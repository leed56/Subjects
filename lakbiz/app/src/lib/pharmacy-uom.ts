import type { Product } from "./types";

export type PharmacyPackaging = {
  totalUnitsPerBox: number;
  stripsPerBox?: number;
  unitsPerStrip?: number;
  hasSubUnits: boolean;
  unitLabel: string;
};

export type PharmacyUomBreakdown = {
  boxes: number;
  strips: number;
  loose: number;
  formatted: string;
};

export type RxClinicalIntake = {
  doctorName: string;
  doctorSlmc: string;
  patientName: string;
  patientAge?: string;
  patientGender?: "male" | "female" | "other";
  dosageInstructions?: string;
  prescriptionRef?: string;
};

/**
 * Parse pack specifications from pharmacy customFields.
 * Common Sri Lankan formats:
 * - "100 tablets (10x10)" or "10x10" or "10 strips of 10"
 * - "30 capsules" or "3 strips of 10"
 * - "100" (default 10 strips of 10)
 * - "150ml syrup" or "1 bottle"
 */
export function parsePharmacyPackaging(
  packSizeRaw?: string | number | null,
  fallbackUnit = "tab",
): PharmacyPackaging {
  const str = String(packSizeRaw ?? "").trim().toLowerCase();
  if (!str) {
    return { totalUnitsPerBox: 1, hasSubUnits: false, unitLabel: fallbackUnit };
  }

  // Format: "10x10" or "10 x 10"
  const multiMatch = str.match(/^(\d+)\s*[x*]\s*(\d+)/);
  if (multiMatch) {
    const strips = parseInt(multiMatch[1], 10);
    const perStrip = parseInt(multiMatch[2], 10);
    if (strips > 0 && perStrip > 0) {
      return {
        totalUnitsPerBox: strips * perStrip,
        stripsPerBox: strips,
        unitsPerStrip: perStrip,
        hasSubUnits: true,
        unitLabel: fallbackUnit || "tab",
      };
    }
  }

  // Format: "10 strips of 10" or "10 strips"
  const stripsOfMatch = str.match(/(\d+)\s*strips?\s*(?:of\s*(\d+))?/);
  if (stripsOfMatch) {
    const strips = parseInt(stripsOfMatch[1], 10);
    const perStrip = stripsOfMatch[2] ? parseInt(stripsOfMatch[2], 10) : 10;
    if (strips > 0 && perStrip > 0) {
      return {
        totalUnitsPerBox: strips * perStrip,
        stripsPerBox: strips,
        unitsPerStrip: perStrip,
        hasSubUnits: true,
        unitLabel: fallbackUnit || "tab",
      };
    }
  }

  // Pure integer format: "100" or "100 tabs" or "30 caps"
  const numberMatch = str.match(/^(\d+)/);
  if (numberMatch) {
    const total = parseInt(numberMatch[1], 10);
    if (total > 1) {
      // If total is divisible by 10, infer 10 units per strip
      const unitsPerStrip = total % 10 === 0 ? 10 : total;
      const stripsPerBox = Math.floor(total / unitsPerStrip);
      return {
        totalUnitsPerBox: total,
        stripsPerBox,
        unitsPerStrip,
        hasSubUnits: stripsPerBox > 1,
        unitLabel: fallbackUnit || "tab",
      };
    }
  }

  return { totalUnitsPerBox: 1, hasSubUnits: false, unitLabel: fallbackUnit };
}

/**
 * Calculate proportional unit prices for box, strip, and single tablet.
 */
export function calculateTierPrices(
  boxPrice: number,
  packaging: PharmacyPackaging,
) {
  const safeBoxPrice = Math.max(0, boxPrice);
  if (!packaging.hasSubUnits || packaging.totalUnitsPerBox <= 1) {
    return {
      boxPrice: safeBoxPrice,
      stripPrice: safeBoxPrice,
      loosePrice: safeBoxPrice,
    };
  }

  const loosePrice = Math.round((safeBoxPrice / packaging.totalUnitsPerBox) * 100) / 100;
  const stripPrice = packaging.unitsPerStrip
    ? Math.round(loosePrice * packaging.unitsPerStrip * 100) / 100
    : safeBoxPrice;

  return {
    boxPrice: safeBoxPrice,
    stripPrice,
    loosePrice,
  };
}

/**
 * Format total quantity into human-readable packaging terms:
 * e.g., 24 tablets (10/strip, 100/box) -> "2 strips + 4 tabs"
 */
export function formatUomBreakdown(
  totalQty: number,
  packaging: PharmacyPackaging,
): PharmacyUomBreakdown {
  if (!packaging.hasSubUnits || packaging.totalUnitsPerBox <= 1) {
    return {
      boxes: totalQty,
      strips: 0,
      loose: 0,
      formatted: `${totalQty} ${packaging.unitLabel || "units"}`,
    };
  }

  const boxSize = packaging.totalUnitsPerBox;
  const stripSize = packaging.unitsPerStrip ?? 10;

  const boxes = Math.floor(totalQty / boxSize);
  const remainingAfterBoxes = totalQty % boxSize;

  const strips = Math.floor(remainingAfterBoxes / stripSize);
  const loose = remainingAfterBoxes % stripSize;

  const parts: string[] = [];
  if (boxes > 0) parts.push(`${boxes} box${boxes > 1 ? "es" : ""}`);
  if (strips > 0) parts.push(`${strips} strip${strips > 1 ? "s" : ""}`);
  if (loose > 0) parts.push(`${loose} ${packaging.unitLabel || "tab"}${loose > 1 ? "s" : ""}`);

  return {
    boxes,
    strips,
    loose,
    formatted: parts.join(" + ") || `0 ${packaging.unitLabel || "tabs"}`,
  };
}

/**
 * Filter catalog for products sharing the same active molecule (genericName).
 * Sorts by available stock descending, then lowest price.
 */
export function findMoleculeEquivalents(
  products: Product[],
  targetGenericName: string,
  excludeProductId?: string,
): Product[] {
  const normalizedTarget = targetGenericName.trim().toLowerCase();
  if (!normalizedTarget) return [];

  return products
    .filter((product) => {
      if (!product.active) return false;
      if (excludeProductId && product.id === excludeProductId) return false;
      const generic = String(product.customFields.genericName ?? "").trim().toLowerCase();
      return generic === normalizedTarget;
    })
    .sort((a, b) => b.stockQty - a.stockQty || a.sellPrice - b.sellPrice);
}

/**
 * Validate prescription intake fields.
 * Returns true if valid or array of missing field error messages.
 */
export function validateRxClinicalIntake(intake: Partial<RxClinicalIntake>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!intake.doctorName?.trim()) {
    errors.push("Doctor Name is required for prescription items.");
  }
  if (!intake.doctorSlmc?.trim()) {
    errors.push("Doctor SLMC Registration Number is required.");
  }
  if (!intake.patientName?.trim()) {
    errors.push("Patient Name is required for prescription records.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
