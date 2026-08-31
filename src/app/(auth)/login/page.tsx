import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { getSession, hasAccount } from "@/lib/auth/tenant";
import { isCloud } from "@/lib/edition";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const claimed = await hasAccount();
  if (!claimed) redirect("/signup");
  if (await getSession()) redirect("/dashboards");

  return (
    <AuthShell
      description={
        isCloud
          ? "Sign in to your Bussola workspace."
          : "Sign in to your local dashboard."
      }
    >
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
      >
        <LoginForm signupOpen={isCloud} />
      </Suspense>
    </AuthShell>
  );
}
