import type { Product } from "@/lib/types";
import type { AppData, Sale, StockLog } from "@/lib/store/types";
import { NEAR_EXPIRY_DAYS } from "./pharmacy-config";

export type RetailSector = "pharmacy" | "grocery";

/** Sales Performance / Owner Financial Snapshot used to be hardcoded to a
 * rolling 30-day window with no way to change it — this is the real
 * period selector behind that control. "custom" carries its own
 * start/end; the named presets are resolved against `referenceDate` in
 * resolvePeriodRange() below. Week-over-week/month-over-month/
 * year-over-year all fall out of the same mechanism: each preset also
 * resolves the *immediately preceding* period of equal length, and
 * periodChangePct compares actual recorded totals between the two —
 * never an assumed or interpolated number. */
export type DashboardPeriod =
  | "7d"
  | "30d"
  | "this_week"
  | "this_month"
  | "last_month"
  | { custom: { start: string; end: string } };

export type ResolvedPeriodRange = {
  /** Inclusive day-string bounds (YYYY-MM-DD), matching Sale.date's own
   * format so range filtering stays a plain string comparison. */
  startKey: string;
  endKey: string;
  priorStartKey: string;
  priorEndKey: string;
  label: string;
};

export type RetailLotSnapshot = {
  id: string;
  productId: string;
  batchNo: string;
  expiryDate: string | null;
  qtyOnHand: number;
  // "disposed"/"supplier_returned" are terminal post-disposition states
  // (see 20260825000001_blocked_lot_disposition.sql) — qtyOnHand is always
  // 0 by the time a lot reaches either, so they never affect
  // available/near-expiry/blocked counts; listed here only so the type
  // doesn't lie about what the DB can actually return.
  status: "available" | "quarantine" | "expired" | "depleted" | "returned" | "recalled" | "disposed" | "supplier_returned";
};

export type RetailTrendPoint = {
  key: string;
  label: string;
  revenue: number;
  profit: number | null;
  transactions: number;
};

export type RetailTopMover = {
  productId: string;
  name: string;
  category: string;
  qty: number;
  revenue: number;
  stockQty: number;
};

export type RetailCategorySlice = {
  category: string;
  value: number;
  share: number;
};

export type RetailReorderItem = {
  productId: string;
  name: string;
  category: string;
  stockQty: number;
  reorderLevel: number;
  unit: string;
};

export type RetailExpiryItem = RetailLotSnapshot & {
  productName: string;
  daysToExpiry: number;
};

export type RetailActivity = {
  id: string;
  type: "sale" | "stock" | "purchase";
  title: string;
  subtitle: string;
  amount: number | null;
  date: string;
};

export type RetailDashboardIntelligence = {
  activeSkuCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventorySellValue: number;
  inventoryCostValue: number | null;
  todaySales: number;
  todayTransactions: number;
  /** vs. the same total computed for yesterday, from the same `data.sales`
   * — null only when yesterday had zero recorded sales (nothing to divide
   * by), never fabricated. Active SKUs and Low Stock have no equivalent:
   * neither Product nor StockLog carries the history needed to know what
   * either count was N days ago without guessing. */
  todaySalesChangePct: number | null;
  averageBasket: number;
  periodSales: number;
  periodTransactions: number;
  periodProfit: number | null;
  grossMarginPct: number | null;
  /** Label for whatever range periodSales/periodProfit/topMovers/etc. were
   * actually computed over — was a hardcoded "30-day sales" string before;
   * now reflects the real selected DashboardPeriod. */
  periodLabel: string;
  /** periodSales vs. the immediately preceding period of equal length
   * (the "this_week"/"this_month" presets are how week-over-week and
   * month-over-month land here) — real data, same null-when-no-baseline
   * rule as todaySalesChangePct. */
  periodChangePct: number | null;
  medicineCount: number;
  nonMedicineCount: number;
  nearExpiryCount: number;
  expiredLotCount: number;
  quarantineLotCount: number;
  fefoProductCount: number;
  availableLotCount: number;
  trend: RetailTrendPoint[];
  topMovers: RetailTopMover[];
  categoryMix: RetailCategorySlice[];
  reorderQueue: RetailReorderItem[];
  slowMovers: RetailTopMover[];
  expiryQueue: RetailExpiryItem[];
  recentActivity: RetailActivity[];
};

