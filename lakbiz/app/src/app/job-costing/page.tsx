"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, EmptyState, SearchInput, FilterBar } from "@/components/ui/primitives";
import { SelectInput, DateInput } from "@/components/ui/form";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import { formatLkr } from "@/lib/format";
import { jobStatusClass, jobStatusLabel } from "@/lib/ac-jobs";
import { jobTypeLabel } from "@/lib/ac-job-types";
import type { ACJobType } from "@/lib/ac-job-types";
import type { ACJob } from "@/lib/store/types";
import { fetchOrgExpenses } from "@/lib/supabase/expenses-client";
import { computeJobProfitability, isLowMarginJob, type JobProfitability, type JobLinkedExpense } from "@/lib/job-profitability";

type CostedJob = {
  job: ACJob;
  profit: JobProfitability;
};

type SortKey = "date" | "margin" | "marginPct" | "quoted";
type StatusFilter = "active" | "completed" | "all";

export default function JobCostingPage() {
  const { t, locale } = useLocale();
  const { org, orgRole } = useSubscription();
  const { data: localData, ready: localReady } = useAppStore();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ACJobType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  // Part 23 — date range, team/technician, and an "unrecorded costs"
  // quick filter, on top of the existing customer/status/type/sort ones.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [onlyUnrecorded, setOnlyUnrecorded] = useState(false);

  const canSeeFinancials = orgRole === "owner" || orgRole === "manager";
  const orgId = org.isAuthenticated ? org.id : null;

  // Expenses are cloud-only (not part of the local-first store — see
  // expenses-client.ts), so job-linked "other costs" (Phase 7) need
  // their own fetch here, same pattern as /expenses itself.
  const [jobLinkedExpenseTotals, setJobLinkedExpenseTotals] = useState<Map<string, JobLinkedExpense[]> | null>(null);
  useEffect(() => {
    if (!orgId || !canSeeFinancials) {
      setJobLinkedExpenseTotals(new Map());
      return;
    }
    let cancelled = false;
    void fetchOrgExpenses(orgId).then((result) => {
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
  }, [orgId, canSeeFinancials]);

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
          <EmptyState title={t("costing.no_access")} description={t("costing.no_access_hint")} />
        </ProMain>
      </AppShell>
    );
  }

  const jobItemsByJob = new Map<string, typeof localData.jobItems>();
  for (const item of localData.jobItems) {
    const list = jobItemsByJob.get(item.jobId) ?? [];
    list.push(item);
    jobItemsByJob.set(item.jobId, list);
  }

  const costed: CostedJob[] = localData.acJobs
    .filter((j) => statusFilter === "all" || (statusFilter === "completed" ? j.status === "completed" : j.status !== "cancelled" && j.status !== "completed"))
    .filter((j) => typeFilter === "all" || j.jobType === typeFilter)
    .filter((j) => !search.trim() || j.customerName.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((j) => !dateFrom || j.date >= dateFrom)
    .filter((j) => !dateTo || j.date <= dateTo)
    .filter((j) => technicianFilter === "all" || (j.assigneeType === "team" && j.assigneeId === technicianFilter))
    .filter((j) => !onlyUnrecorded || (jobItemsByJob.get(j.id) ?? []).length === 0)
    .map((j) => ({
      job: j,
      profit: computeJobProfitability(j, jobItemsByJob.get(j.id) ?? [], jobLinkedExpenseTotals.get(j.id) ?? []),
    }));

  const sorted = [...costed].sort((a, b) => {
    if (sortKey === "margin") return a.profit.grossProfit - b.profit.grossProfit;
    if (sortKey === "marginPct") return (a.profit.grossMarginPct ?? 0) - (b.profit.grossMarginPct ?? 0);
    if (sortKey === "quoted") return b.job.quotedAmount - a.job.quotedAmount;
    return b.job.date.localeCompare(a.job.date);
  });

  const totalQuoted = costed.reduce((s, c) => s + c.job.quotedAmount, 0);
  const totalCost = costed.reduce((s, c) => s + c.profit.totalCost, 0);
  const totalMargin = totalQuoted - totalCost;
  const avgMarginPct = totalQuoted > 0 ? (totalMargin / totalQuoted) * 100 : null;
  const totalMaterial = costed.reduce((s, c) => s + c.profit.materialCost, 0);
  const totalLabor = costed.reduce((s, c) => s + c.profit.laborCost, 0);
  const totalOther = costed.reduce((s, c) => s + c.profit.otherCost, 0);
  const unrecordedCount = costed.filter((c) => (jobItemsByJob.get(c.job.id) ?? []).length === 0).length;

  // Part 23 — "most profitable"/"lowest margin" as bounded, real lists
  // over the currently-filtered set (respects every filter above), not a
  // separate unfiltered global ranking — same defensible-rule discipline
  // as isLowMarginJob/LOW_MARGIN_THRESHOLD_PCT (job-profitability.ts).
  // Margin-assessable only: a job with revenue 0 has no percentage to
  // rank by (grossMarginPct is null), so it's excluded from both lists
  // rather than sorted as if 0% — same rule isLowMarginJob already uses.
  const assessable = costed.filter((c) => c.profit.grossMarginPct !== null);
  const mostProfitable = [...assessable].sort((a, b) => b.profit.grossProfit - a.profit.grossProfit).slice(0, 5);
  const lowestMargin = [...assessable].sort((a, b) => (a.profit.grossMarginPct ?? 0) - (b.profit.grossMarginPct ?? 0)).slice(0, 5);

  // External purchases by supplier (Part 23) — over the same filtered
  // job set's job_items, source === "purchased" (or flagged
  // purchasedForJob for a from-stock line that itself started as an
  // external purchase — see docs/JOB_PARTS_ARCHITECTURE.md §2.2).
  const purchasesBySupplier = new Map<string, { supplierName: string; total: number; count: number }>();
  for (const c of costed) {
    for (const item of jobItemsByJob.get(c.job.id) ?? []) {
      if (item.source !== "purchased" && !item.purchasedForJob) continue;
      const key = item.supplierId ?? "__unspecified";
      const supplierName = item.supplierId
        ? localData.suppliers.find((s) => s.id === item.supplierId)?.name ?? t("costing.unspecified_supplier")
        : t("costing.unspecified_supplier");
      const existing = purchasesBySupplier.get(key);
      if (existing) {
        existing.total += item.lineTotal;
        existing.count += 1;
      } else {
        purchasesBySupplier.set(key, { supplierName, total: item.lineTotal, count: 1 });
      }
    }
  }
  const supplierRows = [...purchasesBySupplier.values()].sort((a, b) => b.total - a.total);

  const marginTone = (margin: number) => (margin < 0 ? "text-rose-700" : margin === 0 ? "text-slate-600" : "text-emerald-700");

  const columns: DataTableColumn<CostedJob & { id: string }>[] = [
    {
      key: "job",
      header: t("costing.job"),
      render: (c) => (
        <div>
          <p className="font-semibold text-slate-900">{c.job.customerName}</p>
          <p className="mt-0.5 text-xs text-slate-500">{c.job.jobNo} · {jobTypeLabel(c.job.jobType, locale)}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      hideOnMobile: true,
      render: (c) => <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${jobStatusClass(c.job.status)}`}>{jobStatusLabel(c.job.status, locale)}</span>,
    },
    {
      key: "quoted",
      header: t("costing.quoted"),
      align: "right",
      render: (c) => formatLkr(c.job.quotedAmount),
    },
    {
      key: "cost",
      header: t("costing.cost"),
      align: "right",
      hideOnMobile: true,
      render: (c) => (
        <div>
          <p>{formatLkr(c.profit.totalCost)}</p>
          {c.profit.otherCost > 0 && <p className="text-xs text-slate-400">{t("costing.incl_other")} {formatLkr(c.profit.otherCost)}</p>}
        </div>
      ),
    },
    {
      key: "margin",
      header: t("costing.margin"),
      align: "right",
      render: (c) => (
        <div>
          <p className={`font-semibold ${marginTone(c.profit.grossProfit)}`}>{formatLkr(c.profit.grossProfit)}</p>
          {c.profit.grossMarginPct !== null && (
            <p className={`text-xs ${marginTone(c.profit.grossProfit)}`}>{c.profit.grossMarginPct.toFixed(1)}%</p>
          )}
          {isLowMarginJob(c.profit) && (
            <span className="mt-1 inline-flex rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
              {t("costing.low_margin")}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("costing.title")}
          description={`${costed.length} ${t("costing.jobs")}`}
          metrics={
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={t("costing.total_quoted")} value={formatLkr(totalQuoted)} />
              <MetricCard
                label={t("costing.total_cost")}
                value={formatLkr(totalCost)}
                hint={`${t("jobs.economics_material")} ${formatLkr(totalMaterial)} · ${t("jobs.economics_labor")} ${formatLkr(totalLabor)} · ${t("jobs.economics_other")} ${formatLkr(totalOther)}`}
              />
              <MetricCard label={t("costing.total_margin")} value={formatLkr(totalMargin)} tone={totalMargin < 0 ? "danger" : "positive"} />
              <MetricCard label={t("costing.avg_margin_pct")} value={avgMarginPct !== null ? `${avgMarginPct.toFixed(1)}%` : "—"} tone={avgMarginPct !== null && avgMarginPct < 0 ? "danger" : "default"} />
            </div>
          }
        />

        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={t("costing.search_placeholder")} className="min-w-[200px] flex-1" />
          <SelectInput
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { value: "active", label: t("costing.status_active") },
              { value: "completed", label: t("costing.status_completed") },
              { value: "all", label: t("cust.filter_all") },
            ]}
          />
          <SelectInput
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as "all" | ACJobType)}
            options={[
              { value: "all", label: t("cust.filter_all") },
              { value: "installation", label: jobTypeLabel("installation", locale) },
              { value: "service", label: jobTypeLabel("service", locale) },
              { value: "repair", label: jobTypeLabel("repair", locale) },
              { value: "inspection", label: jobTypeLabel("inspection", locale) },
              { value: "warranty", label: jobTypeLabel("warranty", locale) },
              { value: "other", label: jobTypeLabel("other", locale) },
            ]}
          />
          <SelectInput
            value={technicianFilter}
            onChange={setTechnicianFilter}
            options={[
              { value: "all", label: t("costing.technician_all") },
              ...localData.technicians.map((tech) => ({ value: tech.id, label: tech.name })),
            ]}
          />
          <DateInput value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} className="w-36" />
          <DateInput value={dateTo} onChange={setDateTo} min={dateFrom || undefined} className="w-36" />
          <button
            type="button"
            onClick={() => setOnlyUnrecorded((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              onlyUnrecorded ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t("costing.unrecorded_toggle")}{unrecordedCount > 0 ? ` (${unrecordedCount})` : ""}
          </button>
          <SelectInput
            value={sortKey}
            onChange={(v) => setSortKey(v as SortKey)}
            options={[
              { value: "date", label: t("costing.sort_date") },
              { value: "margin", label: t("costing.sort_margin") },
              { value: "marginPct", label: t("costing.sort_margin_pct") },
              { value: "quoted", label: t("costing.sort_quoted") },
            ]}
          />
        </FilterBar>

        {costed.length > 0 && (mostProfitable.length > 0 || lowestMargin.length > 0 || supplierRows.length > 0) && (
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            {mostProfitable.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("costing.most_profitable")}</p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {mostProfitable.map((c) => (
                    <li key={c.job.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate text-slate-900">{c.job.customerName}</span>
                      <span className="shrink-0 font-mono text-xs font-semibold text-emerald-700">{formatLkr(c.profit.grossProfit)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lowestMargin.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("costing.lowest_margin")}</p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {lowestMargin.map((c) => (
                    <li key={c.job.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate text-slate-900">{c.job.customerName}</span>
                      <span className={`shrink-0 font-mono text-xs font-semibold ${marginTone(c.profit.grossProfit)}`}>
                        {c.profit.grossMarginPct?.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {supplierRows.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("costing.purchases_by_supplier")}</p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {supplierRows.map((s) => (
                    <li key={s.supplierName} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate text-slate-900">{s.supplierName}</span>
                      <span className="shrink-0 font-mono text-xs font-semibold text-slate-700">{formatLkr(s.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {sorted.length === 0 ? (
          <EmptyState title={t("costing.no_jobs")} description={t("costing.no_jobs_hint")} />
        ) : (
          <DataTable columns={columns} rows={sorted.map((c) => ({ ...c, id: c.job.id }))} emptyState={<EmptyState title={t("sales.no_match")} />} />
        )}
      </ProMain>
    </AppShell>
  );
}
