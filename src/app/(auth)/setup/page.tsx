"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BussolaMark } from "@/components/brand/bussola-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SetupPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data: { configured?: boolean; authenticated?: boolean }) => {
        if (data.configured && data.authenticated) router.replace("/dashboards");
        if (data.configured && !data.authenticated) router.replace("/login");
      });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await res.json()) as { error?: string };
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Setup failed");
      return;
    }
    router.push("/dashboards");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--color-almond-cream-200),transparent_45%),radial-gradient(circle_at_80%_0%,var(--color-taupe-200),transparent_40%)] dark:bg-[radial-gradient(circle_at_20%_20%,var(--color-dark-coffee-900),transparent_45%),radial-gradient(circle_at_80%_0%,var(--color-black-800),transparent_40%)]"
      />
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md space-y-6"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <BussolaMark className="size-8 text-almond-cream-400" />
            <h1 className="text-3xl font-semibold tracking-tight">Bussola</h1>
          </div>
          <p className="text-muted-foreground">
            Create a local admin password to protect your private dashboard.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create local admin"}
          </Button>
        </div>
      </form>
    </div>
  );
}
