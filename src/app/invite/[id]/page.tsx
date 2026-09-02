import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { AcceptInvitation } from "@/app/invite/[id]/accept-invitation";
import { getSession } from "@/lib/auth/tenant";
import { resolveInvitation } from "@/lib/invites/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function Dead({ title, description }: { title: string; description: string }) {
  return (
    <AuthShell title={title} description={description}>
      <Button render={<Link href="/login" />} className="w-full">
        Go to sign in
      </Button>
    </AuthShell>
  );
}

/**
 * Accepting an invitation.
 *
 * Reachable without a session on purpose — the whole point is that the person
 * has not signed in yet, which is why this reads the invitation directly
 * rather than through Better Auth's `getInvitation` (that one requires a
 * session and would turn every first-time invitee away).
 *
 * The id is not the credential. It says who was invited and to what; accepting
 * goes through Better Auth, which checks that the signed-in account's email
 * matches the invited address, so a forwarded link cannot be redeemed by
 * whoever it was forwarded to.
 */
export default async function InvitePage({ params }: Props) {
  const { id } = await params;
  const invitation = await resolveInvitation(id);

  if (!invitation) {
    return (
      <Dead
        title="This invitation could not be found"
        description="The link may be incomplete. Ask whoever invited you to send it again."
      />
    );
  }

  if (invitation.status !== "pending") {
    return (
      <Dead
        title="This invitation has already been used"
        description={`It was sent to ${invitation.email}. If that is you, sign in — you may already be a member.`}
      />
    );
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <Dead
        title="This invitation has expired"
        description={`It was sent to ${invitation.email}. Ask for a new one.`}
      />
    );
  }

  const session = await getSession();

  if (!session) {
    // Signing up comes first, then straight back here. /signup rather than
    // /login because the common case is someone with no account yet; the
    // signup screen links to sign-in for the case where they already have one.
    redirect(`/signup?next=${encodeURIComponent(`/invite/${id}`)}`);
  }

  const invitedYou =
    session.user.email.toLowerCase() === invitation.email.toLowerCase();

  return (
    <AuthShell
      title={`Join ${invitation.organizationName}`}
      description={
        invitedYou
          ? `${invitation.inviterName ?? "Someone"} invited you. You are signed in as ${session.user.email}.`
          : `This invitation was sent to ${invitation.email}, but you are signed in as ${session.user.email}. Sign in with the invited address to accept it.`
      }
    >
      <AcceptInvitation
        invitationId={id}
        organizationName={invitation.organizationName}
        canAccept={invitedYou}
      />
    </AuthShell>
  );
}
