"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { TextileLengthUnit } from "@/lib/types";

export type TextileReservation = {
  id: string; orderReference: string; customerId: string | null; customerName: string | null;
  rollId: string; productId: string; quantity: number; lengthUnit: TextileLengthUnit;
  dyeLot: string | null; shade: string | null; status: "active" | "fulfilled" | "released" | "expired";
  expiresAt: string; exceptionApproved: boolean; exceptionReason: string | null; createdAt: string;
};

export type TextileCutTask = {
  id: string; saleId: string; rollId: string; productId: string; rollNo: string;
  plannedQuantity: number; lengthUnit: TextileLengthUnit; status: "pending" | "completed" | "cancelled";
  actualCutQuantity: number | null; wasteQuantity: number; wasteReason: string | null;
  isRemnant: boolean; remainingAfter: number | null; createdAt: string; completedAt: string | null;
};

const reservationFromRow = (row: Record<string, unknown>): TextileReservation => ({
  id: String(row.id), orderReference: String(row.order_reference), customerId: row.customer_id ? String(row.customer_id) : null,
  customerName: row.customer_name ? String(row.customer_name) : null, rollId: String(row.roll_id), productId: String(row.product_id),
  quantity: Number(row.quantity), lengthUnit: String(row.length_unit) as TextileLengthUnit,
  dyeLot: row.dye_lot ? String(row.dye_lot) : null, shade: row.shade ? String(row.shade) : null,
  status: String(row.status) as TextileReservation["status"], expiresAt: String(row.expires_at),
  exceptionApproved: Boolean(row.exception_approved), exceptionReason: row.exception_reason ? String(row.exception_reason) : null,
  createdAt: String(row.created_at),
});

export async function fetchTextileReservations(organizationId: string, activeOnly = false) {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [] as TextileReservation[], error: "Supabase not configured" };
  let query = supabase.from("textile_reservations").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (activeOnly) query = query.eq("status", "active").gt("expires_at", new Date().toISOString());
  const { data, error } = await query;
  return { data: ((data ?? []) as Record<string, unknown>[]).map(reservationFromRow), error: error?.message ?? null };
}

export async function expireTextileReservations(organizationId: string) {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase.rpc("expire_textile_reservations", { p_organization_id: organizationId });
  return { error: error?.message ?? null };
}

export async function reserveTextileRoll(input: { organizationId: string; orderReference: string; customerId?: string; customerName?: string; rollId: string; quantity: number; expiresAt: string; allowDyeLotException?: boolean; exceptionReason?: string }) {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null as TextileReservation | null, error: "Supabase not configured" };
  const { data, error } = await supabase.rpc("reserve_textile_roll", {
    p_organization_id: input.organizationId, p_order_reference: input.orderReference.trim(), p_customer_id: input.customerId || null,
    p_customer_name: input.customerName?.trim() || null, p_roll_id: input.rollId, p_quantity: input.quantity,
    p_expires_at: input.expiresAt, p_allow_dye_lot_exception: Boolean(input.allowDyeLotException), p_exception_reason: input.exceptionReason?.trim() || null,
  });
  return { data: data ? reservationFromRow(data as Record<string, unknown>) : null, error: error?.message ?? null };
}

export async function releaseTextileReservation(reservationId: string, reason: string) {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase.rpc("release_textile_reservation", { p_reservation_id: reservationId, p_reason: reason.trim() });
  return { error: error?.message ?? null };
}

export async function fetchTextileCutTasks(organizationId: string) {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [] as TextileCutTask[], error: "Supabase not configured" };
  const { data, error } = await supabase.from("textile_cut_tasks").select("*, textile_rolls!inner(roll_no)").eq("organization_id", organizationId).order("created_at", { ascending: false });
  const rows = (data ?? []) as Record<string, unknown>[];
  return { data: rows.map((row) => ({
    id: String(row.id), saleId: String(row.sale_id), rollId: String(row.roll_id), productId: String(row.product_id),
    rollNo: String((row.textile_rolls as Record<string, unknown>)?.roll_no ?? "—"), plannedQuantity: Number(row.planned_quantity),
    lengthUnit: String(row.length_unit) as TextileLengthUnit, status: String(row.status) as TextileCutTask["status"],
    actualCutQuantity: row.actual_cut_quantity == null ? null : Number(row.actual_cut_quantity), wasteQuantity: Number(row.waste_quantity ?? 0),
    wasteReason: row.waste_reason ? String(row.waste_reason) : null, isRemnant: Boolean(row.is_remnant),
    remainingAfter: row.remaining_after == null ? null : Number(row.remaining_after), createdAt: String(row.created_at), completedAt: row.completed_at ? String(row.completed_at) : null,
  })), error: error?.message ?? null };
}

export async function completeTextileCutTask(taskId: string, actualQuantity: number, wasteQuantity: number, wasteReason: string) {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase.rpc("complete_textile_cut_task", { p_task_id: taskId, p_actual_quantity: actualQuantity, p_waste_quantity: wasteQuantity, p_waste_reason: wasteReason.trim() || null });
  return { error: error?.message ?? null };
}
