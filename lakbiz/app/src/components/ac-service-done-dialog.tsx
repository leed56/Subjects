"use client";

import { useEffect, useState } from "react";
import {
  computeServiceDueFromDays,
  resolveServiceIntervalDays,
  SERVICE_INTERVAL_DAY_PRESETS,
} from "@/lib/ac-service";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { loadNotificationSettings } from "@/lib/messaging/settings";
import { sendServiceCompleteSms } from "@/lib/messaging/service-complete-client";
import type { BusinessInfo } from "@/lib/invoice";
import type { ACJob } from "@/lib/store/types";

type AcServiceDoneDialogProps = {
  job: ACJob | null;
  business: BusinessInfo;
  open: boolean;
  onClose: () => void;
  onConfirm: (input: { intervalDays: number; visitNotes?: string }) => void;
};

export function AcServiceDoneDialog({
  job,
  business,
  open,
  onClose,
  onConfirm,
}: AcServiceDoneDialogProps) {
  const { t } = useLocale();
  const [intervalDays, setIntervalDays] = useState(180);
  const [customDays, setCustomDays] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [smsResult, setSmsResult] = useState<string | null>(null);

  useEffect(() => {
    if (!job) return;
    const settings = loadNotificationSettings();
    const days =
      resolveServiceIntervalDays(job) ||
      settings.defaultServiceIntervalDays ||
      180;
    setIntervalDays(days);
    setCustomDays("");
    setVisitNotes("");
    setSmsResult(null);
  }, [job]);

  if (!open || !job) return null;

  const today = new Date().toISOString().slice(0, 10);
  const nextDue = computeServiceDueFromDays(today, intervalDays);
  const settings = loadNotificationSettings();
  const smsEnabled =
    settings.autoSendOnServiceComplete &&
    !!job.phone &&
    process.env.NEXT_PUBLIC_SMS_API_ENABLED === "true";

  const handleConfirm = async () => {
    setSaving(true);
    setSmsResult(null);
    onConfirm({ intervalDays, visitNotes: visitNotes.trim() || undefined });

    if (smsEnabled) {
      const sms = await sendServiceCompleteSms(
        job,
        business,
        nextDue,
        intervalDays,
        settings,
      );
      setSmsResult(
        sms.ok
          ? t("jobs.service_done_sms_sent")
          : (sms.error ?? t("jobs.service_done_sms_failed")),
      );
      setTimeout(() => {
        setSaving(false);
        onClose();
      }, 1200);
      return;
    }

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-bold text-slate-900">
          {t("jobs.service_done_title")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {job.customerName} · {job.address}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-400">{job.jobNo}</p>

        <div className="mt-4">
          <p className="text-sm font-medium text-slate-800">
            {t("jobs.next_service_in")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SERVICE_INTERVAL_DAY_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setIntervalDays(d);
                  setCustomDays("");
                }}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  intervalDays === d && !customDays
                    ? "bg-teal-700 text-white"
                    : "border border-slate-200 bg-white"
                }`}
              >
                {d} {t("jobs.days")}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm">
            {t("jobs.custom_interval_days")}
            <input
              type="number"
              min={14}
              max={730}
              placeholder="120"
              value={customDays}
              onChange={(e) => {
                setCustomDays(e.target.value);
                const n = Number(e.target.value);
                if (n >= 14) setIntervalDays(n);
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
          <p className="font-medium">{t("jobs.next_service_scheduled")}</p>
          <p className="mt-1 text-lg font-bold">{nextDue}</p>
          <p className="text-xs text-teal-700">{t("jobs.reminders_auto_hint")}</p>
        </div>

        <label className="mt-4 block text-sm">
          {t("jobs.visit_notes")}
          <textarea
            value={visitNotes}
            onChange={(e) => setVisitNotes(e.target.value)}
            rows={2}
            placeholder={t("jobs.visit_notes_ph")}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>

        {job.quotedAmount > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {t("jobs.quote_label")}: {formatLkr(job.quotedAmount)}
          </p>
        )}

        {smsEnabled && (
          <p className="mt-3 text-xs text-slate-600">
            {t("jobs.service_done_sms_hint")} ({job.phone})
          </p>
        )}
        {smsResult && (
          <p className="mt-2 text-sm text-teal-800">{smsResult}</p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? t("common.loading") : t("jobs.service_done_confirm")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2.5 text-sm"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
