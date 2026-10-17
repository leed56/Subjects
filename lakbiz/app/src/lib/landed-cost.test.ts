import { describe, expect, it } from "vitest";
import { allocateLandedCost, purchaseLineMinor, type LandedCostInput } from "./landed-cost";
const input: LandedCostInput = { basis: "value", exchangeRate: 1, charges: [0.02], recoverableVat: 0.18, lines: ["c", "b", "a"].map(id => ({ id, quantity: 1, unitCost: 0.01 })) };
describe("exact shipment landed cost", () => {
  it("assigns cent residuals deterministically without negative allocations", () => {
    const result = allocateLandedCost(input);
    expect(result.lines.map(line => [line.id, line.allocatedMinor])).toEqual([["c", 0], ["b", 1], ["a", 1]]);
    expect(result.inventoryMinor).toBe(5); expect(result.vatMinor).toBe(18); expect(result.payableMinor).toBe(23);
  });
  it("is independent of line ordering and preserves totals across a large shipment", () => {
    const lines = Array.from({ length: 200 }, (_, index) => ({ id: String(index), quantity: (index + 1) / 1000, unitCost: 123.45 }));
    const first = allocateLandedCost({ ...input, exchangeRate: 307.123456, charges: [12500.03, 850.02], lines });
    const second = allocateLandedCost({ ...input, exchangeRate: 307.123456, charges: [12500.03, 850.02], lines: [...lines].reverse() });
    expect(first.lines.reduce((sum, line) => sum + line.allocatedMinor, 0)).toBe(1335005);
    expect(new Map(first.lines.map(line => [line.id, line.allocatedMinor]))).toEqual(new Map(second.lines.map(line => [line.id, line.allocatedMinor])));
  });
  it("allows free goods only with an allocation basis that has weight", () => {
    const lines = [{ id: "a", quantity: 2, unitCost: 0 }];
    expect(() => allocateLandedCost({ ...input, lines })).toThrow("nonzero goods value");
    expect(allocateLandedCost({ ...input, lines, basis: "quantity" }).lines[0].landedUnit).toBe(0.01);
  });
  it("rounds fractional quantity and FX goods once to minor units", () => {
    const result = allocateLandedCost({ ...input, charges: [], exchangeRate: 2.5, lines: [{ id: "a", quantity: 0.125, unitCost: 1 }] });
    expect(result.goodsMinor).toBe(31); expect(result.inventoryMinor).toBe(31);
    expect(allocateLandedCost({ ...input, charges: [], lines: [{ id: "half-cent", quantity: 0.5, unitCost: 0.29 }] }).goodsMinor).toBe(15);
    expect(purchaseLineMinor(0.5, 0.29)).toBe(15);
  });
  it("rejects malformed, ambiguous, nonfinite and excessive precision inputs", () => {
    for (const exchangeRate of [0, -1, Infinity, NaN, 1.0000001]) expect(() => allocateLandedCost({ ...input, exchangeRate })).toThrow();
    expect(() => allocateLandedCost({ ...input, charges: [0.001] })).toThrow();
    expect(() => allocateLandedCost({ ...input, lines: [input.lines[0], input.lines[0]] })).toThrow();
    expect(() => allocateLandedCost({ ...input, lines: [{ id: "a", quantity: 0.0001, unitCost: 1 }] })).toThrow();
  });
});
