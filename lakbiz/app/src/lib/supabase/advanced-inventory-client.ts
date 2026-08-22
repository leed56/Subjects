"use client";

/**
 * Cloud client for the additive advanced-inventory identity layer.
 *
 * IMPORTANT: these functions manage variants / batches / serial identities;
 * the existing local-first Product.stockQty + stock-log path remains the
 * authoritative quantity workflow until POS/job allocation is wired in a
 * later phase. Keeping the layers separate prevents a half-migrated product
 * from double-decrementing stock.
 */
import { createBrowserClient } from "@/lib/supabase/client";
import type { InventoryTrackingMode } from "@/lib/inventory-tracking";

export type InventoryProfile = {
  productId: string;
  organizationId: string;
  trackingMode: InventoryTrackingMode;
  variantAxes: string[];
  fefoEnabled: boolean;
  requireSerialOnSale: boolean;
  allowNegativeStock: boolean;
};

export type ProductVariant = {
  id: string;
  productId: string;
  label: string;
  sku: string | null;
  barcode: string | null;
  attributes: Record<string, string | number | boolean>;
  stockQty: number;
  reorderLevel: number | null;
  sellPriceOverride: number | null;
  active: boolean;
};

export type InventoryLot = {
  id: string;
  productId: string;
  variantId: string | null;
  batchNo: string;
  manufacturedDate: string | null;
  expiryDate: string | null;
  receivedDate: string;
  supplierId: string | null;
  qtyReceived: number;
  qtyOnHand: number;
  status: "available" | "quarantine" | "expired" | "depleted" | "returned" | "recalled";
  notes: string | null;
  unitCost?: number;
  landedCost?: number | null;
};

export type InventoryUnit = {
  id: string;
  productId: string;
  variantId: string | null;
  lotId: string | null;
  serialNo: string | null;
  imei: string | null;
  secondaryImei: string | null;
  barcode: string | null;
  warrantyExpiry: string | null;
  status: "available" | "reserved" | "sold" | "service" | "returned" | "damaged" | "written_off";
  saleId: string | null;
  customerId: string | null;
  notes: string | null;
  unitCost?: number;
  landedCost?: number | null;
};

function profileFromRow(row: Record<string, unknown>): InventoryProfile {
  return {
    productId: String(row.product_id),
    organizationId: String(row.organization_id),
    trackingMode: String(row.tracking_mode) as InventoryTrackingMode,
    variantAxes: Array.isArray(row.variant_axes) ? row.variant_axes.map(String) : [],
    fefoEnabled: Boolean(row.fefo_enabled),
    requireSerialOnSale: Boolean(row.require_serial_on_sale),
    allowNegativeStock: Boolean(row.allow_negative_stock),
  };
}

function variantFromRow(row: Record<string, unknown>): ProductVariant {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    label: String(row.label),
    sku: row.sku ? String(row.sku) : null,
    barcode: row.barcode ? String(row.barcode) : null,
    attributes: (row.attributes && typeof row.attributes === "object" ? row.attributes : {}) as Record<string, string | number | boolean>,
    stockQty: Number(row.stock_qty ?? 0),
    reorderLevel: row.reorder_level == null ? null : Number(row.reorder_level),
    sellPriceOverride: row.sell_price_override == null ? null : Number(row.sell_price_override),
    active: row.active !== false,
  };
}

function lotFromRow(row: Record<string, unknown>, cost?: { unit_cost?: unknown; landed_cost?: unknown }): InventoryLot {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    variantId: row.variant_id ? String(row.variant_id) : null,
    batchNo: String(row.batch_no),
    manufacturedDate: row.manufactured_date ? String(row.manufactured_date) : null,
    expiryDate: row.expiry_date ? String(row.expiry_date) : null,
    receivedDate: String(row.received_date),
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
    qtyReceived: Number(row.qty_received ?? 0),
    qtyOnHand: Number(row.qty_on_hand ?? 0),
    status: String(row.status) as InventoryLot["status"],
    notes: row.notes ? String(row.notes) : null,
    ...(cost ? { unitCost: Number(cost.unit_cost ?? 0), landedCost: cost.landed_cost == null ? null : Number(cost.landed_cost) } : {}),
  };
}

