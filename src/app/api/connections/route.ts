import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";
import {
  COMING_SOON_PROVIDERS,
  LIVE_PROVIDERS,
  deleteConnection,
  listConnections,
  testAndPersist,
  upsertConnection,
} from "@/lib/connectors";
import type { Provider } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  return jsonOk({
    connections: listConnections(),
    liveProviders: LIVE_PROVIDERS,
    comingSoon: COMING_SOON_PROVIDERS,
  });
}

const upsertSchema = z.object({
  id: z.string().optional(),
  provider: z.enum([
    "railway",
    "netlify",
    "supabase",
    "qonto",
    "stripe",
    "polar",
    "attio",
    "vercel",
    "webtraffic",
  ]),
  label: z.string().min(1),
  credentials: z.object({
    apiKey: z.string().optional(),
    login: z.string().optional(),
    secretKey: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    orgSlug: z.string().optional(),
  }),
  test: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid connection payload");

  if (!LIVE_PROVIDERS.includes(parsed.data.provider as Provider)) {
    return jsonError("Provider coming soon", 400);
  }

  const id = upsertConnection({
    id: parsed.data.id,
    provider: parsed.data.provider as Provider,
    label: parsed.data.label,
    credentials: parsed.data.credentials,
  });

  let testResult = null;
  if (parsed.data.test !== false) {
    testResult = await testAndPersist(id);
  }

  return jsonOk({ id, testResult });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("id required");

  deleteConnection(id);
  return jsonOk({ ok: true });
}
