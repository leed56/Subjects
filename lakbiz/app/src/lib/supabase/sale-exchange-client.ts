"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { SaleReturnSettlementStatus } from "@/lib/supabase/sale-return-client";

export type SaleExchangeLink = {
  settlementId: string;
  returnId: string;
  replacementSaleId: string;
  amount: number;
  createdAt: string;
};

export type ApplySaleExchangeResult = {
  ok: boolean;
  replayed?: boolean;
  settlementId?: string;
  settlementStatus?: SaleReturnSettlementStatus;
  appliedAmount?: number;
  remainingReturnCredit?: number;
  replacementSaleId?: string;
  replacementBillNo?: string | null;
  replacementCreditDifference?: number;
  error?: string;
};

export function saleExchangeSchemaUnavailable(
  error: string | null | undefined,
): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("replacement_sale_id") ||
    value.includes("apply_sale_return_exchange") ||
    value.includes("sale_return_settlements") ||
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table") ||
    value.includes("could not find the function")
  );
}

/** Owner-only read used to stop an already-linked replacement invoice being offered again. */
export async function fetchSaleExchangeLinks(
  organizationId: string,
): Promise<{ data: SaleExchangeLink[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("sale_return_settlements")
    .select("id, return_id, replacement_sale_id, amount, created_at")
    .eq("organization_id", organizationId)
    .eq("settlement_type", "exchange")
    .not("replacement_sale_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((row) => ({
      settlementId: String(row.id),
      returnId: String(row.return_id),
      replacementSaleId: String(row.replacement_sale_id),
      amount: Number(row.amount ?? 0),
      createdAt: String(row.created_at),
    })),
    error: null,
  };
}

/**
 * Apply the issued return credit to a NEW same-customer CREDIT invoice.
 * The database chooses the amount automatically: min(return credit remaining,
 * replacement credit amount). That makes equal/cheaper/dearer exchanges safe
 * without allowing the UI to fabricate a settlement amount.
 */
export async function applySaleReturnExchange(
  organizationId: string,
  returnId: string,
  settlementId: string,
  replacementSaleId: string,
): Promise<ApplySaleExchangeResult> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };

  if (!organizationId || !returnId || !settlementId || !replacementSaleId) {
    return { ok: false, error: "Organization, return and replacement sale are required" };
  }

  const { data, error } = await supabase.rpc("apply_sale_return_exchange", {
    p_organization_id: organizationId,
    p_return_id: returnId,
    p_settlement_id: settlementId,
    p_replacement_sale_id: replacementSaleId,
  });

  if (error) return { ok: false, error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;

  return {
    ok: row.ok !== false,
    replayed: Boolean(row.replayed),
    settlementId: row.settlement_id ? String(row.settlement_id) : settlementId,
    settlementStatus: row.settlement_status
      ? (String(row.settlement_status) as SaleReturnSettlementStatus)
      : undefined,
    appliedAmount: Number(row.applied_amount ?? 0),
    remainingReturnCredit: Number(row.remaining_return_credit ?? 0),
    replacementSaleId: row.replacement_sale_id
      ? String(row.replacement_sale_id)
      : replacementSaleId,
    replacementBillNo: row.replacement_bill_no
      ? String(row.replacement_bill_no)
      : null,
    replacementCreditDifference: Number(row.replacement_credit_difference ?? 0),
  };
}
