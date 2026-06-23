"use client";

import { useMemo } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "./subscription-provider";

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
  const { isReadOnly, can } = useSubscription();
  const canWrite = !isReadOnly && can("write");

  const disabledHint = useMemo(() => {
    if (canWrite) return null;
    if (isReadOnly) return t("sub.read_only");
    return t("sub.write_blocked");
  }, [canWrite, isReadOnly, t]);

  return { canWrite, disabledHint };
}
