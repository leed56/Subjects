"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AcServiceDoneDialog } from "@/components/ac-service-done-dialog";
import { AcServiceDuePanel } from "@/components/ac-service-due-panel";
import { OfflineSyncNotice } from "@/components/offline-sync-notice";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, SectionHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlay";
import { SalesIcon, StockIcon, CustomersIcon, BankingIcon } from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
import { contactTypeI18nKey } from "@/lib/contact-type";
import { exportAccountantPack } from "@/lib/export";
import { useLocale } from "@/lib/i18n/locale-provider";
import { paymentLabel } from "@/lib/i18n/payment";
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ACJob } from "@/lib/store/types";
import { getVatQuarterSummary } from "@/lib/vat";
import { getIncomeTaxYearSummary } from "@/lib/income-tax";
import { useNotificationLogs } from "@/lib/messaging/use-notification-logs";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { fetchOrgExpenses } from "@/lib/supabase/expenses-client";
import { computeJobProfitability, isLowMarginJob } from "@/lib/job-profitability";

const primaryButton =
  "inline-flex h-10 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700";
const secondaryButton =
  "inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50";
const ghostLink = "text-sm font-medium text-teal-700 hover:underline";

function ListRow({ title, amount, tone, badge }: { title: string; amount?: string; tone: "amber" | "teal" | "rose"; badge?: string }) {
  const amountClass = tone === "amber" ? "text-amber-700" : tone === "rose" ? "text-rose-700" : "text-teal-700";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{title}</p>
      {badge ? (
        <StatusBadge tone="warning">{badge}</StatusBadge>
      ) : (
        <span className={`shrink-0 font-mono text-sm font-semibold ${amountClass}`}>{amount}</span>
      )}
    </div>
  );
}

/** A dark accent card for the VAT/income-tax meters — the one deliberate
 * departure from the flat Phase 1 card style, kept from the original
 * design since it's a meaningful visual highlight, not decoration. */
