"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { PageHeader, SectionHeading } from "@/components/layout/page";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BillingSection } from "@/components/settings/billing-section";

export default function SettingsPage() {
  const [encryptionConfigured, setEncryptionConfigured] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/status")
      .then((r) => r.json())
      .then((data: { encryptionConfigured?: boolean }) => {
        setEncryptionConfigured(Boolean(data.encryptionConfigured));
      });
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // revokeOtherSessions signs out every other device; this one stays valid,
    // so there is no need to bounce the user back to the login screen.
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || "Failed to change password");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    toast.success("Password updated — other devices signed out");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Settings"
        description="Local security and appearance for your private Bussola instance."
      />

      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading
          title="Appearance"
          description="Light and dark mode follow the Bussola palette."
          actions={<ThemeToggle />}
        />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading
          title="Encryption"
          description="Secrets are stored on this machine, encrypted at rest with AES-256-GCM."
        />
        <div className="flex items-center gap-2">
          <Badge variant={encryptionConfigured ? "secondary" : "outline"}>
            {encryptionConfigured ? "Custom key set" : "Dev fallback key"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Set <code className="text-foreground">BUSSOLA_ENCRYPTION_KEY</code> in
          your environment to a 64-char hex string for production-grade local
          secret storage.
        </p>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <SectionHeading title="Change password" />
        <form onSubmit={changePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="next">New password</Label>
            <Input
              id="next"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Updating…" : "Update password"}
          </Button>
        </form>
      </section>
      <BillingSection />
    </div>
  );
}
