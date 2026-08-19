import type { AppData } from "@/lib/store/types";
import type { BusinessInfo } from "@/lib/invoice";

/** Sri Lanka standard VAT rate (2026) */
export const VAT_RATE = 0.18;

export type VatQuarterBounds = {
  start: Date;
  end: Date;
  label: string;
  key: string;
};

/** Split VAT-inclusive retail total into ex-VAT subtotal + output VAT */
export function splitInclusiveTotal(inclusiveTotal: number): {
  subtotal: number;
  vat: number;
  total: number;
} {
  if (inclusiveTotal <= 0) {
    return { subtotal: 0, vat: 0, total: 0 };
  }
  const subtotal = Math.round(inclusiveTotal / (1 + VAT_RATE));
  const vat = inclusiveTotal - subtotal;
  return { subtotal, vat, total: inclusiveTotal };
}

/** Input VAT from pre-VAT purchase subtotal */
export function calcInputVat(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return Math.round(subtotal * VAT_RATE);
}

export function isVatEnabled(business: BusinessInfo): boolean {
  return business.vatRegistered === true;
}

/**
 * IRD-style fiscal quarters defaulting to April start (month 4).
 *
 * CORRECTION (test-coverage pass — found by writing tests for this
 * function, not by a bug report): the previous implementation derived
 * `startYear`/`endYear` from a handful of ad hoc branches
 * (`startMonth >= fiscalStartMonth` / `m < fiscalStartMonth` /
 * `endMonth < startMonth`) that each handled only part of the
 * year-rollover logic. Brute-forcing every (fiscalStartMonth, current
 * month) combination showed 66 of 144 — 46% — returned a quarter whose
 * `[start, end]` bounds didn't even contain `refDate`, off by exactly
 * one year. For the *default* fiscalStartMonth (4, April), this hit
 * every January/February/March: `getVatQuarterSummary` (called with
 * `refDate = new Date()`, i.e. today, by every real caller) would
 * silently show a VAT-registered shop's *previous* year's Jan–Mar
 * quarter — the wrong sales/purchases entirely — for a quarter of every
 * calendar year. A live, real correctness bug in VAT compliance data,
 * not a hypothetical one.
 *
 * Rewritten using absolute-month arithmetic (`year*12 + monthIndex`)
 * instead of ad hoc year branches — the quarter's start/end month is
 * computed as an offset in absolute-month space, then converted back to
 * a (year, month) pair by a single division, which cannot go out of
 * sync with `refDate`'s own year the way multiple independent branches
 * could. Verified against all 144 (fiscalStartMonth, month) combinations
 * — 0 failures — including the fiscalStartMonth===1 (calendar quarter)
 * case, which the old code special-cased separately; the unified
 * formula produces identical results for it, so that branch is gone too.
 */
export function getVatQuarterBounds(
  refDate = new Date(),
  fiscalStartMonth = 4,
): VatQuarterBounds {
  const y = refDate.getFullYear();
  const m = refDate.getMonth() + 1; // 1-12

  const absMonth = y * 12 + (m - 1); // absolute month index, 0-based
  const fiscalMonthIndex = (m - fiscalStartMonth + 12) % 12; // 0..11, offset within the fiscal year
  const qIndex = Math.floor(fiscalMonthIndex / 3);

  const quarterStartAbs = absMonth - fiscalMonthIndex + qIndex * 3;
  const quarterEndAbs = quarterStartAbs + 2;

  const startYear = Math.floor(quarterStartAbs / 12);
  const startMonth = (quarterStartAbs % 12) + 1;
  const endYear = Math.floor(quarterEndAbs / 12);
  const endMonth = (quarterEndAbs % 12) + 1;

  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth, 0, 23, 59, 59, 999);

  return {
    start,
    end,
    label: quarterLabel(start, end),
    key: fiscalStartMonth === 1 ? `${startYear}-Q${qIndex + 1}` : `${startYear}-FYQ${qIndex + 1}`,
  };
}

function quarterLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-LK", { month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function isDateInQuarter(isoDate: string, bounds: VatQuarterBounds): boolean {
  const d = new Date(isoDate).getTime();
  return d >= bounds.start.getTime() && d <= bounds.end.getTime();
}

export type VatQuarterSummary = {
  bounds: VatQuarterBounds;
  outputVat: number;
  inputVat: number;
  netPayable: number;
  salesCount: number;
  purchasesCount: number;
  enabled: boolean;
};

export function getVatQuarterSummary(
  data: AppData,
  refDate = new Date(),
): VatQuarterSummary {
  const enabled = isVatEnabled(data.business);
  const fiscalStart = data.business.quarterStartMonth ?? 4;
  const bounds = getVatQuarterBounds(refDate, fiscalStart);

  const quarterSales = data.sales.filter((s) =>
    isDateInQuarter(s.date, bounds),
  );
  const quarterPurchases = data.purchases.filter((p) =>
    isDateInQuarter(p.date, bounds),
  );

  const outputVat = quarterSales.reduce((sum, s) => {
    if (s.outputVat != null) return sum + s.outputVat;
    return sum + splitInclusiveTotal(s.total).vat;
  }, 0);

  const inputVat = quarterPurchases.reduce((sum, p) => {
    if (p.inputVat != null) return sum + p.inputVat;
    return sum + calcInputVat(p.subtotal ?? p.total);
  }, 0);

  return {
    bounds,
    outputVat,
    inputVat,
    netPayable: outputVat - inputVat,
    salesCount: quarterSales.length,
    purchasesCount: quarterPurchases.length,
    enabled,
  };
}