function MeterCard({ eyebrow, title, href, linkLabel, dark, children }: { eyebrow: string; title: string; href: string; linkLabel: string; dark?: "slate" | "indigo"; children: React.ReactNode }) {
  const bg = dark === "indigo" ? "bg-indigo-950 ring-indigo-900" : "bg-slate-950 ring-slate-800";
  return (
    <div className={`rounded-xl p-5 text-white ring-1 ${bg}`}>
      {/* Link on its own row below the eyebrow/title, not beside them —
       * side-by-side with justify-between + shrink-0 squeezed the eyebrow
       * text into a vertical sliver whenever linkLabel was long (e.g. the
       * income-tax meter's "Company income tax estimate"), since a
       * shrink-0 element never yields width back to its min-w-0 sibling. */}
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{eyebrow}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{title}</p>
      <Link
        href={href}
        className="mt-3 inline-flex rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
      >
        {linkLabel}
      </Link>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { data, ready, resetAllToCloud, recordACServiceToCloud } = useAppStore();
  const { t } = useLocale();
  const { can, org, isReadOnly, canSeeFinancials } = useSubscription();
  const canExport = can("export");
  const showAcJobs = can("ac_jobs");
  const notificationLogs = useNotificationLogs(org.id);
  const showVehicles = can("vehicles");
  const [serviceDoneJob, setServiceDoneJob] = useState<ACJob | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  // HVAC platform Phase 14 — job profitability needs job-linked Expenses
  // (Phase 7), which are cloud-only, not part of the local-first store
  // this page otherwise reads from. Same fetch-on-mount pattern as
  // /job-costing, which already does exactly this. Gated on
  // canSeeFinancials up front: never even request the data a technician
  // isn't allowed to see.
  const [jobLinkedExpenseTotals, setJobLinkedExpenseTotals] = useState<Map<string, number> | null>(null);
  useEffect(() => {
    if (!showAcJobs || !canSeeFinancials || !org.isAuthenticated || !org.id) {
      setJobLinkedExpenseTotals(new Map());
      return;
    }
    let cancelled = false;
    void fetchOrgExpenses(org.id).then((result) => {
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
  }, [showAcJobs, canSeeFinancials, org.isAuthenticated, org.id]);

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
  const vat = getVatQuarterSummary(data);
  const incomeTax = getIncomeTaxYearSummary(data);
  const shopName = data.business.name || org.name || "LakBiz";

  // Job profitability this month — reuses computeJobProfitability (Phase
  // 8), the one authoritative calculation, exactly as /job-costing does.
  // Not a separate/simplified dashboard-only formula.
  const jobItemsByJob = new Map<string, typeof data.jobItems>();
  for (const item of data.jobItems) {
    const list = jobItemsByJob.get(item.jobId) ?? [];
    list.push(item);
    jobItemsByJob.set(item.jobId, list);
  }
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthJobs =
    showAcJobs && canSeeFinancials
      ? data.acJobs.filter((j) => j.date.startsWith(monthKey) && j.status !== "cancelled")
      : [];
  const monthCosted = jobLinkedExpenseTotals
    ? monthJobs.map((j) => ({
        job: j,
        profit: computeJobProfitability(j, jobItemsByJob.get(j.id) ?? [], jobLinkedExpenseTotals.get(j.id) ?? 0),
      }))
    : [];
  const monthTotalQuoted = monthCosted.reduce((s, c) => s + c.job.quotedAmount, 0);
  const monthTotalCost = monthCosted.reduce((s, c) => s + c.profit.totalCost, 0);
  const monthTotalMargin = monthTotalQuoted - monthTotalCost;
  const monthAvgMarginPct = monthTotalQuoted > 0 ? (monthTotalMargin / monthTotalQuoted) * 100 : null;
  const lowMarginJobs = monthCosted
    .filter((c) => isLowMarginJob(c.profit))
    .sort((a, b) => (a.profit.grossMarginPct ?? 0) - (b.profit.grossMarginPct ?? 0));
  const showJobProfitability = showAcJobs && canSeeFinancials && jobLinkedExpenseTotals !== null && monthJobs.length > 0;

  const primaryActions = [
    { href: "/sales", label: t("dash.new_sale"), icon: SalesIcon },
    { href: "/stock", label: t("dash.add_stock"), icon: StockIcon },
    { href: "/customers", label: t("nav.customers"), icon: CustomersIcon },
    ...(canSeeFinancials ? [{ href: "/banking", label: t("nav.banking"), icon: BankingIcon }] : []),
  ];

  const handleReset = async () => {
    if (resetting || isReadOnly) return;
    setResetting(true);
    setResetMessage("");
    const result = await resetAllToCloud();
    setResetting(false);
    setConfirmReset(false);
    if (!result.ok) {
      setResetMessage(result.error ?? t("common.save_failed"));
    }
  };

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={`${t("dash.title")} · ${shopName}`}
          description={`${org.isAuthenticated ? t("common.saved_cloud") : t("common.saved_browser")} · ${t("dash.live")} · ${stats.productCount} ${t("dash.products")} · ${stats.saleCount} ${t("dash.sales_today")}${isReadOnly ? ` · ${t("sub.read_only")}` : ""}`}
          actions={
            <>
              {canExport && canSeeFinancials && (
                <button
                  type="button"
                  onClick={() =>
                    exportAccountantPack(
                      data.business,
                      {
                        sales: data.sales,
                        products: data.products,
                        customers: data.customers,
                      },
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
                    )
                  }
                  className={secondaryButton}
                  title={t("export.accountant_pack_hint")}
                >
                  {t("export.accountant_pack")}
                </button>
              )}
              <Link href="/stock" className={secondaryButton}>
                {t("dash.add_stock")}
              </Link>
              <Link href="/sales" className={primaryButton}>
                {t("dash.new_sale")}
              </Link>
            </>
          }
          metrics={
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={t("dash.today_sales")} value={formatLkr(stats.todaySales)} hint={`${stats.saleCount} ${t("dash.sales_today")}`} />
              <MetricCard
                label={t("dash.month_sales")}
                value={formatLkr(stats.monthSales)}
                hint={stats.monthSalesChangePct != null ? t("dash.month_vs_last").replace("{pct}", String(stats.monthSalesChangePct)) : t("dash.month_no_compare")}
              />
              {canSeeFinancials && <MetricCard label={t("dash.today_profit")} value={formatLkr(stats.todayProfit)} hint={t("dash.profit_hint")} tone="positive" />}
              {canSeeFinancials && <MetricCard label={t("dash.bank_balance")} value={formatLkr(stats.bankBalance)} hint={t("nav.banking")} />}
            </div>
          }
        />

        <OfflineSyncNotice />

        {stats.lowStockCount > 0 && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {t("dash.low_stock_banner").replace("{count}", String(stats.lowStockCount))}{" "}
            <Link href="/stock" className="font-semibold underline">
              {t("nav.stock")}
            </Link>
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {canSeeFinancials && (
            <>
              <MetricCard label={t("dash.credit_out")} value={formatLkr(stats.creditOutstanding)} hint={t("dash.credit_customers")} tone="warning" />
              <MetricCard label={t("dash.supplier_pay")} value={formatLkr(stats.payableOutstanding)} hint={t("dash.supplier_payables")} tone="warning" />
              <MetricCard label={t("dash.cheques_due")} value={String(stats.chequesDueSoonCount)} hint={t("nav.banking")} />
            </>
          )}
          {canSeeFinancials && showVehicles ? (
            <MetricCard label={t("dash.car_profit_month")} value={formatLkr(stats.vehicleProfitThisMonth)} hint={`${stats.forSaleVehicleCount} ${t("dash.vehicles_sale")}`} />
          ) : (
            <MetricCard label={t("dash.products")} value={String(stats.productCount)} hint={t("nav.stock")} />
          )}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <SectionHeader
              title={t("dash.quick_actions_title")}
              action={<StatusBadge tone={org.isAuthenticated ? "positive" : "neutral"}>{org.isAuthenticated ? t("dash.cloud") : t("dash.browser")}</StatusBadge>}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {primaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group rounded-lg border border-slate-200 p-3.5 transition hover:border-teal-300 hover:bg-slate-50"
                  >
                    <Icon className="h-5 w-5 text-slate-400 transition group-hover:text-teal-600" />
                    <p className="mt-3 text-sm font-semibold text-slate-900">{action.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{t("dash.open_module")}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          {canSeeFinancials && (
            <MeterCard
              eyebrow={vat.enabled ? t("vat.meter_label") : t("vat.title")}
              title={vat.enabled ? formatLkr(vat.netPayable) : t("vat.enable_hint")}
              href="/vat"
              linkLabel={t("nav.vat")}
            >
              {vat.enabled ? (
                <div>
                  <p className="mt-1 text-xs font-medium text-slate-400">{vat.bounds.label}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("vat.output_vat")}</p>
                      <p className="mt-1 font-mono text-lg font-bold text-amber-300">{formatLkr(vat.outputVat)}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("vat.input_vat")}</p>
                      <p className="mt-1 font-mono text-lg font-bold text-teal-300">{formatLkr(vat.inputVat)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-white/20 p-4 text-sm text-slate-300">
                  <p>{t("vat.enable_hint")}</p>
                  <Link href="/settings/shop" className="mt-2 inline-flex font-semibold text-teal-300 underline">
                    {t("vat.shop_settings")}
                  </Link>
                </div>
              )}
            </MeterCard>
          )}

          {canSeeFinancials && (
            <MeterCard
              eyebrow={`${t("tax.income_meter")} · ${incomeTax.ratePct}%`}
              title={formatLkr(incomeTax.estimatedTax)}
              href="/vat#income-tax"
              linkLabel={t("tax.income_title")}
              dark="indigo"
            >
              <p className="mt-1 text-xs font-medium text-indigo-300/80">{incomeTax.bounds.label}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">{t("tax.revenue")}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-indigo-100">{formatLkr(incomeTax.revenue)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">{t("tax.estimated_profit")}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-emerald-300">{formatLkr(incomeTax.estimatedTaxableProfit)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-indigo-300/60">{t("tax.owner_only")}</p>
            </MeterCard>
          )}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <SectionHeader title={t("dash.low_stock_alert")} action={<Link href="/stock" className={ghostLink}>{t("nav.stock")}</Link>} />
            {stats.lowStockItems.length === 0 ? (
              <EmptyState title={t("dash.all_good_stock")} description={t("dash.reorder_clear_desc")} />
            ) : (
              <div className="space-y-2">
                {stats.lowStockItems.slice(0, 6).map((p) => (
                  <ListRow
                    key={p.id}
                    title={p.name}
                    tone="amber"
                    badge={p.stockQty <= 0 ? t("dash.out_of_stock") : t("common.low")}
                  />
                ))}
              </div>
            )}
          </div>

          {canSeeFinancials && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader title={t("dash.credit_customers")} action={<Link href="/customers" className={ghostLink}>{t("dash.manage_customers")}</Link>} />
              {stats.topDebtors.length === 0 ? (
                <EmptyState title={t("dash.no_credit")} description={t("dash.no_credit_desc")} />
              ) : (
                <div className="space-y-2">
                  {stats.topDebtors.slice(0, 6).map((c) => (
                    <ListRow key={c.id} title={c.name} amount={formatLkr(c.creditBalance)} tone="teal" />
                  ))}
                </div>
              )}
            </div>
          )}

          {canSeeFinancials && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader title={t("dash.supplier_payables")} action={<Link href="/suppliers" className={ghostLink}>{t("dash.manage_suppliers")}</Link>} />
              {stats.topPayables.length === 0 ? (
                <EmptyState title={t("dash.no_payables")} description={t("dash.no_payables_desc")} />
              ) : (
                <div className="space-y-2">
                  {stats.topPayables.slice(0, 6).map((s) => (
                    <ListRow key={s.id} title={s.name} amount={formatLkr(s.payableBalance)} tone="rose" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {showJobProfitability && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader title={t("dash.job_profitability")} action={<Link href="/job-costing" className={ghostLink}>{t("costing.title")}</Link>} />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("costing.total_margin")}</p>
                  <p className={`mt-1 font-mono text-lg font-bold ${monthTotalMargin < 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatLkr(monthTotalMargin)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("costing.avg_margin_pct")}</p>
                  <p className={`mt-1 font-mono text-lg font-bold ${monthAvgMarginPct !== null && monthAvgMarginPct < 0 ? "text-rose-700" : "text-slate-900"}`}>
                    {monthAvgMarginPct !== null ? `${monthAvgMarginPct.toFixed(1)}%` : "—"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">{t("dash.job_profitability_hint").replace("{count}", String(monthJobs.length))}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader title={t("dash.low_margin_jobs")} action={<Link href="/job-costing" className={ghostLink}>{t("costing.title")}</Link>} />
              {lowMarginJobs.length === 0 ? (
                <EmptyState title={t("dash.no_low_margin_jobs")} description={t("dash.no_low_margin_jobs_desc")} />
              ) : (
                <div className="space-y-2">
                  {lowMarginJobs.slice(0, 6).map((c) => (
                    <ListRow
                      key={c.job.id}
                      title={c.job.customerName}
                      tone="rose"
                      amount={c.profit.grossMarginPct !== null ? `${c.profit.grossMarginPct.toFixed(1)}%` : "—"}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {(showVehicles && stats.aging60VehicleCount > 0) || (showAcJobs && stats.pendingACJobCount > 0) ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {showVehicles && stats.aging60VehicleCount > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <SectionHeader
                  title={`${stats.aging60VehicleCount} ${t("dash.vehicles_aging")}`}
                  action={<Link href="/vehicles" className={ghostLink}>{t("dash.view_vehicles")}</Link>}
                />
                <div className="space-y-2">
                  {stats.aging60Vehicles.slice(0, 5).map((v) => (
                    <div key={v.id} className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                      <p className="font-semibold text-amber-950">{v.make} {v.model} {v.year}</p>
                      <p className="mt-1 text-sm text-amber-800">{formatLkr(v.askPrice)} · {v.stockId}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showAcJobs && stats.pendingACJobCount > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <SectionHeader
                  title={`${stats.pendingACJobCount} ${t("dash.ac_pending")}`}
                  action={<Link href="/jobs" className={ghostLink}>{t("dash.view_jobs")}</Link>}
                />
                <div className="space-y-2">
                  {stats.pendingACJobs.slice(0, 5).map((j) => (
                    <div key={j.id} className="rounded-lg border border-sky-100 bg-sky-50/70 p-3">
                      <p className="font-semibold text-sky-950">{j.customerName}</p>
                      <p className="mt-1 text-sm text-sky-800">{j.description} · {j.jobNo}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {showAcJobs && (
          <div className="mt-6">
            <AcServiceDuePanel
              dueTodayJobs={stats.acServiceDueToday}
              upcomingJobs={stats.acServiceDueSoon.filter((j) => j.serviceDueDate && stats.acServiceDueToday.every((today) => today.id !== j.id))}
              business={data.business}
              overdueCount={stats.acServiceOverdueCount}
              logs={notificationLogs}
              onServiceDone={setServiceDoneJob}
            />
          </div>
        )}

        {data.products.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title={t("dash.get_started")}
              description={t("dash.get_started_desc")}
              action={
                <div className="flex flex-col justify-center gap-2 sm:flex-row">
                  <Link href="/stock" className={primaryButton}>{t("nav.stock")}</Link>
                  <Link href="/customers" className={secondaryButton}>{t("nav.customers")}</Link>
                  <Link href="/sales" className={secondaryButton}>{t("nav.sales")}</Link>
                </div>
              }
            />
          </div>
        )}

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
