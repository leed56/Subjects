"use client";

import { useEffect, useState } from "react";

// Reported: the Messages tab's "Automatic SMS" panel got permanently
// stuck on "Checking SMS..." on one tenant while another resolved fine
// from the same code path — the /api/messages/status GET itself is
// tenant-agnostic (just two server env-presence booleans, gated only on
// being signed in), so nothing in that route can explain a per-tenant
// hang. Whatever the exact trigger (a slow/dropped request, a remount
// racing the fetch before it settles), the actual product bug is that
// there was no upper bound on how long "checking" could last — an
// indefinite loading state reads as broken regardless of cause. Both
// hooks below now fail closed (== "not configured", the same outcome
// the existing .catch() already used) if the request hasn't settled
// within STATUS_TIMEOUT_MS, so the UI always reaches a terminal state.
const STATUS_TIMEOUT_MS = 8000;

function fetchStatusWithTimeout(): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  return fetch("/api/messages/status", { signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/** null = loading, true/false = server Text.lk env configured or not */
export function useSmsApiConfigured(): boolean | null {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchStatusWithTimeout()
      .then((res) => res.json())
      .then((data: { configured?: boolean }) => {
        if (!cancelled) setConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return configured;
}

/** null = loading, true/false = server WasenderAPI (WhatsApp) env
 * configured or not. Separate hook, same /api/messages/status endpoint
 * (it now reports both flags) — kept apart from useSmsApiConfigured so
 * existing callers of that hook are untouched. */
export function useWhatsAppApiConfigured(): boolean | null {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchStatusWithTimeout()
      .then((res) => res.json())
      .then((data: { whatsappConfigured?: boolean }) => {
        if (!cancelled) setConfigured(Boolean(data.whatsappConfigured));
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return configured;
}
