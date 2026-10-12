import { describe, expect, it } from "vitest";
import {
  isMeasuredStockUnit,
  stockQuantityStep,
  validateStockQuantity,
} from "./stock-quantity";

describe("stock quantity validation", () => {
  it("requires finite positive quantities", () => {
    expect(validateStockQuantity("", "pcs")).toBe("required");
    expect(validateStockQuantity("0", "pcs")).toBe("positive");
    expect(validateStockQuantity("-1", "pcs")).toBe("positive");
    expect(validateStockQuantity("1e309", "pcs")).toBe("positive");
  });

  it("requires whole quantities for discrete units", () => {
    expect(validateStockQuantity("1.5", "pcs")).toBe("whole");
    expect(validateStockQuantity("2", "box")).toBeNull();
    expect(stockQuantityStep("bottle")).toBe("1");
  });

  it("allows three decimal places for measured units", () => {
    expect(isMeasuredStockUnit("KG")).toBe(true);
    expect(validateStockQuantity("1.125", "kg")).toBeNull();
    expect(validateStockQuantity("1.1255", "m")).toBe("precision");
    expect(stockQuantityStep("yd")).toBe("0.001");
  });

  it("enforces available stock after unit validation", () => {
    expect(validateStockQuantity("5", "pcs", 4)).toBe("exceeds");
    expect(validateStockQuantity("4", "pcs", 4)).toBeNull();
    expect(validateStockQuantity("1.25", "kg", 1.2)).toBe("exceeds");
  });
});
