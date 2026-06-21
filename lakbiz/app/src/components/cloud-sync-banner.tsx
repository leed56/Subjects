"use client";

import { useAppStore } from "@/lib/store/use-app-store";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export function CloudSyncBanner() {
  const { cloudSyncError, cloudSyncing } = useAppStore();
  const { t } = useLocale();
  const { org, isPlatformAdmin } = useSubscription();

  if (isPlatformAdmin || !org.isAuthenticated) return null;

  if (cloudSyncing) {
    return (
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-center text-xs font-semibold text-slate-600">
        {t("common.cloud_syncing")}
      </div>
    );
  }

  if (!cloudSyncError) return null;

  return (
    <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-center text-sm text-rose-900">
      {t("common.cloud_sync_error")}: {cloudSyncError}
    </div>
  );
}
