import { redirect } from "next/navigation";
import { getSessionUser, hasUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await hasUser())) redirect("/setup");
  if (!(await getSessionUser())) redirect("/login");
  redirect("/dashboards");
}
