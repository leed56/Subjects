import type { ProductCondition } from "@/lib/types";

export type SavedStockView = {
  id: string;
  name: string;
  search: string;
  condition: "all" | ProductCondition;
  category: string;
  lowStock: boolean;
  inactive: boolean;
  zeroPrice: boolean;
};

export const MAX_SAVED_STOCK_VIEWS = 5;

export function stockSavedViewsKey(organizationId: string): string {
  return `lakbiz:stock-saved-views:${organizationId}`;
}

export function parseSavedStockViews(raw: string | null): SavedStockView[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const row = candidate as Record<string, unknown>;
      const condition = row.condition;
      if (
        typeof row.id !== "string" || !row.id.trim() ||
        typeof row.name !== "string" || !row.name.trim() ||
        typeof row.search !== "string" ||
        typeof row.category !== "string" || !row.category ||
        (condition !== "all" && condition !== "new" && condition !== "used") ||
        typeof row.lowStock !== "boolean" ||
        typeof row.inactive !== "boolean" ||
        typeof row.zeroPrice !== "boolean"
      ) return [];
      return [{
        id: row.id.slice(0, 80),
        name: row.name.trim().slice(0, 40),
        search: row.search.slice(0, 120),
        condition: condition as SavedStockView["condition"],
        category: row.category.slice(0, 120),
        lowStock: row.lowStock,
        inactive: row.inactive,
        zeroPrice: row.zeroPrice,
      }];
    }).slice(0, MAX_SAVED_STOCK_VIEWS);
  } catch {
    return [];
  }
}