const DAY_MS = 86_400_000;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseTime(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** `unit` (e.g. "tablets", "ml", "strips") is the only field that belongs
 * next to a quantity. `packSize` is a separate, free-text *descriptive*
 * field ("10 tablets", "100 ml", or shorthand like "100C") — see
 * sector-fields.ts. Falling back to it here used to render nonsense like
 * "0 100C" (stock qty + a pack-size code with no separator or label) in
 * the Replenishment Queue; a bare generic unit is honest where "unit" is
 * genuinely unset, packSize never is. */
function productUnit(product: Product): string {
  return String(product.customFields.unit ?? "units");
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Monday-start week, so "this_week" reads as a normal business week. */
function startOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  return addDays(date, -diff);
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Resolves a DashboardPeriod into concrete day-key bounds plus the
 * immediately preceding period of equal length — the mechanism behind
 * every "vs previous period" comparison this module computes. Never
 * looks past `data.sales` itself: a period with no prior activity just
 * yields a `null` comparison upstream, not an invented one. */
export function resolvePeriodRange(period: DashboardPeriod, referenceDate: Date): ResolvedPeriodRange {
  if (typeof period === "object") {
    const { start, end } = period.custom;
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const lengthDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1);
    const priorEnd = addDays(startDate, -1);
    const priorStart = addDays(priorEnd, -(lengthDays - 1));
    return {
      startKey: start,
      endKey: end,
      priorStartKey: dayKey(priorStart),
      priorEndKey: dayKey(priorEnd),
      label: start === end ? start : `${start} – ${end}`,
    };
  }

  if (period === "7d") {
    const end = referenceDate;
    const start = addDays(end, -6);
    const priorEnd = addDays(start, -1);
    const priorStart = addDays(priorEnd, -6);
    return { startKey: dayKey(start), endKey: dayKey(end), priorStartKey: dayKey(priorStart), priorEndKey: dayKey(priorEnd), label: "Last 7 days" };
  }
  if (period === "this_week") {
    const start = startOfWeek(referenceDate);
    const end = referenceDate;
    const priorEnd = addDays(start, -1);
    const priorStart = addDays(priorEnd, -6);
    return { startKey: dayKey(start), endKey: dayKey(end), priorStartKey: dayKey(priorStart), priorEndKey: dayKey(priorEnd), label: "This week" };
  }
  if (period === "this_month") {
    const start = startOfMonth(referenceDate);
    const end = referenceDate;
    // Normalize `end` to midnight before diffing — referenceDate carries
    // whatever time-of-day the caller passed (real callers use "now"),
    // and that fractional day was rounding daysSoFar up by one.
    const endAtMidnight = new Date(`${dayKey(end)}T00:00:00Z`);
    const daysSoFar = Math.round((endAtMidnight.getTime() - start.getTime()) / DAY_MS) + 1;
    const priorMonthStart = startOfMonth(addDays(start, -1));
    const priorStart = priorMonthStart;
    const priorEnd = addDays(priorMonthStart, daysSoFar - 1);
    return { startKey: dayKey(start), endKey: dayKey(end), priorStartKey: dayKey(priorStart), priorEndKey: dayKey(priorEnd), label: "This month" };
  }
  if (period === "last_month") {
    const thisMonthStart = startOfMonth(referenceDate);
    const lastMonthStart = startOfMonth(addDays(thisMonthStart, -1));
    const lastMonthEnd = addDays(thisMonthStart, -1);
    const priorMonthStart = startOfMonth(addDays(lastMonthStart, -1));
    const priorMonthEnd = addDays(lastMonthStart, -1);
    return { startKey: dayKey(lastMonthStart), endKey: dayKey(lastMonthEnd), priorStartKey: dayKey(priorMonthStart), priorEndKey: dayKey(priorMonthEnd), label: "Last month" };
  }
  // "30d" — the original default window, kept as the fallback.
  const end = referenceDate;
  const start = addDays(end, -29);
  const priorEnd = addDays(start, -1);
  const priorStart = addDays(priorEnd, -29);
  return { startKey: dayKey(start), endKey: dayKey(end), priorStartKey: dayKey(priorStart), priorEndKey: dayKey(priorEnd), label: "Last 30 days" };
}

export function isPharmacyMedicine(product: Product): boolean {
  const kind = String(product.customFields.productKind ?? "").toLowerCase();
  if (kind === "medicine") return true;
  const category = product.category.toLowerCase();
  if (category.includes("medicine")) return true;
  return Boolean(product.customFields.genericName || product.customFields.dosageForm || product.customFields.strength);
}

function buildTrend(sales: Sale[], canSeeFinancials: boolean, referenceDate: Date): RetailTrendPoint[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(referenceDate);
    date.setUTCDate(referenceDate.getUTCDate() - (6 - index));
    const key = dayKey(date);
    const rows = sales.filter((sale) => sale.date.startsWith(key));
    return {
      key,
      label: date.toLocaleDateString("en-LK", { weekday: "short" }),
      revenue: rows.reduce((sum, sale) => sum + sale.total, 0),
      profit: canSeeFinancials ? rows.reduce((sum, sale) => sum + sale.profit, 0) : null,
      transactions: rows.length,
    };
  });
}

