import type { Provider } from "@/lib/db/schema";

export type ConnectionCredentials = {
  apiKey?: string;
  login?: string;
  secretKey?: string;
  accessToken?: string;
  refreshToken?: string;
  orgSlug?: string;
};

export type TestResult = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};

export type TrackerPoint = {
  key?: string;
  color: string;
  tooltip: string;
  status: "ok" | "warn" | "error" | "idle";
};

export type StatusItem = {
  id: string;
  name: string;
  provider: Provider;
  status: "ok" | "warn" | "error" | "idle";
  detail: string;
  updatedAt?: string;
};

export type BalanceInfo = {
  currency: string;
  balance: number;
  accountName: string;
  authorizedBalance?: number;
  main?: boolean;
  sharePct?: number;
};

export type TransactionItem = {
  id: string;
  label: string;
  amount: number;
  currency: string;
  side: "credit" | "debit";
  settledAt: string;
  status?: "pending" | "completed" | "declined" | "reversed";
  accountName?: string;
};

export type CashflowPeriod = {
  currency: string;
  inflow: number;
  outflow: number;
  net: number;
  days: number;
  transactionCount: number;
};

export type LiquidityInfo = {
  currency: string;
  booked: number;
  available: number;
  pendingDelta: number;
  accountCount: number;
};

export type BalanceHistoryPoint = {
  date: string;
  label: string;
  balance: number;
};

export type BalanceHistory = {
  currency: string;
  days: number;
  points: BalanceHistoryPoint[];
  /** True when transaction pagination may have truncated the window. */
  incomplete: boolean;
};

export type QontoDashboard = {
  organizationName?: string;
  balances: BalanceInfo[];
  liquidity: LiquidityInfo;
  cashflow30d: CashflowPeriod;
  balanceHistory: BalanceHistory;
};

export type QontoTransactionsPage = {
  transactions: TransactionItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type RailwayDeployItem = {
  id: string;
  serviceId: string;
  serviceName: string;
  projectName: string;
  status: TrackerPoint["status"];
  rawStatus: string;
  createdAt: string;
  label?: string;
  commitHash?: string;
  branch?: string;
  stage?: string;
};

/** One failed/in-flight attempt sitting above the live deploy. */
export type RailwayDeployAttempt = {
  id: string;
  createdAt: string;
  rawStatus: string;
  /** Where it broke or currently is (Build, Deploy, Runtime, …). */
  stage: string;
  /** Commit message or short fallback label. */
  label: string;
  commitHash?: string;
  branch?: string;
};

/**
 * “How far behind is the live deploy?” — active health plus newer failed attempts.
 */
export type RailwayDeployHealth = {
  serviceId: string;
  serviceName: string;
  projectName: string;
  /** What’s currently serving traffic. */
  active: {
    status: "healthy" | "crashed" | "sleeping" | "unknown";
    createdAt?: string;
    label?: string;
    commitHash?: string;
    rawStatus?: string;
  };
  /** Failed deploys newer than the live one. */
  behindCount: number;
  failedSinceActive: RailwayDeployAttempt[];
  /** Newest in-progress deploy, if any. */
  inFlight: RailwayDeployAttempt | null;
};

export type RailwayFleetHealth = {
  healthy: number;
  total: number;
  crashed: number;
  sleeping: number;
  degraded: number;
};

export type RailwayResourceSnapshot = {
  cpuCores: number | null;
  memoryGb: number | null;
  sampledServices: number;
  label: string;
};

export type RailwayUsageItem = {
  measurement: string;
  label: string;
  value: number;
  display: string;
};

export type RailwayDashboard = {
  items: StatusItem[];
  trackers: Record<string, TrackerPoint[]>;
  /** Worst / most relevant service for the Deploy Health card. */
  deployHealth: RailwayDeployHealth | null;
  fleet: RailwayFleetHealth;
  recentDeploys: RailwayDeployItem[];
  resources: RailwayResourceSnapshot;
  usage: RailwayUsageItem[];
};

export type SupabaseServiceItem = {
  id: string;
  projectName: string;
  serviceName: string;
  status: TrackerPoint["status"];
  detail: string;
  healthy: boolean;
};

export type SupabaseTrafficBucket = {
  label: string;
  value: number;
  display: string;
};

export type SupabaseAdvisorsSummary = {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  projectCount: number;
  top?: Array<{ title: string; level: string; projectName: string }>;
};

export type SupabaseDashboard = {
  items: StatusItem[];
  healthy: number;
  total: number;
  services: SupabaseServiceItem[];
  traffic: SupabaseTrafficBucket[];
  requestVolume: {
    total: number;
    days: number;
    label: string;
  };
  advisors: SupabaseAdvisorsSummary;
};

export type NetlifyDeployItem = {
  id: string;
  siteId: string;
  siteName: string;
  status: TrackerPoint["status"];
  rawState: string;
  branch?: string;
  createdAt: string;
};

export type NetlifyBuildMinutes = {
  current: number;
  previous: number;
  deltaPct: number | null;
  active: number;
  enqueued: number;
  label: string;
};

export type NetlifyFormItem = {
  id: string;
  name: string;
  siteName: string;
  submissionCount: number;
};

export type NetlifyDashboard = {
  items: StatusItem[];
  trackers: Record<string, TrackerPoint[]>;
  healthy: number;
  total: number;
  recentDeploys: NetlifyDeployItem[];
  buildMinutes: NetlifyBuildMinutes | null;
  forms: NetlifyFormItem[];
  formSubmissionsTotal: number;
};

export interface Connector {
  provider: Provider;
  test(credentials: ConnectionCredentials): Promise<TestResult>;
}
