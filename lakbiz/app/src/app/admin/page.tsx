"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/shops")
      .then((r) => r.json())
      .then((json: { ok?: boolean; shops?: ShopRow[]; error?: string }) => {
        if (json.ok && json.shops) setShops(json.shops);
        else setError(json.error ?? t("admin.load_shops_error"));
      });
  }, [t]);

  useEffect(() => {
    void fetch("/api/admin/templates")
      .then((r) => r.json())
      .then((json: { ok?: boolean; templates?: unknown[]; source?: string }) => {
        if (json.templates) setTemplateCount(json.templates.length);
        if (!json.ok || json.source === "fallback") {
          setError((prev) => prev ?? t("admin.templates_load_failed"));
        }
      })
      .catch(() => {
        setError((prev) => prev ?? t("admin.templates_load_failed"));
      });
  }, [t]);

  const active = shops.filter((s) => s.status === "active" || s.status === "trialing").length;
  const expiringSoon = useMemo(() => countTrialsExpiringSoon(shops), [shops]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-bold text-white">{t("admin.platform_dashboard")}</h2>
      <p className="mt-2 text-slate-400">{t("admin.platform_subtitle")}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.total_shops")} value={String(shops.length)} />
        <StatCard label={t("admin.active_trial")} value={String(active)} />
        <StatCard
          label={t("admin.trials_expiring")}
          value={String(expiringSoon)}
          hint={t("admin.trials_expiring_hint")}
          tone={expiringSoon > 0 ? "amber" : "default"}
        />
        <StatCard
          label={t("admin.templates")}
          value={templateCount != null ? String(templateCount) : t("admin.trial_none")}
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

      {error && (
        <p className="mt-6 rounded-lg bg-red-950/50 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
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
