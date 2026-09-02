import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { getSession, hasAccount } from "@/lib/auth/tenant";
import { isCloud, isSelfHosted } from "@/lib/edition";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  // Carried through every redirect below, so an invitation link that sends
  // someone here to make an account returns them to the invitation rather
  // than dropping them on an empty dashboard list.
  const next = safeNext((await searchParams).next);

  if (await getSession()) redirect(next ?? "/dashboards");

  // Self-hosted accepts a single account: once claimed, there is nothing to
  // sign up for and the only way in is the existing one.
  const claimed = await hasAccount();
  if (isSelfHosted && claimed) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }

  return (
    <AuthShell
      description={
        isCloud
          ? "Create your Bussola workspace."
          : "Claim this instance with an account only you hold."
      }
    >
      <SignupForm selfHosted={!isCloud} next={next} />
    </AuthShell>
  );
}

/**
 * Only same-site paths are followed after signing up.
 *
 * A `next` of `https://evil.example` would otherwise turn the signup screen
 * into an open redirect — and one that fires immediately after someone types
 * a password, which is exactly when a convincing fake sign-in page pays off.
 * Leading `//` is rejected too: browsers read it as protocol-relative.
 */
function safeNext(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
