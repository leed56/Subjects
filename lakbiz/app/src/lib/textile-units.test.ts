import { describe, expect, it } from "vitest";
import { applyRollCut, availableRollLength, convertTextileLength } from "./textile-units";

describe("textile measured quantities", () => {
  it("converts yards and metres without whole-number rounding", () => {
    expect(convertTextileLength(10, "yard", "metre")).toBe(9.144);
    expect(convertTextileLength(9.144, "metre", "yard")).toBe(10);
    expect(convertTextileLength(2.75, "metre", "metre")).toBe(2.75);
  });

  it("separates reserved stock from physically remaining stock", () => {
    expect(availableRollLength(42.5, 12.25)).toBe(30.25);
    expect(() => availableRollLength(10, 10.1)).toThrow(/cannot exceed/);
  });

  it("prevents negative roll balances", () => {
    expect(applyRollCut(50, 3.75)).toBe(46.25);
    expect(() => applyRollCut(3, 3.1)).toThrow(/cannot exceed/);
    expect(() => applyRollCut(3, 0)).toThrow(/greater than zero/);
  });
});