function unitFromRow(row: Record<string, unknown>, cost?: { unit_cost?: unknown; landed_cost?: unknown }): InventoryUnit {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    variantId: row.variant_id ? String(row.variant_id) : null,
    lotId: row.lot_id ? String(row.lot_id) : null,
    serialNo: row.serial_no ? String(row.serial_no) : null,
    imei: row.imei ? String(row.imei) : null,
    secondaryImei: row.secondary_imei ? String(row.secondary_imei) : null,
    barcode: row.barcode ? String(row.barcode) : null,
    warrantyExpiry: row.warranty_expiry ? String(row.warranty_expiry) : null,
    status: String(row.status) as InventoryUnit["status"],
    saleId: row.sale_id ? String(row.sale_id) : null,
    customerId: row.customer_id ? String(row.customer_id) : null,
    notes: row.notes ? String(row.notes) : null,
    ...(cost ? { unitCost: Number(cost.unit_cost ?? 0), landedCost: cost.landed_cost == null ? null : Number(cost.landed_cost) } : {}),
  };
}

export async function fetchInventoryProfile(productId: string): Promise<{ data: InventoryProfile | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("product_inventory_profiles")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data ? profileFromRow(data as Record<string, unknown>) : null, error: null };
}

export async function upsertInventoryProfile(input: InventoryProfile): Promise<{ data: InventoryProfile | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("product_inventory_profiles")
    .upsert({
      product_id: input.productId,
      organization_id: input.organizationId,
      tracking_mode: input.trackingMode,
      variant_axes: input.variantAxes,
      fefo_enabled: input.fefoEnabled,
      require_serial_on_sale: input.requireSerialOnSale,
      allow_negative_stock: input.allowNegativeStock,
    }, { onConflict: "product_id" })
    .select("*")
    .single();
  if (error) return { data: null, error: error.message };
  return { data: profileFromRow(data as Record<string, unknown>), error: null };
}

export async function fetchProductVariants(productId: string): Promise<{ data: ProductVariant[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .order("label");
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map((row) => variantFromRow(row as Record<string, unknown>)), error: null };
}

export async function createProductVariant(
  organizationId: string,
  productId: string,
  input: Omit<ProductVariant, "id" | "productId" | "active"> & { active?: boolean },
): Promise<{ data: ProductVariant | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("product_variants")
    .insert({
      organization_id: organizationId,
      product_id: productId,
      label: input.label.trim(),
      sku: input.sku?.trim() || null,
      barcode: input.barcode?.trim() || null,
      attributes: input.attributes,
      stock_qty: input.stockQty,
      reorder_level: input.reorderLevel,
      sell_price_override: input.sellPriceOverride,
      active: input.active ?? true,
    })
    .select("*")
    .single();
  if (error) return { data: null, error: error.message };
  return { data: variantFromRow(data as Record<string, unknown>), error: null };
}

