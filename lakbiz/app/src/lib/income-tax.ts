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
  /** Total sales revenue (incl. VAT if priced inclusive). */
  revenue: number;
  salesProfit: number;
  vehicleProfit: number;
  /**
   * Net profit (revenue − material/labor/other cost, incl. subcontractCost
   * and job-linked Expenses) from completed AC jobs in the fiscal year —
   * computed with the same `computeJobProfitability` used by /job-costing,
   * /jobs and the dashboard, so this figure means the same thing there.
   *
   * CORRECTION (fix-all pass, found while investigating the disclosed
   * "AC job revenue/cost missing from income tax" gap): this field used to
   * be `subcontractExpense`, a standalone subtraction of contractor cost
   * with no corresponding AC job *revenue* ever added anywhere in this
   * function — i.e. every completed AC job's quotedAmount was invisible to
   * the tax estimate, and contractor-assigned jobs were double-penalized
   * (cost counted, revenue never was). AC job invoicing was verified (see
   * jobs/[id]/invoice/page.tsx) to never create a Sale record, so folding
   * full job profit in here does not create a new double-count against
   * `salesProfit`.
   */
  acJobProfit: number;
  /** Business expenses (Phase 11) already scoped to the fiscal year by
   * the caller — see the otherExpenses param below. Callers must exclude
   * job-linked expenses (Expense.jobId set) from this total: those are
   * already netted into acJobProfit per-job via jobLinkedExpenses below,
   * and including them again here would double-subtract them. */
  otherExpenses: number;
  /** Rough profit from LakBiz data — not a full IRD taxable profit. */
  estimatedTaxableProfit: number;
  estimatedTax: number;
  ratePct: number;
  salesCount: number;
};

/**
 * Estimate company income tax from LakBiz profit fields (owner/manager only in UI).
 * Excludes rent, payroll, depreciation, and other costs not tracked in the app,
 * unless the caller supplies otherExpenses explicitly.
 *
 * otherExpenses (Phase 11): expenses now live in a cloud-only table (see
 * expenses-client.ts), not the local-first AppData this function otherwise
 * reads, so it can't be computed in here the way acJobProfit is — the
 * caller fetches its own fiscal-year total and passes it in. Optional and
 * defaults to 0 so every existing caller is unaffected unless it opts in.
 * MUST exclude job-linked expenses (Expense.jobId set) — see the type's
 * doc comment above.
 *
 * jobLinkedExpenses (fix-all pass): same cloud-only constraint as
 * otherExpenses — job-linked Expenses (Phase 7) live outside AppData, so
 * the caller fetches them and passes a jobId → JobLinkedExpense[] map in,
 * same pattern already used by /job-costing, /jobs and the dashboard.
 * Defaults to an empty map so a caller that hasn't wired this up yet still
 * gets a correct (if expense-incomplete) acJobProfit rather than a crash.
 */
export function getIncomeTaxYearSummary(
  data: AppData,
  refDate = new Date(),
  otherExpenses = 0,
  jobLinkedExpenses: Map<string, JobLinkedExpense[]> = new Map(),
): IncomeTaxYearSummary {
  const fiscalStart = data.business.quarterStartMonth ?? 4;
  const bounds = getFiscalYearBounds(refDate, fiscalStart);
  const ratePct = resolveCompanyIncomeTaxRatePct(data.business);
  const rate = ratePct / 100;

  const yearSales = data.sales.filter((s) =>
    isDateInRange(s.date, bounds.start, bounds.end),
  );
  const revenue = yearSales.reduce((sum, s) => sum + s.total, 0);
  const salesProfit = yearSales.reduce((sum, s) => sum + s.profit, 0);

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
    salesProfit,
    otherExpenses,
    vehicleProfit,
    acJobProfit,
    estimatedTaxableProfit,
    estimatedTax,
    ratePct,
    salesCount: yearSales.length,
  };
}
