"use client";

import { useMemo } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useOnlineStatus } from "@/lib/offline/connectivity";
import { useSubscription } from "./subscription-provider";
import { useAppStore } from "@/lib/store/use-app-store";

export type WriteAccess = {
  canWrite: boolean;
  /** Short reason for tooltips on disabled write buttons. */
  disabledHint: string | null;
};

/** True when the shop can persist edits (not read-only / suspended). */
export function useCanWrite(): boolean {
  return useWriteAccess().canWrite;
}

/** Write access plus a user-facing reason when saves are blocked. */
export function useWriteAccess(): WriteAccess {
  const { t } = useLocale();
  const isOnline = useOnlineStatus();
  const { isReadOnly, can } = useSubscription();
  const { syncConflict } = useAppStore();
  const canWrite =
    !isReadOnly && can("write") && (isOnline || can("offline")) && !syncConflict;

  const disabledHint = useMemo(() => {
    if (canWrite) return null;
    if (syncConflict) return t("sync.conflict_blocked");
    if (isReadOnly) return t("sub.read_only");
    if (!isOnline && !can("offline")) return t("offline.write_blocked");
    return t("sub.write_blocked");
  }, [canWrite, syncConflict, isReadOnly, isOnline, can, t]);

  return { canWrite, disabledHint };
}
