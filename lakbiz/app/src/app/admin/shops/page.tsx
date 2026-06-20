"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sectorById } from "@/lib/sectors";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { SectorId } from "@/lib/types";

type ShopRow = {
  id: string;
  name: string;
  phone: string | null;
  sector: string;
  planId: string;
  status: string;
  trialEndsAt: string | null;
  ownerEmail: string | null;
  createdAt: string;
};

export default function AdminShopsPage() {
  const { t } = useLocale();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    void fetch("/api/admin/shops")
      .then((r) => r.json())
      .then((json: { ok?: boolean; shops?: ShopRow[]; error?: string }) => {
        if (json.ok && json.shops) setShops(json.shops);
        else setMessage(json.error ?? t("admin.failed"));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [t]);

  const suspend = async (id: string) => {
    const res = await fetch(`/api/admin/shops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "read_only" }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setMessage(json.ok ? t("admin.suspended_msg") : (json.error ?? t("admin.failed")));
    load();
  };

  const activate = async (id: string) => {
    const res = await fetch(`/api/admin/shops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setMessage(json.ok ? t("admin.activated_msg") : (json.error ?? t("admin.failed")));
    load();
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{t("admin.all_shops")}</h2>
          <p className="mt-1 text-slate-400">{t("admin.all_shops_sub")}</p>
        </div>
        <Link
          href="/admin/shops/new"
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
        >
          {t("admin.create_shop_btn")}
        </Link>
      </div>

      {message && (
        <p className="mt-4 rounded-lg bg-slate-800 px-4 py-3 text-sm text-teal-200">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-slate-400">{t("common.loading")}</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3">{t("admin.shop_col")}</th>
                <th className="px-4 py-3">{t("admin.template_col")}</th>
                <th className="px-4 py-3">{t("admin.owner_login_col")}</th>
                <th className="px-4 py-3">{t("admin.plan_col")}</th>
                <th className="px-4 py-3">{t("admin.status_col")}</th>
                <th className="px-4 py-3">{t("admin.actions_col")}</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const sector = sectorById(shop.sector as SectorId);
                return (
                  <tr key={shop.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{shop.name}</p>
                      <p className="text-xs text-slate-500">{shop.phone ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="mr-1">{sector?.icon ?? "🏪"}</span>
                      {sector?.nameEn ?? shop.sector}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {shop.ownerEmail ?? "—"}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-300">
                      {shop.planId}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-300">
                      {shop.status}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {shop.status === "read_only" || shop.status === "canceled" ? (
                          <button
                            type="button"
                            onClick={() => activate(shop.id)}
                            className="rounded-lg bg-teal-800 px-2 py-1 text-xs text-white"
                          >
                            {t("admin.activate")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => suspend(shop.id)}
                            className="rounded-lg bg-amber-900 px-2 py-1 text-xs text-amber-100"
                          >
                            {t("admin.suspend")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shops.length === 0 && (
            <p className="px-4 py-8 text-center text-slate-500">{t("admin.no_shops")}</p>
          )}
        </div>
      )}
    </main>
  );
}
