"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export default function NotificationsSettingsPage() {
  const { t } = useLocale();
  const [settings, setSettings] = useState<NotificationSettings>(
    defaultNotificationSettings(),
  );
  const [log, setLog] = useState<NotificationLogEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const apiEnabled = process.env.NEXT_PUBLIC_SMS_API_ENABLED === "true";

  useEffect(() => {
    setSettings(loadNotificationSettings());
    setLog(loadNotificationLog());
  }, []);

  const persist = (next: NotificationSettings) => {
    setSettings(next);
    saveNotificationSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">{t("msg.api_title")}</h2>
          <p className="mt-2 text-sm text-slate-600">{t("msg.api_desc")}</p>
          <ul className="mt-3 list-inside list-disc text-sm text-slate-600">
            <li>
              <code className="rounded bg-slate-100 px-1">FITSMS_API_TOKEN</code>
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">FITSMS_SENDER_ID</code>
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">
                NEXT_PUBLIC_SMS_API_ENABLED=true
              </code>
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            {apiEnabled ? t("msg.api_active") : t("msg.api_inactive")}
          </p>
          <a
            href="https://fitsms.lk"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline"
          >
            FitSMS.lk →
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
