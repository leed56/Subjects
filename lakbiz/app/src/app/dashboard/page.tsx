"use client";

/**
 * Owner dashboard — operational command center (dashboard refinement pass).
 *
 * Rebuilt from the original card-grid dashboard around one priority order:
 * TODAY → OPERATIONS → NEEDS ATTENTION → FINANCIAL POSITION → TREND. Every
 * number here is read from `getDashboardStats()` (extended, not duplicated)
 * plus the existing `getVatQuarterSummary`/`getIncomeTaxYearSummary` — no
 * new Supabase queries, no fabricated data. See docs/IMPLEMENTATION_PROGRESS.md
 * for the full before/after writeup.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AcServiceDoneDialog } from "@/components/ac-service-done-dialog";
import { OfflineSyncNotice } from "@/components/offline-sync-notice";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import {
  PageHeader,
  MetricCard,
  SectionHeader,
  EmptyState,
  StatusBadge,
  ActionMenu,
} from "@/components/ui/primitives";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/overlay";
import { CallLink, NavigateLink } from "@/components/ui/field-links";
import { jobStatusLabel } from "@/lib/ac-jobs";
import { jobTypeLabel } from "@/lib/ac-job-types";
import { formatLkr } from "@/lib/format";
import { exportAccountantPack } from "@/lib/export";
import { contactTypeI18nKey } from "@/lib/contact-type";
import { useLocale } from "@/lib/i18n/locale-provider";
import { paymentLabel } from "@/lib/i18n/payment";
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ACJob, Contractor, Sale, Technician } from "@/lib/store/types";
import { getVatQuarterSummary } from "@/lib/vat";
import { getIncomeTaxYearSummary } from "@/lib/income-tax";
import { useSubscription } from "@/lib/subscription/subscription-provider";

type Locale = "si" | "en";
type TrendPeriod = "30d" | "3m" | "6m" | "12m";
type TrendPoint = { key: string; label: string; revenue: number; profit: number };

/**
 * Revenue+profit trend, bucketed daily (30d) or monthly (3/6/12m). A
 * different shape than the Reports page's single-metric daily trend
 * (Phase 14) — kept local to this page rather than forcing that
 * component to support a shape it wasn't built for.
 *
 * `new Date()` is called inside this module-level function, never inline
 * in the component body — matches the codebase's established convention
 * (see Phase 4/5 notes) for keeping render bodies pure.
 */
function getRevenueTrend(sales: Sale[], period: TrendPeriod, locale: Locale): TrendPoint[] {
  const now = new Date();
  if (period === "30d") {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      const iso = d.toISOString().slice(0, 10);
      // Sale.date is a full ISO timestamp (new Date().toISOString() at
      // creation, see createSale in actions.ts), not a plain YYYY-MM-DD —
      // startsWith, not ===, matches the convention getDashboardStats
      // already uses for exactly this reason.
      const daySales = sales.filter((s) => s.date.startsWith(iso));
      return {
        key: iso,
        label: d.toLocaleDateString(locale === "si" ? "si-LK" : "en-LK", { day: "numeric", month: "short" }),
        revenue: daySales.reduce((s, x) => s + x.total, 0),
        profit: daySales.reduce((s, x) => s + x.profit, 0),
      };
    });
  }
  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthSales = sales.filter((s) => s.date.startsWith(key));
    return {
      key,
      label: d.toLocaleDateString(locale === "si" ? "si-LK" : "en-LK", { month: "short", year: "2-digit" }),
      revenue: monthSales.reduce((s, x) => s + x.total, 0),
      profit: monthSales.reduce((s, x) => s + x.profit, 0),
    };
  });
}

/** Same assignee-resolution convention as the Schedule page (Phase 7) —
 * a job's "team" is whichever technician or contractor it's assigned to,
 * not the mostly-unpopulated crews.crew_id (see docs, Phase 6 known gap). */
function assigneeName(job: ACJob, technicians: Technician[], contractors: Contractor[]): string | undefined {
  if (job.assigneeType === "team") return technicians.find((x) => x.id === job.assigneeId)?.name;
  if (job.assigneeType === "contractor") return contractors.find((x) => x.id === job.assigneeId)?.name;
  return undefined;
}

