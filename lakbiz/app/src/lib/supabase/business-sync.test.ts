import { describe, expect, it } from "vitest";
import { dedupeRowsById } from "./business-sync-v2";

describe("dedupeRowsById", () => {
  it("removes repeated primary keys before a cloud upsert", () => {
    const rows = dedupeRowsById([
      { id: "fresh", name: "Local product", stock_qty: 18 },
      { id: "fresh", name: "Older product", stock_qty: 12 },
      { id: "second", name: "Rice", stock_qty: 50 },
    ]);

    expect(rows).toEqual([
      { id: "fresh", name: "Local product", stock_qty: 18 },
      { id: "second", name: "Rice", stock_qty: 50 },
    ]);
  });

  it("does not pass missing identifiers to an id-based upsert", () => {
    expect(dedupeRowsById([{ id: "" }, {}, { id: "milk" }])).toEqual([
      { id: "milk" },
    ]);
  });
});
