"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store/use-app-store";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useOnlineStatus } from "@/lib/offline/connectivity";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { offlinePendingSync, offlinePendingChangeCount } = useAppStore();
  const { t } = useLocale();
  const { org, isPlatformAdmin, can } = useSubscription();

  if (isPlatformAdmin || !org.isAuthenticated) return null;

  const countLabel =
    offlinePendingSync && offlinePendingChangeCount > 0
      ? t("offline.changes_queued_count").replace(
          "{count}",
          String(offlinePendingChangeCount),
        )
      : null;

  if (isOnline) return null;

  const hasOfflinePlan = can("offline");

  return (
    <div
      className={`border-b px-4 py-2 text-center text-sm ${
        hasOfflinePlan
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-rose-200 bg-rose-50 text-rose-900"
      }`}
    >
      {hasOfflinePlan ? (
        <>
          {t("offline.working_offline")}
          {countLabel ? ` ${countLabel}` : ""}
        </>
      ) : (
        <>
          {t("offline.no_internet_readonly")}{" "}
          <Link href="/settings/plans" className="font-black underline">
            {t("sub.upgrade_now")}
          </Link>
        </>
      )}
    </div>
  );
}
