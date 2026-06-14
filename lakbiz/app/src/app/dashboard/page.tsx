"use client";

import Link from "next/link";
import { DashboardStat } from "@/components/dashboard-stat";
import { SiteHeader } from "@/components/site-header";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";

export default function DashboardPage() {
  const { data, ready, resetAll } = useAppStore();
  const { t } = useLocale();

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">{t("common.loading")}</main>
      </div>
    );
  }

  const stats = getDashboardStats(data);

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("dash.title")}</h1>
            <p className="text-slate-600">
              {t("dash.live")} · {stats.productCount} {t("dash.products")} ·{" "}
              {stats.saleCount} {t("dash.sales_today")}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/stock"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white"
            >
              {t("dash.add_stock")}
            </Link>
            <Link
              href="/sales"
              className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700"
            >
              {t("dash.new_sale")}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStat
            labelKey="dash.today_sales"
            value={formatLkr(stats.todaySales)}
          />
          <DashboardStat
            labelKey="dash.today_profit"
            value={formatLkr(stats.todayProfit)}
            hintKey="dash.profit_hint"
          />
          <DashboardStat
            labelKey="dash.products"
            value={String(stats.productCount)}
          />
          <DashboardStat
            labelKey="dash.low_stock"
            value={String(stats.lowStockCount)}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStat
            labelKey="dash.credit_out"
            value={formatLkr(stats.creditOutstanding)}
          />
          <DashboardStat
            labelKey="dash.supplier_pay"
            value={formatLkr(stats.payableOutstanding)}
          />
          <DashboardStat
            labelKey="dash.bank_balance"
            value={formatLkr(stats.bankBalance)}
          />
          <DashboardStat
            labelKey="dash.cheques_due"
            value={String(stats.chequesDueSoonCount)}
          />
          <DashboardStat
            labelKey="dash.vehicles_sale"
            value={String(stats.forSaleVehicleCount)}
          />
          <DashboardStat
            labelKey="dash.car_profit_month"
            value={formatLkr(stats.vehicleProfitThisMonth)}
          />
        </div>

        {stats.aging60VehicleCount > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-amber-900">
                {stats.aging60VehicleCount} {t("dash.vehicles_aging")}
              </p>
              <Link href="/vehicles" className="text-sm text-amber-800 underline">
                {t("dash.view_vehicles")}
              </Link>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {stats.aging60Vehicles.map((v) => (
                <li key={v.id}>
                  • {v.make} {v.model} {v.year} — {formatLkr(v.askPrice)} (
                  {v.stockId})
                </li>
              ))}
            </ul>
          </div>
        )}

        {stats.pendingACJobCount > 0 && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-sky-900">
                {stats.pendingACJobCount} {t("dash.ac_pending")}
              </p>
              <Link href="/jobs" className="text-sm text-sky-800 underline">
                {t("dash.view_jobs")}
              </Link>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-sky-800">
              {stats.pendingACJobs.map((j) => (
                <li key={j.id}>
                  • {j.customerName} — {j.description} ({j.jobNo})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">
              {t("dash.low_stock_alert")}
            </h2>
            {stats.lowStockItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{t("dash.all_good_stock")}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {stats.lowStockItems.map((p) => (
                  <li key={p.id}>
                    • {p.name} — {p.stockQty}{" "}
                    {String(p.customFields.unit ?? "pcs")}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">
              {t("dash.credit_customers")}
            </h2>
            {stats.topDebtors.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{t("dash.no_credit")}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {stats.topDebtors.map((c) => (
                  <li key={c.id}>
                    • {c.name} — {formatLkr(c.creditBalance)}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/customers"
              className="mt-3 inline-block text-sm text-teal-700 underline"
            >
              {t("dash.manage_customers")}
            </Link>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">
              {t("dash.supplier_payables")}
            </h2>
            {stats.topPayables.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{t("dash.no_payables")}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {stats.topPayables.map((s) => (
                  <li key={s.id}>
                    • {s.name} — {formatLkr(s.payableBalance)}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/suppliers"
              className="mt-3 inline-block text-sm text-teal-700 underline"
            >
              {t("dash.manage_suppliers")}
            </Link>
          </section>
        </div>

        {data.products.length === 0 && (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-medium">{t("dash.get_started")}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                <Link href="/stock" className="underline">
                  {t("nav.stock")}
                </Link>
              </li>
              <li>
                <Link href="/customers" className="underline">
                  {t("nav.customers")}
                </Link>
              </li>
              <li>
                <Link href="/sales" className="underline">
                  {t("nav.sales")}
                </Link>
              </li>
              <li>
                <Link href="/banking" className="underline">
                  {t("nav.banking")}
                </Link>
              </li>
            </ol>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          {t("common.saved_browser")}{" "}
          <button
            onClick={() => {
              if (confirm(t("common.confirm_delete"))) resetAll();
            }}
            className="underline hover:text-slate-600"
          >
            {t("common.reset_data")}
          </button>
        </p>
      </main>
    </div>
  );
}
