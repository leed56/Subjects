import { describe, expect, it } from "vitest";
import { allocateTextileLandedCosts, commissionAmount, receivableAgeBucket } from "./textile-trade-domain";

describe("textile trade finance", () => {
  it("allocates freight by weight, duty by value and handling by quantity", () => {
    expect(allocateTextileLandedCosts([{ supplierValue: 1000, weightKg: 10, quantity: 20 }, { supplierValue: 3000, weightKg: 30, quantity: 20 }], { freight: 400, duty: 400, insurance: 0, port: 200, handling: 0 })).toEqual([300, 700]);
  });
  it("buckets overdue receivables", () => {
    expect(receivableAgeBucket("2026-08-01", "2026-08-24")).toBe("1-30");
    expect(receivableAgeBucket("2026-04-01", "2026-08-24")).toBe("90+");
  });
  it("calculates commission without floating noise", () => expect(commissionAmount(125000, 2.5)).toBe(3125));
});
