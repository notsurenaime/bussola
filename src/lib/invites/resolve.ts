import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { invitation, organization, user } from "@/lib/db/schema";

/**
 * Reading an invitation without being signed in.
 *
 * Better Auth's own `getInvitation` requires a session *and* that the session's
 * email matches the invited address. Both are right for accepting — and both
 * make it useless for rendering the page, because the person an invitation
 * exists for is precisely the one who has no account yet. Calling it there
 * turns every first-time invitee into "this invitation is no longer valid".
 *
 * So the page reads the invitation directly, and acceptance still goes through
 * Better Auth, which enforces the email match. Nothing here is a credential
 * check: the id shows who was invited and to what, which the link already
 * implies. It grants nothing.
 */
export type InvitationView = {
  id: string;
  email: string;
  organizationName: string;
  inviterName: string | null;
  status: string;
  expiresAt: Date;
};

export async function resolveInvitation(
  id: string,
): Promise<InvitationView | null> {
  // A path segment is attacker-controlled; there is no reason to turn a 4KB
  // one into a query.
  if (!id || id.length > 64 || !/^[A-Za-z0-9_-]+$/.test(id)) return null;

  const db = await getDb();

  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationName: organization.name,
      inviterName: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .leftJoin(user, eq(invitation.inviterId, user.id))
    .where(eq(invitation.id, id))
    .limit(1);

  return row ?? null;
}
