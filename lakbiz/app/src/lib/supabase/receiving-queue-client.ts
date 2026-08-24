"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { InventoryTrackingMode } from "@/lib/inventory-tracking";

export type ReceivingQueueItem = {
  productId: string;
  mode: InventoryTrackingMode;
  identityCoverage: number;
  /** Physical quantity already identified as a customer-return hold. It counts
   * toward on-hand identity coverage but is deliberately NOT POS-available. */
  returnHoldQty: number;
};

function relationMissing(error: { message?: string } | null | undefined): boolean {
  const value = error?.message?.toLowerCase() ?? "";
  return (
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table")
  );
}

/**
 * Returns identity coverage for every advanced-tracked product in one shop.
 * Aggregate Product quantity intentionally is not queried here: the local-first
 * AppData store already owns that value. The caller joins these rows to its
 * current products and computes `stockQty - identityCoverage`.
 *
 * Physical-coverage sources mirror the registration guards:
 * - pure variant: explicit product_variants.stock_qty
 * - lot / variant_lot: qty_on_hand across lots
 * - serial / variant_serial: every physical unit still on hand, including
 *   reserved/service/returned/damaged but excluding sold/written_off
 * - customer-return holds: non-resellable returned quantity that is physically
 *   back on hand but intentionally excluded from POS availability
 *
 * A serialized return with a known unit_id is already counted by the unit row
 * after its status becomes `returned`, so its hold is not counted a second
 * time. Identity-less legacy serialized holds do count here.
 */
export async function fetchTrackedReceivingCoverage(
  organizationId: string,
): Promise<{ data: ReceivingQueueItem[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data: profileRows, error: profileError } = await supabase
    .from("product_inventory_profiles")
    .select("product_id, tracking_mode")
    .eq("organization_id", organizationId)
    .neq("tracking_mode", "simple");

  if (profileError) return { data: [], error: profileError.message };
  if (!profileRows?.length) return { data: [], error: null };

  const modes = new Map(
    profileRows.map((row) => [
      String(row.product_id),
      String(row.tracking_mode) as InventoryTrackingMode,
    ]),
  );
  const productIds = [...modes.keys()];

  const needsVariants = productIds.filter((id) => modes.get(id) === "variant");
  const needsLots = productIds.filter((id) => {
    const mode = modes.get(id);
    return mode === "lot" || mode === "variant_lot";
  });
  const needsUnits = productIds.filter((id) => {
    const mode = modes.get(id);
    return mode === "serial" || mode === "variant_serial";
  });

  const [variantResult, lotResult, unitResult, holdResult] = await Promise.all([
    needsVariants.length
      ? supabase
          .from("product_variants")
          .select("product_id, stock_qty")
          .eq("organization_id", organizationId)
          .in("product_id", needsVariants)
      : Promise.resolve({ data: [], error: null }),
    needsLots.length
      ? supabase
          .from("inventory_lots")
          .select("product_id, qty_on_hand")
          .eq("organization_id", organizationId)
          .in("product_id", needsLots)
      : Promise.resolve({ data: [], error: null }),
    needsUnits.length
      ? supabase
          .from("inventory_units")
          .select("product_id, status")
          .eq("organization_id", organizationId)
          .in("product_id", needsUnits)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("inventory_return_holds")
      .select("product_id, unit_id, qty")
      .eq("organization_id", organizationId)
      .is("released_at", null)
      .in("product_id", productIds),
  ]);

  const coreError = variantResult.error ?? lotResult.error ?? unitResult.error;
  if (coreError) return { data: [], error: coreError.message };
  if (holdResult.error && !relationMissing(holdResult.error)) {
    return { data: [], error: holdResult.error.message };
  }

  const coverage = new Map<string, number>();
  const holdQty = new Map<string, number>();
  for (const id of productIds) {
    coverage.set(id, 0);
    holdQty.set(id, 0);
  }

  for (const row of variantResult.data ?? []) {
    const id = String(row.product_id);
    coverage.set(id, (coverage.get(id) ?? 0) + Math.max(0, Number(row.stock_qty ?? 0)));
  }

  for (const row of lotResult.data ?? []) {
    const id = String(row.product_id);
    coverage.set(id, (coverage.get(id) ?? 0) + Math.max(0, Number(row.qty_on_hand ?? 0)));
  }

  for (const row of unitResult.data ?? []) {
    const id = String(row.product_id);
    const status = String(row.status ?? "available");
    if (status === "sold" || status === "written_off") continue;
    coverage.set(id, (coverage.get(id) ?? 0) + 1);
  }

  if (!holdResult.error) {
    for (const row of holdResult.data ?? []) {
      const id = String(row.product_id);
      const mode = modes.get(id);
      if (!mode) continue;

      // Known serialized returns are already represented by their unit row in
      // status=returned. Only legacy serialized holds with no unit identity add
      // separate coverage here.
      if ((mode === "serial" || mode === "variant_serial") && row.unit_id) {
        continue;
      }

      const qty = Math.max(0, Number(row.qty ?? 0));
      coverage.set(id, (coverage.get(id) ?? 0) + qty);
      holdQty.set(id, (holdQty.get(id) ?? 0) + qty);
    }
  }

  return {
    data: productIds.map((productId) => ({
      productId,
      mode: modes.get(productId)!,
      identityCoverage: coverage.get(productId) ?? 0,
      returnHoldQty: holdQty.get(productId) ?? 0,
    })),
    error: null,
  };
}
