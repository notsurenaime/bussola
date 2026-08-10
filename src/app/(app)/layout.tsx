import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser, hasUser } from "@/lib/auth/session";

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
