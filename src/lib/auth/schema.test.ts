import { getTableColumns } from "drizzle-orm";
import { getAuthTables } from "better-auth/db";
import { organization } from "better-auth/plugins/organization";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";

/**
 * Our Drizzle tables are hand-written to match what Better Auth expects, which
 * means an upgrade that adds a column would break at runtime with a missing
 * relation error and nothing earlier to catch it.
 *
 * The Better Auth CLI's `generate` would surface that, but only if someone
 * remembers to run it — and it cannot read our config anyway, because the
 * adapter is built lazily around an async database factory. This asks Better
 * Auth directly for its table definitions and checks ours still satisfy them,
 * every time the suite runs.
 */
const tables = getAuthTables({
  plugins: [organization()],
  emailAndPassword: { enabled: true },
} as never) as Record<
  string,
  { modelName: string; fields: Record<string, unknown> }
>;

/** Better Auth model name to the Drizzle table we back it with. */
const OURS: Record<string, unknown> = {
  user: schema.user,
  session: schema.session,
  account: schema.account,
  verification: schema.verification,
  organization: schema.organization,
  member: schema.member,
  invitation: schema.invitation,
};

describe("Better Auth schema", () => {
  it("backs every model Better Auth expects", () => {
    expect(Object.keys(tables).sort()).toEqual(Object.keys(OURS).sort());
  });

  it.each(Object.keys(tables))("has every column %s needs", (model) => {
    const table = OURS[model];
    expect(table, `no Drizzle table for "${model}"`).toBeDefined();

    const ours = Object.keys(getTableColumns(table as never));
    const theirs = Object.keys(tables[model].fields);

    // Every model also carries an implicit primary key.
    expect(ours, `${model}.id`).toContain("id");

    for (const field of theirs) {
      expect(ours, `${model}.${field} is missing`).toContain(field);
    }
  });

  it("keeps the session's active organization, which is our tenant", () => {
    // The whole tenant boundary hangs off this column.
    expect(Object.keys(getTableColumns(schema.session))).toContain(
      "activeOrganizationId",
    );
  });
});
