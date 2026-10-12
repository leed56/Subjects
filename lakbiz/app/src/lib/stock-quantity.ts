export type StockQuantityError =
  | "required"
  | "positive"
  | "whole"
  | "precision"
  | "exceeds";

const MEASURED_UNITS = new Set([
  "g",
  "kg",
  "ml",
  "l",
  "m",
  "metre",
  "meter",
  "yd",
  "yard",
]);

export function isMeasuredStockUnit(unit: unknown): boolean {
  return MEASURED_UNITS.has(String(unit ?? "").trim().toLowerCase());
}

export function stockQuantityStep(unit: unknown): "0.001" | "1" {
  return isMeasuredStockUnit(unit) ? "0.001" : "1";
}

export function validateStockQuantity(
  raw: string,
  unit: unknown,
  maximum?: number,
): StockQuantityError | null {
  const valueText = raw.trim();
  if (!valueText) return "required";

  const value = Number(valueText);
  if (!Number.isFinite(value) || value <= 0) return "positive";

  if (isMeasuredStockUnit(unit)) {
    if (!/^\d+(?:\.\d{1,3})?$/.test(valueText)) return "precision";
  } else if (!Number.isInteger(value)) {
    return "whole";
  }

  if (maximum != null && value > maximum) return "exceeds";
  return null;
}
