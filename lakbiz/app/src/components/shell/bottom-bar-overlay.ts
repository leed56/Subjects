"use client";

import { useSyncExternalStore } from "react";

/**
 * Some pages (the POS/checkout flows) render their own fixed bottom bar
 * — a cart/settlement summary — only once there's something in the cart.
 * The shared mobile bottom tab bar must get out of the way exactly then,
 * not for the whole page: hiding it unconditionally on those routes left
 * mobile visitors with no bottom nav at all while browsing with an empty
 * cart (e.g. arriving from Business Pulse's own "Sales" tab), which read
 * as the nav vanishing for no reason.
 *
 * A tiny module-level store (rather than a context) so any page can
 * report occupancy without needing to sit inside a new provider.
 */
let occupied = false;
const listeners = new Set<() => void>();

export function setBottomBarOccupied(next: boolean) {
  if (occupied === next) return;
  occupied = next;
  listeners.forEach((listener) => listener());
}

export function useBottomBarOccupied(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => occupied,
    () => false,
  );
}
