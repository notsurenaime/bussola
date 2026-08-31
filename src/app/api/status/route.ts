import { jsonOk } from "@/lib/api";
import { getSession, hasAccount } from "@/lib/auth/tenant";
import { encryptionConfigured } from "@/lib/crypto/vault";
import { EDITION, isCloud } from "@/lib/edition";

export const runtime = "nodejs";

/**
 * What the client needs before rendering an auth screen: which edition this is,
 * whether the instance still needs claiming, and whether secrets are safe.
 */
export async function GET() {
  const claimed = await hasAccount();
  const session = await getSession();

  return jsonOk({
    edition: EDITION,
    // Self-hosted accepts one account; cloud is always open for signup.
    signupOpen: isCloud || !claimed,
    claimed,
    authenticated: Boolean(session),
    user: session?.user ?? null,
    encryptionConfigured: encryptionConfigured(),
  });
}
