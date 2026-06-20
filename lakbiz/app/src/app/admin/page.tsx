"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";

type ShopRow = {
  id: string;
  name: string;
  sector: string;
  status: string;
  planId: string;
};

export default function AdminDashboardPage() {
  const { t } = useLocale();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/shops")
      .then((r) => r.json())
      .then((json: { ok?: boolean; shops?: ShopRow[]; error?: string }) => {
        if (json.ok && json.shops) setShops(json.shops);
        else setError(json.error ?? t("admin.load_shops_error"));
      });
  }, [t]);

  const active = shops.filter((s) => s.status === "active" || s.status === "trialing").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-bold text-white">{t("admin.platform_dashboard")}</h2>
      <p className="mt-2 text-slate-400">{t("admin.platform_subtitle")}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label={t("admin.total_shops")} value={String(shops.length)} />
        <StatCard label={t("admin.active_trial")} value={String(active)} />
        <StatCard
          label={t("admin.templates")}
          value="6"
          hint={t("admin.templates_hint")}
        />
      </div>

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
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
