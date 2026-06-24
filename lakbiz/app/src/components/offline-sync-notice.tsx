"use client";

import { useAppStore } from "@/lib/store/use-app-store";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useOnlineStatus } from "@/lib/offline/connectivity";
import { useSubscription } from "@/lib/subscription/subscription-provider";

/** Dashboard / page-level notice for queued offline changes. */
export function OfflineSyncNotice({ className = "mb-4" }: { className?: string }) {
  const {
    offlinePendingSync,
    offlinePendingChangeCount,
    cloudSyncing,
    cloudSyncError,
    retryCloudSync,
  } = useAppStore();
  const isOnline = useOnlineStatus();
  const { t } = useLocale();
  const { org, isPlatformAdmin } = useSubscription();

  if (isPlatformAdmin || !org.isAuthenticated || !offlinePendingSync) return null;

  const count = Math.max(offlinePendingChangeCount, 1);

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
        cloudSyncError
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-sky-200 bg-sky-50 text-sky-900"
      } ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {isOnline
            ? cloudSyncing
              ? t("offline.sync_pending_count").replace("{count}", String(count))
              : cloudSyncError
                ? t("offline.sync_failed_count").replace("{count}", String(count))
                : t("offline.pending_banner").replace("{count}", String(count))
            : t("offline.pending_offline_count").replace("{count}", String(count))}
        </span>
        {isOnline && !cloudSyncing && (
          <button
            type="button"
            onClick={retryCloudSync}
            className="rounded-xl bg-white px-3 py-1.5 text-xs font-black shadow-sm ring-1 ring-sky-200 hover:bg-sky-100"
          >
            {t("offline.sync_now")}
          </button>
        )}
      </div>
      {cloudSyncError && isOnline && (
        <p className="mt-1 text-xs font-medium opacity-90">{cloudSyncError}</p>
      )}
    </div>
  );
}
