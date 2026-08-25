"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/use-app-store";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useOnlineStatus } from "@/lib/offline/connectivity";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export function CloudSyncBanner() {
  const {
    cloudSyncing,
    cloudSyncError,
    cloudRemoteNotice,
    offlinePendingSync,
    offlinePendingChangeCount,
    retryCloudSync,
    dismissCloudRemoteNotice,
  } = useAppStore();
  const isOnline = useOnlineStatus();
  const { t } = useLocale();
  const { org, isPlatformAdmin } = useSubscription();

  useEffect(() => {
    if (!cloudRemoteNotice) return;
    const timer = window.setTimeout(() => dismissCloudRemoteNotice(), 12_000);
    return () => window.clearTimeout(timer);
  }, [cloudRemoteNotice, dismissCloudRemoteNotice]);

  if (isPlatformAdmin || !org.isAuthenticated || !isOnline) return null;

  if (cloudSyncError) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-center text-sm text-rose-900">
        <span>{t("common.cloud_sync_error")}: {cloudSyncError}</span>
        <button
          type="button"
          onClick={retryCloudSync}
          disabled={cloudSyncing}
          className="min-h-11 rounded-xl bg-white px-3 text-xs font-bold text-rose-800 shadow-sm ring-1 ring-rose-200 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
        >
          {cloudSyncing ? t("common.cloud_syncing") : t("offline.sync_now")}
        </button>
      </div>
    );
  }

  if (cloudSyncing && offlinePendingSync) {
    const count = Math.max(offlinePendingChangeCount, 1);
    return (
      <div role="status" aria-live="polite" className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm font-medium text-sky-900">
        {t("offline.sync_pending_count").replace("{count}", String(count))}
      </div>
    );
  }

  if (!cloudRemoteNotice) return null;

  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-900">
      <span>{t("common.cloud_updated_remote")}</span>
      <button
        type="button"
        onClick={dismissCloudRemoteNotice}
        className="min-h-11 rounded-xl bg-sky-100 px-3 text-xs font-semibold text-sky-800 hover:bg-sky-200"
      >
        {t("common.dismiss")}
      </button>
    </div>
  );
}
