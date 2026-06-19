"use client";

import { useEffect, useState } from "react";
import { loadNotificationLog } from "@/lib/messaging/settings";
import type { NotificationLogEntry } from "@/lib/messaging/types";
import {
  fetchOrgNotificationLog,
  mergeNotificationLogs,
} from "@/lib/supabase/notification-log-client";

export function useNotificationLogs(orgId: string | null | undefined) {
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);

  useEffect(() => {
    const local = loadNotificationLog();
    if (!orgId) {
      setLogs(local);
      return;
    }

    let cancelled = false;
    void fetchOrgNotificationLog(orgId).then((cloud) => {
      if (cancelled) return;
      setLogs(mergeNotificationLogs(local, cloud));
    });

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return logs;
}
