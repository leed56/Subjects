export type DyeLotCandidate = { productId: string; dyeLot: string | null; shade: string | null };

export function textileDyeLotConflict(existing: DyeLotCandidate[], candidate: DyeLotCandidate): string | null {
  const sameProduct = existing.filter((row) => row.productId === candidate.productId);
  if (sameProduct.length === 0) return null;
  const normalized = (value: string | null) => value?.trim().toLowerCase() || "unrecorded";
  const expected = sameProduct[0];
  if (normalized(expected.dyeLot) !== normalized(candidate.dyeLot) || normalized(expected.shade) !== normalized(candidate.shade)) {
    return `This order is already allocated from dye lot ${expected.dyeLot || "unrecorded"}, shade ${expected.shade || "unrecorded"}.`;
  }
  return null;
}

export function isTextileRemnant(remainingLength: number, threshold: number): boolean {
  return remainingLength > 0.0005 && remainingLength <= threshold;
}

export function validateCutCompletion(planned: number, actual: number, waste: number, reason: string): string | null {
  if (!Number.isFinite(actual) || Math.abs(actual - planned) > 0.0005) return "Actual customer cut must match the invoiced quantity.";
  if (!Number.isFinite(waste) || waste < 0) return "Waste cannot be negative.";
  if (waste > 0 && !reason.trim()) return "A waste reason is required.";
  return null;
}
