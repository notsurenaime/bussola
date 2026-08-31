import type {
  ConnectionCredentials,
  Connector,
  ResendDashboard,
  ResendDomainItem,
  ResendEmailItem,
  TestResult,
  TrackerPoint,
} from "./types";
import { toUserFacingError } from "./errors";
import { fetchJson } from "./http";

const BASE = "https://api.resend.com";
const RECENT_EMAILS = 25;

async function resendFetch<T>(key: string, path: string): Promise<T> {
  return fetchJson<T>(
    `${BASE}${path}`,
    { headers: { Authorization: `Bearer ${key}` } },
    { label: "Resend" },
  );
}

type ResendDomain = {
  id: string;
  name: string;
  status?: string;
  region?: string;
  created_at?: string;
};

type ResendEmail = {
  id: string;
  to?: string[] | string;
  subject?: string;
  last_event?: string;
  created_at?: string;
};

/**
 * A domain that is not verified cannot send, so it is the one thing worth
 * surfacing loudly — "verified" is the whole point of the widget.
 */
export function domainStatus(status?: string): TrackerPoint["status"] {
  switch (status) {
    case "verified":
      return "ok";
    case "pending":
    case "temporary_failure":
      return "warn";
    case "failed":
    case "not_started":
      return "error";
    default:
      return "idle";
  }
}

export function domainStatusLabel(status?: string): string {
  if (!status) return "Unknown";
  return status.replace(/_/g, " ");
}

function recipient(to: ResendEmail["to"]): string {
  if (Array.isArray(to)) return to[0] ?? "—";
  return to || "—";
}

export const resendConnector: Connector = {
  provider: "resend",
  async test(credentials: ConnectionCredentials): Promise<TestResult> {
    const key = credentials.apiKey?.trim();
    if (!key) return { ok: false, message: "API key is required" };

    try {
      const domains = await resendFetch<{ data?: ResendDomain[] }>(
        key,
        "/domains",
      );
      const count = domains.data?.length ?? 0;
      return {
        ok: true,
        message:
          count > 0
            ? `Connected to Resend (${count} domain${count === 1 ? "" : "s"})`
            : "Connected to Resend — no domains yet",
      };
    } catch (error) {
      return { ok: false, message: toUserFacingError(error, "resend") };
    }
  },
};

export async function fetchResendDashboard(
  credentials: ConnectionCredentials,
): Promise<ResendDashboard> {
  const key = credentials.apiKey?.trim();
  if (!key) throw new Error("Resend API key is required");

  const domainsResponse = await resendFetch<{ data?: ResendDomain[] }>(
    key,
    "/domains",
  );

  /*
   * Listing sent emails needs a key with broader access than a send-only one,
   * and not every account exposes it. Treat it as optional: losing the email
   * list should not take the domain widgets down with it.
   */
  let emails: ResendEmailItem[] = [];
  let emailsUnavailable = false;
  try {
    const response = await resendFetch<{ data?: ResendEmail[] }>(
      key,
      `/emails?limit=${RECENT_EMAILS}`,
    );
    emails = (response.data ?? []).map((email) => ({
      id: email.id,
      to: recipient(email.to),
      subject: email.subject || "(no subject)",
      status: email.last_event || "sent",
      sentAt: email.created_at || new Date().toISOString(),
    }));
  } catch {
    emailsUnavailable = true;
  }

  const domains: ResendDomainItem[] = (domainsResponse.data ?? []).map(
    (domain) => ({
      id: domain.id,
      name: domain.name,
      status: domainStatus(domain.status),
      rawStatus: domainStatusLabel(domain.status),
      region: domain.region,
      createdAt: domain.created_at,
    }),
  );

  return {
    domains,
    verified: domains.filter((domain) => domain.status === "ok").length,
    total: domains.length,
    emails,
    emailsUnavailable,
  };
}
