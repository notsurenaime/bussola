import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell description="Sign in to your local dashboard.">
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
