"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/use-app-store";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useOnlineStatus } from "@/lib/offline/connectivity";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export function CloudSyncBanner() {
  const { cloudSyncError, cloudRemoteNotice, dismissCloudRemoteNotice } =
    useAppStore();
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
      <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-center text-sm text-rose-900">
        {t("common.cloud_sync_error")}: {cloudSyncError}
      </div>
    );
  }

  if (!cloudRemoteNotice) return null;

  return (
    <div className="flex items-center justify-center gap-3 border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-900">
      <span>{t("common.cloud_updated_remote")}</span>
      <button
        type="button"
        onClick={dismissCloudRemoteNotice}
        className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 hover:bg-sky-200"
      >
        {t("common.dismiss")}
      </button>
    </div>
  );
}
