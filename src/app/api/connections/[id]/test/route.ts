import { jsonOk, withTenant } from "@/lib/api";
import { testAndPersist } from "@/lib/connectors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  return withTenant(async (repos) => {
    const { id } = await params;
    return jsonOk({ result: await testAndPersist(repos, id) });
  });
}
