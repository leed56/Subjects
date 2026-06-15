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

/** IRD-style fiscal quarters defaulting to April start (month 4) */
export function getVatQuarterBounds(
  refDate = new Date(),
  fiscalStartMonth = 4,
): VatQuarterBounds {
  const y = refDate.getFullYear();
  const m = refDate.getMonth() + 1; // 1-12

  let qIndex: number;
  let startYear = y;
  let endYear = y;

  if (fiscalStartMonth === 1) {
    qIndex = Math.floor((m - 1) / 3);
    const startMonth = qIndex * 3 + 1;
    const endMonth = startMonth + 2;
    const start = new Date(y, startMonth - 1, 1);
    const end = new Date(y, endMonth, 0, 23, 59, 59, 999);
    return {
      start,
      end,
      label: quarterLabel(start, end),
      key: `${y}-Q${qIndex + 1}`,
    };
  }

  // Fiscal year starting April (month 4)
  const offset = ((m - fiscalStartMonth + 12) % 12);
  qIndex = Math.floor(offset / 3);
  const startMonth = ((fiscalStartMonth - 1 + qIndex * 3) % 12) + 1;
  const endMonth = ((startMonth - 1 + 2) % 12) + 1;

  if (startMonth >= fiscalStartMonth) {
    startYear = y;
  } else if (m < fiscalStartMonth) {
    startYear = y - 1;
  }
  endYear = endMonth < startMonth ? startYear + 1 : startYear;

  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth, 0, 23, 59, 59, 999);

  return {
    start,
    end,
    label: quarterLabel(start, end),
    key: `${startYear}-FYQ${qIndex + 1}`,
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
