"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { SectorId } from "@/lib/types";

export type SectorLotSnapshot = {
  productId: string;
  batchNo: string;
  expiryDate: string | null;
  qtyOnHand: number;
  status: "available" | "quarantine" | "expired" | "depleted" | "returned" | "recalled" | "disposed" | "supplier_returned";
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

export type SectorTextileRollSnapshot = {
  productId: string;
  lengthUnit: "metre" | "yard";
  remainingLength: number;
  reservedLength: number;
  status: "unopened" | "opened" | "reserved" | "exhausted" | "quarantined" | "returned";
};

export type SectorTextileActivitySnapshot = {
  id: string;
  movementType: string;
  quantityDelta: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
};

export type SectorTextileWorkflowSnapshot = {
  pendingCuts: number;
  pendingDispatches: number;
  activeReservations: number;
  remnants: number;
  customerTerms: number;
  overdueReceivables: number;
  overdueAmount: number;
  recentActivity: SectorTextileActivitySnapshot[];
};

export type SectorOperationalSnapshot = {
  lots: SectorLotSnapshot[];
  units: SectorUnitSnapshot[];
  variants: SectorVariantSnapshot[];
  textileRolls: SectorTextileRollSnapshot[];
  textileWorkflow: SectorTextileWorkflowSnapshot;
  schemaReady: boolean;
  error: string | null;
};

export type TextileRollSummary = {
  activeRolls: number;
  metres: number;
  yards: number;
  remnants: number;
  reserved: number;
};

/**
 * Roll-inventory rollup shared by the dashboard's textile no-transactions
 * state and the sector command centre's metrics — both previously
 * re-derived this from `snapshot.textileRolls` independently. Metres and
 * yards stay separate sums (never added together — different units).
 */
export function summarizeTextileRolls(snapshot: SectorOperationalSnapshot): TextileRollSummary {
  const live = snapshot.textileRolls.filter((roll) => !["exhausted", "returned"].includes(roll.status));
  return {
    activeRolls: live.length,
    metres: live.filter((roll) => roll.lengthUnit === "metre").reduce((sum, roll) => sum + roll.remainingLength, 0),
    yards: live.filter((roll) => roll.lengthUnit === "yard").reduce((sum, roll) => sum + roll.remainingLength, 0),
    remnants: snapshot.textileWorkflow.remnants,
    reserved: live.reduce((sum, roll) => sum + roll.reservedLength, 0),
  };
}

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
  includeFinancials = false,
): Promise<SectorOperationalSnapshot> {
  const empty: SectorOperationalSnapshot = {
    lots: [],
    units: [],
    variants: [],
    textileRolls: [],
    textileWorkflow: {
      pendingCuts: 0,
      pendingDispatches: 0,
      activeReservations: 0,
      remnants: 0,
      customerTerms: 0,
      overdueReceivables: 0,
      overdueAmount: 0,
      recentActivity: [],
    },
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

  if (sector === "textile") {
    const today = new Date().toISOString().slice(0, 10);
    const [rolls, cuts, dispatches, reservations, remnants, terms, activity, receivables] = await Promise.all([
      supabase.from("textile_rolls").select("product_id, length_unit, remaining_length, reserved_length, status").eq("organization_id", organizationId),
      supabase.from("textile_cut_tasks").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending"),
      supabase.from("textile_dispatches").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["draft", "picking", "packed", "dispatched"]),
      supabase.from("textile_reservations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
      supabase.from("textile_rolls").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_remnant", true).not("status", "in", "(exhausted,returned)"),
      supabase.from("textile_customer_terms").select("customer_id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("textile_roll_movements").select("id, movement_type, quantity_delta, balance_after, reason, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(5),
      includeFinancials
        ? supabase.from("textile_receivables").select("outstanding_amount").eq("organization_id", organizationId).in("status", ["open", "part_paid"]).lt("due_date", today)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const firstError = [rolls, cuts, dispatches, reservations, remnants, terms, activity, receivables].find((item) => item.error)?.error;
    if (firstError) {
      return schemaUnavailable(firstError.message) || firstError.message.toLowerCase().includes("textile_")
        ? { ...empty, schemaReady: false }
        : { ...empty, error: firstError.message };
    }
    const overdueRows = receivables.data ?? [];
    return {
      ...empty,
      textileRolls: (rolls.data ?? []).map((row) => ({
        productId: String(row.product_id),
        lengthUnit: String(row.length_unit) as SectorTextileRollSnapshot["lengthUnit"],
        remainingLength: Number(row.remaining_length ?? 0),
        reservedLength: Number(row.reserved_length ?? 0),
        status: String(row.status) as SectorTextileRollSnapshot["status"],
      })),
      textileWorkflow: {
        pendingCuts: cuts.count ?? 0,
        pendingDispatches: dispatches.count ?? 0,
        activeReservations: reservations.count ?? 0,
        remnants: remnants.count ?? 0,
        customerTerms: terms.count ?? 0,
        overdueReceivables: overdueRows.length,
        overdueAmount: overdueRows.reduce((sum, row) => sum + Number(row.outstanding_amount ?? 0), 0),
        recentActivity: (activity.data ?? []).map((row) => ({
          id: String(row.id),
          movementType: String(row.movement_type),
          quantityDelta: Number(row.quantity_delta ?? 0),
          balanceAfter: Number(row.balance_after ?? 0),
          reason: row.reason ? String(row.reason) : null,
          createdAt: String(row.created_at),
        })),
      },
    };
  }

  return empty;
}
