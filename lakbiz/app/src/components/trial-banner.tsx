"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export function TrialBanner() {
  const { t } = useLocale();
  const { subscription, daysLeftInTrial, isReadOnly, isPlatformAdmin } =
    useSubscription();

  if (isPlatformAdmin) return null;

  if (subscription.status === "active") return null;

  if (isReadOnly) {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
        {t("sub.read_only")}{" "}
        <Link href="/settings/billing" className="font-semibold underline">
          {t("sub.upgrade_now")}
        </Link>
      </div>
    );
  }

  if (subscription.status === "trialing" && daysLeftInTrial != null) {
    return (
      <div className="border-b border-teal-200 bg-teal-50 px-4 py-2 text-center text-sm text-teal-900">
        {t("sub.trial_banner")} {daysLeftInTrial}.{" "}
        <Link href="/settings/billing" className="font-semibold underline">
          {t("sub.choose_plan")}
        </Link>
      </div>
    );
  }

  return null;
}
