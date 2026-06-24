"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildAcInAppAlerts,
  countUnreadAcAlerts,
  loadAcAlertsSeen,
  loadAcInAppAlertPrefs,
  saveAcAlertsSeen,
  saveAcInAppAlertPrefs,
  type AcInAppAlert,
  type AcInAppAlertPrefs,
} from "@/lib/ac/in-app-alerts";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export function useAcInAppAlerts() {
  const { data, ready } = useAppStore();
  const { org, can, isPlatformAdmin } = useSubscription();
  const enabled = !isPlatformAdmin && org.isAuthenticated && can("ac_jobs");
  const [prefs, setPrefs] = useState<AcInAppAlertPrefs>(loadAcInAppAlertPrefs);
  const [seen, setSeen] = useState<Set<string>>(() =>
    org.id ? loadAcAlertsSeen(org.id) : new Set(),
  );

  useEffect(() => {
    if (!org.id) return;
    setSeen(loadAcAlertsSeen(org.id));
  }, [org.id]);

  const alerts = useMemo(() => {
    if (!enabled || !ready || !data) return [];
    return buildAcInAppAlerts(data.acJobs, prefs);
  }, [enabled, ready, data, prefs]);

  const unreadCount = useMemo(
    () => countUnreadAcAlerts(alerts, seen),
    [alerts, seen],
  );

  const updatePrefs = useCallback((next: AcInAppAlertPrefs) => {
    setPrefs(next);
    saveAcInAppAlertPrefs(next);
  }, []);

  const markAlertsSeen = useCallback(
    (items: AcInAppAlert[]) => {
      const orgId = org.id;
      if (!orgId || items.length === 0) return;
      setSeen((prev) => {
        const next = new Set(prev);
        for (const item of items) next.add(item.id);
        saveAcAlertsSeen(orgId, next);
        return next;
      });
    },
    [org.id],
  );

  const markAllSeen = useCallback(() => {
    markAlertsSeen(alerts);
  }, [alerts, markAlertsSeen]);

  return {
    enabled,
    prefs,
    updatePrefs,
    alerts,
    unreadCount,
    markAlertsSeen,
    markAllSeen,
  };
}
