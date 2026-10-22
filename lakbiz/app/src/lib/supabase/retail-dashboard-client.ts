"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { fetchAllPages } from "@/lib/supabase/pagination";
import type { RetailLotSnapshot } from "@/lib/dashboard/retail-intelligence";

function lotFromRow(row: Record<string, unknown>): RetailLotSnapshot {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    batchNo: String(row.batch_no ?? ""),
    expiryDate: row.expiry_date ? String(row.expiry_date) : null,
    qtyOnHand: Number(row.qty_on_hand ?? 0),
    status: String(row.status) as RetailLotSnapshot["status"],
  };
}

/**
 * Organization-wide lot snapshot for the Pharmacy command center.
 * Intentionally selects no cost fields: non-owner roles receive the exact same
 * operational batch/expiry data while financial costs remain behind the
 * existing owner-only views/tables.
 */
export async function fetchRetailDashboardLots(
  organizationId: string,
): Promise<{ data: RetailLotSnapshot[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const result = await fetchAllPages((from, to) =>
    supabase
      .from("inventory_lots")
      .select("id,product_id,batch_no,expiry_date,qty_on_hand,status")
      .eq("organization_id", organizationId)
      .range(from, to),
  );

  if (result.error) return { data: [], error: result.error.message };
  return {
    data: (result.data ?? []).map((row) => lotFromRow(row as Record<string, unknown>)),
    error: null,
  };
}
