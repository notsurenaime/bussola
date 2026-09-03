import type { Provider } from "@/lib/db/schema";

export type WidgetType =
  | "railway-tracker"
  | "railway-services"
  | "railway-fleet"
  | "railway-resources"
  | "railway-usage"
  | "railway-deploys"
  | "railway-projects"
  | "railway-billing"
  | "railway-cpu"
  | "railway-memory"
  | "railway-egress"
  | "railway-disk"
  | "netlify-tracker"
  | "netlify-sites"
  | "netlify-health"
  | "netlify-deploys"
  | "netlify-builds"
  | "netlify-forms"
  | "supabase-health"
  | "supabase-projects"
  | "supabase-services"
  | "supabase-traffic"
  | "supabase-requests"
  | "supabase-advisors"
  | "supabase-advisor-issues"
  | "qonto-balance"
  | "qonto-transactions"
  | "qonto-cashflow"
  | "qonto-in-out"
  | "qonto-liquidity"
  | "qonto-accounts"
  | "qonto-history"
  | "stripe-mrr"
  | "stripe-revenue"
  | "stripe-payments"
  | "lemonsqueezy-mrr"
  | "lemonsqueezy-revenue"
  | "lemonsqueezy-orders"
  | "sentry-issues"
  | "sentry-recent"
  | "sentry-projects"
  | "resend-domains"
  | "resend-emails"
  | "resend-broadcasts"
  | "resend-delivery"
  | "resend-open-rate"
  | "resend-click-rate"
  | "resend-outcomes"
  | "vercel-tracker"
  | "vercel-projects"
  | "vercel-deploys"
  | "status-board";

