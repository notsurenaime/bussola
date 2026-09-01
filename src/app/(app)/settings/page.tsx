"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useSettingsModal } from "@/components/settings/settings-modal-context";

/**
 * Settings lives in a modal now, not a page — this route only exists as a
 * stable redirect target for Stripe's checkout/portal return URLs.
 */
export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openSettings } = useSettingsModal();

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") toast.success("Plan updated");
    if (checkout === "cancelled") toast("Checkout cancelled");

    openSettings(checkout ? "billing" : undefined);
    router.replace("/dashboards");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
