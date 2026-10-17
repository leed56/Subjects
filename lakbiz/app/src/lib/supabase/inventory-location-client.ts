"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { InventoryTransferStatus } from "@/lib/inventory-transfer";

export type StockLocation = { id: string; code: string; name: string; active: boolean; is_default: boolean };
export type LocationBalance = { id: string; location_id: string; product_id: string; variant_id: string | null; lot_id: string | null; qty_on_hand: number; qty_reserved: number };
export type CustodyUnit = { id: string; product_id: string; variant_id: string | null; lot_id: string | null; location_id: string | null; serial_no: string | null; imei: string | null; status: string; custody_status: string };
export type StockTransfer = { id: string; transfer_no: string; from_location_id: string; to_location_id: string; status: InventoryTransferStatus; created_at: string };
export type StockReservation = { id: string; balance_id: string | null; unit_id: string | null; qty: number; reason: string; status: string };
export type ReconciliationRow = { product_id: string; identity_kind: string; variant_id: string | null; lot_id: string | null; unit_id: string | null; source_qty: number; located_qty: number; transit_qty: number; difference: number };
export type InventoryLocationSnapshot = { organizationId: string; locations: StockLocation[]; balances: LocationBalance[]; units: CustodyUnit[]; transfers: StockTransfer[]; reservations: StockReservation[]; enabled: boolean };

// Explicit paging prevents the Data API's default row cap hiding stock or holds.
async function rows<T>(table: string, organizationId: string): Promise<T[]> {
  const db = createBrowserClient();
  if (!db) throw new Error("Cloud inventory is unavailable.");
  const result: T[] = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    const { data, error } = await db.from(table).select("*").eq("organization_id", organizationId)
      .order("id").range(offset, offset + 499);
    if (error) throw new Error(error.message);
    result.push(...(data ?? []) as T[]);
    if (!data || data.length === 0) return result;
    offset += data.length;
  }
  throw new Error("This inventory exceeds the workspace paging limit. Narrow the organization inventory before continuing.");
}

export async function loadInventoryLocations(organizationId: string): Promise<InventoryLocationSnapshot> {
  const db = createBrowserClient();
  if (!db) throw new Error("Cloud inventory is unavailable.");
  const results = await Promise.allSettled([
    rows<StockLocation>("inventory_locations", organizationId),
    rows<LocationBalance>("inventory_location_balances", organizationId),
    rows<CustodyUnit>("inventory_units", organizationId),
    rows<StockTransfer>("inventory_transfers", organizationId),
    rows<StockReservation>("inventory_reservations", organizationId),
    db.from("inventory_transfer_settings").select("enabled").eq("organization_id", organizationId).maybeSingle(),
  ] as const);
  const [locations, balances, units, transfers, reservations, setting] = results;
  for (const result of results) if (result.status === "rejected") throw result.reason;
  if (locations.status !== "fulfilled" || balances.status !== "fulfilled" || units.status !== "fulfilled" || transfers.status !== "fulfilled" || reservations.status !== "fulfilled" || setting.status !== "fulfilled") throw new Error("Inventory loading failed.");
  if (setting.value.error) throw new Error(setting.value.error.message);
  return { organizationId, locations: locations.value, balances: balances.value, units: units.value,
    transfers: transfers.value.sort((a,b) => b.created_at.localeCompare(a.created_at)),
    reservations: reservations.value, enabled: setting.value.data?.enabled === true };
}

export async function inventoryOperation(name: string, args: Record<string, unknown>) {
  const db = createBrowserClient();
  if (!db) throw new Error("Cloud inventory is unavailable.");
  const { error } = await db.rpc(name, args);
  if (error) throw new Error(error.message);
}

export async function createStockLocation(organizationId: string, code: string, name: string, isDefault = false) {
  const db = createBrowserClient();
  if (!db) throw new Error("Cloud inventory is unavailable.");
  const { data: existingDefault, error: lookupError } = await db.from("inventory_locations").select("id")
    .eq("organization_id", organizationId).eq("is_default", true).maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  const { error } = await db.from("inventory_locations").insert({ organization_id: organizationId, code: code.trim().toUpperCase(), name: name.trim(), kind: "stockroom", is_default: isDefault || !existingDefault });
  if (error) throw new Error(error.message);
}

export async function inspectInventoryProduct(organizationId: string, productId: string): Promise<ReconciliationRow[]> {
  const db = createBrowserClient();
  if (!db) throw new Error("Cloud inventory is unavailable.");
  const result: ReconciliationRow[] = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    const { data, error } = await db.rpc("get_inventory_location_reconciliation", { p_organization_id: organizationId, p_product_id: productId })
      .order("identity_kind").order("variant_id").order("lot_id").order("unit_id").range(offset, offset + 499);
    if (error) throw new Error(error.message);
    result.push(...(data ?? []) as ReconciliationRow[]);
    if (!data || data.length === 0) return result;
    offset += data.length;
  }
  throw new Error("This product has too many identities for one reconciliation review.");
}
