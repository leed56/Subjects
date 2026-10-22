import type { InventoryTrackingMode } from "@/lib/inventory-tracking";

/**
 * UI-facing selection for one normal LakBiz sale line.
 *
 * Aggregate quantity remains on the existing SaleLine. This object only says
 * WHICH variant / serialized units should fulfil it. Lot modes intentionally
 * have no manual lot selector: the database allocator performs FEFO so a busy
 * pharmacy cashier cannot accidentally choose a later-expiry batch first.
 */
export type SaleInventorySelection = {
  variantId?: string | null;
  unitIds?: string[];
};

export type SaleInventoryAllocationLine = {
  productId: string;
  qty: number;
  variantId?: string | null;
  unitIds?: string[];
};

export type SaleInventoryReadiness = {
  required: boolean;
  complete: boolean;
  needsVariant: boolean;
  needsUnits: boolean;
  missingUnitCount: number;
  reason: string | null;
};

export function inventorySelectionReadiness(
  mode: InventoryTrackingMode | null | undefined,
  qty: number,
  selection?: SaleInventorySelection,
): SaleInventoryReadiness {
  const normalizedMode = mode ?? "simple";
  const wholeQty = Number.isInteger(qty) && qty > 0;
  const unitIds = [...new Set(selection?.unitIds ?? [])].filter(Boolean);
  const needsVariant = ["variant", "variant_lot", "variant_serial"].includes(normalizedMode);
  const needsUnits = ["serial", "variant_serial"].includes(normalizedMode);
  const required = normalizedMode !== "simple";

  if (!required) {
    return {
      required: false,
      complete: true,
      needsVariant: false,
      needsUnits: false,
      missingUnitCount: 0,
      reason: null,
    };
  }

  if (!(qty > 0)) {
    return {
      required,
      complete: false,
      needsVariant,
      needsUnits,
      missingUnitCount: 0,
      reason: "Quantity must be greater than zero.",
    };
  }

  if (needsVariant && !selection?.variantId) {
    return {
      required,
      complete: false,
      needsVariant,
      needsUnits,
      missingUnitCount: needsUnits && wholeQty ? qty : 0,
      reason: "Select a variant before checkout.",
    };
  }

  if (needsUnits) {
    if (!wholeQty) {
      return {
        required,
        complete: false,
        needsVariant,
        needsUnits,
        missingUnitCount: 0,
        reason: "Serialized products must use a whole-number quantity.",
      };
    }
    const missingUnitCount = Math.max(0, qty - unitIds.length);
    if (unitIds.length !== qty) {
      return {
        required,
        complete: false,
        needsVariant,
        needsUnits,
        missingUnitCount,
        reason: `Select exactly ${qty} physical unit${qty === 1 ? "" : "s"} before checkout.`,
      };
    }
  }

  return {
    required,
    complete: true,
    needsVariant,
    needsUnits,
    missingUnitCount: 0,
    reason: null,
  };
}

export function buildSaleInventoryAllocationLine(
  productId: string,
  qty: number,
  mode: InventoryTrackingMode | null | undefined,
  selection?: SaleInventorySelection,
): SaleInventoryAllocationLine | null {
  const readiness = inventorySelectionReadiness(mode, qty, selection);
  if (!readiness.required) return null;
  if (!readiness.complete) {
    throw new Error(readiness.reason ?? "Advanced inventory selection is incomplete.");
  }
  return {
    productId,
    qty,
    ...(selection?.variantId ? { variantId: selection.variantId } : {}),
    ...(selection?.unitIds?.length ? { unitIds: [...new Set(selection.unitIds)] } : {}),
  };
}
