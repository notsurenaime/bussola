import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSession, hasAccount } from "@/lib/auth/tenant";

// Every page in this group is per-tenant and reads the database, so none of
// them may be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasAccount())) {
    redirect("/signup");
  }
  if (!(await getSession())) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
