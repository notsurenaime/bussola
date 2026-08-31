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
import type { ConnectionStatus, Provider } from "@/lib/providers";

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
