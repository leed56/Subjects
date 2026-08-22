import type { AppData } from "@/lib/store/types";
import type { BusinessInfo } from "@/lib/invoice";
import { vehicleTotalCost } from "@/lib/vehicles";
import { computeJobProfitability, type JobLinkedExpense } from "@/lib/job-profitability";

/** Sri Lanka standard company rate — YoA 2025/2026 (most companies). */
export const DEFAULT_COMPANY_INCOME_TAX_RATE_PCT = 30;

export const COMPANY_INCOME_TAX_PRESETS = [
  { value: 30, labelKey: "tax.rate_standard" },
  { value: 15, labelKey: "tax.rate_export" },
  { value: 45, labelKey: "tax.rate_special" },
] as const;

export type IncomeTaxReturnAdjustment = {
  issuedAt: string;
  grossCredit: number;
  reversedProfit?: number;
};

export function clampCompanyIncomeTaxRatePct(rate: number | undefined): number {
  if (rate == null || Number.isNaN(rate)) return DEFAULT_COMPANY_INCOME_TAX_RATE_PCT;
  return Math.min(100, Math.max(0, Math.round(rate * 10) / 10));
}

export function resolveCompanyIncomeTaxRatePct(business: BusinessInfo): number {
  return clampCompanyIncomeTaxRatePct(business.companyIncomeTaxRate);
}

export function resolveCompanyIncomeTaxRate(business: BusinessInfo): number {
  return resolveCompanyIncomeTaxRatePct(business) / 100;
}

export type FiscalYearBounds = {
  start: Date;
  end: Date;
  label: string;
  key: string;
};

function fiscalYearLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-LK", { month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** IRD-style fiscal year (defaults to April start, same as VAT settings). */
export function getFiscalYearBounds(
  refDate = new Date(),
  fiscalStartMonth = 4,
): FiscalYearBounds {
  const y = refDate.getFullYear();
  const m = refDate.getMonth() + 1;

  const startYear = m >= fiscalStartMonth ? y : y - 1;
  const start = new Date(startYear, fiscalStartMonth - 1, 1);

  const endMonth = fiscalStartMonth === 1 ? 12 : fiscalStartMonth - 1;
  const endYear = fiscalStartMonth === 1 ? startYear : startYear + 1;
  const end = new Date(endYear, endMonth, 0, 23, 59, 59, 999);

  return {
    start,
    end,
    label: fiscalYearLabel(start, end),
    key: `${startYear}-FY`,
  };
}

function isDateInRange(isoDate: string, start: Date, end: Date): boolean {
  const d = new Date(isoDate).getTime();
  return d >= start.getTime() && d <= end.getTime();
}

export type IncomeTaxYearSummary = {
  bounds: FiscalYearBounds;
  /** Net sales revenue after issued return credit notes (incl. VAT if priced inclusive). */
  revenue: number;
  revenueBeforeReturns: number;
  returnRevenueReversal: number;
  /** Net sales profit after owner-only return profit reversals. */
  salesProfit: number;
  salesProfitBeforeReturns: number;
  returnProfitReversal: number;
  creditNoteCount: number;
  vehicleProfit: number;
  /**
   * Net profit (revenue − material/labor/other cost, incl. subcontractCost
   * and job-linked Expenses) from completed AC jobs in the fiscal year —
   * computed with the same `computeJobProfitability` used by /job-costing,
   * /jobs and the dashboard, so this figure means the same thing there.
   */
  acJobProfit: number;
  /** Business expenses already scoped to the fiscal year by the caller. */
  otherExpenses: number;
  /** Rough profit from LakBiz data — not a full IRD taxable profit. */
  estimatedTaxableProfit: number;
  estimatedTax: number;
  ratePct: number;
  salesCount: number;
};

/**
 * Estimate company income tax from LakBiz profit fields.
 *
 * Return accounting is deliberately supplied separately because accepted
 * returns/credit notes are transactional cloud records, not part of local-first
 * AppData. Only ISSUED credit notes are netted: physical return intake alone is
 * not treated as an accounting reversal. `reversedProfit` is owner-only; if a
 * caller does not supply it, revenue can still be netted but profit remains
 * unchanged rather than inventing a cost basis.
 */
export function getIncomeTaxYearSummary(
  data: AppData,
  refDate = new Date(),
  otherExpenses = 0,
  jobLinkedExpenses: Map<string, JobLinkedExpense[]> = new Map(),
  returnAdjustments: IncomeTaxReturnAdjustment[] = [],
): IncomeTaxYearSummary {
  const fiscalStart = data.business.quarterStartMonth ?? 4;
  const bounds = getFiscalYearBounds(refDate, fiscalStart);
  const ratePct = resolveCompanyIncomeTaxRatePct(data.business);
  const rate = ratePct / 100;

  const yearSales = data.sales.filter((s) =>
    isDateInRange(s.date, bounds.start, bounds.end),
  );
  const yearReturns = returnAdjustments.filter((adjustment) =>
    isDateInRange(adjustment.issuedAt, bounds.start, bounds.end),
  );

  const revenueBeforeReturns = yearSales.reduce((sum, s) => sum + s.total, 0);
  const returnRevenueReversal = yearReturns.reduce(
    (sum, adjustment) => sum + Math.max(0, adjustment.grossCredit),
    0,
  );
  const revenue = revenueBeforeReturns - returnRevenueReversal;

  const salesProfitBeforeReturns = yearSales.reduce((sum, s) => sum + s.profit, 0);
  const returnProfitReversal = yearReturns.reduce(
    (sum, adjustment) =>
      sum + (adjustment.reversedProfit != null ? adjustment.reversedProfit : 0),
    0,
  );
  const salesProfit = salesProfitBeforeReturns - returnProfitReversal;

  const vehicleProfit = data.vehicles
    .filter(
      (v) =>
        v.status === "sold" &&
        v.soldDate &&
        isDateInRange(v.soldDate, bounds.start, bounds.end),
    )
    .reduce(
      (sum, v) =>
        sum +
        ((v.soldPrice ?? 0) -
          vehicleTotalCost(v.purchasePrice, v.reconditionCost)),
      0,
    );

  const jobItemsByJob = new Map<string, typeof data.jobItems>();
  for (const item of data.jobItems) {
    const list = jobItemsByJob.get(item.jobId) ?? [];
    list.push(item);
    jobItemsByJob.set(item.jobId, list);
  }

  const acJobProfit = data.acJobs
    .filter(
      (j) =>
        j.status === "completed" &&
        isDateInRange(j.installedDate ?? j.date, bounds.start, bounds.end),
    )
    .reduce(
      (sum, j) =>
        sum +
        computeJobProfitability(
          j,
          jobItemsByJob.get(j.id) ?? [],
          jobLinkedExpenses.get(j.id) ?? [],
        ).grossProfit,
      0,
    );

  const estimatedTaxableProfit = Math.max(
    0,
    salesProfit + vehicleProfit + acJobProfit - otherExpenses,
  );
  const estimatedTax = Math.round(estimatedTaxableProfit * rate);

  return {
    bounds,
    revenue,
    revenueBeforeReturns,
    returnRevenueReversal,
    salesProfit,
    salesProfitBeforeReturns,
    returnProfitReversal,
    creditNoteCount: yearReturns.length,
    otherExpenses,
    vehicleProfit,
    acJobProfit,
    estimatedTaxableProfit,
    estimatedTax,
    ratePct,
    salesCount: yearSales.length,
  };
}
