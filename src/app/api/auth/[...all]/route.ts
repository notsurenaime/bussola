import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Better Auth owns every /api/auth/* endpoint: sign-up, sign-in, sign-out,
 * session, password change, and the organization plugin's routes.
 */
export async function GET(request: Request) {
  return toNextJsHandler(await getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(await getAuth()).POST(request);
}
