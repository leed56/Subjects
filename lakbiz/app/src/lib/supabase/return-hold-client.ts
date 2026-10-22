"use client";

import { createBrowserClient } from "@/lib/supabase/client";

export type ReturnHoldDisposition = "inspection" | "quarantine" | "damaged";
export type ReturnHoldResolution = "resale" | "write_off";
export type ReturnHoldAction = "approve_resale" | "write_off";

export type ReturnHoldRecord = {
  id: string;
  returnId: string;
  returnNo: string;
  saleId: string;
  productId: string;
  variantId: string | null;
  lotId: string | null;
  unitId: string | null;
  qty: number;
  disposition: ReturnHoldDisposition;
  note: string | null;
  createdAt: string;
  identityLabel: string | null;
};

export function returnHoldSchemaUnavailable(error: string | null | undefined): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("inventory_return_holds") ||
    value.includes("set_inventory_return_hold_disposition") ||
    value.includes("resolve_inventory_return_hold") ||
    value.includes("resolution") ||
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table") ||
    value.includes("could not find the function")
  );
}

/** Active customer-return inspection holds with exact identity labels. */
export async function fetchActiveReturnHolds(
  organizationId: string,
): Promise<{ data: ReturnHoldRecord[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const holdResult = await supabase
    .from("inventory_return_holds")
    .select(
      "id, return_id, product_id, variant_id, lot_id, unit_id, qty, disposition, note, resolution, released_at, created_at",
    )
    .eq("organization_id", organizationId)
    .is("released_at", null)
    .order("created_at", { ascending: false });

  if (holdResult.error) return { data: [], error: holdResult.error.message };
  const holds = holdResult.data ?? [];
  if (holds.length === 0) return { data: [], error: null };

  const returnIds = Array.from(new Set(holds.map((row) => String(row.return_id))));
  const variantIds = Array.from(
    new Set(holds.map((row) => row.variant_id && String(row.variant_id)).filter((value): value is string => Boolean(value))),
  );
  const lotIds = Array.from(
    new Set(holds.map((row) => row.lot_id && String(row.lot_id)).filter((value): value is string => Boolean(value))),
  );
  const unitIds = Array.from(
    new Set(holds.map((row) => row.unit_id && String(row.unit_id)).filter((value): value is string => Boolean(value))),
  );

  const returnResult = await supabase
    .from("sale_returns")
    .select("id, return_no, sale_id")
    .eq("organization_id", organizationId)
    .in("id", returnIds);
  if (returnResult.error) return { data: [], error: returnResult.error.message };

  let variants: { id: unknown; label: unknown }[] = [];
  if (variantIds.length > 0) {
    const result = await supabase
      .from("product_variants")
      .select("id, label")
      .eq("organization_id", organizationId)
      .in("id", variantIds);
    if (result.error) return { data: [], error: result.error.message };
    variants = result.data ?? [];
  }

  let lots: { id: unknown; batch_no: unknown; expiry_date: unknown }[] = [];
  if (lotIds.length > 0) {
    const result = await supabase
      .from("inventory_lots")
      .select("id, batch_no, expiry_date")
      .eq("organization_id", organizationId)
      .in("id", lotIds);
    if (result.error) return { data: [], error: result.error.message };
    lots = result.data ?? [];
  }

  let units: { id: unknown; imei: unknown; secondary_imei: unknown; serial_no: unknown; barcode: unknown }[] = [];
  if (unitIds.length > 0) {
    const result = await supabase
      .from("inventory_units")
      .select("id, imei, secondary_imei, serial_no, barcode")
      .eq("organization_id", organizationId)
      .in("id", unitIds);
    if (result.error) return { data: [], error: result.error.message };
    units = result.data ?? [];
  }

  const returnById = new Map(
    (returnResult.data ?? []).map((row) => [
      String(row.id),
      { returnNo: String(row.return_no), saleId: String(row.sale_id) },
    ] as const),
  );
  const variantById = new Map(variants.map((row) => [String(row.id), String(row.label)] as const));
  const lotById = new Map(
    lots.map((row) => [
      String(row.id),
      `Batch ${String(row.batch_no)}${row.expiry_date ? ` · Exp ${String(row.expiry_date)}` : ""}`,
    ] as const),
  );
  const unitById = new Map(
    units.map((row) => {
      const identity = row.imei || row.serial_no || row.barcode || row.secondary_imei;
      const prefix = row.imei ? "IMEI" : row.serial_no ? "Serial" : row.barcode ? "Barcode" : "IMEI 2";
      return [String(row.id), identity ? `${prefix} ${String(identity)}` : "Serialized unit"] as const;
    }),
  );

  return {
    data: holds.map((row) => {
      const returnMeta = returnById.get(String(row.return_id));
      const variantLabel = row.variant_id ? variantById.get(String(row.variant_id)) : null;
      const lotLabel = row.lot_id ? lotById.get(String(row.lot_id)) : null;
      const unitLabel = row.unit_id ? unitById.get(String(row.unit_id)) : null;
      const identityLabel = [variantLabel, lotLabel, unitLabel].filter(Boolean).join(" · ") || null;
      return {
        id: String(row.id),
        returnId: String(row.return_id),
        returnNo: returnMeta?.returnNo ?? String(row.return_id).slice(0, 8),
        saleId: returnMeta?.saleId ?? "",
        productId: String(row.product_id),
        variantId: row.variant_id ? String(row.variant_id) : null,
        lotId: row.lot_id ? String(row.lot_id) : null,
        unitId: row.unit_id ? String(row.unit_id) : null,
        qty: Number(row.qty ?? 0),
        disposition: String(row.disposition ?? "inspection") as ReturnHoldDisposition,
        note: row.note ? String(row.note) : null,
        createdAt: String(row.created_at),
        identityLabel,
      };
    }),
    error: null,
  };
}

export async function setReturnHoldDisposition(
  organizationId: string,
  holdId: string,
  disposition: ReturnHoldDisposition,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const { data, error } = await supabase.rpc("set_inventory_return_hold_disposition", {
    p_organization_id: organizationId,
    p_hold_id: holdId,
    p_disposition: disposition,
    p_note: note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  return { ok: row.ok !== false };
}

export async function resolveReturnHold(
  organizationId: string,
  holdId: string,
  action: ReturnHoldAction,
  note?: string,
): Promise<{ ok: boolean; replayed?: boolean; resolution?: ReturnHoldResolution; error?: string }> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const { data, error } = await supabase.rpc("resolve_inventory_return_hold", {
    p_organization_id: organizationId,
    p_hold_id: holdId,
    p_action: action,
    p_note: note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: row.ok !== false,
    replayed: Boolean(row.replayed),
    resolution: row.resolution ? (String(row.resolution) as ReturnHoldResolution) : undefined,
  };
}
