import { jsonError } from "@/lib/api";
import type { TenantRepos } from "@/lib/db/tenant";
import { checkLimit, entitlementsFor, type LimitName } from "./entitlements";

/**
 * Refuse to create one more of something when the plan is full.
 *
 * Returns a 402 response to send back, or null to carry on. Self-hosted always
 * returns null: `entitlementsFor` grants unlimited before any of this runs.
 *
 * Enforcement lives at creation only — a downgrade never deletes anything a
 * customer already has, it just stops them adding more.
 */
export async function overLimit(
  repos: TenantRepos,
  limit: LimitName,
  current: number,
): Promise<Response | null> {
  const entitlements = await entitlementsFor(repos.ctx.organizationId);
  const check = checkLimit(entitlements, limit, current);
  if (check.allowed) return null;

  // 402 Payment Required: the request is well-formed, the plan is the problem.
  return jsonError(check.message, 402);
}
