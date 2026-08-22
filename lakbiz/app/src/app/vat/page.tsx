"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExportActions } from "@/components/export/export-actions";
import { AppShell } from "@/components/shell/app-shell";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProStatCard,
} from "@/components/ui/pro-shell";
import { formatLkr } from "@/lib/format";
import { exportVatCsv, printVatReport } from "@/lib/export";
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
import { SalesIcon, ReportsIcon, VehiclesIcon, JobsIcon, CostingIcon, BillsIcon, InboxIcon, SuppliersIcon } from "@/components/ui/icons";

export default function VatReturnPage() {
  const { data, ready } = useAppStore();
  const { t } = useLocale();
  const { can, org, canSeeFinancials } = useSubscription();
  const orgId = org.isAuthenticated ? org.id : null;

  // Job-linked expenses are cloud-only, so the income-tax AC-job-profit figure
  // needs the same owner-only fetch used by the dashboard/job-costing pages.
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

  // Credit notes are also cloud-only. Only ISSUED credit notes count here:
  // physical return intake itself deliberately leaves VAT/revenue unchanged.
  // If the additive return-accounting migration is not deployed yet, keep the
  // existing gross report usable rather than breaking VAT for older databases.
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

  // Owner-only is the same capability enforced by can_see_org_financials() at
  // the database boundary. Do not reintroduce the historical manager shortcut.
  if (!canSeeFinancials) {
    return (
      <AppShell>
        <ProMain>
          <ProCard>
            <ProEmptyState
              title="Owner-only financial report"
              description="VAT, income-tax estimates, internal profit and return settlements are restricted to the organization owner."
              action={<ProButton href="/dashboard">Dashboard</ProButton>}
            />
          </ProCard>
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

  const incomeTaxSection = (
    <section id="income-tax" className="mt-10">
      <ProPageHeader
        eyebrow={t("tax.owner_only")}
        title={t("tax.income_title")}
        description={t("tax.rate_note")}
        actions={<ProButton href="/settings/shop" variant="secondary">{t("tax.rate_setting")}</ProButton>}
      />

      <section className="mb-6 rounded-xl border border-indigo-900 bg-indigo-950 p-6 text-white sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-300">
              {t("tax.estimated_tax")}
            </p>
            <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-indigo-200 sm:text-4xl">
              {formatLkr(incomeTax.estimatedTax)}
            </p>
            <p className="mt-3 text-sm font-medium text-indigo-300/80">
              {t("tax.fiscal_year")}: {incomeTax.bounds.label}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-300/70">
              {t("tax.disclaimer")}
            </p>
          </div>
          <ProBadge tone={incomeTax.estimatedTax > 0 ? "amber" : "emerald"}>
            {t("tax.rate_on_profit").replace("{rate}", String(incomeTax.ratePct))}
          </ProBadge>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ProStatCard
          label={t("tax.revenue")}
          value={formatLkr(incomeTax.revenue)}
          hint={incomeTax.creditNoteCount > 0 ? `${incomeTax.creditNoteCount} credit note${incomeTax.creditNoteCount === 1 ? "" : "s"} netted` : `${incomeTax.salesCount} ${t("vat.sales_in_period")}`}
          icon={<SalesIcon className="h-5 w-5" />}
          tone="blue"
        />
        <ProStatCard
          label={t("tax.sales_profit")}
          value={formatLkr(incomeTax.salesProfit)}
          hint={incomeTax.returnProfitReversal !== 0 ? `${formatLkr(incomeTax.returnProfitReversal)} return profit reversed` : t("tax.estimated_profit")}
          icon={<ReportsIcon className="h-5 w-5" />}
          tone="emerald"
        />
        <ProStatCard
          label={t("tax.vehicle_profit")}
          value={formatLkr(incomeTax.vehicleProfit)}
          hint={t("nav.vehicles")}
          icon={<VehiclesIcon className="h-5 w-5" />}
          tone="teal"
        />
        <ProStatCard
          label={t("tax.ac_job_profit")}
          value={formatLkr(incomeTax.acJobProfit)}
          hint={t("nav.jobs")}
          icon={<JobsIcon className="h-5 w-5" />}
          tone={incomeTax.acJobProfit < 0 ? "rose" : "teal"}
        />
        <ProStatCard
          label={t("tax.estimated_profit")}
          value={formatLkr(incomeTax.estimatedTaxableProfit)}
          hint={t("tax.income_meter")}
          icon={<CostingIcon className="h-5 w-5" />}
          tone="amber"
        />
      </section>

      {incomeTax.creditNoteCount > 0 && (
        <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-xs font-semibold leading-5 text-teal-900">
          Issued return credit notes in this fiscal year reduce reported sales by {formatLkr(incomeTax.returnRevenueReversal)}. The original invoices remain unchanged.
        </div>
      )}
    </section>
  );

  if (!summary.enabled) {
    return (
      <AppShell>
        <ProMain>
          <ProCard>
            <ProEmptyState
              title={t("vat.title")}
              description={t("vat.enable_hint")}
              action={<ProButton href="/settings/shop">{t("vat.shop_settings")}</ProButton>}
            />
          </ProCard>
          {incomeTaxSection}
        </ProMain>
      </AppShell>
    );
  }

  const quarterSales = data.sales.filter((s) => {
    const d = new Date(s.date).getTime();
    return d >= summary.bounds.start.getTime() && d <= summary.bounds.end.getTime();
  });
  const quarterPurchases = data.purchases.filter((p) => {
    const d = new Date(p.date).getTime();
    return d >= summary.bounds.start.getTime() && d <= summary.bounds.end.getTime();
  });

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
  };

  return (
    <AppShell>
      <ProMain>
        <ProPageHeader
          eyebrow={t("vat.ready_to_file")}
          title={t("vat.title")}
          description={
            <span>
              {summary.bounds.label}
              {data.business.vatNumber && (
                <span className="mt-1 block text-sm font-bold text-slate-500">
                  {t("vat.vat_number")}: {data.business.vatNumber}
                </span>
              )}
            </span>
          }
          actions={
            <>
              {canExport && (
                <ExportActions
                  disabled={quarterSales.length === 0 && quarterPurchases.length === 0 && summary.creditNoteCount === 0}
                  onExportCsv={() =>
                    exportVatCsv(
                      data.business,
                      quarterSales,
                      quarterPurchases,
                      summary,
                      vatExportLabels,
                    )
                  }
                  onPrintPdf={() =>
                    printVatReport(
                      data.business,
                      quarterSales,
                      quarterPurchases,
                      summary,
                      vatExportLabels,
                      t("export.vat_report"),
                    )
                  }
                />
              )}
              <ProButton href="/sales" variant="secondary">{t("nav.sales")}</ProButton>
              <ProButton href="/suppliers" variant="secondary">{t("sup.record_purchase")}</ProButton>
              <ProButton href="/settings/shop">{t("vat.shop_settings")}</ProButton>
            </>
          }
        />

        {returnAccountingError && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
            Return credit-note adjustments could not be loaded, so this view is temporarily showing invoice VAT without those adjustments. {returnAccountingError}
          </div>
        )}

        <section className="mb-6 overflow-hidden rounded-xl bg-slate-950 p-6 text-white shadow-sm shadow-slate-950/20 ring-1 ring-slate-800 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-teal-300">{t("vat.net_payable")}</p>
              <p className="mt-3 font-mono text-4xl font-bold tracking-tight text-teal-300 sm:text-5xl">
                {formatLkr(summary.netPayable)}
              </p>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-400">{t("vat.ird_note")}</p>
            </div>
            <ProBadge tone={summary.netPayable > 0 ? "amber" : "emerald"}>
              {summary.netPayable > 0 ? "Payable" : "Input credit"}
            </ProBadge>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard label={t("vat.output_vat")} value={formatLkr(summary.outputVat)} hint={summary.creditNoteCount > 0 ? `${summary.creditNoteCount} credit note${summary.creditNoteCount === 1 ? "" : "s"} netted` : `${summary.salesCount} ${t("vat.sales_in_period")}`} icon={<BillsIcon className="h-5 w-5" />} tone="amber" />
          <ProStatCard label={t("vat.input_vat")} value={formatLkr(summary.inputVat)} hint={`${summary.purchasesCount} ${t("vat.purchases_in_period")}`} icon={<InboxIcon className="h-5 w-5" />} tone="teal" />
          <ProStatCard label={t("vat.sales_list")} value={String(quarterSales.length)} hint="Invoices in quarter" icon={<SalesIcon className="h-5 w-5" />} tone="blue" />
          <ProStatCard label={t("vat.purchases_list")} value={String(quarterPurchases.length)} hint="Purchase records" icon={<SuppliersIcon className="h-5 w-5" />} tone="emerald" />
        </section>

        {summary.creditNoteCount > 0 && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{summary.creditNoteCount} issued return credit note{summary.creditNoteCount === 1 ? "" : "s"} in this quarter</span>
            <span className="font-mono">Output VAT reversal −{formatLkr(summary.returnVatReversal)}</span>
          </div>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <ProCard title={t("vat.sales_list")} action={<ProBadge tone="amber">{formatLkr(summary.outputVat)}</ProBadge>}>
            {quarterSales.length === 0 ? (
              <ProEmptyState title={t("vat.no_sales")} description="Sales with output VAT will appear here for this period." />
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {quarterSales.map((s) => (
                  <Link key={s.id} href={`/bills/${s.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold uppercase tracking-wide text-slate-500">{s.billNo ?? s.id.slice(0, 8)}</p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-950">{s.customerName || "Walk-in customer"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{new Date(s.date).toLocaleDateString("en-LK")}</p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-bold text-amber-700">{formatLkr(s.outputVat ?? 0)}</p>
                  </Link>
                ))}
              </div>
            )}
            {summary.creditNoteCount > 0 && (
              <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-[11px] font-semibold leading-5 text-teal-800">
                Invoice rows above remain historical gross VAT. The card total is net of {formatLkr(summary.returnVatReversal)} issued credit-note VAT reversals.
              </p>
            )}
          </ProCard>

          <ProCard title={t("vat.purchases_list")} action={<ProBadge tone="teal">{formatLkr(summary.inputVat)}</ProBadge>}>
            {quarterPurchases.length === 0 ? (
              <ProEmptyState title={t("vat.no_purchases")} description="Purchases with input VAT will appear here for this period." />
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {quarterPurchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold uppercase tracking-wide text-slate-500">{p.grnNo}</p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-950">{p.supplierName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{new Date(p.date).toLocaleDateString("en-LK")}</p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-bold text-teal-700">{formatLkr(p.inputVat ?? 0)}</p>
                  </div>
                ))}
              </div>
            )}
          </ProCard>
        </section>

        {incomeTaxSection}
      </ProMain>
    </AppShell>
  );
}
