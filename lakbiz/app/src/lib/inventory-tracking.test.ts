import { describe, expect, it } from "vitest";
import { sectors } from "@/lib/sectors";
import {
  defaultInventoryTrackingMode,
  inventoryTrackingPreset,
} from "@/lib/inventory-tracking";

describe("sector inventory tracking", () => {
  it("defines a valid strategy for every provisionable sector", () => {
    for (const sector of sectors) {
      const preset = inventoryTrackingPreset(sector.id);
      expect(preset.allowedModes).toContain(preset.defaultMode);
      expect(defaultInventoryTrackingMode(sector.id)).toBe(preset.defaultMode);
    }
  });

  it("uses batch/FEFO tracking for pharmacy", () => {
    const pharmacy = inventoryTrackingPreset("pharmacy");
    expect(pharmacy.defaultMode).toBe("lot");
    expect(pharmacy.fefo).toBe(true);
  });

  it("uses IMEI/serial-aware tracking for mobile shops", () => {
    const mobile = inventoryTrackingPreset("mobile_shop");
    expect(mobile.defaultMode).toBe("variant_serial");
    expect(mobile.allowedModes).toContain("serial");
    expect(mobile.variantAxes).toContain("storage");
    expect(mobile.variantAxes).toContain("colour");
  });

  it("requires size/colour variants for footwear", () => {
    const footwear = inventoryTrackingPreset("footwear");
    expect(footwear.defaultMode).toBe("variant");
    expect(footwear.allowedModes).toEqual(["variant"]);
    expect(footwear.variantAxes).toEqual(["size", "colour"]);
  });

  it("keeps car identity in the dedicated Vehicles workflow", () => {
    const cars = inventoryTrackingPreset("car_sales");
    expect(cars.defaultMode).toBe("simple");
    expect(cars.allowedModes).toEqual(["simple"]);
  });

  it("requires colour, shade and width with lot identity for textile", () => {
    const textile = inventoryTrackingPreset("textile");
    expect(textile.defaultMode).toBe("variant_lot");
    expect(textile.allowedModes).toEqual(["variant_lot"]);
    expect(textile.variantAxes).toEqual(["colour", "shade", "width"]);
    expect(textile.fefo).toBe(false);
  });
});
