/**
 * Bussola ships as one codebase in two editions.
 *
 * `self-hosted` (the default) is single-tenant: one organization is created on
 * first run and every request resolves to it. `cloud` is multi-tenant, with
 * signup, organizations and billing on top.
 *
 * The distinction exists only at the edges — configuration, entitlements and
 * identity resolution. Every query below `lib/db` is tenant-scoped in both
 * editions, so the self-hosted path exercises the same isolation code that
 * keeps cloud customers apart.
 */
export type Edition = "self-hosted" | "cloud";

export const EDITION: Edition =
  process.env.BUSSOLA_EDITION === "cloud" ? "cloud" : "self-hosted";

export const isCloud = EDITION === "cloud";
export const isSelfHosted = !isCloud;

/**
 * Fail fast on a cloud deployment that is missing the configuration which keeps
 * customer credentials safe. Self-hosted installs stay permissive so that
 * `npm run dev` works with no environment at all.
 */
export function assertEditionConfig(): void {
  if (!isCloud) return;

  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.BUSSOLA_ENCRYPTION_KEY) {
    missing.push("BUSSOLA_ENCRYPTION_KEY");
  }
  if (!process.env.BETTER_AUTH_SECRET) missing.push("BETTER_AUTH_SECRET");
  // Without it, request origins are inferred rather than pinned — fine for a
  // laptop, too loose for a deployment taking other people's credentials.
  if (!process.env.BETTER_AUTH_URL) missing.push("BETTER_AUTH_URL");

  if (missing.length) {
    throw new Error(
      `BUSSOLA_EDITION=cloud requires ${missing.join(", ")}. ` +
        "Refusing to start: the local-dev fallbacks are not safe for hosted use.",
    );
  }
}
