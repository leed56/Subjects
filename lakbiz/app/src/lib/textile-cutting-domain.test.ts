import { describe, expect, it } from "vitest";
import { isTextileRemnant, textileDyeLotConflict, validateCutCompletion } from "./textile-cutting-domain";

describe("textile cutting controls", () => {
  it("blocks silent dye-lot or shade mixing", () => {
    const existing = [{ productId: "p1", dyeLot: "DL-7", shade: "navy-a" }];
    expect(textileDyeLotConflict(existing, { productId: "p1", dyeLot: "DL-7", shade: "navy-a" })).toBeNull();
    expect(textileDyeLotConflict(existing, { productId: "p1", dyeLot: "DL-8", shade: "navy-a" })).toMatch(/DL-7/);
  });

  it("classifies only usable short balances as remnants", () => {
    expect(isTextileRemnant(3.5, 5)).toBe(true);
    expect(isTextileRemnant(8, 5)).toBe(false);
    expect(isTextileRemnant(0, 5)).toBe(false);
  });

  it("requires exact customer cut and explained waste", () => {
    expect(validateCutCompletion(10, 9.5, 0, "")).toMatch(/match/);
    expect(validateCutCompletion(10, 10, 0.2, "")).toMatch(/reason/);
    expect(validateCutCompletion(10, 10, 0.2, "Selvedge defect")).toBeNull();
  });
});
