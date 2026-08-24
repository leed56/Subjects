"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExportActions } from "@/components/export/export-actions";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import {
  BillsIcon,
  CostingIcon,
  InboxIcon,
  JobsIcon,
  ReportsIcon,
  SalesIcon,
  SuppliersIcon,
  VehiclesIcon,
} from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
import {
  exportVatReconciliationCsv,
  printVatReconciliationReport,
} from "@/lib/export/vat-returns";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import { getVatQuarterSummary } from "@/lib/vat";
import { getIncomeTaxYearSummary } from "@/lib/income-tax";
import type { JobLinkedExpense } from "@/lib/job-profitability";
import { fetchOrgExpenses } from "@/lib/supabase/expenses-client";
import {
  fetchOrgReturnAccountingAdjustments,
  returnAccountingSchemaUnavailable,
  type ReturnAccountingAdjustment,
} from "@/lib/supabase/return-accounting-client";
import { useSubscription } from "@/lib/subscription/subscription-provider";

type TaxView = "vat" | "income";

const linkButtonBase =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.98]";
const secondaryLink = `${linkButtonBase} border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950`;
const primaryLink = `${linkButtonBase} bg-teal-600 text-white shadow-sm shadow-teal-950/15 hover:bg-teal-700`;

export default function VatPageV2() {
  const { data, ready } = useAppStore();
  const { t } = useLocale();
  const { can, org, canSeeFinancials } = useSubscription();
  const orgId = org.isAuthenticated ? org.id : null;
  const [activeView, setActiveView] = useState<TaxView>("vat");

  // Preserve the existing owner-only cloud fetch used by the income-tax
  // profitability calculation. This is data behavior, not presentation.
  const [jobLinkedExpenseTotals, setJobLinkedExpenseTotals] = useState<
    Map<string, JobLinkedExpense[]> | null
  >(null);
  useEffect(() => {
    if (!orgId || !canSeeFinancials) {
      setJobLinkedExpenseTotals(new Map());
      return;
    }
    let cancelled = false;
    void fetchOrgExpenses(orgId).then((result) => {
      if (cancelled) return;
      const totals = new Map<string, JobLinkedExpense[]>();
      for (const expense of result.data) {
        if (!expense.jobId) continue;
        const list = totals.get(expense.jobId) ?? [];
        list.push({ category: expense.category, amount: expense.amount });
        totals.set(expense.jobId, list);
      }
      setJobLinkedExpenseTotals(totals);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, canSeeFinancials]);

  // Preserve the existing issued-credit-note accounting adjustment behavior.
  const [returnAdjustments, setReturnAdjustments] = useState<ReturnAccountingAdjustment[] | null>(null);
  const [returnAccountingError, setReturnAccountingError] = useState<string | null>(null);
  useEffect(() => {
    if (!orgId || !canSeeFinancials) {
      setReturnAdjustments([]);
      setReturnAccountingError(null);
      return;
    }
    let cancelled = false;
    setReturnAdjustments(null);
    setReturnAccountingError(null);
    void fetchOrgReturnAccountingAdjustments(orgId, true).then((result) => {
      if (cancelled) return;
      if (returnAccountingSchemaUnavailable(result.error)) {
        setReturnAdjustments([]);
        return;
      }
      if (result.error) {
        setReturnAdjustments([]);
        setReturnAccountingError(result.error);
        return;
      }
      setReturnAdjustments(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, canSeeFinancials]);

  if (!ready || !data || !jobLinkedExpenseTotals || returnAdjustments == null) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  // Keep the same database-aligned owner-only financial boundary.
  if (!canSeeFinancials) {
    return (
      <AppShell>
        <ProMain>
          <EmptyState
            title="Owner-only financial report"
            description="VAT, income-tax estimates, internal profit and return settlements are restricted to the organization owner."
            icon={<ReportsIcon className="h-5 w-5" />}
            action={
              <Link href="/dashboard" className={primaryLink}>
                Dashboard
              </Link>
            }
          />
        </ProMain>
      </AppShell>
    );
  }

  const summary = getVatQuarterSummary(data, new Date(), returnAdjustments);
  const incomeTax = getIncomeTaxYearSummary(
    data,
    new Date(),
    0,
    jobLinkedExpenseTotals,
    returnAdjustments,
  );

  const quarterSales = summary.enabled
    ? data.sales.filter((sale) => {
        const date = new Date(sale.date).getTime();
        return date >= summary.bounds.start.getTime() && date <= summary.bounds.end.getTime();
      })
    : [];
  const quarterPurchases = summary.enabled
    ? data.purchases.filter((purchase) => {
        const date = new Date(purchase.date).getTime();
        return date >= summary.bounds.start.getTime() && date <= summary.bounds.end.getTime();
      })
    : [];
  const quarterCreditNotes = summary.enabled
    ? returnAdjustments.filter((note) => {
        const date = new Date(note.issuedAt).getTime();
        return date >= summary.bounds.start.getTime() && date <= summary.bounds.end.getTime();
      })
    : [];

  const canExport = can("export");
  const vatExportLabels = {
    billNo: t("bills.bill_no"),
    date: t("common.date"),
    customer: t("common.customer"),
    outputVat: t("vat.output_vat"),
    grnNo: "GRN #",
    supplier: t("common.supplier"),
    inputVat: t("vat.input_vat"),
    netPayable: t("vat.net_payable"),
    outputTotal: t("vat.output_vat"),
    inputTotal: t("vat.input_vat"),
    creditNotes: "Issued return credit notes",
    creditNoteNo: "Credit note #",
    originalBill: "Original bill",
    grossCredit: "Gross credit",
    returnVatReversal: "VAT reversal from credit notes",
  };

  const vatDescription = summary.enabled
    ? `${summary.bounds.label}${data.business.vatNumber ? ` · ${t("vat.vat_number")}: ${data.business.vatNumber}` : ""}`
    : t("vat.enable_hint");

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={activeView === "vat" ? t("vat.title") : t("tax.income_title")}
          description={activeView === "vat" ? vatDescription : `${t("tax.rate_note")} · ${t("tax.fiscal_year")}: ${incomeTax.bounds.label}`}
          actions={
            <>
              {activeView === "vat" && summary.enabled && canExport && (
                <ExportActions
                  disabled={quarterSales.length === 0 && quarterPurchases.length === 0 && summary.creditNoteCount === 0}
                  onExportCsv={() =>
                    exportVatReconciliationCsv(
                      data.business,
                      quarterSales,
                      quarterPurchases,
                      quarterCreditNotes,
                      summary,
                      vatExportLabels,
                    )
                  }
                  onPrintPdf={() =>
                    printVatReconciliationReport(
                      data.business,
                      quarterSales,
                      quarterPurchases,
                      quarterCreditNotes,
                      summary,
                      vatExportLabels,
                      t("export.vat_report"),
                    )
                  }
                />
              )}
              {activeView === "vat" && (
                <>
                  <Link href="/sales" className={secondaryLink}>
                    {t("nav.sales")}
                  </Link>
                  <Link href="/suppliers" className={secondaryLink}>
                    {t("sup.record_purchase")}
                  </Link>
                </>
              )}
              <Link href="/settings/shop" className={activeView === "income" ? secondaryLink : primaryLink}>
                {activeView === "income" ? t("tax.rate_setting") : t("vat.shop_settings")}
              </Link>
            </>
          }
        />

        <div className="mb-6">
          <Tabs
            tabs={[
              { value: "vat", label: t("vat.title") },
              { value: "income", label: t("tax.income_title") },
            ]}
            value={activeView}
            onChange={(value) => setActiveView(value as TaxView)}
          />
        </div>

        {activeView === "vat" ? (
          summary.enabled ? (
            <>
              {returnAccountingError && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  Return credit-note adjustments could not be loaded, so this view is temporarily showing invoice VAT without those adjustments. {returnAccountingError}
                </div>
              )}

              <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,0.045)] sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {t("vat.net_payable")}
                    </p>
                    <p className={`mt-2 font-mono text-3xl font-bold tracking-tight sm:text-4xl ${summary.netPayable > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {formatLkr(summary.netPayable)}
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t("vat.ird_note")}</p>
                  </div>
                  <StatusBadge tone={summary.netPayable > 0 ? "warning" : "positive"}>
                    {summary.netPayable > 0 ? "Payable" : "Input credit"}
                  </StatusBadge>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label={t("vat.output_vat")}
                  value={formatLkr(summary.outputVat)}
                  hint={`${summary.salesCount} ${t("vat.sales_in_period")}`}
                  icon={<BillsIcon className="h-4.5 w-4.5" />}
                  tone="warning"
                />
                <MetricCard
                  label={t("vat.input_vat")}
                  value={formatLkr(summary.inputVat)}
                  hint={`${summary.purchasesCount} ${t("vat.purchases_in_period")}`}
                  icon={<InboxIcon className="h-4.5 w-4.5" />}
                  tone="positive"
                />
                <MetricCard
                  label={t("vat.sales_list")}
                  value={String(quarterSales.length)}
                  hint="Invoices in quarter"
                  icon={<SalesIcon className="h-4.5 w-4.5" />}
                />
                <MetricCard
                  label={t("vat.purchases_list")}
                  value={String(quarterPurchases.length)}
                  hint="Purchase records"
                  icon={<SuppliersIcon className="h-4.5 w-4.5" />}
                />
              </section>

              {summary.creditNoteCount > 0 && (
                <div className="mt-4 flex flex-col gap-2 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {summary.creditNoteCount} issued return credit note{summary.creditNoteCount === 1 ? "" : "s"} in this quarter
                  </span>
                  <span className="font-mono tabular-nums">
                    Output VAT reversal −{formatLkr(summary.returnVatReversal)}
                  </span>
                </div>
              )}

              <section className="mt-6 grid gap-5 xl:grid-cols-2">
                <Panel
                  title={t("vat.sales_list")}
                  action={<StatusBadge tone="warning">{formatLkr(summary.outputVat)}</StatusBadge>}
                >
                  {quarterSales.length === 0 ? (
                    <EmptyState
                      size="compact"
                      title={t("vat.no_sales")}
                      description="Sales with output VAT will appear here for this period."
                      icon={<SalesIcon className="h-5 w-5" />}
                    />
                  ) : (
                    <div className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto pr-1">
                      {quarterSales.map((sale) => (
                        <Link
                          key={sale.id}
                          href={`/bills/${sale.id}`}
                          className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0 hover:bg-slate-50/70"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-semibold text-teal-700">
                              {sale.billNo ?? sale.id.slice(0, 8)}
                            </p>
                            <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                              {sale.customerName || "Walk-in customer"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {new Date(sale.date).toLocaleDateString("en-LK")}
                            </p>
                          </div>
                          <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-amber-700">
                            {formatLkr(sale.outputVat ?? 0)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                  {summary.creditNoteCount > 0 && (
                    <p className="mt-4 rounded-lg bg-teal-50 px-3 py-2 text-[11px] font-medium leading-5 text-teal-800">
                      Invoice rows remain historical gross VAT. The total above is net of {formatLkr(summary.returnVatReversal)} issued credit-note VAT reversals.
                    </p>
                  )}
                </Panel>

                <Panel
                  title={t("vat.purchases_list")}
                  action={<StatusBadge tone="positive">{formatLkr(summary.inputVat)}</StatusBadge>}
                >
                  {quarterPurchases.length === 0 ? (
                    <EmptyState
                      size="compact"
                      title={t("vat.no_purchases")}
                      description="Purchases with input VAT will appear here for this period."
                      icon={<SuppliersIcon className="h-5 w-5" />}
                    />
                  ) : (
                    <div className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto pr-1">
                      {quarterPurchases.map((purchase) => (
                        <div
                          key={purchase.id}
                          className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-semibold text-slate-600">{purchase.grnNo}</p>
                            <p className="mt-1 truncate text-sm font-semibold text-slate-950">{purchase.supplierName}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {new Date(purchase.date).toLocaleDateString("en-LK")}
                            </p>
                          </div>
                          <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-emerald-700">
                            {formatLkr(purchase.inputVat ?? 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </section>
            </>
          ) : (
            <EmptyState
              title={t("vat.title")}
              description={t("vat.enable_hint")}
              icon={<BillsIcon className="h-5 w-5" />}
              action={
                <Link href="/settings/shop" className={primaryLink}>
                  {t("vat.shop_settings")}
                </Link>
              }
            />
          )
        ) : (
          <>
            <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,0.045)] sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {t("tax.estimated_tax")}
                  </p>
                  <p className={`mt-2 font-mono text-3xl font-bold tracking-tight sm:text-4xl ${incomeTax.estimatedTax > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {formatLkr(incomeTax.estimatedTax)}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t("tax.disclaimer")}</p>
                </div>
                <StatusBadge tone={incomeTax.estimatedTax > 0 ? "warning" : "positive"}>
                  {t("tax.rate_on_profit").replace("{rate}", String(incomeTax.ratePct))}
                </StatusBadge>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label={t("tax.revenue")}
                value={formatLkr(incomeTax.revenue)}
                hint={incomeTax.creditNoteCount > 0 ? `${incomeTax.creditNoteCount} credit note${incomeTax.creditNoteCount === 1 ? "" : "s"} netted` : `${incomeTax.salesCount} ${t("vat.sales_in_period")}`}
                icon={<SalesIcon className="h-4.5 w-4.5" />}
              />
              <MetricCard
                label={t("tax.sales_profit")}
                value={formatLkr(incomeTax.salesProfit)}
                hint={incomeTax.returnProfitReversal !== 0 ? `${formatLkr(incomeTax.returnProfitReversal)} return profit reversed` : t("tax.estimated_profit")}
                icon={<ReportsIcon className="h-4.5 w-4.5" />}
                tone={incomeTax.salesProfit < 0 ? "danger" : "positive"}
              />
              <MetricCard
                label={t("tax.vehicle_profit")}
                value={formatLkr(incomeTax.vehicleProfit)}
                hint={t("nav.vehicles")}
                icon={<VehiclesIcon className="h-4.5 w-4.5" />}
                tone={incomeTax.vehicleProfit < 0 ? "danger" : "positive"}
              />
              <MetricCard
                label={t("tax.ac_job_profit")}
                value={formatLkr(incomeTax.acJobProfit)}
                hint={t("nav.jobs")}
                icon={<JobsIcon className="h-4.5 w-4.5" />}
                tone={incomeTax.acJobProfit < 0 ? "danger" : "positive"}
              />
              <MetricCard
                label={t("tax.estimated_profit")}
                value={formatLkr(incomeTax.estimatedTaxableProfit)}
                hint={t("tax.income_meter")}
                icon={<CostingIcon className="h-4.5 w-4.5" />}
                tone={incomeTax.estimatedTaxableProfit < 0 ? "danger" : "warning"}
              />
            </section>

            {incomeTax.creditNoteCount > 0 && (
              <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-xs font-medium leading-5 text-teal-900">
                Issued return credit notes in this fiscal year reduce reported sales by {formatLkr(incomeTax.returnRevenueReversal)}. The original invoices remain unchanged.
              </div>
            )}
          </>
        )}
      </ProMain>
    </AppShell>
  );
}