export type WidgetDefinition = {
  type: WidgetType;
  name: string;
  description: string;
  provider: Provider | "multi";
  /**
   * Where this data lives in the source's own product — opened from a link in
   * the widget header. Cross-source widgets have no single origin page, so it
   * stays optional.
   */
  sourceUrl?: string;
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
};

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    type: "railway-services",
    name: "Service Status",
    description: "Latest deploy status for every Railway service",
    provider: "railway",
    sourceUrl: "https://railway.com/dashboard",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: "railway-tracker",
    name: "Deploy Health",
    description: "Live deploy status and how many newer deploys failed",
    provider: "railway",
    sourceUrl: "https://railway.com/dashboard",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "railway-fleet",
    name: "Fleet Health",
    description: "How many Railway services are running healthy",
    provider: "railway",
    sourceUrl: "https://railway.com/dashboard",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "railway-resources",
    name: "CPU & Memory",
    description: "Average CPU and memory over the last hour",
    provider: "railway",
    sourceUrl: "https://railway.com/dashboard",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "railway-usage",
    name: "Usage This Cycle",
    description: "Estimated Railway usage for the current billing cycle",
    provider: "railway",
    sourceUrl: "https://railway.com/account/usage",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "railway-deploys",
    name: "Recent Deploys",
    description: "Latest deployments across Railway services",
    provider: "railway",
    sourceUrl: "https://railway.com/dashboard",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    type: "railway-projects",
    name: "Projects",
    description: "Every Railway project, its services and whether any are failing",
    provider: "railway",
    sourceUrl: "https://railway.com/dashboard",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: "railway-billing",
    name: "Usage & Bill",
    description: "Cycle-to-date spend, projected bill and the billing period",
    provider: "railway",
    sourceUrl: "https://railway.com/account/usage",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "railway-cpu",
    name: "CPU Usage",
    description: "vCPU used across a project over the last 24 hours",
    provider: "railway",
    sourceUrl: "https://railway.com/dashboard",
    defaultW: 5,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "railway-memory",
    name: "Memory Usage",
    description: "Memory used across a project over the last 24 hours",
    provider: "railway",
    sourceUrl: "https://railway.com/dashboard",
    defaultW: 5,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "railway-egress",
    name: "Network Egress",
    description: "Outbound traffic per interval over the last 24 hours",
    provider: "railway",
    sourceUrl: "https://railway.com/dashboard",
    defaultW: 5,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "railway-disk",
    name: "Disk Usage",
    description: "Volume storage used across a project over the last 24 hours",
    provider: "railway",
    sourceUrl: "https://railway.com/dashboard",
    defaultW: 5,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "netlify-tracker",
    name: "Deploy Health",
    description: "Recent deploy trail for a Netlify site",
    provider: "netlify",
    sourceUrl: "https://app.netlify.com/",
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "netlify-sites",
    name: "Sites Board",
    description: "Publish status for every Netlify site",
    provider: "netlify",
    sourceUrl: "https://app.netlify.com/",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: "netlify-health",
    name: "Sites Health",
    description: "Ready vs total Netlify sites",
    provider: "netlify",
    sourceUrl: "https://app.netlify.com/",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "netlify-deploys",
    name: "Recent Deploys",
    description: "Latest deployments across Netlify sites",
    provider: "netlify",
    sourceUrl: "https://app.netlify.com/",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    type: "netlify-builds",
    name: "Build Minutes",
    description: "Build minutes used in the current billing period",
    provider: "netlify",
    sourceUrl: "https://app.netlify.com/",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "netlify-forms",
    name: "Form Submissions",
    description: "Netlify Forms submission counts by form",
    provider: "netlify",
    sourceUrl: "https://app.netlify.com/",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "supabase-health",
    name: "Project Health",
    description: "Healthy vs total Supabase projects",
    provider: "supabase",
    sourceUrl: "https://supabase.com/dashboard/projects",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "supabase-projects",
    name: "Projects Board",
    description: "Status and region for every Supabase project",
    provider: "supabase",
    sourceUrl: "https://supabase.com/dashboard/projects",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: "supabase-services",
    name: "Service Health",
    description: "Database, Auth, Storage, Realtime, Functions health",
    provider: "supabase",
    sourceUrl: "https://supabase.com/dashboard/project/_",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: "supabase-traffic",
    name: "API Traffic",
    description: "REST / Auth / Storage / Realtime requests over 7 days",
    provider: "supabase",
    sourceUrl: "https://supabase.com/dashboard/project/_/reports/api-overview",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "supabase-requests",
    name: "Request Volume",
    description: "Total API requests across projects (7 days)",
    provider: "supabase",
    sourceUrl: "https://supabase.com/dashboard/project/_/reports/api-overview",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "supabase-advisors",
    name: "Security Advisors",
    description: "Open security findings from Supabase advisors",
    provider: "supabase",
    sourceUrl: "https://supabase.com/dashboard/project/_/advisors/security",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "supabase-advisor-issues",
    name: "Advisor Issues",
    description: "Security and performance findings, worst first",
    provider: "supabase",
    sourceUrl: "https://supabase.com/dashboard/project/_/advisors/security",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    type: "qonto-balance",
    name: "Cash Balance",
    description: "Total cash across all Qonto accounts",
    provider: "qonto",
    sourceUrl: "https://app.qonto.com/",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "qonto-liquidity",
    name: "Available Liquidity",
    description: "Spendable balance after pending payments",
    provider: "qonto",
    sourceUrl: "https://app.qonto.com/",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "qonto-cashflow",
    name: "30-Day Net Cashflow",
    description: "Money in minus money out over the last 30 days",
    provider: "qonto",
    sourceUrl: "https://app.qonto.com/",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "qonto-in-out",
    name: "In vs Out",
    description: "Inflow and outflow comparison for the last 30 days",
    provider: "qonto",
    sourceUrl: "https://app.qonto.com/",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "qonto-accounts",
    name: "Accounts Overview",
    description: "Pie split of cash across Qonto accounts",
    provider: "qonto",
    sourceUrl: "https://app.qonto.com/",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
  },
  {
    type: "qonto-history",
    name: "Account History",
    description: "30-day cash balance trail from settled transactions",
    provider: "qonto",
    sourceUrl: "https://app.qonto.com/",
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 2,
  },
  {
    type: "qonto-transactions",
    name: "Recent Transactions",
    description: "Latest bank movements across accounts",
    provider: "qonto",
    sourceUrl: "https://app.qonto.com/",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    type: "status-board",
    name: "Status Board",
    description: "Cross-source status for Railway, Netlify, Supabase",
    provider: "multi",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    type: "stripe-mrr",
    name: "MRR",
    description: "Monthly recurring revenue across active Stripe subscriptions",
    provider: "stripe",
    sourceUrl: "https://dashboard.stripe.com/subscriptions",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "stripe-revenue",
    name: "Revenue (30d)",
    description: "Gross Stripe volume over the last 30 days",
    provider: "stripe",
    sourceUrl: "https://dashboard.stripe.com/dashboard",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "stripe-payments",
    name: "Recent Payments",
    description: "Latest Stripe charges and their outcome",
    provider: "stripe",
    sourceUrl: "https://dashboard.stripe.com/payments",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    type: "lemonsqueezy-mrr",
    name: "MRR",
    description: "Recurring revenue across active Lemon Squeezy subscriptions",
    provider: "lemonsqueezy",
    sourceUrl: "https://app.lemonsqueezy.com/dashboard",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "lemonsqueezy-revenue",
    name: "Revenue (30d)",
    description: "Lemon Squeezy store revenue over the last 30 days",
    provider: "lemonsqueezy",
    sourceUrl: "https://app.lemonsqueezy.com/dashboard",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "lemonsqueezy-orders",
    name: "Recent Orders",
    description: "Latest Lemon Squeezy orders",
    provider: "lemonsqueezy",
    sourceUrl: "https://app.lemonsqueezy.com/orders",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    type: "sentry-issues",
    name: "Unresolved Issues",
    description: "Open Sentry issues and events in the last 24 hours",
    provider: "sentry",
    sourceUrl: "https://sentry.io/issues/",
    defaultW: 3,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    type: "sentry-recent",
    name: "Recent Errors",
    description: "Newest unresolved Sentry issues",
    provider: "sentry",
    sourceUrl: "https://sentry.io/issues/",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    type: "sentry-projects",
    name: "Projects Board",
    description: "Sentry projects and whether they are reporting",
    provider: "sentry",
    sourceUrl: "https://sentry.io/projects/",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: "resend-domains",
    name: "Sending Domains",
    description: "Resend domain verification status",
    provider: "resend",
    sourceUrl: "https://resend.com/domains",
    defaultW: 5,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "resend-emails",
    name: "Recent Emails",
    description: "Latest emails sent through Resend and how each landed",
    provider: "resend",
    sourceUrl: "https://resend.com/emails",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    type: "resend-broadcasts",
    name: "Broadcasts",
    description: "Broadcast campaigns and where each one stands",
    provider: "resend",
    sourceUrl: "https://resend.com/broadcasts",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: "resend-delivery",
    name: "Emails & Deliverability",
    description: "Daily send volume against the share that was delivered",
    provider: "resend",
    sourceUrl: "https://resend.com/overview",
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 3,
  },
  {
    type: "resend-open-rate",
    name: "Open Rate",
    description: "Share of delivered emails opened, day by day",
    provider: "resend",
    sourceUrl: "https://resend.com/overview",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
  },
  {
    type: "resend-click-rate",
    name: "Click Rate",
    description: "Share of delivered emails clicked, day by day",
    provider: "resend",
    sourceUrl: "https://resend.com/overview",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
  },
  {
    type: "resend-outcomes",
    name: "Email Outcomes",
    description: "Where emails ended up — each counted at its furthest step",
    provider: "resend",
    sourceUrl: "https://resend.com/overview",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
  },
  {
    type: "vercel-tracker",
    name: "Deploy Health",
    description: "Recent Vercel deploy trail per project",
    provider: "vercel",
    sourceUrl: "https://vercel.com/dashboard",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: "vercel-projects",
    name: "Projects Board",
    description: "Latest deploy state for every Vercel project",
    provider: "vercel",
    sourceUrl: "https://vercel.com/dashboard",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: "vercel-deploys",
    name: "Recent Deploys",
    description: "Vercel deployment feed",
    provider: "vercel",
    sourceUrl: "https://vercel.com/dashboard",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
];

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find((w) => w.type === type);
}

