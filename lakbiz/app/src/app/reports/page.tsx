"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, EmptyState, SectionHeader } from "@/components/ui/primitives";
import { SelectInput } from "@/components/ui/form";
import { ExportActions } from "@/components/export/export-actions";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import { formatLkr } from "@/lib/format";
import type { Sale } from "@/lib/store/types";
import { computeJobProfitability, isLowMarginJob, type JobLinkedExpense } from "@/lib/job-profitability";
import { fetchOrgExpenses } from "@/lib/supabase/expenses-client";
import { exportReportsCsv, printReportsSummary, type ReportsExportData } from "@/lib/export";

type Period = "7d" | "30d" | "month" | "all";

/** Module-level so "today" isn't computed inline during render (matches
 * the Date.now()-outside-render convention from Phases 4/5/7). */
function periodStartIso(period: Period, now: Date): string | null {
  if (period === "all") return null;
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const days = period === "7d" ? 7 : 30;
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  return start.toISOString().slice(0, 10);
}

function dayLabel(iso: string, locale: "si" | "en"): string {
  return new Date(iso).toLocaleDateString(locale === "si" ? "si-LK" : "en-LK", { day: "numeric", month: "short" });
}

export default function ReportsPage() {
  const { t, locale } = useLocale();
  const { org, orgRole, can } = useSubscription();
  const { data: localData, ready: localReady } = useAppStore();

  const [period, setPeriod] = useState<Period>("30d");

  const canSeeFinancials = orgRole === "owner" || orgRole === "manager";
  // Phase 24 — AC job performance section, gated on the plan feature
  // (not every sector has ac_jobs at all) same as /job-costing,
  // /dashboard, and /vat.
  const showAcJobs = can("ac_jobs");
  const canExport = can("export");

  // Job-linked expenses (Phase 7) are cloud-only (not part of the
  // local-first store), same fetch-on-mount pattern already used by
  // /job-costing, /dashboard, and /vat — see those for the precedent.
  const [jobLinkedExpenseTotals, setJobLinkedExpenseTotals] = useState<Map<string, JobLinkedExpense[]> | null>(null);
  useEffect(() => {
    if (!showAcJobs || !canSeeFinancials || !org.isAuthenticated || !org.id) {
      setJobLinkedExpenseTotals(new Map());
      return;
    }
    let cancelled = false;
    void fetchOrgExpenses(org.id).then((result) => {
      if (cancelled) return;
      const totals = new Map<string, JobLinkedExpense[]>();
      for (const e of result.data) {
        if (!e.jobId) continue;
        const list = totals.get(e.jobId) ?? [];
        list.push({ category: e.category, amount: e.amount });
        totals.set(e.jobId, list);
      }
      setJobLinkedExpenseTotals(totals);
    });
    return () => {
      cancelled = true;
    };
  }, [showAcJobs, canSeeFinancials, org.isAuthenticated, org.id]);

  if (!org.isAuthenticated || !localReady || !localData || !jobLinkedExpenseTotals) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  if (!canSeeFinancials) {
    return (
      <AppShell>
        <ProMain>
          <EmptyState title={t("reports.no_access")} description={t("reports.no_access_hint")} />
        </ProMain>
      </AppShell>
    );
  }

  const startIso = periodStartIso(period, new Date());
  const sales: Sale[] = localData.sales.filter((s) => !startIso || s.date >= startIso);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0;

  // Daily trend — always the last 14 days of activity within the filtered
  // set, regardless of period, so the chart stays readable even when
  // "all" is selected (a multi-year bar chart would be unreadable and
  // isn't the point of this view; the metrics above already cover totals
  // for the full period).
  // Sale.date is a full ISO timestamp (new Date().toISOString() at
  // creation, see createSale in store/actions.ts), not a plain
  // YYYY-MM-DD — bucket on the date portion only, or every key here
  // silently fails to match trendDays' plain-date keys below.
  const byDay = new Map<string, number>();
  for (const s of sales) {
    const day = s.date.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + s.total);
  }
  const trendDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const trendValues = trendDays.map((iso) => byDay.get(iso) ?? 0);
  const trendMax = Math.max(1, ...trendValues);

  const productTotals = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const s of sales) {
    for (const line of s.lines) {
      const entry = productTotals.get(line.productId) ?? { name: line.productName, qty: 0, revenue: 0 };
      entry.qty += line.qty;
      entry.revenue += line.qty * line.unitPrice;
      productTotals.set(line.productId, entry);
    }
  }
  const topProducts = Array.from(productTotals.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const customerTotals = new Map<string, { name: string; orders: number; total: number }>();
  for (const s of sales) {
    if (!s.customerId) continue;
    const entry = customerTotals.get(s.customerId) ?? { name: s.customerName ?? t("common.customer"), orders: 0, total: 0 };
    entry.orders += 1;
    entry.total += s.total;
    customerTotals.set(s.customerId, entry);
  }
  const topCustomers = Array.from(customerTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // AC job performance (Phase 24 — Reports/job-costing integration).
  // Reuses computeJobProfitability, the one authoritative job-cost
  // calculation (Phase 8), exactly as /job-costing, /dashboard, and
  // /vat already do — no re-derived formula. Period-filtered on
  // job.date the same way sales above are filtered on s.date, and
  // excludes cancelled jobs the same way dashboard's own "this month's
  // job profitability" section does — a cancelled job never happened
  // and has no real revenue/cost to report.
  const jobItemsByJob = new Map<string, typeof localData.jobItems>();
  for (const item of localData.jobItems) {
    const list = jobItemsByJob.get(item.jobId) ?? [];
    list.push(item);
    jobItemsByJob.set(item.jobId, list);
  }
  const periodJobs = showAcJobs
    ? localData.acJobs.filter((j) => (!startIso || j.date >= startIso) && j.status !== "cancelled")
    : [];
  const costedJobs = periodJobs.map((j) => ({
    job: j,
    profit: computeJobProfitability(j, jobItemsByJob.get(j.id) ?? [], jobLinkedExpenseTotals.get(j.id) ?? []),
  }));

  const totalQuoted = costedJobs.reduce((s, c) => s + c.job.quotedAmount, 0);
  const totalJobCost = costedJobs.reduce((s, c) => s + c.profit.totalCost, 0);
  const totalJobMargin = totalQuoted - totalJobCost;
  const lowMarginJobs = costedJobs
    .filter((c) => isLowMarginJob(c.profit))
    .sort((a, b) => a.profit.grossMarginPct! - b.profit.grossMarginPct!)
    .slice(0, 10);

  const periodLabel = t(
    period === "7d" ? "reports.period_7d"
      : period === "30d" ? "reports.period_30d"
      : period === "month" ? "reports.period_month"
      : "reports.period_all",
  );

  // Phase 24 follow-up — CSV/print export, the item explicitly flagged
  // as not-started when the AC job performance section shipped: the
  // per-domain export helpers (sales/customers/stock/VAT) don't fit
  // this page's aggregate shape, so it never had export at all. Mirrors
  // exactly what's rendered above — including omitting `acJobs`
  // entirely when this role/org doesn't see that section, never
  // exporting zeros for data that was never actually computed.
  const reportsExportData: ReportsExportData = {
    periodLabel,
    totalRevenue,
    totalProfit,
    salesCount: sales.length,
    avgSale,
    topProducts,
    topCustomers,
    ...(showAcJobs && {
      acJobs: {
        totalQuoted,
        totalCost: totalJobCost,
        totalMargin: totalJobMargin,
        lowMarginJobs: lowMarginJobs.map(({ job, profit }) => ({
          customerName: job.customerName,
          jobNo: job.jobNo,
          grossProfit: profit.grossProfit,
          grossMarginPct: profit.grossMarginPct ?? 0,
        })),
      },
    }),
  };
  const reportsExportLabels = {
    period: t("reports.period"),
    totalRevenue: t("reports.total_revenue"),
    totalProfit: t("reports.total_profit"),
    salesCount: t("reports.sales_count"),
    avgSale: t("reports.avg_sale"),
    topProducts: t("reports.top_products"),
    productName: t("common.name"),
    qty: t("common.qty"),
    revenue: t("reports.revenue"),
    topCustomers: t("reports.top_customers"),
    customerName: t("common.name"),
    orders: t("reports.orders"),
    total: t("common.total"),
    acJobsTitle: t("reports.ac_jobs_title"),
    totalQuoted: t("costing.total_quoted"),
    totalCost: t("costing.total_cost"),
    totalMargin: t("costing.total_margin"),
    jobsNeedingAttention: t("reports.jobs_needing_attention"),
    jobCustomer: t("common.customer"),
    jobNo: t("reports.job_no"),
    margin: t("costing.total_margin"),
    marginPct: t("reports.margin_pct"),
  };

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("reports.title")}
          description={t("reports.subtitle")}
          actions={
            <>
              <SelectInput
                value={period}
                onChange={(v) => setPeriod(v as Period)}
                options={[
                  { value: "7d", label: t("reports.period_7d") },
                  { value: "30d", label: t("reports.period_30d") },
                  { value: "month", label: t("reports.period_month") },
                  { value: "all", label: t("reports.period_all") },
                ]}
                className="w-40"
              />
              {canExport && (
                <ExportActions
                  disabled={sales.length === 0 && costedJobs.length === 0}
                  onExportCsv={() => exportReportsCsv(localData.business, reportsExportData, reportsExportLabels)}
                  onPrintPdf={() =>
                    printReportsSummary(localData.business, reportsExportData, reportsExportLabels, t("reports.title"))
                  }
                />
              )}
            </>
          }
          metrics={
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={t("reports.total_revenue")} value={formatLkr(totalRevenue)} />
              <MetricCard label={t("reports.total_profit")} value={formatLkr(totalProfit)} tone="positive" />
              <MetricCard label={t("reports.sales_count")} value={String(sales.length)} />
              <MetricCard label={t("reports.avg_sale")} value={formatLkr(avgSale)} />
            </div>
          }
        />

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <SectionHeader title={t("reports.trend_title")} />
          {trendValues.every((v) => v === 0) ? (
            <EmptyState title={t("reports.no_sales")} description={t("reports.no_sales_hint")} />
          ) : (
            <div className="flex h-40 items-end gap-1.5">
              {trendDays.map((iso, i) => (
                <div key={iso} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    title={`${dayLabel(iso, locale)}: ${formatLkr(trendValues[i])}`}
                    className={`w-full rounded-t ${trendValues[i] > 0 ? "bg-teal-500" : "bg-slate-100"}`}
                    style={{ height: `${Math.max(2, (trendValues[i] / trendMax) * 100)}%` }}
                  />
                  <span className="text-[10px] text-slate-400">{dayLabel(iso, locale)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <SectionHeader title={t("reports.top_products")} />
            {topProducts.length === 0 ? (
              <EmptyState title={t("reports.no_sales")} description={t("reports.no_sales_hint")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {topProducts.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.qty} {t("common.qty")}</p>
                    </div>
                    <span className="shrink-0 font-mono font-semibold text-teal-700">{formatLkr(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <SectionHeader title={t("reports.top_customers")} />
            {topCustomers.length === 0 ? (
              <EmptyState title={t("reports.no_customer_sales")} description={t("reports.no_customer_sales_hint")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {topCustomers.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.orders} {t("reports.orders")}</p>
                    </div>
                    <span className="shrink-0 font-mono font-semibold text-teal-700">{formatLkr(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {showAcJobs && (
          <div className="mt-4">
            <SectionHeader title={t("reports.ac_jobs_title")} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard label={t("costing.total_quoted")} value={formatLkr(totalQuoted)} />
              <MetricCard label={t("costing.total_cost")} value={formatLkr(totalJobCost)} />
              <MetricCard
                label={t("costing.total_margin")}
                value={formatLkr(totalJobMargin)}
                tone={totalJobMargin < 0 ? "danger" : "positive"}
              />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader title={t("reports.jobs_needing_attention")} />
              {costedJobs.length === 0 ? (
                <EmptyState title={t("reports.no_ac_jobs")} description={t("reports.no_ac_jobs_hint")} />
              ) : lowMarginJobs.length === 0 ? (
                <EmptyState title={t("reports.no_low_margin_jobs")} description={t("reports.no_low_margin_jobs_hint")} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {lowMarginJobs.map(({ job, profit }) => (
                    <li key={job.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{job.customerName}</p>
                        <p className="text-xs text-slate-500">{job.jobNo}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono font-semibold text-rose-700">{formatLkr(profit.grossProfit)}</p>
                        <p className="text-xs text-rose-600">{profit.grossMarginPct!.toFixed(1)}%</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </ProMain>
    </AppShell>
  );
}
