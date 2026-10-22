"use client";

import { createBrowserClient } from "@/lib/supabase/client";

export type VariantStockAssignmentResult = {
  variantQty: number;
  assignedTotal: number;
  aggregateQty: number;
  unassignedQty: number;
};

/**
 * Assigns already-recorded aggregate Product stock to one pure variant.
 * It never changes Product.stockQty; the database RPC enforces that the total
 * assigned across variants cannot exceed the aggregate product balance.
 */
export async function adjustProductVariantStock(
  organizationId: string,
  productId: string,
  variantId: string,
  delta: number,
  note?: string,
): Promise<{ data: VariantStockAssignmentResult | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };
  if (!Number.isFinite(delta) || delta === 0) {
    return { data: null, error: "Variant stock adjustment must be non-zero" };
  }

  const { data, error } = await supabase.rpc("adjust_product_variant_stock", {
    p_organization_id: organizationId,
    p_product_id: productId,
    p_variant_id: variantId,
    p_delta: delta,
    p_note: note?.trim() || null,
  });
  if (error) return { data: null, error: error.message };

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    data: {
      variantQty: Number(row.variant_qty ?? 0),
      assignedTotal: Number(row.assigned_total ?? 0),
      aggregateQty: Number(row.aggregate_qty ?? 0),
      unassignedQty: Number(row.unassigned_qty ?? 0),
    },
    error: null,
  };
}
