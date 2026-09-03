import type { AlertState, NotificationChannelKind } from "@/lib/db/schema";
import { sendEmail } from "@/lib/notify/email";

/**
 * Getting one alert to one channel.
 *
 * Every channel returns the same result shape, and a failure is recorded
 * rather than thrown: one dead Slack webhook must not stop the email going
 * out, and it must not stop the alert being recorded in the app either. The
 * in-app feed is the delivery of last resort — it always happens, whatever the
 * channels do.
 */

export type DeliveryTarget = {
  id: string;
  kind: NotificationChannelKind;
  label: string;
  /** Decrypted at the call site; never stored or logged in the clear. */
  target: string;
};

export type Delivery = {
  channelId: string;
  kind: NotificationChannelKind;
  ok: boolean;
  error?: string;
};

export type AlertNotification = {
  state: AlertState;
  /** e.g. "Railway · production" */
  source: string;
  /** The one-sentence verdict from `evaluateRule`. */
  message: string;
  /** Absolute URL back into the app, when the caller knows one. */
  url?: string;
};

const TIMEOUT_MS = 10_000;

export async function deliver(
  channel: DeliveryTarget,
  notification: AlertNotification,
): Promise<Delivery> {
  const base = { channelId: channel.id, kind: channel.kind };

  try {
    switch (channel.kind) {
      case "email": {
        const result = await sendEmail({
          to: channel.target,
          subject: subjectFor(notification),
          text: plainTextFor(notification),
        });
        return result.ok
          ? { ...base, ok: true }
          : { ...base, ok: false, error: result.error };
      }

      case "slack":
        return { ...base, ...(await postWebhook(channel.target, slackBody(notification))) };

      case "discord":
        return {
          ...base,
          ...(await postWebhook(channel.target, discordBody(notification))),
        };

      default: {
        const _exhaustive: never = channel.kind;
        return { ...base, ok: false, error: `Unknown channel: ${_exhaustive}` };
      }
    }
  } catch (error) {
    return {
      ...base,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const RECOVERED = "Recovered";
const TRIGGERED = "Alert";

function subjectFor(notification: AlertNotification): string {
  const prefix = notification.state === "breached" ? TRIGGERED : RECOVERED;
  return `[Bussola] ${prefix}: ${notification.source}`;
}

function plainTextFor(notification: AlertNotification): string {
  const lines = [notification.message, "", `Source: ${notification.source}`];
  if (notification.url) lines.push(`Open: ${notification.url}`);
  lines.push("", "You are receiving this because a Bussola alert rule matched.");
  return lines.join("\n");
}

/**
 * Slack's incoming-webhook shape.
 *
 * `text` is set as well as `blocks` on purpose: it is what a notification
 * preview and a screen reader use, and a blocks-only message shows as "This
 * content can't be displayed" in both.
 */
function slackBody(notification: AlertNotification) {
  const emoji = notification.state === "breached" ? "🔴" : "🟢";
  const heading = `${emoji} *${
    notification.state === "breached" ? TRIGGERED : RECOVERED
  }* · ${notification.source}`;

  return {
    text: `${notification.state === "breached" ? TRIGGERED : RECOVERED}: ${notification.message}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `${heading}\n${notification.message}` },
      },
      ...(notification.url
        ? [
            {
              type: "context",
              elements: [
                { type: "mrkdwn", text: `<${notification.url}|Open in Bussola>` },
              ],
            },
          ]
        : []),
    ],
  };
}

function discordBody(notification: AlertNotification) {
  const breached = notification.state === "breached";
  return {
    // Discord shows this above the embed and uses it for the push preview.
    content: `${breached ? "🔴" : "🟢"} ${notification.message}`,
    embeds: [
      {
        title: `${breached ? TRIGGERED : RECOVERED} · ${notification.source}`,
        description: notification.message,
        // Discord wants a decimal int, not a CSS hex string.
        color: breached ? 0xdc2626 : 0x16a34a,
        url: notification.url,
      },
    ],
  };
}

async function postWebhook(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.ok) return { ok: true };

  // Both services explain a revoked or deleted webhook in the body, and that
  // sentence is the whole difference between "delivery failed" and "recreate
  // this webhook".
  const text = await response.text().catch(() => "");
  return {
    ok: false,
    error: `Webhook returned ${response.status}. ${text.slice(0, 200)}`.trim(),
  };
}

/**
 * Whether a URL is plausibly the webhook it claims to be.
 *
 * Checked when a channel is saved, not when it fires: a typo caught at save
 * time is a form error, while the same typo caught at fire time is a missed
 * alert. Host-locked because these fields take a URL that Bussola will POST
 * to — accepting an arbitrary host would turn the alert engine into a request
 * forwarder pointed wherever a tenant likes.
 */
export function validateChannelTarget(
  kind: NotificationChannelKind,
  target: string,
): { ok: true } | { ok: false; error: string } {
  const value = target.trim();
  if (!value) return { ok: false, error: "This cannot be empty." };

  if (kind === "email") {
    // Deliberately loose: the authoritative check is whether it delivers.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? { ok: true }
      : { ok: false, error: "That does not look like an email address." };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "That is not a valid URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "A webhook URL must use https." };
  }

  if (kind === "slack" && url.hostname !== "hooks.slack.com") {
    return {
      ok: false,
      error: "A Slack webhook URL starts with https://hooks.slack.com/services/",
    };
  }

  if (
    kind === "discord" &&
    !["discord.com", "discordapp.com"].includes(url.hostname)
  ) {
    return {
      ok: false,
      error: "A Discord webhook URL starts with https://discord.com/api/webhooks/",
    };
  }

  return { ok: true };
}
