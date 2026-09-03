import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { PlanId } from "@/lib/billing/plans";
import type { ConnectionStatus, Provider } from "@/lib/providers";

/** Where an alert can be delivered. Which of these a plan allows is in `lib/billing/plans`. */
export type NotificationChannelKind = "email" | "slack" | "discord";

export type AlertComparator = "above" | "below" | "equals" | "not_equals";

export type AlertState = "ok" | "breached";

export type ApiTokenScope = "read" | "write";

/** Where a queued notification is in its life. */
export type AlertDeliveryStatus = "pending" | "sent" | "failed";

/* ───────────────────────── Identity (owned by Better Auth) ─────────────────
 *
 * These seven tables match the shape Better Auth expects for email/password
 * auth plus the organization plugin. Do not hand-edit their columns: change the
 * auth configuration in `lib/auth`, then regenerate and review the migration.
 * ------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The organization this session is acting in — the tenant. */
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [
    index("session_user_idx").on(table.userId),
    index("session_expires_idx").on(table.expiresAt),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("account_user_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/** The tenant boundary. One row per self-hosted install, one per customer. */
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("member_org_user_key").on(table.organizationId, table.userId),
    index("member_user_idx").on(table.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("invitation_org_idx").on(table.organizationId)],
);

/* ───────────────────────────── Tenant-owned data ───────────────────────────
 *
 * Every table below carries `organization_id` and is reachable only through the
 * scoped repositories in `lib/db/tenant.ts`.
 * ------------------------------------------------------------------------- */

const orgRef = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

export const dashboards = pgTable(
  "dashboards",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    name: text("name").notNull(),
    starred: boolean("starred").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("dashboards_org_idx").on(table.organizationId)],
);

export const dashboardWidgets = pgTable(
  "dashboard_widgets",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    dashboardId: text("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    widgetType: text("widget_type").notNull(),
    title: text("title"),
    /**
     * Which connection feeds this widget.
     *
     * Null means "whichever connection this organization has for the widget's
     * provider", which is what every widget created before multi-connection
     * support meant. Set explicitly, it pins the widget to one account — the
     * difference between a canvas that breaks when a second Stripe account is
     * added and one that does not. `set null` rather than cascade: deleting a
     * connection should drop the widget back to the default, not silently
     * delete a block off someone's dashboard.
     */
    connectionId: text("connection_id").references(() => connections.id, {
      onDelete: "set null",
    }),
    configJson: text("config_json").notNull().default("{}"),
    layoutX: integer("layout_x").notNull().default(0),
    layoutY: integer("layout_y").notNull().default(0),
    layoutW: integer("layout_w").notNull().default(4),
    layoutH: integer("layout_h").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("widgets_dashboard_idx").on(table.dashboardId),
    index("widgets_org_idx").on(table.organizationId),
    index("widgets_connection_idx").on(table.connectionId),
  ],
);

export const connections = pgTable(
  "connections",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    provider: text("provider").$type<Provider>().notNull(),
    label: text("label").notNull(),
    /** AES-256-GCM payload from `lib/crypto/vault`. Never leaves the server. */
    credentialsEncrypted: text("credentials_encrypted").notNull(),
    status: text("status")
      .$type<ConnectionStatus>()
      .notNull()
      .default("unknown"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastError: text("last_error"),

    /* Background sync state. The worker claims a connection by pushing
     * next_sync_at forward, so two workers never fetch the same one. */
    syncEnabled: boolean("sync_enabled").notNull().default(true),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    /** Drives exponential backoff; reset to 0 on every success. */
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("connections_org_idx").on(table.organizationId),
    index("connections_due_idx").on(table.nextSyncAt),
  ],
);

/**
 * The latest payload the sync worker fetched for a connection.
 *
 * Widget requests read from here and never call a provider, so the number of
 * upstream calls scales with connections rather than with page views.
 */
export const connectionSnapshots = pgTable(
  "connection_snapshots",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    /** Which payload of this connection, e.g. "dashboard". */
    kind: text("kind").notNull(),
    payloadJson: text("payload_json").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("snapshot_connection_kind_key").on(
      table.connectionId,
      table.kind,
    ),
    index("snapshot_org_idx").on(table.organizationId),
  ],
);

