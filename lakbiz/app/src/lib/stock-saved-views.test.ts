import { describe, expect, it } from "vitest";
import { MAX_SAVED_STOCK_VIEWS, parseSavedStockViews, stockSavedViewsKey } from "./stock-saved-views";

const validView = {
  id: "low-stock",
  name: "Low stock",
  search: "cotton",
  condition: "new",
  category: "Fabric",
  lowStock: true,
  inactive: false,
  zeroPrice: false,
};

describe("stock saved views", () => {
  it("scopes storage to the organization", () => {
    expect(stockSavedViewsKey("shop-42")).toBe("lakbiz:stock-saved-views:shop-42");
  });

  it("rejects malformed storage without breaking the stock workspace", () => {
    expect(parseSavedStockViews("not json")).toEqual([]);
    expect(parseSavedStockViews(JSON.stringify([{ ...validView, lowStock: "yes" }]))).toEqual([]);
  });

  it("sanitizes labels and caps the visible saved views", () => {
    const rows = Array.from({ length: MAX_SAVED_STOCK_VIEWS + 2 }, (_, index) => ({
      ...validView,
      id: `view-${index}`,
      name: `  View ${index} ${"x".repeat(60)}  `,
    }));
    const parsed = parseSavedStockViews(JSON.stringify(rows));
    expect(parsed).toHaveLength(MAX_SAVED_STOCK_VIEWS);
    expect(parsed[0]?.name.startsWith("View 0")).toBe(true);
    expect(parsed[0]?.name.length).toBeLessThanOrEqual(40);
  });
});