function buildTopMovers(products: Product[], sales: Sale[]): RetailTopMover[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const totals = new Map<string, { qty: number; revenue: number; name: string }>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      const current = totals.get(line.productId) ?? { qty: 0, revenue: 0, name: line.productName };
      current.qty += line.qty;
      current.revenue += line.qty * line.unitPrice;
      totals.set(line.productId, current);
    }
  }
  return [...totals.entries()]
    .map(([productId, total]) => {
      const product = productById.get(productId);
      return {
        productId,
        name: product?.name ?? total.name,
        category: product?.category ?? "Other",
        qty: total.qty,
        revenue: total.revenue,
        stockQty: product?.stockQty ?? 0,
      };
    })
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, 8);
}

function buildSlowMovers(products: Product[], sales: Sale[]): RetailTopMover[] {
  const sold = new Map<string, { qty: number; revenue: number }>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      const current = sold.get(line.productId) ?? { qty: 0, revenue: 0 };
      current.qty += line.qty;
      current.revenue += line.qty * line.unitPrice;
      sold.set(line.productId, current);
    }
  }
  return products
    .filter((product) => product.active && product.stockQty > 0)
    .map((product) => ({
      productId: product.id,
      name: product.name,
      category: product.category,
      qty: sold.get(product.id)?.qty ?? 0,
      revenue: sold.get(product.id)?.revenue ?? 0,
      stockQty: product.stockQty,
    }))
    .sort((a, b) => a.qty - b.qty || b.stockQty - a.stockQty)
    .slice(0, 6);
}

function buildCategoryMix(products: Product[], sales: Sale[]): RetailCategorySlice[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const values = new Map<string, number>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      const category = productById.get(line.productId)?.category ?? "Other";
      values.set(category, (values.get(category) ?? 0) + line.qty * line.unitPrice);
    }
  }
  if (!values.size) {
    for (const product of products) {
      if (!product.active) continue;
      values.set(product.category || "Other", (values.get(product.category || "Other") ?? 0) + 1);
    }
  }
  const sorted = [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = sorted.reduce((sum, [, value]) => sum + value, 0);
  return sorted.map(([category, value]) => ({
    category,
    value,
    share: total > 0 ? (value / total) * 100 : 0,
  }));
}

function buildReorderQueue(products: Product[]): RetailReorderItem[] {
  return products
    .filter((product) => product.active && product.reorderLevel != null && product.stockQty <= product.reorderLevel)
    .sort((a, b) => {
      const aLevel = Math.max(1, a.reorderLevel ?? 1);
      const bLevel = Math.max(1, b.reorderLevel ?? 1);
      return a.stockQty / aLevel - b.stockQty / bLevel || a.stockQty - b.stockQty;
    })
    .slice(0, 8)
    .map((product) => ({
      productId: product.id,
      name: product.name,
      category: product.category,
      stockQty: product.stockQty,
      reorderLevel: product.reorderLevel ?? 0,
      unit: productUnit(product),
    }));
}

