import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { getSession, hasAccount } from "@/lib/auth/tenant";
import { isCloud, isSelfHosted } from "@/lib/edition";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboards");

  // Self-hosted accepts a single account: once claimed, there is nothing to
  // sign up for and the only way in is the existing one.
  const claimed = await hasAccount();
  if (isSelfHosted && claimed) redirect("/login");

  return (
    <AuthShell
      description={
        isCloud
          ? "Create your Bussola workspace."
          : "Claim this instance with an account only you hold."
      }
    >
      <SignupForm selfHosted={!isCloud} />
    </AuthShell>
  );
}
