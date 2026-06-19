"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  defaultNotificationSettings,
  loadNotificationLog,
  loadNotificationSettings,
  saveNotificationSettings,
  type MessageChannel,
  type NotificationLogEntry,
  type NotificationSettings,
} from "@/lib/messaging";
import { formatSlPhoneDisplay } from "@/lib/messaging";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import {
  fetchOrgNotificationSettings,
  saveOrgNotificationSettings,
} from "@/lib/supabase/org-notification-settings";

export default function NotificationsSettingsPage() {
  const { t } = useLocale();
  const { org } = useSubscription();
  const [settings, setSettings] = useState<NotificationSettings>(
    defaultNotificationSettings(),
  );
  const [customRemindDay, setCustomRemindDay] = useState("");
  const [log, setLog] = useState<NotificationLogEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);
  const apiEnabled = process.env.NEXT_PUBLIC_SMS_API_ENABLED === "true";

  useEffect(() => {
    const local = loadNotificationSettings();
    setSettings(local);
    setLog(loadNotificationLog());

    if (!org.id) return;

    fetchOrgNotificationSettings(org.id).then((cloud) => {
      if (cloud) {
        setSettings((prev) => ({ ...prev, ...cloud }));
        saveNotificationSettings({ ...local, ...cloud });
      }
    });
  }, [org.id]);

  const persist = useCallback(
    async (next: NotificationSettings) => {
      setSettings(next);
      saveNotificationSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      if (!org.id) return;

      const err = await saveOrgNotificationSettings(org.id, next);
      setCloudError(err);
    },
    [org.id],
  );

  const runBatchNow = async () => {
    setBatchRunning(true);
    setBatchResult(null);
    try {
      const res = await fetch("/api/cron/service-due-reminders", {
        method: "POST",
      });
      const data = (await res.json()) as {
        sent?: number;
        failed?: number;
        skippedDuplicate?: number;
        skippedNoPhone?: number;
        error?: string;
        skippedReason?: string;
      };
      if (!res.ok) {
        setBatchResult(data.error ?? data.skippedReason ?? "Failed");
        return;
      }
      const skipped =
        (data.skippedDuplicate ?? 0) + (data.skippedNoPhone ?? 0);
      setBatchResult(
        t("msg.send_service_due_result")
          .replace("{{sent}}", String(data.sent ?? 0))
          .replace("{{failed}}", String(data.failed ?? 0))
          .replace("{{skipped}}", String(skipped)),
      );
    } catch {
      setBatchResult("Network error");
    } finally {
      setBatchRunning(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6">
          <Link
            href="/settings/billing"
            className="text-sm text-teal-700 hover:underline"
          >
            ← {t("nav.billing")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {t("msg.settings_title")}
          </h1>
          <p className="text-slate-600">{t("msg.settings_subtitle")}</p>
        </div>

        {saved && (
          <div className="mb-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {t("msg.settings_saved")}
          </div>
        )}
        {cloudError && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Cloud sync: {cloudError}
          </div>
        )}

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">{t("msg.prefs_title")}</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              {t("msg.default_channel")}
              <select
                value={settings.defaultChannel}
                onChange={(e) =>
                  persist({
                    ...settings,
                    defaultChannel: e.target.value as MessageChannel,
                  })
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="whatsapp">{t("msg.whatsapp")}</option>
                <option value="sms">{t("msg.sms")}</option>
                {apiEnabled && (
                  <option value="api_sms">{t("msg.api_sms")}</option>
                )}
              </select>
            </label>

            <label className="block text-sm">
              {t("msg.default_language")}
              <select
                value={settings.preferredLanguage}
                onChange={(e) =>
                  persist({
                    ...settings,
                    preferredLanguage: e.target.value as "si" | "en",
                  })
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="si">සිංහල</option>
                <option value="en">English</option>
              </select>
            </label>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings.autoPromptOnJobStatus}
                onChange={(e) =>
                  persist({
                    ...settings,
                    autoPromptOnJobStatus: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              {t("msg.auto_prompt_jobs")}
            </label>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50/80 to-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            {t("msg.auto_service_due_title")}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("msg.auto_service_due_desc")}
          </p>
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings.autoSendServiceDueSms}
                onChange={(e) =>
                  persist({
                    ...settings,
                    autoSendServiceDueSms: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300"
                disabled={!apiEnabled}
              />
              {t("msg.auto_send_service_due")}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                {t("msg.service_due_repeat_days")}
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={settings.serviceDueRepeatDays}
                  onChange={(e) =>
                    persist({
                      ...settings,
                      serviceDueRepeatDays: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            </div>

            <div className="pt-2">
              <p className="text-sm font-medium text-slate-800">
                {t("msg.remind_schedule")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[14, 7, 2, 0].map((day) => {
                  const active = settings.serviceDueRemindDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? settings.serviceDueRemindDays.filter((d) => d !== day)
                          : [...settings.serviceDueRemindDays, day];
                        persist({
                          ...settings,
                          serviceDueRemindDays: [...new Set(next)].sort(
                            (a, b) => b - a,
                          ),
                        });
                      }}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        active
                          ? "bg-cyan-700 text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {day === 0
                        ? t("msg.remind_day_of")
                        : t("msg.remind_days_before").replace(
                            "{{days}}",
                            String(day),
                          )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="block text-sm">
                  {t("msg.remind_custom_days")}
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={customRemindDay}
                    onChange={(e) => setCustomRemindDay(e.target.value)}
                    placeholder="2"
                    className="mt-1 w-24 rounded-lg border px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const day = Number(customRemindDay);
                    if (day < 1 || day > 365) return;
                    if (settings.serviceDueRemindDays.includes(day)) return;
                    persist({
                      ...settings,
                      serviceDueRemindDays: [
                        ...settings.serviceDueRemindDays,
                        day,
                      ].sort((a, b) => b - a),
                    });
                    setCustomRemindDay("");
                  }}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  {t("msg.remind_add_day")}
                </button>
              </div>
              {settings.serviceDueRemindDays.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  {t("msg.remind_active")}:{" "}
                  {settings.serviceDueRemindDays.join(", ")}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <label className="block text-sm">
                {t("msg.default_service_interval")}
                <select
                  value={settings.defaultServiceIntervalDays}
                  onChange={(e) =>
                    persist({
                      ...settings,
                      defaultServiceIntervalDays: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value={90}>90 {t("jobs.days")}</option>
                  <option value={180}>180 {t("jobs.days")}</option>
                  <option value={365}>365 {t("jobs.days")}</option>
                </select>
              </label>
            </div>

            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.autoSendOnServiceComplete}
                onChange={(e) =>
                  persist({
                    ...settings,
                    autoSendOnServiceComplete: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300"
                disabled={!apiEnabled}
              />
              {t("msg.auto_send_on_service_complete")}
            </label>

            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <label className="block text-sm">
                {t("msg.owner_phone")}
                <input
                  type="tel"
                  value={settings.ownerPhone}
                  onChange={(e) =>
                    persist({ ...settings, ownerPhone: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  placeholder="07XXXXXXXX"
                />
              </label>
              <label className="block text-sm">
                {t("msg.technician_phone")}
                <input
                  type="tel"
                  value={settings.technicianPhone}
                  onChange={(e) =>
                    persist({ ...settings, technicianPhone: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  placeholder="07XXXXXXXX"
                />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.notifyCustomerOnServiceDue}
                onChange={(e) =>
                  persist({
                    ...settings,
                    notifyCustomerOnServiceDue: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              {t("msg.notify_customer_service_due")}
            </label>

            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.notifyOwnerOnServiceDue}
                onChange={(e) =>
                  persist({
                    ...settings,
                    notifyOwnerOnServiceDue: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              {t("msg.notify_owner_service_due")}
            </label>

            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.notifyTechnicianOnServiceDue}
                onChange={(e) =>
                  persist({
                    ...settings,
                    notifyTechnicianOnServiceDue: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              {t("msg.notify_technician_service_due")}
            </label>

            {apiEnabled && org.id && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={runBatchNow}
                  disabled={batchRunning}
                  className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-60"
                >
                  {batchRunning
                    ? t("msg.send_service_due_running")
                    : t("msg.send_service_due_now")}
                </button>
                {batchResult && (
                  <span className="text-sm text-slate-600">{batchResult}</span>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">{t("msg.api_title")}</h2>
          <p className="mt-2 text-sm text-slate-600">{t("msg.api_desc")}</p>
          <ul className="mt-3 list-inside list-disc text-sm text-slate-600">
            <li>
              <code className="rounded bg-slate-100 px-1">TEXTLK_API_TOKEN</code>
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">TEXTLK_SENDER_ID</code>
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">
                NEXT_PUBLIC_SMS_API_ENABLED=true
              </code>
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">CRON_SECRET</code> (
              Vercel Cron)
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">
                SUPABASE_SERVICE_ROLE_KEY
              </code>
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            {apiEnabled ? t("msg.api_active") : t("msg.api_inactive")}
          </p>
          <a
            href="https://app.text.lk/senderid"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline"
          >
            Text.lk Sender ID →
          </a>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">{t("msg.log_title")}</h2>
          {log.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t("msg.log_empty")}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {log.slice(0, 15).map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">
                      {entry.recipientName}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                      {entry.channel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {formatSlPhoneDisplay(entry.recipientPhone)} ·{" "}
                    {new Date(entry.sentAt).toLocaleString("en-LK")}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                    {entry.messageBody}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
