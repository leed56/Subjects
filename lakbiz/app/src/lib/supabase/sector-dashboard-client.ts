"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { SectorId } from "@/lib/types";

export type SectorLotSnapshot = {
  productId: string;
  batchNo: string;
  expiryDate: string | null;
  qtyOnHand: number;
  status: "available" | "quarantine" | "expired" | "depleted" | "returned" | "recalled";
};

export type SectorUnitSnapshot = {
  productId: string;
  serialNo: string | null;
  imei: string | null;
  warrantyExpiry: string | null;
  status: "available" | "reserved" | "sold" | "service" | "returned" | "damaged" | "written_off";
};

export type SectorVariantSnapshot = {
  productId: string;
  label: string;
  stockQty: number;
  reorderLevel: number | null;
  active: boolean;
  attributes: Record<string, string | number | boolean>;
};

export type SectorOperationalSnapshot = {
  lots: SectorLotSnapshot[];
  units: SectorUnitSnapshot[];
  variants: SectorVariantSnapshot[];
  schemaReady: boolean;
  error: string | null;
};

function schemaUnavailable(message: string | null | undefined): boolean {
  const value = (message ?? "").toLowerCase();
  return (
    value.includes("inventory_lots") ||
    value.includes("inventory_units") ||
    value.includes("product_variants") ||
    value.includes("schema cache") ||
    value.includes("does not exist") ||
    value.includes("could not find the table")
  );
}

export async function fetchSectorOperationalSnapshot(
  organizationId: string,
  sector: SectorId,
): Promise<SectorOperationalSnapshot> {
  const empty: SectorOperationalSnapshot = {
    lots: [],
    units: [],
    variants: [],
    schemaReady: true,
    error: null,
  };
  const supabase = createBrowserClient();
  if (!supabase) return { ...empty, schemaReady: false, error: "Supabase not configured" };

  if (sector === "pharmacy") {
    const result = await supabase
      .from("inventory_lots")
      .select("product_id, batch_no, expiry_date, qty_on_hand, status")
      .eq("organization_id", organizationId)
      .gt("qty_on_hand", 0)
      .order("expiry_date", { ascending: true, nullsFirst: false });
    if (result.error) {
      return schemaUnavailable(result.error.message)
        ? { ...empty, schemaReady: false }
        : { ...empty, error: result.error.message };
    }
    return {
      ...empty,
      lots: (result.data ?? []).map((row) => ({
        productId: String(row.product_id),
        batchNo: String(row.batch_no ?? ""),
        expiryDate: row.expiry_date ? String(row.expiry_date) : null,
        qtyOnHand: Number(row.qty_on_hand ?? 0),
        status: String(row.status) as SectorLotSnapshot["status"],
      })),
    };
  }

  if (sector === "mobile_shop" || sector === "electronics") {
    const result = await supabase
      .from("inventory_units")
      .select("product_id, serial_no, imei, warranty_expiry, status")
      .eq("organization_id", organizationId);
    if (result.error) {
      return schemaUnavailable(result.error.message)
        ? { ...empty, schemaReady: false }
        : { ...empty, error: result.error.message };
    }
    return {
      ...empty,
      units: (result.data ?? []).map((row) => ({
        productId: String(row.product_id),
        serialNo: row.serial_no ? String(row.serial_no) : null,
        imei: row.imei ? String(row.imei) : null,
        warrantyExpiry: row.warranty_expiry ? String(row.warranty_expiry) : null,
        status: String(row.status) as SectorUnitSnapshot["status"],
      })),
    };
  }

  if (sector === "footwear") {
    const result = await supabase
      .from("product_variants")
      .select("product_id, label, stock_qty, reorder_level, active, attributes")
      .eq("organization_id", organizationId)
      .eq("active", true);
    if (result.error) {
      return schemaUnavailable(result.error.message)
        ? { ...empty, schemaReady: false }
        : { ...empty, error: result.error.message };
    }
    return {
      ...empty,
      variants: (result.data ?? []).map((row) => ({
        productId: String(row.product_id),
        label: String(row.label ?? ""),
        stockQty: Number(row.stock_qty ?? 0),
        reorderLevel: row.reorder_level == null ? null : Number(row.reorder_level),
        active: row.active !== false,
        attributes:
          row.attributes && typeof row.attributes === "object"
            ? (row.attributes as Record<string, string | number | boolean>)
            : {},
      })),
    };
  }

  return empty;
}
