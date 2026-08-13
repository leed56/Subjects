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

type CostedJob = {
  job: ACJob;
  itemsCost: number;
  subcontractCost: number;
  /** HVAC platform Phase 7 — job-linked Expenses rows (parking, equipment
   * rental, outsourced repair, etc.), excluding "subcontractor" as a
   * category since that cost already lives in subcontractCost above. */
  otherCost: number;
  totalCost: number;
  margin: number;
  marginPct: number | null;
};

function costJob(job: ACJob, itemsCost: number, otherCost: number): CostedJob {
  const subcontractCost = job.assigneeType === "contractor" ? job.subcontractCost ?? 0 : 0;
  const totalCost = itemsCost + subcontractCost + otherCost;
  const margin = job.quotedAmount - totalCost;
  const marginPct = job.quotedAmount > 0 ? (margin / job.quotedAmount) * 100 : null;
  return { job, itemsCost, subcontractCost, otherCost, totalCost, margin, marginPct };
}

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
  const [jobLinkedExpenseTotals, setJobLinkedExpenseTotals] = useState<Map<string, number> | null>(null);
  useEffect(() => {
    if (!orgId || !canSeeFinancials) {
      setJobLinkedExpenseTotals(new Map());
      return;
    }
    let cancelled = false;
    void fetchOrgExpenses(orgId).then((result) => {
      if (cancelled) return;
      const totals = new Map<string, number>();
      for (const e of result.data) {
        if (!e.jobId) continue;
        totals.set(e.jobId, (totals.get(e.jobId) ?? 0) + e.amount);
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

  const itemsCostByJob = new Map<string, number>();
  for (const item of localData.jobItems) {
    itemsCostByJob.set(item.jobId, (itemsCostByJob.get(item.jobId) ?? 0) + item.lineTotal);
  }

  const costed = localData.acJobs
    .filter((j) => statusFilter === "all" || (statusFilter === "completed" ? j.status === "completed" : j.status !== "cancelled" && j.status !== "completed"))
    .filter((j) => typeFilter === "all" || j.jobType === typeFilter)
    .filter((j) => !search.trim() || j.customerName.toLowerCase().includes(search.trim().toLowerCase()))
    .map((j) => costJob(j, itemsCostByJob.get(j.id) ?? 0, jobLinkedExpenseTotals.get(j.id) ?? 0));

  const sorted = [...costed].sort((a, b) => {
    if (sortKey === "margin") return a.margin - b.margin;
    if (sortKey === "marginPct") return (a.marginPct ?? 0) - (b.marginPct ?? 0);
    if (sortKey === "quoted") return b.job.quotedAmount - a.job.quotedAmount;
    return b.job.date.localeCompare(a.job.date);
  });

  const totalQuoted = costed.reduce((s, c) => s + c.job.quotedAmount, 0);
  const totalCost = costed.reduce((s, c) => s + c.totalCost, 0);
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
          <p>{formatLkr(c.totalCost)}</p>
          {c.otherCost > 0 && <p className="text-xs text-slate-400">{t("costing.incl_other")} {formatLkr(c.otherCost)}</p>}
        </div>
      ),
    },
    {
      key: "margin",
      header: t("costing.margin"),
      align: "right",
      render: (c) => (
        <div>
          <p className={`font-semibold ${marginTone(c.margin)}`}>{formatLkr(c.margin)}</p>
          {c.marginPct !== null && <p className={`text-xs ${marginTone(c.margin)}`}>{c.marginPct.toFixed(1)}%</p>}
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
