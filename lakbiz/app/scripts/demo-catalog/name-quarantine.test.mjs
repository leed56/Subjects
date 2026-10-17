import { describe, expect, it } from "vitest";
import { partitionCatalogNames } from "./name-quarantine.mjs";
import { pharmacyRetailCandidatesFromSpar } from "./healthguard-fallback.mjs";
describe("unresolved source identity quarantine", () => {
  it("keeps complete factual rows intact and records unresolved source identities separately", () => {
    const good = { source: "spar2u", sourceProductId: "full", sourceUrl: "https://spar2u.lk/products/full", productName: "7 UP 1.5L", retailPrice: 420 };
    const partial = { source: "spar2u", sourceProductId: "partial", sourceUrl: "https://spar2u.lk/products/partial", productName: "Chicken...", retailPrice: 500 };
    const result = partitionCatalogNames([good, partial], "2026-10-11T00:00:00Z");
    expect(result.complete).toEqual([good]);
    expect(result.complete[0]).toBe(good);
    expect(result.quarantined).toEqual([{ source: "spar2u", sourceProductId: "partial", sourceUrl: partial.sourceUrl, productName: "Chicken...", reason: "unresolved_truncated_name", retrievedAt: "2026-10-11T00:00:00Z" }]);
    expect(partial.productName).toBe("Chicken...");
  });
  it("rejects blank and both ellipsis styles without deleting short valid brands", () => {
    const rows = ["", null, "Thing...", "Thing…", "7 UP", "Full identity"].map((productName, i) => ({ sourceProductId: String(i), productName }));
    const result = partitionCatalogNames(rows, "now");
    expect(result.complete.map(row => row.productName)).toEqual(["7 UP", "Full identity"]);
    expect(result.quarantined.map(row => row.reason)).toEqual(["blank_name", "blank_name", "unresolved_truncated_name", "unresolved_truncated_name"]);
    expect(result.complete.length + result.quarantined.length).toBe(rows.length);
  });
  it("prevents the same unresolved row from entering both grocery and pharmacy payloads", () => {
    const partial = { source: "spar2u", sourceProductId: "partial", productName: "Shampoo..." };
    const good = { source: "spar2u", sourceProductId: "good", productName: "Toothpaste 70g" };
    const { complete, quarantined } = partitionCatalogNames([partial, good], "now");
    expect(pharmacyRetailCandidatesFromSpar(complete).map(row => row.sourceProductId)).toEqual(["good"]);
    expect(complete.map(row => row.sourceProductId)).toEqual(["good"]);
    expect(quarantined).toHaveLength(1);
  });
});
