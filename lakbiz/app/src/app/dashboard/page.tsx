"use client";

import Link from "next/link";
import { DashboardStat } from "@/components/dashboard-stat";
import { SiteHeader } from "@/components/site-header";
import { formatLkr } from "@/lib/format";
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";

export default function DashboardPage() {
  const { data, ready, resetAll } = useAppStore();

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">Loading...</main>
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
            <h1 className="text-2xl font-bold text-slate-900">Owner dashboard</h1>
            <p className="text-slate-600">
              Live from your data · {stats.productCount} products ·{" "}
              {stats.saleCount} sales today
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/stock"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white"
            >
              + Add stock
            </Link>
            <Link
              href="/sales"
              className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700"
            >
              New sale
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStat
            labelEn="Today's sales"
            labelSi="අද විකුණුම"
            value={formatLkr(stats.todaySales)}
          />
          <DashboardStat
            labelEn="Today's profit"
            labelSi="අද ලාභය"
            value={formatLkr(stats.todayProfit)}
            hint="Sell price − buy price"
          />
          <DashboardStat
            labelEn="Products"
            labelSi="භාණ්ඩ"
            value={String(stats.productCount)}
          />
          <DashboardStat
            labelEn="Low stock items"
            labelSi="අවසන් වෙන තොග"
            value={String(stats.lowStockCount)}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStat
            labelEn="Credit outstanding"
            labelSi="ණය බිලි"
            value={formatLkr(stats.creditOutstanding)}
          />
          <DashboardStat
            labelEn="Supplier payables"
            labelSi="සැපයුම්කරු ණය"
            value={formatLkr(stats.payableOutstanding)}
          />
          <DashboardStat
            labelEn="Bank balance"
            labelSi="බැංකු ශේෂය"
            value={formatLkr(stats.bankBalance)}
          />
          <DashboardStat
            labelEn="Cheques due (7 days)"
            labelSi="ඉදිරියට චෙක්"
            value={String(stats.chequesDueSoonCount)}
          />
          <DashboardStat
            labelEn="Vehicles for sale"
            labelSi="වාහන තොග"
            value={String(stats.forSaleVehicleCount)}
          />
          <DashboardStat
            labelEn="Car profit (month)"
            labelSi="මාසික ලාභය"
            value={formatLkr(stats.vehicleProfitThisMonth)}
          />
        </div>

        {stats.aging60VehicleCount > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-amber-900">
                {stats.aging60VehicleCount} vehicle(s) 60+ days in yard
              </p>
              <Link href="/vehicles" className="text-sm text-amber-800 underline">
                View vehicles
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
                {stats.pendingACJobCount} AC installation(s) pending
              </p>
              <Link href="/jobs" className="text-sm text-sky-800 underline">
                View jobs
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
            <h2 className="font-semibold text-slate-900">Low stock alert</h2>
            {stats.lowStockItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">All good — no low items.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {stats.lowStockItems.map((p) => (
                  <li key={p.id}>
                    • {p.name} — {p.stockQty}{" "}
                    {String(p.customFields.unit ?? "pcs")} left
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Credit customers</h2>
            {stats.topDebtors.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No credit outstanding.</p>
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
              Manage customers
            </Link>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Supplier payables</h2>
            {stats.topPayables.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No payables.</p>
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
              Manage suppliers
            </Link>
          </section>
        </div>

        {data.products.length === 0 && (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-medium">Get started in 2 minutes</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                Go to <Link href="/stock" className="underline">Stock</Link> and
                add items
              </li>
              <li>
                Go to <Link href="/customers" className="underline">Customers</Link> for
                credit accounts
              </li>
              <li>
                Go to <Link href="/sales" className="underline">Sales</Link> and
                bill a customer
              </li>
              <li>
                <Link href="/banking" className="underline">Banking</Link> for
                cheques &amp; bank accounts
              </li>
            </ol>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          Data saved in this browser only.{" "}
          <button
            onClick={() => {
              if (confirm("Delete all local data?")) resetAll();
            }}
            className="underline hover:text-slate-600"
          >
            Reset all data
          </button>
        </p>
      </main>
    </div>
  );
}
