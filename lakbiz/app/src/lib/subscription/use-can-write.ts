"use client";

import { useSubscription } from "./subscription-provider";

/** True when the shop can persist edits (not read-only / suspended). */
export function useCanWrite(): boolean {
  const { isReadOnly, can } = useSubscription();
  return !isReadOnly && can("write");
}
