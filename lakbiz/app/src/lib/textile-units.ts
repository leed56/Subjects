import type { TextileLengthUnit } from "@/lib/types";

export const METRES_PER_YARD = 0.9144;
const LENGTH_PRECISION = 3;

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`);
  }
  return value;
}

export function roundTextileLength(value: number): number {
  finiteNonNegative(value, "Length");
  const factor = 10 ** LENGTH_PRECISION;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function convertTextileLength(
  value: number,
  from: TextileLengthUnit,
  to: TextileLengthUnit,
): number {
  finiteNonNegative(value, "Length");
  if (from === to) return roundTextileLength(value);
  return roundTextileLength(from === "yard" ? value * METRES_PER_YARD : value / METRES_PER_YARD);
}

export function availableRollLength(
  remainingLength: number,
  reservedLength: number,
): number {
  finiteNonNegative(remainingLength, "Remaining length");
  finiteNonNegative(reservedLength, "Reserved length");
  if (reservedLength > remainingLength) {
    throw new RangeError("Reserved length cannot exceed remaining length");
  }
  return roundTextileLength(remainingLength - reservedLength);
}

export function applyRollCut(remainingLength: number, cutLength: number): number {
  finiteNonNegative(remainingLength, "Remaining length");
  finiteNonNegative(cutLength, "Cut length");
  if (cutLength <= 0) throw new RangeError("Cut length must be greater than zero");
  if (cutLength > remainingLength) throw new RangeError("Cut length cannot exceed remaining length");
  return roundTextileLength(remainingLength - cutLength);
}
