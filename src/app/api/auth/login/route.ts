import { z } from "zod";
import { login } from "@/lib/auth/password";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Password required");
  }

  const ok = await login(parsed.data.password);
  if (!ok) {
    return jsonError("Invalid password", 401);
  }
  return jsonOk({ ok: true });
}
