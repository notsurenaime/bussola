import { getSessionUser, hasUser } from "@/lib/auth/session";
import { encryptionConfigured } from "@/lib/crypto/vault";
import { jsonOk } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const configured = await hasUser();
  const user = await getSessionUser();
  return jsonOk({
    configured,
    authenticated: Boolean(user),
    encryptionConfigured: encryptionConfigured(),
  });
}
