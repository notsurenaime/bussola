import type Stripe from "stripe";
import { jsonError, jsonOk } from "@/lib/api";
import {
  BillingUnavailableError,
  getStripe,
  webhookSecret,
} from "@/lib/billing/stripe";
import {
  applySubscription,
  claimEvent,
  organizationForCustomer,
  organizationForStoredCustomer,
  releaseEvent,
} from "@/lib/billing/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED = new Set<Stripe.Event.Type>([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "checkout.session.completed",
]);

/**
 * Which organization an event belongs to.
 *
 * Metadata we set ourselves is preferred; the stored customer id is the
 * fallback for a subscription created outside our checkout flow. Nothing here
 * trusts a value that arrives in the request body without Stripe having
 * signed it.
 */
async function resolveOrganization(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.organizationId;
  if (fromMetadata) return fromMetadata;

  const fromCustomer = await organizationForCustomer(
    stripe,
    subscription.customer,
  );
  if (fromCustomer) return fromCustomer;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  return organizationForStoredCustomer(customerId);
}

export async function POST(request: Request) {
  let stripe: Stripe;
  let secret: string;
  try {
    stripe = getStripe();
    secret = webhookSecret();
  } catch (error) {
    if (error instanceof BillingUnavailableError) {
      return jsonError("Billing is not enabled on this deployment", 404);
    }
    throw error;
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return jsonError("Missing signature", 400);

  // Signature verification needs the exact bytes Stripe signed.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      secret,
    );
  } catch {
    // Never echo the reason: this endpoint is public.
    return jsonError("Invalid signature", 400);
  }

  if (!HANDLED.has(event.type)) {
    // Acknowledge so Stripe stops retrying something we do not act on.
    return jsonOk({ received: true, handled: false });
  }

  if (!(await claimEvent(event.id, event.type))) {
    return jsonOk({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const organizationId = await resolveOrganization(stripe, subscription);
        if (!organizationId) {
          // Nothing to attach it to; acknowledging avoids an endless retry.
          return jsonOk({ received: true, orphaned: true });
        }
        await applySubscription(subscription, organizationId);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object;
        if (!session.subscription) break;

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const organizationId =
          session.metadata?.organizationId ??
          (await resolveOrganization(stripe, subscription));

        if (organizationId) {
          await applySubscription(subscription, organizationId);
        }
        break;
      }
    }
  } catch (error) {
    console.error(`[billing] failed to apply ${event.type}:`, error);
    // 500 makes Stripe retry; the event id stays claimed, so release it first.
    await releaseEvent(event.id);
    return jsonError("Failed to process event", 500);
  }

  return jsonOk({ received: true });
}
