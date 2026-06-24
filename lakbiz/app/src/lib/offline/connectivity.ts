"use client";

import { useSyncExternalStore } from "react";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getServerSnapshot() {
  return true;
}

/** Reactive browser online status (false when offline). */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot);
}

/** One-shot check — safe outside React. */
export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