export function isQontoWidget(type: WidgetType): boolean {
  return (
    type === "qonto-balance" ||
    type === "qonto-transactions" ||
    type === "qonto-cashflow" ||
    type === "qonto-in-out" ||
    type === "qonto-liquidity" ||
    type === "qonto-accounts" ||
    type === "qonto-history"
  );
}

export function isRailwayWidget(type: WidgetType): boolean {
  return (
    type === "railway-tracker" ||
    type === "railway-services" ||
    type === "railway-fleet" ||
    type === "railway-resources" ||
    type === "railway-usage" ||
    type === "railway-deploys" ||
    type === "railway-projects" ||
    type === "railway-billing" ||
    type === "railway-cpu" ||
    type === "railway-memory" ||
    type === "railway-egress" ||
    type === "railway-disk"
  );
}

export function isSupabaseWidget(type: WidgetType): boolean {
  return (
    type === "supabase-health" ||
    type === "supabase-projects" ||
    type === "supabase-services" ||
    type === "supabase-traffic" ||
    type === "supabase-requests" ||
    type === "supabase-advisors" ||
    type === "supabase-advisor-issues"
  );
}

export function isNetlifyWidget(type: WidgetType): boolean {
  return (
    type === "netlify-tracker" ||
    type === "netlify-sites" ||
    type === "netlify-health" ||
    type === "netlify-deploys" ||
    type === "netlify-builds" ||
    type === "netlify-forms"
  );
}

export function isStripeWidget(type: WidgetType): boolean {
  return type.startsWith("stripe-");
}

export function isLemonSqueezyWidget(type: WidgetType): boolean {
  return type.startsWith("lemonsqueezy-");
}

export function isSentryWidget(type: WidgetType): boolean {
  return type.startsWith("sentry-");
}

export function isResendWidget(type: WidgetType): boolean {
  return type.startsWith("resend-");
}

export function isVercelWidget(type: WidgetType): boolean {
  return type.startsWith("vercel-");
}
