import { z } from "zod";
import { setupAdmin } from "@/lib/auth/password";
import { hasUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  password: z.string().min(8),
});

export async function POST(request: Request) {
  if (await hasUser()) {
    return jsonError("Already configured", 409);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Password must be at least 8 characters");
  }

  try {
    await setupAdmin(parsed.data.password);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Setup failed",
      500,
    );
  }
}
