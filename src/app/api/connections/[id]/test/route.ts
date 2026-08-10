import { getSessionUser } from "@/lib/auth/session";
import { jsonOk, unauthorized } from "@/lib/api";
import { testAndPersist } from "@/lib/connectors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const result = await testAndPersist(id);
  return jsonOk({ result });
}
