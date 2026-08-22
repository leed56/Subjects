import { describe, expect, it } from "vitest";
import {
  buildSaleInventoryAllocationLine,
  inventorySelectionReadiness,
} from "./inventory-sale-allocation";

describe("inventorySelectionReadiness", () => {
  it("keeps simple stock on the existing quantity workflow", () => {
    expect(inventorySelectionReadiness("simple", 3)).toMatchObject({
      required: false,
      complete: true,
    });
  });

  it("lets lot/FEFO products proceed without a cashier manually choosing a batch", () => {
    expect(inventorySelectionReadiness("lot", 6)).toMatchObject({
      required: true,
      complete: true,
      needsVariant: false,
      needsUnits: false,
    });
  });

  it("requires a size/colour variant for variant stock", () => {
    expect(inventorySelectionReadiness("variant", 2)).toMatchObject({
      complete: false,
      needsVariant: true,
    });
    expect(
      inventorySelectionReadiness("variant", 2, { variantId: "variant-42-black" }),
    ).toMatchObject({ complete: true });
  });

  it("requires exactly one unique identity per serialized physical unit", () => {
    expect(
      inventorySelectionReadiness("serial", 2, { unitIds: ["imei-a"] }),
    ).toMatchObject({ complete: false, missingUnitCount: 1 });
    expect(
      inventorySelectionReadiness("serial", 2, { unitIds: ["imei-a", "imei-a"] }),
    ).toMatchObject({ complete: false, missingUnitCount: 1 });
    expect(
      inventorySelectionReadiness("serial", 2, { unitIds: ["imei-a", "imei-b"] }),
    ).toMatchObject({ complete: true, missingUnitCount: 0 });
  });

  it("requires both variant and physical identities for phone-style variant_serial stock", () => {
    expect(
      inventorySelectionReadiness("variant_serial", 1, { unitIds: ["phone-a"] }),
    ).toMatchObject({ complete: false, needsVariant: true, needsUnits: true });
    expect(
      inventorySelectionReadiness("variant_serial", 1, {
        variantId: "256-black",
        unitIds: ["phone-a"],
      }),
    ).toMatchObject({ complete: true });
  });
});

describe("buildSaleInventoryAllocationLine", () => {
  it("returns null for simple stock", () => {
    expect(buildSaleInventoryAllocationLine("p1", 1, "simple")).toBeNull();
  });

  it("builds a clean advanced allocation payload", () => {
    expect(
      buildSaleInventoryAllocationLine("p1", 1, "variant_serial", {
        variantId: "v1",
        unitIds: ["u1"],
      }),
    ).toEqual({ productId: "p1", qty: 1, variantId: "v1", unitIds: ["u1"] });
  });

  it("throws instead of silently selling an incompletely selected serialized item", () => {
    expect(() => buildSaleInventoryAllocationLine("p1", 1, "serial", {})).toThrow(
      /Select exactly 1 physical unit/,
    );
  });
});
