import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser, hasUser } from "@/lib/auth/session";

// Every page in this group is per-tenant and reads the database, so none of
// them may be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasUser())) {
    redirect("/setup");
  }
  if (!(await getSessionUser())) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
