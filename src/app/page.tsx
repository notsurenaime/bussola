import { redirect } from "next/navigation";
import { getSession, hasAccount } from "@/lib/auth/tenant";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await hasAccount())) redirect("/signup");
  if (!(await getSession())) redirect("/login");
  redirect("/dashboards");
}
