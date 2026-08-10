import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,var(--color-almond-cream-200),transparent_40%),radial-gradient(circle_at_85%_10%,var(--color-taupe-200),transparent_35%)] dark:bg-[radial-gradient(circle_at_15%_30%,var(--color-dark-coffee-900),transparent_40%),radial-gradient(circle_at_85%_10%,var(--color-black-800),transparent_35%)]"
      />
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