function buildExpiryMetrics(
  products: Product[],
  lots: RetailLotSnapshot[],
  referenceDate: Date,
): Pick<RetailDashboardIntelligence, "nearExpiryCount" | "expiredLotCount" | "quarantineLotCount" | "fefoProductCount" | "availableLotCount" | "expiryQueue"> {
  const productById = new Map(products.map((product) => [product.id, product]));
  const today = new Date(dayKey(referenceDate)).getTime();
  const nearCutoff = today + NEAR_EXPIRY_DAYS * DAY_MS;
  const availableByProduct = new Map<string, number>();
  let nearExpiryCount = 0;
  let expiredLotCount = 0;
  let quarantineLotCount = 0;
  let availableLotCount = 0;
  const expiryQueue: RetailExpiryItem[] = [];

  for (const lot of lots) {
    if (lot.qtyOnHand <= 0) continue;
    const expiryTime = lot.expiryDate ? parseTime(`${lot.expiryDate}T00:00:00Z`) : 0;
    const isExpired = lot.status === "expired" || (expiryTime > 0 && expiryTime < today);
    const isQuarantine = lot.status === "quarantine" || lot.status === "recalled";
    const isAvailable = lot.status === "available" && !isExpired;
    const isNear = isAvailable && expiryTime >= today && expiryTime <= nearCutoff;

    if (isExpired) expiredLotCount += 1;
    if (isQuarantine) quarantineLotCount += 1;
    if (isAvailable) {
      availableLotCount += 1;
      availableByProduct.set(lot.productId, (availableByProduct.get(lot.productId) ?? 0) + 1);
    }
    if (isNear) {
      nearExpiryCount += 1;
      expiryQueue.push({
        ...lot,
        productName: productById.get(lot.productId)?.name ?? "Unknown product",
        daysToExpiry: Math.ceil((expiryTime - today) / DAY_MS),
      });
    }
  }

  expiryQueue.sort((a, b) => a.daysToExpiry - b.daysToExpiry || a.productName.localeCompare(b.productName));
  return {
    nearExpiryCount,
    expiredLotCount,
    quarantineLotCount,
    fefoProductCount: [...availableByProduct.values()].filter((count) => count > 1).length,
    availableLotCount,
    expiryQueue: expiryQueue.slice(0, 8),
  };
}

function stockLogSubtitle(log: StockLog): string {
  const qty = Math.abs(log.qty);
  if (log.type === "sale") return `${qty} sold`;
  if (log.type === "purchase" || log.type === "in") return `${qty} received`;
  if (log.type === "write_off") return `${qty} written off`;
  if (log.type === "supplier_return") return `${qty} returned to supplier`;
  return `${qty} stock movement`;
}

function buildRecentActivity(data: AppData, canSeeFinancials: boolean): RetailActivity[] {
  const sales: RetailActivity[] = data.sales.slice(-8).map((sale) => ({
    id: `sale:${sale.id}`,
    type: "sale",
    title: sale.billNo ? `Sale ${sale.billNo}` : "Sale completed",
    subtitle: `${sale.lines.length} line${sale.lines.length === 1 ? "" : "s"}${sale.customerName ? ` · ${sale.customerName}` : ""}`,
    amount: sale.total,
    date: sale.date,
  }));
  const stock: RetailActivity[] = data.stockLogs.slice(-10).map((log) => ({
    id: `stock:${log.id}`,
    type: "stock",
    title: log.productName,
    subtitle: stockLogSubtitle(log),
    amount: null,
    date: log.date,
  }));
  const purchases: RetailActivity[] = canSeeFinancials
    ? data.purchases.slice(-6).map((purchase) => ({
        id: `purchase:${purchase.id}`,
        type: "purchase" as const,
        title: `GRN ${purchase.grnNo}`,
        subtitle: purchase.supplierName,
        amount: purchase.total,
        date: purchase.date,
      }))
    : [];
  return [...sales, ...stock, ...purchases]
    .sort((a, b) => parseTime(b.date) - parseTime(a.date))
    .slice(0, 8);
}

