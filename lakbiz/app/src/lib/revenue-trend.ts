import type { Sale } from "@/lib/store/types";

export type Locale = "si" | "en" | "ta";
export type TrendPeriod = "30d" | "3m" | "6m" | "12m";
export type TrendPoint = { key: string; label: string; revenue: number; profit: number };

/** Intl locale tag for the active UI locale. "ta-LK" is valid BCP 47 even
 * where a browser/Node's ICU data lacks Sri-Lanka-specific Tamil overrides —
 * it falls back to generic "ta" formatting rather than throwing. */
export function localeTag(locale: Locale): string {
  if (locale === "si") return "si-LK";
  if (locale === "ta") return "ta-LK";
  return "en-LK";
}

/**
 * Revenue+profit trend, bucketed daily (30d) or monthly (3/6/12m). A
 * different shape than the Reports page's single-metric daily trend
 * (Phase 14) — kept as its own function rather than forcing that
 * component to support a shape it wasn't built for.
 *
 * `now` is an explicit parameter (not `new Date()` called inside) so this
 * stays a pure function usable from both the dashboard and Business Pulse
 * without either page owning the "current time" decision.
 */
export function getRevenueTrend(sales: Sale[], period: TrendPeriod, locale: Locale, now: Date): TrendPoint[] {
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
        label: d.toLocaleDateString(localeTag(locale), { day: "numeric", month: "short" }),
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
      label: d.toLocaleDateString(localeTag(locale), { month: "short", year: "2-digit" }),
      revenue: monthSales.reduce((s, x) => s + x.total, 0),
      profit: monthSales.reduce((s, x) => s + x.profit, 0),
    };
  });
}
