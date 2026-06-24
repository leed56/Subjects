"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store/use-app-store";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useOnlineStatus } from "@/lib/offline/connectivity";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { offlinePendingSync, offlinePendingChangeCount, cloudSyncing } = useAppStore();
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

  if (isOnline && offlinePendingSync && cloudSyncing) {
    return (
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-center text-xs font-semibold text-slate-600">
        {offlinePendingChangeCount > 0
          ? t("offline.sync_pending_count").replace(
              "{count}",
              String(Math.max(offlinePendingChangeCount, 1)),
            )
          : t("offline.sync_pending")}
      </div>
    );
  }

  if (isOnline && offlinePendingSync) return null;

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
