"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, EmptyState, SearchInput, FilterBar } from "@/components/ui/primitives";
import { SelectInput } from "@/components/ui/form";
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
              <MetricCard label={t("costing.total_cost")} value={formatLkr(totalCost)} />
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

        {sorted.length === 0 ? (
          <EmptyState title={t("costing.no_jobs")} description={t("costing.no_jobs_hint")} />
        ) : (
          <DataTable columns={columns} rows={sorted.map((c) => ({ ...c, id: c.job.id }))} emptyState={<EmptyState title={t("sales.no_match")} />} />
        )}
      </ProMain>
    </AppShell>
  );
}
