import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { billingEvents, subscriptions } from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { planForPriceId } from "./plans";

/**
 * Stripe moved `current_period_end` from the subscription onto its items.
 * Read whichever this API version provides rather than pinning to one shape.
 */
function periodEnd(subscription: Stripe.Subscription): Date | null {
  const fromItem = subscription.items?.data?.[0]?.current_period_end;
  const fromSubscription = (
    subscription as unknown as { current_period_end?: number }
  ).current_period_end;
  const seconds = fromItem ?? fromSubscription;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

function priceId(subscription: Stripe.Subscription): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

function customerId(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

/**
 * Write a Stripe subscription into our table.
 *
 * The organization is taken from the customer's metadata, which we set when
 * creating it — never from anything the caller supplies, so a forged webhook
 * body cannot move a subscription onto someone else's organization.
 */
export async function applySubscription(
  subscription: Stripe.Subscription,
  organizationId: string,
): Promise<void> {
  const db = await getDb();
  const now = new Date();

  const values = {
    stripeCustomerId: customerId(subscription),
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId(subscription),
    plan: planForPriceId(priceId(subscription)),
    status: subscription.status,
    currentPeriodEnd: periodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    updatedAt: now,
  };

  await db
    .insert(subscriptions)
    .values({ id: createId("sub"), organizationId, ...values })
    .onConflictDoUpdate({
      target: subscriptions.organizationId,
      set: values,
    });
}

/** The organization a Stripe customer belongs to, from its metadata. */
export async function organizationForCustomer(
  stripe: Stripe,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): Promise<string | null> {
  const id = typeof customer === "string" ? customer : customer.id;
  const record = await stripe.customers.retrieve(id);
  if (record.deleted) return null;
  return record.metadata?.organizationId || null;
}

/**
 * Record that an event has been applied.
 *
 * Returns false when it was already recorded — Stripe retries on any non-2xx
 * and may deliver an event twice, and applying a plan change twice is worse
 * than skipping it.
 */
export async function claimEvent(
  eventId: string,
  type: string,
): Promise<boolean> {
  const db = await getDb();
  const inserted = await db
    .insert(billingEvents)
    .values({ id: eventId, type })
    .onConflictDoNothing()
    .returning({ id: billingEvents.id });
  return inserted.length > 0;
}

/** Look up which organization a stored customer id belongs to. */
export async function organizationForStoredCustomer(
  stripeCustomerId: string,
): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ organizationId: subscriptions.organizationId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return row?.organizationId ?? null;
}

/**
 * The Stripe customer for an organization, created on first use.
 *
 * The organization id goes into the customer's metadata, which is what every
 * webhook later reads to decide whose subscription an event belongs to.
 */
export async function ensureCustomer(
  stripe: Stripe,
  input: { organizationId: string; email: string; name?: string },
): Promise<string> {
  const db = await getDb();
  const [existing] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, input.organizationId))
    .limit(1);

  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name,
    metadata: { organizationId: input.organizationId },
  });

  await db
    .insert(subscriptions)
    .values({
      id: createId("sub"),
      organizationId: input.organizationId,
      stripeCustomerId: customer.id,
      plan: "free",
      status: "none",
    })
    .onConflictDoUpdate({
      target: subscriptions.organizationId,
      set: { stripeCustomerId: customer.id, updatedAt: new Date() },
    });

  return customer.id;
}

/**
 * Undo an event claim so Stripe's retry can apply it again.
 *
 * Called when applying the event failed after it was claimed — without this
 * the retry would be treated as a duplicate and the change lost for good.
 */
export async function releaseEvent(eventId: string): Promise<void> {
  const db = await getDb();
  await db.delete(billingEvents).where(eq(billingEvents.id, eventId));
}
