import { z } from "zod";
import { changePassword } from "@/lib/auth/password";
import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid password payload");

  try {
    await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
    // Every session was revoked, this one included: the client must sign in again.
    return jsonOk({ ok: true, reauthRequired: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Password change failed",
      400,
    );
  }
}
