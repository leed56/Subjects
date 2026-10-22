import type { TextileLengthUnit, TextileRollStatus } from "@/lib/types";

export type TextileRollBalanceInput = {
  lengthUnit: TextileLengthUnit;
  remainingLength: number;
  reservedLength: number;
  status: TextileRollStatus;
};

export function summarizeTextileRollBalances(rolls: TextileRollBalanceInput[]) {
  const live = rolls.filter((roll) => !["exhausted", "returned"].includes(roll.status));
  return {
    activeRolls: live.length,
    metreBalance: live
      .filter((roll) => roll.lengthUnit === "metre")
      .reduce((sum, roll) => sum + roll.remainingLength, 0),
    yardBalance: live
      .filter((roll) => roll.lengthUnit === "yard")
      .reduce((sum, roll) => sum + roll.remainingLength, 0),
    reservedMeasure: live.reduce((sum, roll) => sum + roll.reservedLength, 0),
    quarantinedRolls: rolls.filter((roll) => roll.status === "quarantined").length,
  };
}

export function validateTextileMeasurementAdjustment(input: {
  receivedLength: number;
  damagedLength?: number;
  reservedLength: number;
  newRemainingLength: number;
  reason: string;
}): string | null {
  if (!Number.isFinite(input.newRemainingLength) || input.newRemainingLength < 0) {
    return "Remaining length must be a finite non-negative number";
  }
  if (input.newRemainingLength + (input.damagedLength ?? 0) > input.receivedLength) {
    return "Usable remaining length plus damaged length cannot exceed received length";
  }
  if (input.newRemainingLength < input.reservedLength) {
    return "Remaining length cannot be below reserved length";
  }
  if (!input.reason.trim()) return "Adjustment reason is required";
  return null;
}