export const connectionCache = pgTable(
  "connection_cache",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    cacheKey: text("cache_key").notNull(),
    payloadJson: text("payload_json").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("cache_org_key_key").on(table.organizationId, table.cacheKey),
    index("cache_expires_idx").on(table.expiresAt),
  ],
);

/**
 * Sampled history behind the trend widgets, and the thing the plans sell as
 * "30 days" / "12 months" of history.
 *
 * The worker appends at most one sample per connection per hour: a 60-second
 * sync interval would otherwise write ~43k rows per connection per month for
 * data nobody plots at that resolution. Retention is pruned per organization
 * against its plan.
 */
export const connectionHistory = pgTable(
  "connection_history",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payloadJson: text("payload_json").notNull(),
    /** Truncated to the hour; the unique index is what enforces one per hour. */
    bucket: timestamp("bucket", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("history_conn_kind_bucket_key").on(
      table.connectionId,
      table.kind,
      table.bucket,
    ),
    index("history_org_bucket_idx").on(table.organizationId, table.bucket),
  ],
);

/* ─────────────────────────────── Billing (cloud) ───────────────────────────
 *
 * Only the hosted edition writes here. Self-hosted installs never create a row
 * and never load the Stripe client — `lib/billing/entitlements` grants
 * everything without consulting these tables.
 * ------------------------------------------------------------------------- */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    /** One subscription per organization. */
    organizationId: text("organization_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    /** Our plan id, resolved from the Stripe price. */
    plan: text("plan").$type<PlanId>().notNull().default("trial"),
    /** Seats bought on top of the plan's included allowance. */
    extraSeats: integer("extra_seats").notNull().default(0),
    /** Stripe's subscription status, verbatim. */
    status: text("status").notNull().default("incomplete"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("subscriptions_customer_idx").on(table.stripeCustomerId),
  ],
);

/**
 * Webhook events we have already applied.
 *
 * Stripe retries on any non-2xx and can deliver the same event more than once;
 * the primary key is Stripe's event id, so a replay is a no-op instead of a
 * second plan change.
 */
export const billingEvents = pgTable("billing_events", {
  /** Stripe's event id. */
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ────────────────────────────── Sharing ────────────────────────────────────
 *
 * A read-only view of one dashboard, reachable without an account.
 * ------------------------------------------------------------------------- */

/**
 * A revocable, read-only link to one dashboard.
 *
 * Only the SHA-256 of the token is stored. The plaintext is shown once, at
 * creation, and is unrecoverable afterwards — a leaked database backup then
 * hands out no working links, which is the whole point of a link that needs no
 * password. Revoking is a timestamp rather than a delete so the view counter
 * and the audit trail survive.
 */
export const dashboardShares = pgTable(
  "dashboard_shares",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    dashboardId: text("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    /** SHA-256 of the token. Never the token itself. */
    tokenHash: text("token_hash").notNull().unique(),
    /** First characters of the token, so a link is recognisable in a list. */
    tokenPrefix: text("token_prefix").notNull(),
    label: text("label"),
    /** Hide Bussola's own branding from the shared page. Team and above. */
    whiteLabel: boolean("white_label").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shares_dashboard_idx").on(table.dashboardId),
    index("shares_org_idx").on(table.organizationId),
  ],
);

/* ─────────────────────────────── Alerting ──────────────────────────────────
 *
 * Where a notification goes, when to send one, and what was sent.
 * ------------------------------------------------------------------------- */

export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    kind: text("kind").$type<NotificationChannelKind>().notNull(),
    label: text("label").notNull(),
    /**
     * Where to deliver. AES-256-GCM, same vault as connector credentials: a
     * Slack or Discord webhook URL is a bearer credential — anyone holding it
     * can post into the channel — so it is not stored in the clear.
     */
    targetEncrypted: text("target_encrypted").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastError: text("last_error"),
    lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("channels_org_idx").on(table.organizationId)],
);

