"use client";

import { createBrowserClient } from "@/lib/supabase/client";

export type BlockedLotAction = "dispose" | "return_to_supplier";

/** Mirrors return-hold-client.ts's schema-detection helper — same shape of
 * error string matching for a migration that hasn't been applied yet. */
export function blockedLotSchemaUnavailable(error: string | null | undefined): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("resolve_blocked_lot") ||
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the function")
  );
}

/** Owner/manager-only terminal disposition for a quarantined, recalled or
 * expired batch — see 20260825000001_blocked_lot_disposition.sql. Zeroes
 * the batch's qty_on_hand and decrements aggregate product stock exactly
 * once; there is no "release back to available" action. */
export async function resolveBlockedLot(
  organizationId: string,
  lotId: string,
  action: BlockedLotAction,
  note?: string,
): Promise<{ ok: boolean; replayed?: boolean; status?: string; error?: string }> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const { data, error } = await supabase.rpc("resolve_blocked_lot", {
    p_organization_id: organizationId,
    p_lot_id: lotId,
    p_action: action,
    p_note: note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: row.ok !== false,
    replayed: Boolean(row.replayed),
    status: row.status ? String(row.status) : undefined,
  };
}
