"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { daysUntilIso, isTrialExpiringSoon } from "@/lib/admin/trial-ops";
import {
  adminPlanLabel,
  adminSectorLabel,
  adminStatusLabel,
  formatAdminDate,
} from "@/lib/admin/admin-labels";
import { sectorById } from "@/lib/sectors";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { Locale } from "@/lib/i18n/translations";
import type { SectorId } from "@/lib/types";

import type { BillingCycle, PlanId } from "@/lib/subscription/types";

const PLAN_IDS: PlanId[] = ["starter", "business", "pro"];

type ShopRow = {
  id: string;
  name: string;
  phone: string | null;
  sector: string;
  planId: string;
  status: string;
  billingCycle: BillingCycle;
  trialEndsAt: string | null;
  ownerEmail: string | null;
  createdAt: string;
};

function trialDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatTrialEnd(iso: string | null, locale: Locale, emptyLabel: string): string {
  return formatAdminDate(iso, locale, emptyLabel);
}

export default function AdminShopsPage() {
  const { t, locale } = useLocale();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [trialDates, setTrialDates] = useState<Record<string, string>>({});
  const [savingTrialId, setSavingTrialId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    void fetch("/api/admin/shops")
      .then((r) => r.json())
      .then((json: { ok?: boolean; shops?: ShopRow[]; error?: string }) => {
        if (json.ok && json.shops) {
          setShops(json.shops);
          setTrialDates(
            Object.fromEntries(
              json.shops.map((shop) => [shop.id, trialDateInputValue(shop.trialEndsAt)]),
            ),
          );
        } else {
          setMessage(json.error ?? t("admin.failed"));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [t]);

  const patchShop = async (
    id: string,
    body: Record<string, unknown>,
    successMsg: string,
  ) => {
    setSavingTrialId(id);
    const res = await fetch(`/api/admin/shops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setSavingTrialId(null);
    setMessage(json.ok ? successMsg : (json.error ?? t("admin.failed")));
    if (json.ok) load();
  };

  const suspend = (id: string) =>
    void patchShop(id, { status: "read_only" }, t("admin.suspended_msg"));

  const activate = (id: string) =>
    void patchShop(id, { status: "active" }, t("admin.activated_msg"));

  const extendTrial = (id: string, extendTrialDays: number) =>
    void patchShop(id, { extendTrialDays }, t("admin.trial_extended_msg"));

  const saveTrialDate = (id: string) => {
    const date = trialDates[id]?.trim();
    if (!date) return;
    void patchShop(id, { trialEndsAt: date }, t("admin.trial_extended_msg"));
  };

  const setBillingCycle = (id: string, billingCycle: BillingCycle) =>
    void patchShop(id, { billingCycle }, t("admin.billing_cycle_updated"));

  const setPlan = (id: string, planId: PlanId) =>
    void patchShop(id, { planId }, t("admin.plan_updated"));

  const expiringCount = useMemo(
    () => shops.filter((shop) => isTrialExpiringSoon(shop.status, shop.trialEndsAt)).length,
    [shops],
  );

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

      {expiringCount > 0 && (
        <p className="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          {t("admin.trials_expiring_banner").replace("{count}", String(expiringCount))}
        </p>
      )}

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
                <th className="px-4 py-3">{t("admin.trial_col")}</th>
                <th className="px-4 py-3">{t("admin.actions_col")}</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const sector = sectorById(shop.sector as SectorId);
                const saving = savingTrialId === shop.id;
                const expiringSoon = isTrialExpiringSoon(shop.status, shop.trialEndsAt);
                const daysLeft = daysUntilIso(shop.trialEndsAt);
                return (
                  <tr
                    key={shop.id}
                    className={`border-t border-slate-800 ${
                      expiringSoon ? "bg-amber-950/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{shop.name}</p>
                      <p className="text-xs text-slate-500">{shop.phone ?? t("admin.trial_none")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="mr-1">{sector?.icon ?? "🏪"}</span>
                      {adminSectorLabel(locale, shop.sector)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {shop.ownerEmail ?? t("admin.trial_none")}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <select
                        value={shop.planId}
                        onChange={(e) => setPlan(shop.id, e.target.value as PlanId)}
                        disabled={saving}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                      >
                        {PLAN_IDS.map((planId) => (
                          <option key={planId} value={planId}>
                            {adminPlanLabel(t, planId)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={shop.billingCycle}
                        onChange={(e) =>
                          setBillingCycle(shop.id, e.target.value as BillingCycle)
                        }
                        disabled={saving}
                        className="mt-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                      >
                        <option value="monthly">{t("sub.monthly")}</option>
                        <option value="annual">{t("sub.annual")}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {adminStatusLabel(t, shop.status)}
                      {expiringSoon && daysLeft != null && (
                        <span className="ml-2 rounded-full bg-amber-900/80 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-100">
                          {t("admin.trial_days_left").replace("{days}", String(daysLeft))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300">
                        {shop.trialEndsAt
                          ? formatTrialEnd(shop.trialEndsAt, locale, t("admin.trial_none"))
                          : t("admin.trial_none")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <input
                          type="date"
                          value={trialDates[shop.id] ?? ""}
                          onChange={(e) =>
                            setTrialDates((prev) => ({
                              ...prev,
                              [shop.id]: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                          disabled={saving}
                        />
                        <button
                          type="button"
                          onClick={() => saveTrialDate(shop.id)}
                          disabled={saving || !trialDates[shop.id]}
                          className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-teal-200 disabled:opacity-50"
                        >
                          {t("admin.trial_save")}
                        </button>
                        <button
                          type="button"
                          onClick={() => extendTrial(shop.id, 7)}
                          disabled={saving}
                          className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                        >
                          {t("admin.trial_extend_7")}
                        </button>
                        <button
                          type="button"
                          onClick={() => extendTrial(shop.id, 14)}
                          disabled={saving}
                          className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                        >
                          {t("admin.trial_extend_14")}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {shop.status !== "active" && (
                          <button
                            type="button"
                            onClick={() => activate(shop.id)}
                            disabled={saving}
                            className="rounded-lg bg-teal-800 px-2 py-1 text-xs text-white disabled:opacity-50"
                          >
                            {t("admin.activate")}
                          </button>
                        )}
                        {(shop.status === "active" || shop.status === "trialing") && (
                          <button
                            type="button"
                            onClick={() => suspend(shop.id)}
                            disabled={saving}
                            className="rounded-lg bg-amber-900 px-2 py-1 text-xs text-amber-100 disabled:opacity-50"
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
