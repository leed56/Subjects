"use client";

import { useEffect, useState } from "react";

/** null = loading, true/false = server Text.lk env configured or not */
export function useSmsApiConfigured(): boolean | null {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/messages/status")
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

    fetch("/api/messages/status")
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
