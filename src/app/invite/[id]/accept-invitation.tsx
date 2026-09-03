"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

type Props = {
  invitationId: string;
  organizationName: string;
  /** False when the signed-in address is not the one that was invited. */
  canAccept: boolean;
};

/**
 * The accept / decline buttons.
 *
 * Better Auth performs the acceptance, including the email match — this only
 * decides what to show and where to go afterwards. Accepting switches the
 * session's active organization, so the redirect lands on the new
 * organization's dashboards rather than the old one's.
 */
export function AcceptInvitation({
  invitationId,
  organizationName,
  canAccept,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    const { error } = await authClient.organization.acceptInvitation({
      invitationId,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message || "Could not accept this invitation");
      return;
    }

    /*
     * `refresh` before `push`: accepting switched the session's active
     * organization, and the app shell resolves that on the server. Navigating
     * without invalidating the cached server render would land on the
     * previous organization's dashboards.
     */
    router.refresh();
    router.push("/dashboards");
  }

  async function decline() {
    setBusy(true);
    const { error } = await authClient.organization.rejectInvitation({
      invitationId,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Could not decline this invitation");
      return;
    }
    toast("Invitation declined");
    router.push("/dashboards");
  }

  if (!canAccept) {
    return (
      <div className="space-y-2">
        <Button
          render={<Link href="/login" />}
          variant="outline"
          className="w-full"
        >
          Sign in with another account
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" disabled={busy} onClick={accept}>
        {busy ? "Joining…" : `Join ${organizationName}`}
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        disabled={busy}
        onClick={decline}
      >
        Decline
      </Button>
    </div>
  );
}
