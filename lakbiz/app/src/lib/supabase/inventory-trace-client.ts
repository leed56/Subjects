"use client";

import { createBrowserClient } from "@/lib/supabase/client";

export type SaleInventoryTraceRow = {
  allocationId: string;
  productId: string;
  qty: number;
  variantLabel: string | null;
  batchNo: string | null;
  expiryDate: string | null;
  serialNo: string | null;
  imei: string | null;
  secondaryImei: string | null;
  barcode: string | null;
  warrantyExpiry: string | null;
};

export function advancedInventorySchemaUnavailable(error: string | null): boolean {
  if (!error) return false;
  const value = error.toLowerCase();
  return (
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table")
  );
}

export async function fetchSaleInventoryTrace(
  organizationId: string,
  saleId: string,
): Promise<{ data: SaleInventoryTraceRow[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data: allocations, error: allocationError } = await supabase
    .from("inventory_allocations")
    .select("id, product_id, variant_id, lot_id, unit_id, qty")
    .eq("organization_id", organizationId)
    .eq("reference_type", "sale")
    .eq("reference_id", saleId)
    .order("created_at", { ascending: true });

  if (allocationError) return { data: [], error: allocationError.message };
  if (!allocations?.length) return { data: [], error: null };

  const variantIds = [...new Set(allocations.map((row) => row.variant_id).filter(Boolean))] as string[];
  const lotIds = [...new Set(allocations.map((row) => row.lot_id).filter(Boolean))] as string[];
  const unitIds = [...new Set(allocations.map((row) => row.unit_id).filter(Boolean))] as string[];

  const [variantResult, lotResult, unitResult] = await Promise.all([
    variantIds.length
      ? supabase.from("product_variants").select("id, label").in("id", variantIds)
      : Promise.resolve({ data: [], error: null }),
    lotIds.length
      ? supabase.from("inventory_lots").select("id, batch_no, expiry_date").in("id", lotIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? supabase
          .from("inventory_units")
          .select("id, serial_no, imei, secondary_imei, barcode, warranty_expiry")
          .in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const error = variantResult.error ?? lotResult.error ?? unitResult.error;
  if (error) return { data: [], error: error.message };

  const variants = new Map((variantResult.data ?? []).map((row) => [String(row.id), row]));
  const lots = new Map((lotResult.data ?? []).map((row) => [String(row.id), row]));
  const units = new Map((unitResult.data ?? []).map((row) => [String(row.id), row]));

  return {
    data: allocations.map((row) => {
      const variant = row.variant_id ? variants.get(String(row.variant_id)) : undefined;
      const lot = row.lot_id ? lots.get(String(row.lot_id)) : undefined;
      const unit = row.unit_id ? units.get(String(row.unit_id)) : undefined;
      return {
        allocationId: String(row.id),
        productId: String(row.product_id),
        qty: Number(row.qty ?? 0),
        variantLabel: variant?.label ? String(variant.label) : null,
        batchNo: lot?.batch_no ? String(lot.batch_no) : null,
        expiryDate: lot?.expiry_date ? String(lot.expiry_date) : null,
        serialNo: unit?.serial_no ? String(unit.serial_no) : null,
        imei: unit?.imei ? String(unit.imei) : null,
        secondaryImei: unit?.secondary_imei ? String(unit.secondary_imei) : null,
        barcode: unit?.barcode ? String(unit.barcode) : null,
        warrantyExpiry: unit?.warranty_expiry ? String(unit.warranty_expiry) : null,
      };
    }),
    error: null,
  };
}
