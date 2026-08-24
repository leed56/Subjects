"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { TextileLengthUnit, TextileRollStatus } from "@/lib/types";

export type TextileRollRecord = {
  id: string;
  organizationId: string;
  productId: string;
  supplierId: string | null;
  rollNo: string;
  barcode: string | null;
  supplierLot: string | null;
  dyeLot: string | null;
  shade: string | null;
  width: number | null;
  widthUnit: "inch" | "centimetre";
  lengthUnit: TextileLengthUnit;
  receivedLength: number;
  remainingLength: number;
  reservedLength: number;
  damagedLength: number;
  weightKg: number | null;
  grade: string | null;
  rackLocation: string | null;
  sourceReference: string | null;
  status: TextileRollStatus;
  receivedAt: string;
  notes: string | null;
  createdAt: string;
  unitCost?: number;
  landedUnitCost?: number | null;
};

export type TextileRollMovement = {
  id: string;
  rollId: string;
  movementType: string;
  quantityDelta: number;
  balanceAfter: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

export type CreateTextileRollInput = {
  productId: string;
  supplierId?: string | null;
  rollNo: string;
  barcode?: string;
  supplierLot?: string;
  dyeLot?: string;
  shade?: string;
  width?: number | null;
  widthUnit: "inch" | "centimetre";
  lengthUnit: TextileLengthUnit;
  receivedLength: number;
  damagedLength?: number;
  weightKg?: number | null;
  grade?: string;
  rackLocation?: string;
  sourceReference?: string;
  receivedAt?: string;
  notes?: string;
  unitCost?: number;
  landedUnitCost?: number | null;
};

function rollFromRow(
  row: Record<string, unknown>,
  cost?: { unit_cost?: unknown; landed_unit_cost?: unknown },
): TextileRollRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    productId: String(row.product_id),
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
    rollNo: String(row.roll_no),
    barcode: row.barcode ? String(row.barcode) : null,
    supplierLot: row.supplier_lot ? String(row.supplier_lot) : null,
    dyeLot: row.dye_lot ? String(row.dye_lot) : null,
    shade: row.shade ? String(row.shade) : null,
    width: row.width == null ? null : Number(row.width),
    widthUnit: String(row.width_unit) as TextileRollRecord["widthUnit"],
    lengthUnit: String(row.length_unit) as TextileLengthUnit,
    receivedLength: Number(row.received_length),
    remainingLength: Number(row.remaining_length),
    reservedLength: Number(row.reserved_length ?? 0),
    damagedLength: Number(row.damaged_length ?? 0),
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    grade: row.grade ? String(row.grade) : null,
    rackLocation: row.rack_location ? String(row.rack_location) : null,
    sourceReference: row.source_reference ? String(row.source_reference) : null,
    status: String(row.status) as TextileRollStatus,
    receivedAt: String(row.received_at),
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    ...(cost
      ? {
          unitCost: Number(cost.unit_cost ?? 0),
          landedUnitCost:
            cost.landed_unit_cost == null ? null : Number(cost.landed_unit_cost),
        }
      : {}),
  };
}

export async function fetchTextileRolls(
  organizationId: string,
  includeCosts: boolean,
): Promise<{ data: TextileRollRecord[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("textile_rolls")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as Record<string, unknown>[];
  if (!includeCosts || rows.length === 0) {
    return { data: rows.map((row) => rollFromRow(row)), error: null };
  }
  const { data: costs, error: costError } = await supabase
    .from("textile_roll_costs")
    .select("roll_id, unit_cost, landed_unit_cost")
    .in("roll_id", rows.map((row) => String(row.id)));
  if (costError) return { data: [], error: costError.message };
  const costByRoll = new Map((costs ?? []).map((row) => [String(row.roll_id), row]));
  return {
    data: rows.map((row) => rollFromRow(row, costByRoll.get(String(row.id)))),
    error: null,
  };
}

export async function createTextileRoll(
  organizationId: string,
  input: CreateTextileRollInput,
  canSeeFinancials: boolean,
): Promise<{ data: TextileRollRecord | null; error: string | null; warning?: string }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };
  if (!input.rollNo.trim()) return { data: null, error: "Roll number is required" };
  if (!Number.isFinite(input.receivedLength) || input.receivedLength <= 0) {
    return { data: null, error: "Received length must be greater than zero" };
  }
  const damagedLength = input.damagedLength ?? 0;
  if (damagedLength < 0 || damagedLength > input.receivedLength) {
    return { data: null, error: "Damaged length must be within the received length" };
  }

  const { data, error } = await supabase
    .from("textile_rolls")
    .insert({
      organization_id: organizationId,
      product_id: input.productId,
      supplier_id: input.supplierId || null,
      roll_no: input.rollNo.trim(),
      barcode: input.barcode?.trim() || null,
      supplier_lot: input.supplierLot?.trim() || null,
      dye_lot: input.dyeLot?.trim() || null,
      shade: input.shade?.trim() || null,
      width: input.width ?? null,
      width_unit: input.widthUnit,
      length_unit: input.lengthUnit,
      received_length: input.receivedLength,
      remaining_length: input.receivedLength - damagedLength,
      damaged_length: damagedLength,
      weight_kg: input.weightKg ?? null,
      grade: input.grade?.trim() || null,
      rack_location: input.rackLocation?.trim() || null,
      source_reference: input.sourceReference?.trim() || null,
      received_at: input.receivedAt || new Date().toISOString().slice(0, 10),
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) return { data: null, error: error.message };
  const row = data as Record<string, unknown>;

  if (canSeeFinancials && input.unitCost != null) {
    const { error: costError } = await supabase.from("textile_roll_costs").insert({
      roll_id: row.id,
      organization_id: organizationId,
      unit_cost: input.unitCost,
      landed_unit_cost: input.landedUnitCost ?? null,
    });
    if (costError) {
      return {
        data: rollFromRow(row),
        error: null,
        warning: `Roll was received, but owner-only cost was not saved: ${costError.message}`,
      };
    }
  }

  return {
    data: rollFromRow(
      row,
      canSeeFinancials && input.unitCost != null
        ? { unit_cost: input.unitCost, landed_unit_cost: input.landedUnitCost }
        : undefined,
    ),
    error: null,
  };
}

export async function adjustTextileRollMeasurement(
  rollId: string,
  newRemaining: number,
  reason: string,
): Promise<{ data: TextileRollRecord | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };
  const { data, error } = await supabase.rpc("adjust_textile_roll_measurement", {
    p_roll_id: rollId,
    p_new_remaining: newRemaining,
    p_reason: reason.trim(),
  });
  if (error) return { data: null, error: error.message };
  return { data: data ? rollFromRow(data as Record<string, unknown>) : null, error: null };
}

export async function fetchTextileRollMovements(
  rollId: string,
): Promise<{ data: TextileRollMovement[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };
  const { data, error } = await supabase
    .from("textile_roll_movements")
    .select("*")
    .eq("roll_id", rollId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      rollId: String(row.roll_id),
      movementType: String(row.movement_type),
      quantityDelta: Number(row.quantity_delta),
      balanceAfter: Number(row.balance_after),
      reason: row.reason ? String(row.reason) : null,
      referenceType: row.reference_type ? String(row.reference_type) : null,
      referenceId: row.reference_id ? String(row.reference_id) : null,
      createdAt: String(row.created_at),
    })),
    error: null,
  };
}
