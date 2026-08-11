import type { Provider } from "@/lib/db/schema";

export type WidgetType =
  | "railway-tracker"
  | "railway-services"
  | "railway-fleet"
  | "railway-resources"
  | "railway-usage"
  | "railway-deploys"
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
  | "qonto-balance"
  | "qonto-transactions"
  | "qonto-cashflow"
  | "qonto-in-out"
  | "qonto-liquidity"
  | "qonto-accounts"
  | "qonto-history"
  | "status-board";

export type WidgetDefinition = {
  type: WidgetType;
  name: string;
  description: string;
  provider: Provider | "multi";
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
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    type: "netlify-tracker",
    name: "Deploy Health",
    description: "Recent deploy trail for a Netlify site",
    provider: "netlify",
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
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: "qonto-balance",
    name: "Cash Balance",
    description: "Total cash across all Qonto accounts",
    provider: "qonto",
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
    type === "railway-deploys"
  );
}

export function isSupabaseWidget(type: WidgetType): boolean {
  return (
    type === "supabase-health" ||
    type === "supabase-projects" ||
    type === "supabase-services" ||
    type === "supabase-traffic" ||
    type === "supabase-requests" ||
    type === "supabase-advisors"
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
