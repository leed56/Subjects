"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { serviceDueLabel } from "@/lib/ac-service";
import { useAcInAppAlerts } from "@/hooks/use-ac-in-app-alerts";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { AcInAppAlertKind } from "@/lib/ac/in-app-alerts";

function kindLabel(kind: AcInAppAlertKind, t: (key: string) => string): string {
  if (kind === "overdue") return t("ac_alerts.kind_overdue");
  if (kind === "due_today") return t("ac_alerts.kind_today");
  return t("ac_alerts.kind_upcoming");
}

export function AcAlertsBell() {
  const { t, locale } = useLocale();
  const { enabled, alerts, unreadCount, markAlertsSeen, markAllSeen } =
    useAcInAppAlerts();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (!enabled) return null;

  const preview = alerts.slice(0, 8);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("ac_alerts.bell_label")}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            if (next) markAlertsSeen(preview);
            return next;
          });
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-base hover:border-teal-200 hover:bg-teal-50"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 pb-2">
            <p className="text-sm font-black text-slate-900">{t("ac_alerts.title")}</p>
            {alerts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  markAllSeen();
                  setOpen(false);
                }}
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                {t("ac_alerts.mark_all_read")}
              </button>
            )}
          </div>

          {preview.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">{t("ac_alerts.empty")}</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {preview.map((alert) => (
                <li key={alert.id} className="border-b border-slate-50 last:border-0">
                  <Link
                    href="/jobs"
                    onClick={() => {
                      markAlertsSeen([alert]);
                      setOpen(false);
                    }}
                    className="block px-3 py-2.5 hover:bg-slate-50"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                      {kindLabel(alert.kind, t)}
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {alert.customerName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {alert.jobNo} ·{" "}
                      {serviceDueLabel(alert.serviceDueDate, locale)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-slate-100 px-3 pt-2">
            <Link
              href="/jobs"
              onClick={() => setOpen(false)}
              className="block py-2 text-center text-xs font-black text-teal-700 hover:underline"
            >
              {t("ac_alerts.view_jobs")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