export async function fetchInventoryLots(productId: string, includeCosts: boolean): Promise<{ data: InventoryLot[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("inventory_lots")
    .select("*")
    .eq("product_id", productId)
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .order("received_date", { ascending: true });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as Record<string, unknown>[];
  if (!includeCosts || rows.length === 0) return { data: rows.map((row) => lotFromRow(row)), error: null };

  const ids = rows.map((row) => String(row.id));
  const { data: costs, error: costError } = await supabase
    .from("inventory_lot_costs")
    .select("lot_id, unit_cost, landed_cost")
    .in("lot_id", ids);
  if (costError) return { data: [], error: costError.message };
  const costById = new Map((costs ?? []).map((row) => [String(row.lot_id), row]));
  return { data: rows.map((row) => lotFromRow(row, costById.get(String(row.id)))), error: null };
}

export async function createInventoryLot(
  organizationId: string,
  input: {
    productId: string;
    variantId?: string | null;
    batchNo: string;
    manufacturedDate?: string | null;
    expiryDate?: string | null;
    receivedDate?: string;
    supplierId?: string | null;
    qty: number;
    notes?: string;
    unitCost?: number;
    landedCost?: number | null;
  },
  canSeeFinancials: boolean,
): Promise<{ data: InventoryLot | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("inventory_lots")
    .insert({
      organization_id: organizationId,
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      batch_no: input.batchNo.trim(),
      manufactured_date: input.manufacturedDate || null,
      expiry_date: input.expiryDate || null,
      received_date: input.receivedDate || new Date().toISOString().slice(0, 10),
      supplier_id: input.supplierId ?? null,
      qty_received: input.qty,
      qty_on_hand: input.qty,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) return { data: null, error: error.message };

  const row = data as Record<string, unknown>;
  if (canSeeFinancials && input.unitCost != null) {
    const { error: costError } = await supabase.from("inventory_lot_costs").insert({
      lot_id: row.id,
      organization_id: organizationId,
      unit_cost: input.unitCost,
      landed_cost: input.landedCost ?? null,
    });
    if (costError) {
      // Avoid leaving an identity row whose intended cost record failed.
      await supabase.from("inventory_lots").delete().eq("id", row.id);
      return { data: null, error: costError.message };
    }
  }
  return { data: lotFromRow(row, canSeeFinancials && input.unitCost != null ? { unit_cost: input.unitCost, landed_cost: input.landedCost } : undefined), error: null };
}

export async function fetchInventoryUnits(productId: string, includeCosts: boolean): Promise<{ data: InventoryUnit[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("inventory_units")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as Record<string, unknown>[];
  if (!includeCosts || rows.length === 0) return { data: rows.map((row) => unitFromRow(row)), error: null };

  const ids = rows.map((row) => String(row.id));
  const { data: costs, error: costError } = await supabase
    .from("inventory_unit_costs")
    .select("unit_id, unit_cost, landed_cost")
    .in("unit_id", ids);
  if (costError) return { data: [], error: costError.message };
  const costById = new Map((costs ?? []).map((row) => [String(row.unit_id), row]));
  return { data: rows.map((row) => unitFromRow(row, costById.get(String(row.id)))), error: null };
}

export async function createInventoryUnit(
  organizationId: string,
  input: {
    productId: string;
    variantId?: string | null;
    lotId?: string | null;
    serialNo?: string;
    imei?: string;
    secondaryImei?: string;
    barcode?: string;
    warrantyExpiry?: string | null;
    notes?: string;
    unitCost?: number;
    landedCost?: number | null;
  },
  canSeeFinancials: boolean,
): Promise<{ data: InventoryUnit | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };
  if (![input.serialNo, input.imei, input.barcode].some((value) => value?.trim())) {
    return { data: null, error: "Serial, IMEI or barcode is required" };
  }

  const { data, error } = await supabase
    .from("inventory_units")
    .insert({
      organization_id: organizationId,
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      lot_id: input.lotId ?? null,
      serial_no: input.serialNo?.trim() || null,
      imei: input.imei?.trim() || null,
      secondary_imei: input.secondaryImei?.trim() || null,
      barcode: input.barcode?.trim() || null,
      warranty_expiry: input.warrantyExpiry || null,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) return { data: null, error: error.message };

  const row = data as Record<string, unknown>;
  if (canSeeFinancials && input.unitCost != null) {
    const { error: costError } = await supabase.from("inventory_unit_costs").insert({
      unit_id: row.id,
      organization_id: organizationId,
      unit_cost: input.unitCost,
      landed_cost: input.landedCost ?? null,
    });
    if (costError) {
      await supabase.from("inventory_units").delete().eq("id", row.id);
      return { data: null, error: costError.message };
    }
  }
  return { data: unitFromRow(row, canSeeFinancials && input.unitCost != null ? { unit_cost: input.unitCost, landed_cost: input.landedCost } : undefined), error: null };
}
