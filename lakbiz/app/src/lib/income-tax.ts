import type { AppData } from "@/lib/store/types";
import type { BusinessInfo } from "@/lib/invoice";
import { vehicleTotalCost } from "@/lib/vehicles";

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
  subcontractExpense: number;
  /** Rough profit from LakBiz data — not a full IRD taxable profit. */
  estimatedTaxableProfit: number;
  estimatedTax: number;
  ratePct: number;
  salesCount: number;
};

/**
 * Estimate company income tax from LakBiz profit fields (owner/manager only in UI).
 * Excludes rent, payroll, depreciation, and other costs not tracked in the app.
 */
export function getIncomeTaxYearSummary(
  data: AppData,
  refDate = new Date(),
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

  const subcontractExpense = data.acJobs
    .filter(
      (j) =>
        j.status === "completed" &&
        j.assigneeType === "contractor" &&
        (j.subcontractCost ?? 0) > 0 &&
        isDateInRange(j.installedDate ?? j.date, bounds.start, bounds.end),
    )
    .reduce((sum, j) => sum + (j.subcontractCost ?? 0), 0);

  const estimatedTaxableProfit = Math.max(
    0,
    salesProfit + vehicleProfit - subcontractExpense,
  );
  const estimatedTax = Math.round(estimatedTaxableProfit * rate);

  return {
    bounds,
    revenue,
    salesProfit,
    vehicleProfit,
    subcontractExpense,
    estimatedTaxableProfit,
    estimatedTax,
    ratePct,
    salesCount: yearSales.length,
  };
}