/**
 * One condition on one metric of one connection.
 *
 * `lastState` is what makes this an alert rather than a cron job: a rule fires
 * on the transition into breach and again on the return to normal, not on
 * every tick where the condition still holds. `mutedUntil` is the escape hatch
 * for a breach someone already knows about.
 */
export const alertRules = pgTable(
  "alert_rules",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    /** A key from `lib/alerts/metrics`, e.g. "railway.failedDeploys". */
    metric: text("metric").notNull(),
    comparator: text("comparator").$type<AlertComparator>().notNull(),
    threshold: text("threshold").notNull(),
    /** Channel ids, as JSON. Empty means the in-app feed only. */
    channelIdsJson: text("channel_ids_json").notNull().default("[]"),
    enabled: boolean("enabled").notNull().default(true),
    /** Suppress re-notification while a breach persists. */
    cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
    /** "ok" | "breached", or null before the first evaluation. */
    lastState: text("last_state").$type<AlertState>(),
    lastValue: text("last_value"),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    mutedUntil: timestamp("muted_until", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("alert_rules_org_idx").on(table.organizationId),
    index("alert_rules_connection_idx").on(table.connectionId),
  ],
);

/**
 * What actually happened, kept whether or not a channel accepted it.
 *
 * This is the in-app alert feed and the answer to "did it even try to tell
 * me?" — a rule that fired but whose Slack webhook 404s must not look like a
 * rule that never fired.
 */
export const alertEvents = pgTable(
  "alert_events",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    ruleId: text("rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    state: text("state").$type<AlertState>().notNull(),
    value: text("value").notNull(),
    message: text("message").notNull(),
    /** Per-channel delivery outcomes, as JSON. */
    deliveriesJson: text("deliveries_json").notNull().default("[]"),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("alert_events_org_idx").on(table.organizationId, table.createdAt),
    index("alert_events_rule_idx").on(table.ruleId),
  ],
);

/**
 * The outbox for alert notifications.
 *
 * Delivery used to happen inline inside the sync worker, which meant a Slack
 * webhook that hung for its full ten-second timeout delayed the connection's
 * sync and held its lease. Evaluation is cheap and stays inline — it needs the
 * snapshot that was just written — but sending is network work with someone
 * else's latency in it, so it is queued here and drained on its own.
 *
 * A row per (event, channel). Attempts are retried with backoff and eventually
 * abandoned, and the row is kept either way: "we tried four times and Slack
 * kept saying 404" is the answer someone actually needs.
 */
export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    eventId: text("event_id")
      .notNull()
      .references(() => alertEvents.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => notificationChannels.id, { onDelete: "cascade" }),
    /** Rendered at queue time, so a later channel edit cannot rewrite history. */
    payloadJson: text("payload_json").notNull(),
    status: text("status")
      .$type<AlertDeliveryStatus>()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("alert_deliveries_due_idx").on(table.status, table.nextAttemptAt),
    index("alert_deliveries_event_idx").on(table.eventId),
    index("alert_deliveries_org_idx").on(table.organizationId),
  ],
);

/* ──────────────────────────────── API tokens ───────────────────────────────
 *
 * What an MCP client authenticates with.
 * ------------------------------------------------------------------------- */

/**
 * A bearer token for the MCP server.
 *
 * Hashed like a share token, and scoped: `read` can never mutate, and no scope
 * reaches credentials at all — the MCP server has no tool that returns one.
 * `userId` records who minted it so revoking someone's access is one query,
 * but the token acts for the organization, not the person.
 */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    organizationId: orgRef(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull(),
    /** "read" or "write". Write implies read. */
    scope: text("scope").$type<ApiTokenScope>().notNull().default("read"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_tokens_org_idx").on(table.organizationId),
    index("api_tokens_user_idx").on(table.userId),
  ],
);

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  dashboards: many(dashboards),
  connections: many(connections),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}));

export const dashboardsRelations = relations(dashboards, ({ many, one }) => ({
  widgets: many(dashboardWidgets),
  organization: one(organization, {
    fields: [dashboards.organizationId],
    references: [organization.id],
  }),
}));

export type { ConnectionStatus, Provider };
