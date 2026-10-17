"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { countTrialsExpiringSoon } from "@/lib/admin/trial-ops";
import { useLocale } from "@/lib/i18n/locale-provider";

type ShopRow = {
  id: string;
  name: string;
  sector: string;
  status: string;
  planId: string;
  trialEndsAt: string | null;
};

export default function AdminDashboardPage() {
  const { t } = useLocale();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [shopsError, setShopsError] = useState<string | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const loadShops = useCallback(() => {
    setShopsLoading(true);
    setShopsError(null);
    void fetch("/api/admin/shops")
      .then((r) => r.json())
      .then((json: { ok?: boolean; shops?: ShopRow[]; error?: string }) => {
        if (json.ok && json.shops) setShops(json.shops);
        else setShopsError(json.error ?? t("admin.load_shops_error"));
      })
      .catch(() => setShopsError(t("admin.load_shops_error")))
      .finally(() => setShopsLoading(false));
  }, [t]);

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    void fetch("/api/admin/templates")
      .then((r) => r.json())
      .then((json: { ok?: boolean; templates?: unknown[]; source?: string }) => {
        if (json.templates) setTemplateCount(json.templates.length);
        if (!json.ok || json.source === "fallback") {
          setTemplatesError(t("admin.templates_load_failed"));
        }
      })
      .catch(() => setTemplatesError(t("admin.templates_load_failed")))
      .finally(() => setTemplatesLoading(false));
  }, [t]);

  useEffect(loadShops, [loadShops]);
  useEffect(loadTemplates, [loadTemplates]);

  const active = shops.filter((s) => s.status === "active" || s.status === "trialing").length;
  const expiringSoon = useMemo(() => countTrialsExpiringSoon(shops), [shops]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-bold text-white">{t("admin.platform_dashboard")}</h2>
      <p className="mt-2 text-slate-400">{t("admin.platform_subtitle")}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.total_shops")} value={shopsLoading ? "…" : shopsError ? "—" : String(shops.length)} />
        <StatCard label={t("admin.active_trial")} value={shopsLoading ? "…" : shopsError ? "—" : String(active)} />
        <StatCard
          label={t("admin.trials_expiring")}
          value={shopsLoading ? "…" : shopsError ? "—" : String(expiringSoon)}
          hint={t("admin.trials_expiring_hint")}
          tone={expiringSoon > 0 ? "amber" : "default"}
        />
        <StatCard
          label={t("admin.templates")}
          value={templatesLoading ? "…" : templateCount != null ? String(templateCount) : templatesError ? "—" : t("admin.trial_none")}
          hint={t("admin.templates_hint")}
        />
      </div>

      {expiringSoon > 0 && (
        <p className="mt-6 rounded-lg border border-amber-700/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          {t("admin.trials_expiring_banner").replace("{count}", String(expiringSoon))}{" "}
          <Link href="/admin/shops" className="font-semibold underline">
            {t("admin.view_all_shops")}
          </Link>
        </p>
      )}

      {(shopsError || templatesError) && (
        <div role="alert" className="mt-6 space-y-3">
          {shopsError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">
              <span>{shopsError}</span>
              <button type="button" onClick={loadShops} disabled={shopsLoading} className="rounded-lg border border-red-700 px-3 py-1.5 font-semibold hover:bg-red-900/40 disabled:opacity-50">
                {shopsLoading ? t("common.loading") : t("resilience.retry")}
              </button>
            </div>
          )}
          {templatesError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
              <span>{templatesError}</span>
              <button type="button" onClick={loadTemplates} disabled={templatesLoading} className="rounded-lg border border-amber-700 px-3 py-1.5 font-semibold hover:bg-amber-900/40 disabled:opacity-50">
                {templatesLoading ? t("common.loading") : t("resilience.retry")}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/shops/new"
          className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500"
        >
          {t("admin.create_new_shop")}
        </Link>
        <Link
          href="/admin/shops"
          className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900"
        >
          {t("admin.view_all_shops")}
        </Link>
        <Link
          href="/admin/messaging"
          className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900"
        >
          {t("admin.nav_messaging")}
        </Link>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "amber";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        tone === "amber"
          ? "border-amber-700/50 bg-amber-950/30"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <p className={`text-sm ${tone === "amber" ? "text-amber-200" : "text-slate-400"}`}>
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${tone === "amber" ? "text-amber-50" : "text-white"}`}>
        {value}
      </p>
      {hint && (
        <p className={`mt-1 text-xs ${tone === "amber" ? "text-amber-300/80" : "text-slate-500"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
