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

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <DashboardStat
            labelEn="Stock value (cost)"
            labelSi="තොග වටිනාකම"
            value={formatLkr(stats.stockValue)}
          />
          <DashboardStat
            labelEn="Sales today"
            labelSi="අද බිල්"
            value={String(stats.saleCount)}
          />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
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
            <h2 className="font-semibold text-slate-900">Recent sales</h2>
            {stats.recentSales.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No sales yet.{" "}
                <Link href="/sales" className="text-teal-700 underline">
                  Create first sale
                </Link>
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {stats.recentSales.map((s) => (
                  <li key={s.id}>
                    • {formatLkr(s.total)} —{" "}
                    {s.lines.map((l) => l.productName).join(", ")}
                  </li>
                ))}
              </ul>
            )}
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
                Go to <Link href="/sales" className="underline">Sales</Link> and
                bill a customer
              </li>
              <li>Come back here — numbers update automatically</li>
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
