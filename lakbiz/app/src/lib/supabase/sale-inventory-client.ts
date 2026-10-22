"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import {
  fetchInventoryLots,
  fetchInventoryProfile,
  fetchInventoryUnits,
  fetchProductVariants,
  type InventoryLot,
  type InventoryProfile,
  type InventoryUnit,
  type ProductVariant,
} from "@/lib/supabase/advanced-inventory-client";
import type { SaleInventoryAllocationLine } from "@/lib/inventory-sale-allocation";

export type SaleInventoryOptions = {
  profile: InventoryProfile | null;
  variants: ProductVariant[];
  lots: InventoryLot[];
  units: InventoryUnit[];
};

/**
 * Fetch only the identity data a cashier needs. Internal lot/unit costs are
 * deliberately never requested from the POS selector, even for an owner.
 */
export async function fetchSaleInventoryOptions(
  productId: string,
): Promise<{ data: SaleInventoryOptions; error: string | null }> {
  const profileResult = await fetchInventoryProfile(productId);
  if (profileResult.error) {
    return {
      data: { profile: null, variants: [], lots: [], units: [] },
      error: profileResult.error,
    };
  }

  const profile = profileResult.data;
  if (!profile || profile.trackingMode === "simple") {
    return {
      data: { profile, variants: [], lots: [], units: [] },
      error: null,
    };
  }

  const needsVariants = ["variant", "variant_lot", "variant_serial"].includes(
    profile.trackingMode,
  );
  const needsLots = ["lot", "variant_lot"].includes(profile.trackingMode);
  const needsUnits = ["serial", "variant_serial"].includes(profile.trackingMode);

  const [variantsResult, lotsResult, unitsResult] = await Promise.all([
    needsVariants
      ? fetchProductVariants(productId)
      : Promise.resolve({ data: [] as ProductVariant[], error: null as string | null }),
    needsLots
      ? fetchInventoryLots(productId, false)
      : Promise.resolve({ data: [] as InventoryLot[], error: null as string | null }),
    needsUnits
      ? fetchInventoryUnits(productId, false)
      : Promise.resolve({ data: [] as InventoryUnit[], error: null as string | null }),
  ]);

  const error = variantsResult.error ?? lotsResult.error ?? unitsResult.error;
  return {
    data: {
      profile,
      variants: variantsResult.data.filter((variant) => variant.active),
      lots: lotsResult.data.filter(
        (lot) =>
          lot.status === "available" &&
          lot.qtyOnHand > 0 &&
          (!lot.expiryDate || lot.expiryDate >= new Date().toISOString().slice(0, 10)),
      ),
      units: unitsResult.data.filter((unit) => unit.status === "available"),
    },
    error,
  };
}

export async function allocateSaleInventory(
  organizationId: string,
  saleId: string,
  customerId: string | undefined,
  lines: SaleInventoryAllocationLine[],
): Promise<{ ok: boolean; replayed?: boolean; allocations?: number; error?: string }> {
  if (lines.length === 0) return { ok: true, allocations: 0 };
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };

  const { data, error } = await supabase.rpc("allocate_sale_inventory", {
    p_organization_id: organizationId,
    p_sale_id: saleId,
    p_customer_id: customerId ?? null,
    p_lines: lines.map((line) => ({
      product_id: line.productId,
      qty: line.qty,
      variant_id: line.variantId ?? null,
      unit_ids: line.unitIds ?? [],
    })),
  });

  if (error) return { ok: false, error: error.message };
  const result = (data ?? {}) as {
    ok?: boolean;
    replayed?: boolean;
    allocations?: number;
  };
  return {
    ok: result.ok !== false,
    replayed: result.replayed,
    allocations: Number(result.allocations ?? 0),
  };
}
