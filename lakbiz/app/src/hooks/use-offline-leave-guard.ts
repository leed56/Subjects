"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/use-app-store";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";

/** Warn before closing the tab when unsynced offline changes exist. */
export function useOfflineLeaveGuard() {
  const { offlinePendingSync } = useAppStore();
  const { org, isPlatformAdmin } = useSubscription();
  const { t } = useLocale();

  useEffect(() => {
    if (isPlatformAdmin || !org.isAuthenticated || !offlinePendingSync) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = t("offline.leave_confirm");
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [offlinePendingSync, org.isAuthenticated, isPlatformAdmin, t]);
}