export function buildRetailDashboardIntelligence(
  data: AppData,
  sector: RetailSector,
  canSeeFinancials: boolean,
  lots: RetailLotSnapshot[] = [],
  referenceDate = new Date(),
  period: DashboardPeriod = "30d",
): RetailDashboardIntelligence {
  const products = data.products;
  const activeProducts = products.filter((product) => product.active);
  const lowStock = activeProducts.filter((product) => product.reorderLevel != null && product.stockQty <= product.reorderLevel);
  const outOfStock = activeProducts.filter((product) => product.stockQty <= 0);
  const today = dayKey(referenceDate);
  const todaySalesRows = data.sales.filter((sale) => sale.date.startsWith(today));
  const range = resolvePeriodRange(period, referenceDate);
  const recentSales = data.sales.filter((sale) => {
    const key = sale.date.slice(0, 10);
    return key >= range.startKey && key <= range.endKey;
  });
  const priorPeriodSalesTotal = data.sales
    .filter((sale) => {
      const key = sale.date.slice(0, 10);
      return key >= range.priorStartKey && key <= range.priorEndKey;
    })
    .reduce((sum, sale) => sum + sale.total, 0);
  const rankingSales = recentSales.length ? recentSales : data.sales;
  const todaySales = todaySalesRows.reduce((sum, sale) => sum + sale.total, 0);
  const yesterday = new Date(referenceDate);
  yesterday.setUTCDate(referenceDate.getUTCDate() - 1);
  const yesterdayKey = dayKey(yesterday);
  const yesterdaySales = data.sales
    .filter((sale) => sale.date.startsWith(yesterdayKey))
    .reduce((sum, sale) => sum + sale.total, 0);
  const todaySalesChangePct = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : null;
  const periodSales = recentSales.reduce((sum, sale) => sum + sale.total, 0);
  const periodProfit = canSeeFinancials ? recentSales.reduce((sum, sale) => sum + sale.profit, 0) : null;
  const periodChangePct = priorPeriodSalesTotal > 0 ? ((periodSales - priorPeriodSalesTotal) / priorPeriodSalesTotal) * 100 : null;
  const averageBase = todaySalesRows.length ? todaySalesRows : recentSales;
  const averageTotal = averageBase.reduce((sum, sale) => sum + sale.total, 0);
  const medicines = sector === "pharmacy" ? activeProducts.filter(isPharmacyMedicine).length : 0;
  const expiry = buildExpiryMetrics(products, lots, referenceDate);

  return {
    activeSkuCount: activeProducts.length,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    inventorySellValue: activeProducts.reduce((sum, product) => sum + product.stockQty * product.sellPrice, 0),
    inventoryCostValue: canSeeFinancials
      ? activeProducts.reduce((sum, product) => sum + product.stockQty * product.buyPrice, 0)
      : null,
    todaySales,
    todaySalesChangePct,
    todayTransactions: todaySalesRows.length,
    averageBasket: averageBase.length ? averageTotal / averageBase.length : 0,
    periodSales,
    periodLabel: range.label,
    periodChangePct,
    periodTransactions: recentSales.length,
    periodProfit,
    grossMarginPct: canSeeFinancials && periodSales > 0 && periodProfit != null ? (periodProfit / periodSales) * 100 : null,
    medicineCount: medicines,
    nonMedicineCount: sector === "pharmacy" ? Math.max(0, activeProducts.length - medicines) : 0,
    ...expiry,
    trend: buildTrend(data.sales, canSeeFinancials, referenceDate),
    topMovers: buildTopMovers(products, rankingSales),
    categoryMix: buildCategoryMix(products, rankingSales),
    reorderQueue: buildReorderQueue(products),
    slowMovers: buildSlowMovers(products, rankingSales),
    recentActivity: buildRecentActivity(data, canSeeFinancials),
  };
}
