import { relations } from "drizzle-orm";
import type { ConnectionStatus, Provider } from "@/lib/providers";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/**
 * The tenant boundary. Self-hosted installs hold exactly one row; cloud holds
 * one per customer. Every tenant-owned table carries `organization_id` and is
 * only reachable through the scoped repositories in `lib/db/tenant.ts`.
 */
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  /** Null until an account is claimed; self-hosted setup leaves it unset. */
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type MemberRole = "owner" | "admin" | "member";

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<MemberRole>().notNull().default("owner"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("memberships_org_user_key").on(
      table.organizationId,
      table.userId,
    ),
    index("memberships_user_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The organization this session is acting in. */
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const dashboards = pgTable(
  "dashboards",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("dashboards_org_idx").on(table.organizationId)],
);

export const dashboardWidgets = pgTable(
  "dashboard_widgets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").$type<Provider>().notNull(),
    label: text("label").notNull(),
    /** AES-256-GCM payload from `lib/crypto/vault`. Never leaves the server. */
    credentialsEncrypted: text("credentials_encrypted").notNull(),
    status: text("status").$type<ConnectionStatus>().notNull().default("unknown"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("connections_org_idx").on(table.organizationId)],
);

export const connectionCache = pgTable(
  "connection_cache",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    cacheKey: text("cache_key").notNull(),
    payloadJson: text("payload_json").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("cache_org_key_key").on(table.organizationId, table.cacheKey),
    index("cache_expires_idx").on(table.expiresAt),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  dashboards: many(dashboards),
  connections: many(connections),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));

export const dashboardsRelations = relations(dashboards, ({ many, one }) => ({
  widgets: many(dashboardWidgets),
  organization: one(organizations, {
    fields: [dashboards.organizationId],
    references: [organizations.id],
  }),
}));

export type { ConnectionStatus, Provider };