function dateHeading(locale: Locale): string {
  return new Date().toLocaleDateString(locale === "si" ? "si-LK" : "en-LK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const primaryButton =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 text-sm font-semibold text-white hover:bg-teal-700";
const secondaryButton =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50";
const ghostLink = "text-xs font-semibold text-teal-700 hover:underline";

/** Card shell used throughout — one consistent 10-14px-radius, subtle-border
 * container, replacing the old dashboard's mix of flat cards and the
 * oversized black/indigo MeterCards. */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>{children}</div>;
}

/** A single compact, actionable "Needs Attention" row — never a whole card
 * per alert, per the density requirement. */
function AttentionRow({
  title,
  description,
  actionLabel,
  actionHref,
  tone,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  tone: "danger" | "warning";
}) {
  const dot = tone === "danger" ? "bg-rose-500" : "bg-amber-500";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          <p className="truncate text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <Link href={actionHref} className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        {actionLabel}
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data, ready, resetAllToCloud, recordACServiceToCloud } = useAppStore();
  const { t, locale } = useLocale();
  const { can, org, isReadOnly, canSeeFinancials, orgRole } = useSubscription();
  const canExport = can("export");
  const showAcJobs = can("ac_jobs");
  const [serviceDoneJob, setServiceDoneJob] = useState<ACJob | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("6m");
  const [showIncomeTax, setShowIncomeTax] = useState(false);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const stats = getDashboardStats(data);
  const shopName = data.business.name || org.name || "LakBiz";
  const isTechnician = orgRole === "technician";
  // showAcJobs is only the plan-feature gate; cashier can't reach /jobs,
  // /schedule, or /teams at all (see permissions.ts SHOP_STAFF_ROUTES),
  // so AC-jobs dashboard sections need both checks, not just the feature
  // flag — otherwise a cashier sees job data and a "+ New job" button
  // that just bounces them back here via the route guard.
  const canSeeJobs = showAcJobs && orgRole !== "cashier";

  const handleReset = async () => {
    if (resetting || isReadOnly) return;
    setResetting(true);
    setResetMessage("");
    const result = await resetAllToCloud();
    setResetting(false);
    setConfirmReset(false);
    if (!result.ok) setResetMessage(result.error ?? t("common.save_failed"));
  };

  const resetFooter = (
    <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-center text-xs font-medium text-slate-500 sm:flex-row sm:text-left">
      <span>{resetMessage || t(org.isAuthenticated ? "common.saved_cloud" : "common.saved_browser")}</span>
      <button
        type="button"
        onClick={() => setConfirmReset(true)}
        disabled={resetting || isReadOnly}
        className="rounded-full px-3 py-1.5 font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {resetting ? t("common.saving") : t("common.reset_data")}
      </button>
    </div>
  );

  const resetDialog = (
    <ConfirmDialog
      open={confirmReset}
      title={t("common.confirm_delete")}
      tone="danger"
      confirmLabel={t("common.reset_data")}
      cancelLabel={t("common.cancel")}
      loading={resetting}
      onConfirm={() => void handleReset()}
      onClose={() => setConfirmReset(false)}
    />
  );

  // ---------------------------------------------------------------------
  // Technician view: a simplified, financial-free job list. Deliberately
  // titled "Today's Jobs" rather than "My Jobs" — org_members.role
  // "technician" (the login) has no link to a specific technicians.id row
  // (the workforce roster used for job assignment), so there is no
  // reliable way to filter to "this person's" jobs specifically. Showing
  // all of today's real jobs, honestly labeled, beats guessing a filter
  // that could silently hide or misattribute work. See final report.
  // ---------------------------------------------------------------------
  if (isTechnician) {
    return (
      <AppShell>
        <ProMain>
          <PageHeader
            title={t("dash.tech_title")}
            description={`${dateHeading(locale)} · ${t("dash.tech_subtitle")}`}
          />
          <Card>
            <SectionHeader title={t("dash.operations_title")} action={<Link href="/schedule" className={ghostLink}>{t("schedule.title")}</Link>} />
            {stats.todayJobs.length === 0 ? (
              <EmptyState title={t("dash.tech_no_jobs")} description={t("dash.tech_no_jobs_desc")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.todayJobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{job.customerName}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {jobTypeLabel(job.jobType, locale)} · {job.address}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge tone={job.status === "completed" || job.status === "installed" ? "positive" : "info"}>
                        {jobStatusLabel(job.status, locale)}
                      </StatusBadge>
                      {job.phone && <CallLink phone={job.phone} label={t("common.call")} variant="icon" />}
                      <NavigateLink address={job.address} label={t("common.navigate")} variant="icon" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </ProMain>
      </AppShell>
    );
  }

  // ---------------------------------------------------------------------
  // Smart onboarding state: truly no business data yet (not just "no
  // products", the old check) — no customers, products, sales, or jobs at
  // all. Switches to the real dashboard automatically the moment any of
  // that exists; nothing to dismiss.
  // ---------------------------------------------------------------------
  const hasAnyData =
    data.customers.length > 0 || data.products.length > 0 || data.sales.length > 0 || data.acJobs.length > 0;

  if (!hasAnyData) {
    return (
      <AppShell>
        <ProMain>
          <PageHeader title={`${t("dash.title")} · ${shopName}`} />
          <EmptyState
            title={t("dash.onboarding_title")}
            description={t("dash.onboarding_desc")}
            action={
              <div className="mx-auto max-w-sm space-y-3 text-left">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">1</span>
                  <p className="text-sm text-slate-700">{t("dash.onboarding_step1")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">2</span>
                  <p className="text-sm text-slate-700">{t("dash.onboarding_step2")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">3</span>
                  <p className="text-sm text-slate-700">{t("dash.onboarding_step3")}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <Link href="/customers" className={secondaryButton}>{t("cust.add")}</Link>
                  <Link href="/stock" className={secondaryButton}>{t("dash.add_stock")}</Link>
                  <Link href="/sales" className={primaryButton}>{t("dash.new_sale")}</Link>
                </div>
              </div>
            }
          />
        </ProMain>
      </AppShell>
    );
  }

  // ---------------------------------------------------------------------
  // Full owner/manager/data_entry/cashier dashboard.
  // ---------------------------------------------------------------------
  const vat = canSeeFinancials ? getVatQuarterSummary(data) : null;
  const incomeTax = canSeeFinancials ? getIncomeTaxYearSummary(data) : null;
  const marginPct = stats.todaySales > 0 ? Math.round((stats.todayProfit / stats.todaySales) * 100) : 0;
  const trend = getRevenueTrend(data.sales, trendPeriod, locale);
  const trendMax = Math.max(1, ...trend.map((p) => Math.max(p.revenue, p.profit)));
  const trendRevenueTotal = trend.reduce((s, p) => s + p.revenue, 0);
  const trendProfitTotal = trend.reduce((s, p) => s + p.profit, 0);
  const trendAvgMargin = trendRevenueTotal > 0 ? Math.round((trendProfitTotal / trendRevenueTotal) * 100) : 0;

  // Needs Attention — only real, currently-true items, most severe first.
  type Alert = { key: string; title: string; description: string; actionLabel: string; actionHref: string; tone: "danger" | "warning" };
  const alerts: Alert[] = [];
  if (canSeeJobs && stats.todayJobsUnassignedCount > 0) {
    alerts.push({
      key: "unassigned",
      title: t("dash.attention_unassigned").replace("{count}", String(stats.todayJobsUnassignedCount)),
      description: t("dash.attention_unassigned_desc"),
      actionLabel: t("dash.action_assign"),
      actionHref: "/jobs",
      tone: "danger",
    });
  }
  if (canSeeFinancials && stats.overLimitCustomerCount > 0) {
    alerts.push({
      key: "over_limit",
      title: t("dash.attention_over_limit").replace("{count}", String(stats.overLimitCustomerCount)),
      description: t("dash.attention_over_limit_desc").replace("{amount}", stats.overLimitCustomerTotal.toLocaleString("en-LK", { maximumFractionDigits: 0 })),
      actionLabel: t("dash.action_view_customers"),
      actionHref: "/customers",
      tone: "danger",
    });
  }
  if (canSeeJobs && stats.acServiceOverdueCount > 0) {
    alerts.push({
      key: "overdue_service",
      title: t("dash.attention_services_overdue").replace("{count}", String(stats.acServiceOverdueCount)),
      description: t("dash.attention_services_due_desc"),
      actionLabel: t("dash.action_view_services"),
      actionHref: "/jobs",
      tone: "danger",
    });
  }
  if (stats.lowStockCount > 0) {
    alerts.push({
      key: "low_stock",
      title: t("dash.attention_low_stock").replace("{count}", String(stats.lowStockCount)),
      description: t("dash.attention_low_stock_desc"),
      actionLabel: t("nav.stock"),
      actionHref: "/stock",
      tone: "warning",
    });
  }
  if (canSeeJobs && stats.acServiceDueSoonCount > 0) {
    alerts.push({
      key: "due_soon",
      title: t("dash.attention_services_due").replace("{count}", String(stats.acServiceDueSoonCount)),
      description: t("dash.attention_services_due_desc"),
      actionLabel: t("dash.action_view_services"),
      actionHref: "/jobs",
      tone: "warning",
    });
  }
  if (canSeeFinancials && stats.payableOutstanding > 0) {
    alerts.push({
      key: "payables",
      title: t("dash.attention_payables").replace("{count}", String(stats.topPayables.length)),
      description: formatLkr(stats.payableOutstanding),
      actionLabel: t("dash.action_view_payables"),
      actionHref: "/suppliers",
      tone: "warning",
    });
  }

  // Today's Operations table columns.
  const operationsColumns: DataTableColumn<ACJob>[] = [
    {
      key: "customer",
      header: t("common.customer"),
      render: (job) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{job.customerName}</p>
          <p className="truncate text-xs text-slate-400">{job.jobNo}</p>
        </div>
      ),
    },
    {
      key: "job",
      header: t("dash.col_job"),
      render: (job) => (
        <div className="min-w-0">
          <p className="truncate text-slate-700">{jobTypeLabel(job.jobType, locale)}</p>
          {job.description && <p className="truncate text-xs text-slate-400">{job.description}</p>}
        </div>
      ),
    },
    {
      key: "team",
      header: t("dash.col_team"),
      hideOnMobile: true,
      render: (job) => {
        const name = assigneeName(job, data.technicians, data.contractors);
        return name ? <span className="text-slate-700">{name}</span> : <StatusBadge tone="warning">{t("dash.status_unassigned")}</StatusBadge>;
      },
    },
    {
      key: "status",
      header: t("common.status"),
      render: (job) => <StatusBadge tone={job.status === "completed" || job.status === "installed" ? "positive" : job.status === "service_due" ? "warning" : "info"}>{jobStatusLabel(job.status, locale)}</StatusBadge>,
    },
    {
      key: "action",
      header: t("dash.col_action"),
      hideOnMobile: true,
      align: "right",
      render: () => <span className={ghostLink}>{t("dash.view")} →</span>,
    },
  ];

  // Teams Today — grouped by real assignee (technician/contractor), not
  // the largely-unpopulated crew_id (see docs/IMPLEMENTATION_PROGRESS.md,
  // Phase 6 known gap, and the note on assigneeName() above).
  type TeamGroup = { key: string; name: string; jobs: ACJob[] };
  const teamGroups = new Map<string, TeamGroup>();
  for (const job of stats.todayJobs) {
    const name = assigneeName(job, data.technicians, data.contractors);
    const key = job.assigneeType && job.assigneeId ? `${job.assigneeType}:${job.assigneeId}` : "unassigned";
    const existing = teamGroups.get(key);
    if (existing) existing.jobs.push(job);
    else teamGroups.set(key, { key, name: name ?? t("dash.status_unassigned"), jobs: [job] });
  }
  const teamGroupList = Array.from(teamGroups.values()).sort((a, b) => (a.key === "unassigned" ? 1 : b.key === "unassigned" ? -1 : b.jobs.length - a.jobs.length));

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={`${t("dash.title")} · ${shopName}`}
          description={`${dateHeading(locale)} · ${t("dash.live_overview")}${org.isAuthenticated ? ` · ${t("dash.cloud_synced")}` : ` · ${t("common.saved_browser")}`}${isReadOnly ? ` · ${t("sub.read_only")}` : ""}`}
          actions={
            <>
              <Link href="/sales" className={primaryButton}>+ {t("dash.new_sale")}</Link>
              {canSeeJobs && <Link href="/jobs" className={primaryButton}>{t("jobs.new")}</Link>}
              <ActionMenu
                label={t("dash.more")}
                items={[
                  { label: t("dash.add_stock"), onSelect: () => router.push("/stock") },
                  { label: t("cust.add"), onSelect: () => router.push("/customers") },
                  ...(canSeeFinancials ? [{ label: t("expenses.add"), onSelect: () => router.push("/expenses") }] : []),
                  ...(canExport && canSeeFinancials
                    ? [
                        {
                          label: t("export.accountant_pack"),
                          onSelect: () =>
                            exportAccountantPack(
                              data.business,
                              { sales: data.sales, products: data.products, customers: data.customers },
                              {
                                includeProfit: true,
                                includeBuyPrice: true,
                                salesLabels: {
                                  billNo: t("bills.bill_no"),
                                  date: t("common.date"),
                                  customer: t("common.customer"),
                                  payment: t("common.payment"),
                                  items: t("common.items"),
                                  discount: t("sales.discount"),
                                  subtotal: t("vat.subtotal"),
                                  vat: t("vat.output_vat"),
                                  total: t("common.total"),
                                  profit: t("common.profit"),
                                },
                                stockLabels: {
                                  name: t("common.name"),
                                  sku: t("stock.sku"),
                                  category: t("stock.category"),
                                  condition: t("stock.condition"),
                                  qty: t("common.qty"),
                                  sellPrice: t("stock.sell_price"),
                                  buyPrice: t("stock.buy_price"),
                                  reorderLevel: t("stock.reorder_level"),
                                },
                                customerLabels: {
                                  name: t("common.name"),
                                  type: t("cust.contact_type"),
                                  contactPerson: t("cust.contact_person"),
                                  phone: t("common.phone"),
                                  address: t("common.address"),
                                  vatNumber: t("cust.vat_number"),
                                  creditBalance: t("cust.credit_owed"),
                                  creditLimit: t("cust.credit_limit"),
                                },
                                paymentLabel: (m) => paymentLabel(t, m),
                                typeLabel: (type) => t(contactTypeI18nKey(type)),
                                conditionLabel: (c) => t(c === "used" ? "stock.condition_used" : "stock.condition_new"),
                              },
                            ),
                        },
                      ]
                    : []),
                ]}
              />
            </>
          }
          metrics={
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={t("dash.today_sales")} value={formatLkr(stats.todaySales)} hint={`${stats.saleCount} ${t("dash.sales_today")}`} />
              {canSeeFinancials ? (
                <MetricCard
                  label={t("dash.today_profit")}
                  value={formatLkr(stats.todayProfit)}
                  hint={stats.todaySales > 0 ? t("dash.kpi_margin").replace("{pct}", String(marginPct)) : "—"}
                  tone="positive"
                />
              ) : (
                // Non-financial roles (data_entry/cashier) don't get bank
                // balance either — canUseBankingModule uses the same
                // FINANCIAL_ROLES gate as canSeeFinancials. Low stock is a
                // real operational number every role can already see on
                // /stock, so it fills this slot instead.
                <MetricCard
                  label={t("dash.low_stock")}
                  value={String(stats.lowStockCount)}
                  hint={t("nav.stock")}
                  tone={stats.lowStockCount > 0 ? "warning" : "default"}
                />
              )}
              <MetricCard
                label={t("dash.kpi_payments_received")}
                value={formatLkr(stats.paymentsReceivedToday)}
                hint={t("dash.kpi_payments_count").replace("{count}", String(stats.paymentsReceivedCount))}
              />
              <MetricCard
                label={t("dash.kpi_jobs_today")}
                value={String(stats.todayJobsCount)}
                hint={t("dash.kpi_jobs_breakdown").replace("{completed}", String(stats.todayJobsCompletedCount)).replace("{remaining}", String(stats.todayJobsRemainingCount))}
                tone={stats.todayJobsUnassignedCount > 0 ? "warning" : "default"}
              />
            </div>
          }
        />

        <OfflineSyncNotice />

        {/* Today's Operations — the main section. */}
        {canSeeJobs && (
          <Card className="mb-4">
            <SectionHeader
              title={t("dash.operations_title")}
              action={<Link href="/schedule" className={ghostLink}>{t("schedule.title")}</Link>}
            />
            <p className="-mt-2 mb-3 text-xs text-slate-500">{t("dash.operations_subtitle")}</p>
            <DataTable
              columns={operationsColumns}
              rows={stats.todayJobs}
              onRowClick={() => router.push("/jobs")}
              emptyState={<EmptyState title={t("dash.operations_empty_title")} description={t("dash.operations_empty_desc")} />}
            />
          </Card>
        )}

        {/* Needs Attention. */}
        <Card className="mb-4">
          <SectionHeader title={t("dash.attention_title")} />
          {alerts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
              {t("dash.attention_all_clear")}
            </p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <AttentionRow key={a.key} title={a.title} description={a.description} actionLabel={a.actionLabel} actionHref={a.actionHref} tone={a.tone} />
              ))}
            </div>
          )}
        </Card>

        {/* Financial Snapshot is omitted entirely for non-financial roles —
            without it, the chart alone should take the full row, not sit
            in a lopsided two-column grid with an empty second track. */}
        <div className={`grid gap-4 ${canSeeFinancials && vat && incomeTax ? "lg:grid-cols-[1fr_1.3fr]" : ""}`}>
          {/* Financial Snapshot — compact, VAT/tax no longer dominant. */}
          {canSeeFinancials && vat && incomeTax && (
            <Card>
              <SectionHeader title={t("dash.financial_title")} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("dash.bank_balance")}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-slate-900">{formatLkr(stats.bankBalance)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("dash.receivables")}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-slate-900">{formatLkr(stats.creditOutstanding)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("dash.supplier_pay")}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-slate-900">{formatLkr(stats.payableOutstanding)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("dash.vat_due")}</p>
                  {vat.enabled ? (
                    <>
                      <p className="mt-1 font-mono text-lg font-bold text-slate-900">{formatLkr(vat.netPayable)}</p>
                      <p className="text-xs text-slate-400">{vat.bounds.label}</p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">{t("vat.enable_hint")}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIncomeTax((v) => !v)}
                className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
                aria-expanded={showIncomeTax}
              >
                {t("tax.income_meter")}
                <span aria-hidden="true">{showIncomeTax ? "▲" : "▼"}</span>
              </button>
              {showIncomeTax && (
                <div className="mt-2 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    {t("tax.income_meter")} · {incomeTax.ratePct}%
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-slate-900">{formatLkr(incomeTax.estimatedTax)}</p>
                  <p className="mt-1 text-xs text-slate-400">{incomeTax.bounds.label}</p>
                  <p className="mt-2 text-xs text-slate-400">{t("tax.owner_only")}</p>
                </div>
              )}
            </Card>
          )}

          {/* Business Performance — one dual-series trend. */}
          <Card>
            <SectionHeader
              title={t("dash.performance_title")}
              action={
                <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5">
                  {(["30d", "3m", "6m", "12m"] as TrendPeriod[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTrendPeriod(p)}
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${trendPeriod === p ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                    >
                      {t(`dash.period_${p}`)}
                    </button>
                  ))}
                </div>
              }
            />
            {trendRevenueTotal === 0 ? (
              <EmptyState title={t("dash.performance_empty")} />
            ) : (
              <>
                <div className="flex h-36 items-end gap-1.5">
                  {trend.map((p) => (
                    <div key={p.key} className="flex flex-1 flex-col items-center justify-end gap-1">
                      <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                        <div
                          title={`${t("dash.today_sales")}: ${formatLkr(p.revenue)}`}
                          className="w-1/2 rounded-t bg-teal-500"
                          style={{ height: `${Math.max(2, (p.revenue / trendMax) * 100)}%` }}
                        />
                        <div
                          title={`${t("dash.gross_profit")}: ${formatLkr(p.profit)}`}
                          className="w-1/2 rounded-t bg-emerald-300"
                          style={{ height: `${Math.max(2, (p.profit / trendMax) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{p.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-teal-500" />{t("dash.today_sales")}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-300" />{t("dash.gross_profit")}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">{t("dash.today_sales")}</p>
                    <p className="font-mono font-semibold text-slate-900">{formatLkr(trendRevenueTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{t("dash.gross_profit")}</p>
                    <p className="font-mono font-semibold text-slate-900">{formatLkr(trendProfitTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{t("dash.avg_margin")}</p>
                    <p className="font-mono font-semibold text-slate-900">{trendAvgMargin}%</p>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Teams Today. */}
        {canSeeJobs && (
          <Card className="mt-4">
            <SectionHeader title={t("dash.teams_title")} action={<Link href="/teams" className={ghostLink}>{t("nav.field_teams")}</Link>} />
            <p className="-mt-2 mb-3 text-xs text-slate-500">{t("dash.teams_subtitle")}</p>
            {teamGroupList.length === 0 ? (
              <EmptyState title={t("dash.teams_empty")} />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {teamGroupList.map((g) => {
                  const completed = g.jobs.filter((j) => j.status === "completed" || j.status === "installed").length;
                  const remaining = g.jobs.length - completed;
                  const nextJob = g.jobs.find((j) => j.status !== "completed" && j.status !== "installed");
                  return (
                    <div key={g.key} className="rounded-lg border border-slate-200 p-3">
                      <p className={`truncate text-sm font-semibold ${g.key === "unassigned" ? "text-amber-700" : "text-slate-900"}`}>{g.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{t("dash.team_jobs_count").replace("{count}", String(g.jobs.length))}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("dash.team_completed_remaining").replace("{completed}", String(completed)).replace("{remaining}", String(remaining))}
                      </p>
                      {nextJob && <p className="mt-1 truncate text-xs text-teal-700">{t("dash.team_next").replace("{customer}", nextJob.customerName)}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* Low stock / receivables / payables — compact, hidden when empty.
            Grid column count matches how many of the three will actually
            render (a fixed 3-col grid with 1-2 real children leaves an
            awkward empty track — Tailwind needs the literal class names
            present for its scanner, so this is a ternary, not string
            interpolation). Nothing renders at all if none apply. */}
        {(() => {
          const bottomCardCount =
            (stats.lowStockItems.length > 0 ? 1 : 0) +
            (canSeeFinancials && stats.topDebtors.length > 0 ? 1 : 0) +
            (canSeeFinancials && stats.topPayables.length > 0 ? 1 : 0);
          if (bottomCardCount === 0) return null;
          const gridClass = bottomCardCount === 3 ? "lg:grid-cols-3" : bottomCardCount === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1";
          return (
        <div className={`mt-4 grid gap-4 ${gridClass}`}>
          {stats.lowStockItems.length > 0 && (
            <Card>
              <SectionHeader title={t("dash.low_stock_alert")} action={<Link href="/stock" className={ghostLink}>{t("nav.stock")}</Link>} />
              <div className="space-y-1.5">
                {stats.lowStockItems.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <p className="min-w-0 truncate text-sm font-medium text-slate-900">{p.name}</p>
                    <span className="shrink-0 text-xs font-semibold text-amber-700">
                      {p.stockQty <= 0
                        ? t("dash.out_of_stock")
                        : `${p.stockQty} ${String(p.customFields.unit ?? "pcs")}${p.reorderLevel != null ? ` · ${t("dash.min_short")} ${p.reorderLevel}` : ""}`}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {canSeeFinancials && stats.topDebtors.length > 0 && (
            <Card>
              <SectionHeader title={t("dash.credit_customers")} action={<Link href="/customers" className={ghostLink}>{t("dash.manage_customers")}</Link>} />
              <div className="space-y-1.5">
                {stats.topDebtors.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <p className="min-w-0 truncate text-sm font-medium text-slate-900">{c.name}</p>
                    <span className="shrink-0 font-mono text-xs font-semibold text-teal-700">{formatLkr(c.creditBalance)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {canSeeFinancials && stats.topPayables.length > 0 && (
            <Card>
              <SectionHeader title={t("dash.supplier_payables")} action={<Link href="/suppliers" className={ghostLink}>{t("dash.manage_suppliers")}</Link>} />
              <div className="space-y-1.5">
                {stats.topPayables.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <p className="min-w-0 truncate text-sm font-medium text-slate-900">{s.name}</p>
                    <span className="shrink-0 font-mono text-xs font-semibold text-rose-700">{formatLkr(s.payableBalance)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
          );
        })()}

        {resetFooter}
        {resetDialog}

        <AcServiceDoneDialog
          job={serviceDoneJob}
          business={data.business}
          open={!!serviceDoneJob}
          onClose={() => setServiceDoneJob(null)}
          onConfirm={async (input) => {
            if (!serviceDoneJob) return { ok: false, error: t("common.save_failed") };
            return recordACServiceToCloud(serviceDoneJob.id, input);
          }}
        />
      </ProMain>
    </AppShell>
  );
}
