import { getSessionUser, hasUser } from "@/lib/auth/session";
import { encryptionConfigured } from "@/lib/crypto/vault";
import { EDITION, isCloud } from "@/lib/edition";
import { jsonOk } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  // The hosted edition is always "configured" — new customers sign up rather
  // than claiming a single admin slot.
  const configured = isCloud ? true : await hasUser();
  const user = await getSessionUser();

  return jsonOk({
    edition: EDITION,
    configured,
    authenticated: Boolean(user),
    encryptionConfigured: encryptionConfigured(),
  });
}
