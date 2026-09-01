import type { CredentialField, Provider } from "@/lib/providers";

/**
 * Everything the UI needs to describe a source in one place.
 *
 * Names, credential fields and setup hints used to live in the connections
 * page while titles lived in the icon component, which meant adding a
 * connector touched both and they could drift. This is the single description
 * of a provider; the connector modules stay purely about fetching.
 */
export type ProviderCatalogEntry = {
  provider: Provider;
  name: string;
  /** One line: what connecting this actually gets you. */
  tagline: string;
  fields: CredentialField[];
  /** How to obtain the credential, in the provider's own words. */
  hint: string;
  /** Where to create the token. */
  docsUrl?: string;
  /** Label for the scope field, when the provider needs one. */
  orgSlugLabel?: string;
  /** Shown on a coming-soon card. */
  soonNote?: string;
};

export const PROVIDER_CATALOG: Record<Provider, ProviderCatalogEntry> = {
  railway: {
    provider: "railway",
    name: "Railway",
    tagline: "Deploy health, crashed services, CPU and memory, billing usage",
    fields: ["apiKey"],
    hint: "An account token, or a project token from project settings — both work.",
    docsUrl: "https://railway.com/account/tokens",
  },
  vercel: {
    provider: "vercel",
    name: "Vercel",
    tagline: "Deploy status and history for every project",
    fields: ["apiKey", "orgSlug"],
    hint: "An access token from your account settings. For a team account, add the team id too.",
    docsUrl: "https://vercel.com/account/tokens",
    orgSlugLabel: "Team ID (optional)",
  },
  netlify: {
    provider: "netlify",
    name: "Netlify",
    tagline: "Site publish status, build minutes, form submissions",
    fields: ["apiKey"],
    hint: "A personal access token from your Netlify user settings.",
    docsUrl:
      "https://app.netlify.com/user/applications#personal-access-tokens",
  },
  supabase: {
    provider: "supabase",
    name: "Supabase",
    tagline: "Project and service health, API traffic, security advisors",
    fields: ["apiKey"],
    hint: "A personal access token starting with sbp_ — not a project anon or service key.",
    docsUrl: "https://supabase.com/dashboard/account/tokens",
  },
  sentry: {
    provider: "sentry",
    name: "Sentry",
    tagline: "Unresolved issues, error volume, which projects are reporting",
    fields: ["apiKey", "orgSlug"],
    hint: "An auth token with org:read and project:read. The organization is detected if you leave it blank.",
    docsUrl: "https://sentry.io/settings/account/api/auth-tokens/",
    orgSlugLabel: "Organization slug (optional)",
  },
  stripe: {
    provider: "stripe",
    name: "Stripe",
    tagline: "MRR, revenue, recent payments and payouts",
    fields: ["apiKey"],
    hint: "A restricted key with read access to Charges, Subscriptions and Balance. Never your live secret key.",
    docsUrl: "https://dashboard.stripe.com/apikeys",
  },
  lemonsqueezy: {
    provider: "lemonsqueezy",
    name: "Lemon Squeezy",
    tagline: "Recurring revenue, store revenue, recent orders",
    fields: ["apiKey"],
    hint: "An API key from Settings → API in your Lemon Squeezy dashboard.",
    docsUrl: "https://app.lemonsqueezy.com/settings/api",
  },
  resend: {
    provider: "resend",
    name: "Resend",
    tagline: "Sending domain verification and recent delivery status",
    fields: ["apiKey"],
    hint: "An API key from resend.com. Full access is needed to list sent emails; a sending key still shows domains.",
    docsUrl: "https://resend.com/api-keys",
  },
  qonto: {
    provider: "qonto",
    name: "Qonto",
    tagline: "Cash balance, liquidity, 30-day cashflow, transactions",
    fields: ["apiKey", "login", "secretKey"],
    hint: "From Integrations → API key: paste login:secret as one value, or fill the two fields separately.",
    docsUrl: "https://app.qonto.com/settings/integrations",
  },

  github: {
    provider: "github",
    name: "GitHub",
    tagline: "Open pull requests, CI status, release cadence",
    fields: ["apiKey"],
    hint: "",
    soonNote: "Needs an OAuth app",
  },
  gitlab: {
    provider: "gitlab",
    name: "GitLab",
    tagline: "Pipelines, merge requests, release cadence",
    fields: ["apiKey"],
    hint: "",
    soonNote: "Needs an OAuth app",
  },
  linear: {
    provider: "linear",
    name: "Linear",
    tagline: "Cycle progress and open issues",
    fields: ["apiKey"],
    hint: "",
    soonNote: "Needs an OAuth app",
  },
  notion: {
    provider: "notion",
    name: "Notion",
    tagline: "Docs and database rollups",
    fields: ["apiKey"],
    hint: "",
    soonNote: "Needs an OAuth app",
  },
  polar: {
    provider: "polar",
    name: "Polar",
    tagline: "Subscriptions and revenue",
    fields: ["apiKey"],
    hint: "",
    soonNote: "Planned",
  },
  attio: {
    provider: "attio",
    name: "Attio",
    tagline: "Pipeline and CRM activity",
    fields: ["apiKey"],
    hint: "",
    soonNote: "Planned",
  },
  webtraffic: {
    provider: "webtraffic",
    name: "Web traffic",
    tagline: "Page views and unique visitors, cookieless",
    fields: ["apiKey"],
    hint: "",
    soonNote: "Planned",
  },
};

export function catalogEntry(provider: Provider): ProviderCatalogEntry {
  return PROVIDER_CATALOG[provider];
}
