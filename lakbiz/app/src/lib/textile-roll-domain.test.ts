import { describe, expect, it } from "vitest";
import { summarizeTextileRollBalances, validateTextileMeasurementAdjustment } from "./textile-roll-domain";

describe("textile roll domain", () => {
  it("keeps metre and yard balances separate", () => {
    const summary = summarizeTextileRollBalances([
      { lengthUnit: "metre", remainingLength: 40.25, reservedLength: 5, status: "opened" },
      { lengthUnit: "metre", remainingLength: 10, reservedLength: 0, status: "unopened" },
      { lengthUnit: "yard", remainingLength: 30.5, reservedLength: 2, status: "reserved" },
      { lengthUnit: "yard", remainingLength: 0, reservedLength: 0, status: "exhausted" },
    ]);
    expect(summary.activeRolls).toBe(3);
    expect(summary.metreBalance).toBe(50.25);
    expect(summary.yardBalance).toBe(30.5);
    expect(summary.reservedMeasure).toBe(7);
  });

  it("blocks measurement adjustments that violate physical or reserved stock", () => {
    expect(validateTextileMeasurementAdjustment({ receivedLength: 50, reservedLength: 10, newRemainingLength: 9.5, reason: "Count" })).toMatch(/reserved/);
    expect(validateTextileMeasurementAdjustment({ receivedLength: 50, reservedLength: 0, newRemainingLength: 51, reason: "Count" })).toMatch(/received/);
    expect(validateTextileMeasurementAdjustment({ receivedLength: 50, damagedLength: 2, reservedLength: 0, newRemainingLength: 49, reason: "Count" })).toMatch(/damaged/);
    expect(validateTextileMeasurementAdjustment({ receivedLength: 50, reservedLength: 0, newRemainingLength: 49, reason: "" })).toMatch(/reason/);
    expect(validateTextileMeasurementAdjustment({ receivedLength: 50, reservedLength: 0, newRemainingLength: 49.125, reason: "Physical recount" })).toBeNull();
  });
});
