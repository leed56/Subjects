"use client";

import { createBrowserClient } from "@/lib/supabase/client";

export type ReturnAccountingAdjustment = {
  creditNoteId: string;
  returnId: string;
  saleId: string;
  issuedAt: string;
  grossCredit: number;
  outputVatReversal: number;
  netRevenueReversal: number;
  reversedCogs?: number;
  reversedProfit?: number;
};

export function returnAccountingSchemaUnavailable(error: string | null | undefined): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("sale_credit_notes") ||
    value.includes("sale_return_financials") ||
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table")
  );
}

/**
 * Return accounting is cloud-only because physical returns and credit notes are
 * transactional server workflows, not part of the local-first AppData snapshot.
 *
 * `includeOwnerFinancials` controls whether the owner-only COGS/profit snapshot
 * is queried. Non-owner callers can still net revenue/VAT from customer-facing
 * credit notes without ever requesting hidden buy-cost data.
 */
export async function fetchOrgReturnAccountingAdjustments(
  organizationId: string,
  includeOwnerFinancials = false,
): Promise<{ data: ReturnAccountingAdjustment[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const noteResult = await supabase
    .from("sale_credit_notes")
    .select(
      "id, return_id, sale_id, issued_at, gross_credit, output_vat_reversal, net_revenue_reversal",
    )
    .eq("organization_id", organizationId)
    .order("issued_at", { ascending: true });

  if (noteResult.error) return { data: [], error: noteResult.error.message };

  const base: ReturnAccountingAdjustment[] = (noteResult.data ?? []).map((row) => ({
    creditNoteId: String(row.id),
    returnId: String(row.return_id),
    saleId: String(row.sale_id),
    issuedAt: String(row.issued_at),
    grossCredit: Number(row.gross_credit ?? 0),
    outputVatReversal: Number(row.output_vat_reversal ?? 0),
    netRevenueReversal: Number(row.net_revenue_reversal ?? 0),
  }));

  if (!includeOwnerFinancials || base.length === 0) {
    return { data: base, error: null };
  }

  const returnIds = base.map((row) => row.returnId);
  const financeResult = await supabase
    .from("sale_return_financials")
    .select("return_id, reversed_cogs, reversed_profit")
    .eq("organization_id", organizationId)
    .in("return_id", returnIds);

  if (financeResult.error) return { data: [], error: financeResult.error.message };

  const finance = new Map(
    (financeResult.data ?? []).map((row) => [
      String(row.return_id),
      {
        reversedCogs: Number(row.reversed_cogs ?? 0),
        reversedProfit: Number(row.reversed_profit ?? 0),
      },
    ] as const),
  );

  return {
    data: base.map((row) => ({ ...row, ...finance.get(row.returnId) })),
    error: null,
  };
}
