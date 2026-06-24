"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  DEFAULT_PLATFORM_MESSAGING_POLICY,
  type PlatformMessagingPolicy,
} from "@/lib/messaging/platform-policy";

export default function AdminMessagingPage() {
  const { t } = useLocale();
  const [policy, setPolicy] = useState<PlatformMessagingPolicy>(
    DEFAULT_PLATFORM_MESSAGING_POLICY,
  );
  const [textLkConfigured, setTextLkConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [customRemindDay, setCustomRemindDay] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    void fetch("/api/admin/messaging")
      .then((r) => r.json())
      .then(
        (json: {
          ok?: boolean;
          policy?: PlatformMessagingPolicy;
          textLkConfigured?: boolean;
          error?: string;
        }) => {
          if (json.ok && json.policy) {
            setPolicy(json.policy);
            setTextLkConfigured(json.textLkConfigured ?? null);
          } else {
            setMessage(json.error ?? t("admin.load_failed"));
          }
        },
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const save = async (next: PlatformMessagingPolicy) => {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/messaging", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      policy?: PlatformMessagingPolicy;
      error?: string;
    };
    setSaving(false);
    if (json.ok && json.policy) {
      setPolicy(json.policy);
      setMessage(t("admin.messaging_saved"));
    } else {
      setMessage(json.error ?? t("admin.save_failed"));
    }
  };

  const resetDefaults = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/messaging", { method: "POST" });
    const json = (await res.json()) as {
      ok?: boolean;
      policy?: PlatformMessagingPolicy;
      error?: string;
    };
    setSaving(false);
    if (json.ok && json.policy) {
      setPolicy(json.policy);
      setMessage(t("admin.messaging_reset"));
    } else {
      setMessage(json.error ?? t("admin.reset_failed"));
    }
  };

  const toggleRemindDay = (day: number) => {
    const active = policy.defaultRemindDays.includes(day);
    const next = active
      ? policy.defaultRemindDays.filter((d) => d !== day)
      : [...policy.defaultRemindDays, day];
    void save({
      ...policy,
      defaultRemindDays: [...new Set(next)].sort((a, b) => b - a),
    });
  };

  const toggleRenewalRemindDay = (day: number) => {
    const active = policy.subscriptionRenewalRemindDays.includes(day);
    const next = active
      ? policy.subscriptionRenewalRemindDays.filter((d) => d !== day)
      : [...policy.subscriptionRenewalRemindDays, day];
    void save({
      ...policy,
      subscriptionRenewalRemindDays: [...new Set(next)].sort((a, b) => b - a),
    });
  };

  const runRenewalCron = async () => {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/cron/subscription-renewal-reminders", {
      method: "POST",
    });
    const json = (await res.json()) as {
      ok?: boolean;
      sent?: number;
      matched?: number;
      skippedReason?: string;
      error?: string;
      errors?: string[];
    };
    setSaving(false);
    if (json.ok) {
      setMessage(
        t("admin.messaging_renewal_run_ok")
          .replace("{sent}", String(json.sent ?? 0))
          .replace("{matched}", String(json.matched ?? 0)),
      );
    } else {
      setMessage(
        json.skippedReason ??
          json.error ??
          json.errors?.[0] ??
          t("admin.failed"),
      );
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/admin" className="text-sm text-teal-400 hover:underline">
        ← {t("admin.nav_dashboard")}
      </Link>
      <h2 className="mt-4 text-2xl font-bold text-white">{t("admin.messaging_title")}</h2>
      <p className="mt-2 text-slate-400">{t("admin.messaging_subtitle")}</p>

      {message && (
        <p className="mt-4 rounded-lg bg-slate-800 px-4 py-3 text-sm text-teal-200">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-slate-400">{t("common.loading")}</p>
      ) : (
        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="font-semibold text-white">{t("admin.messaging_status")}</h3>
            <p className="mt-2 text-sm text-slate-400">
              {t("admin.messaging_textlk")}:{" "}
              <span className={textLkConfigured ? "text-teal-300" : "text-amber-300"}>
                {textLkConfigured ? t("admin.messaging_sms_ready") : t("admin.messaging_sms_missing")}
              </span>
            </p>
            <label className="mt-4 flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={policy.cronEnabled}
                onChange={(e) => void save({ ...policy, cronEnabled: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              {t("admin.messaging_cron_enabled")}
            </label>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="font-semibold text-white">{t("admin.messaging_limits")}</h3>
            <p className="mt-1 text-xs text-slate-500">{t("admin.messaging_limits_hint")}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                {t("admin.messaging_repeat_days")}
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={policy.serviceDueRepeatDays}
                  onChange={(e) =>
                    setPolicy({ ...policy, serviceDueRepeatDays: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  {t("admin.messaging_repeat_hint")}
                </span>
              </label>
              <label className="block text-sm text-slate-300">
                {t("admin.messaging_daily_limit")}
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={policy.dailySmsLimitPerOrg}
                  onChange={(e) =>
                    setPolicy({ ...policy, dailySmsLimitPerOrg: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </label>
              <label className="block text-sm text-slate-300 sm:col-span-2">
                {t("admin.messaging_max_length")}
                <input
                  type="number"
                  min={70}
                  max={2000}
                  value={policy.maxSmsLength}
                  onChange={(e) =>
                    setPolicy({ ...policy, maxSmsLength: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="font-semibold text-white">{t("admin.messaging_new_shop_defaults")}</h3>
            <p className="mt-1 text-xs text-slate-500">{t("admin.messaging_defaults_hint")}</p>

            <label className="mt-4 block text-sm text-slate-300">
              {t("msg.default_service_interval")}
              <select
                value={policy.defaultServiceIntervalDays}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    defaultServiceIntervalDays: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                <option value={90}>90 {t("jobs.days")}</option>
                <option value={180}>180 {t("jobs.days")}</option>
                <option value={365}>365 {t("jobs.days")}</option>
              </select>
            </label>

            <p className="mt-4 text-sm font-medium text-slate-300">{t("msg.remind_schedule")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[14, 7, 2, 0].map((day) => {
                const active = policy.defaultRemindDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleRemindDay(day)}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      active
                        ? "bg-teal-700 text-white"
                        : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {day === 0
                      ? t("msg.remind_day_of")
                      : t("msg.remind_days_before").replace("{{days}}", String(day))}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="block text-sm text-slate-300">
                {t("msg.remind_custom_days")}
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customRemindDay}
                  onChange={(e) => setCustomRemindDay(e.target.value)}
                  className="mt-1 w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const day = Number(customRemindDay);
                  if (day < 1 || day > 365) return;
                  if (policy.defaultRemindDays.includes(day)) return;
                  void save({
                    ...policy,
                    defaultRemindDays: [...policy.defaultRemindDays, day].sort(
                      (a, b) => b - a,
                    ),
                  });
                  setCustomRemindDay("");
                }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                {t("msg.remind_add_day")}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="font-semibold text-white">{t("admin.messaging_renewal_title")}</h3>
            <p className="mt-1 text-xs text-slate-500">{t("admin.messaging_renewal_hint")}</p>
            <label className="mt-4 flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={policy.subscriptionRenewalCronEnabled}
                onChange={(e) =>
                  void save({
                    ...policy,
                    subscriptionRenewalCronEnabled: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded"
              />
              {t("admin.messaging_renewal_cron_enabled")}
            </label>
            <p className="mt-4 text-sm font-medium text-slate-300">
              {t("admin.messaging_renewal_schedule")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[7, 3, 0].map((day) => {
                const active = policy.subscriptionRenewalRemindDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleRenewalRemindDay(day)}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      active
                        ? "bg-amber-700 text-white"
                        : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {day === 0
                      ? t("msg.remind_day_of")
                      : t("msg.remind_days_before").replace("{{days}}", String(day))}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={saving || !textLkConfigured}
              onClick={() => void runRenewalCron()}
              className="mt-4 rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
            >
              {t("admin.messaging_renewal_run_now")}
            </button>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(policy)}
              className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
            >
              {saving ? t("common.loading") : t("common.save")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void resetDefaults()}
              className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {t("admin.messaging_reset_btn")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
