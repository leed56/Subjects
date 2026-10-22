import { describe, expect, it } from "vitest";
import { canTransitionDispatch, dispatchProgress, validatePartialFulfilment } from "./textile-warehouse-domain";

describe("textile warehouse controls", () => {
  it("enforces forward-only dispatch custody", () => {
    expect(canTransitionDispatch("draft", "picking")).toBe(true);
    expect(canTransitionDispatch("packed", "picking")).toBe(false);
    expect(canTransitionDispatch("delivered", "cancelled")).toBe(false);
  });
  it("prevents assigning more than the sold allocation", () => {
    expect(validatePartialFulfilment(20, 12, 8)).toBeNull();
    expect(validatePartialFulfilment(20, 12, 8.001)).toMatch(/exceeds/);
  });
  it("summarizes scan-confirmed quantities", () => {
    expect(dispatchProgress([{ quantity: 10, pickedQuantity: 10, packedQuantity: 4 }, { quantity: 5, pickedQuantity: 2, packedQuantity: 0 }])).toEqual({ ordered: 15, picked: 12, packed: 4 });
  });
});
