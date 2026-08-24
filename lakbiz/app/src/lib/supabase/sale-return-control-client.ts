"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type {
  SaleCreditNoteRecord,
  SaleReturnSettlementRecord,
  SaleReturnSettlementStatus,
} from "@/lib/supabase/sale-return-client";

export type SaleReturnControlRow = {
  id: string;
  returnNo: string;
  saleId: string;
  returnedAt: string;
  reason: string;
  merchandiseValue: number;
  outputVatReversal: number;
  settlementStatus: SaleReturnSettlementStatus;
  settledAt: string | null;
  creditNote: SaleCreditNoteRecord | null;
  settlements: SaleReturnSettlementRecord[];
  settledTotal: number;
  remainingCredit: number;
};

export type SaleReturnControlSummary = {
  totalReturns: number;
  totalReturnValue: number;
  awaitingCreditNote: number;
  awaitingSettlement: number;
  settled: number;
  outstandingCredit: number;
};

export function saleReturnControlSchemaUnavailable(
  error: string | null | undefined,
): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("sale_returns") ||
    value.includes("sale_credit_notes") ||
    value.includes("sale_return_settlements") ||
    value.includes("settled_at") ||
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table")
  );
}

/**
 * Owner return-control read model.
 *
 * This deliberately composes immutable physical-return, credit-note and
 * settlement ledgers instead of introducing another mutable summary table.
 * That keeps the control center auditable and prevents dashboard/UI state from
 * becoming a second financial source of truth.
 */
export async function fetchOrgSaleReturnControl(
  organizationId: string,
): Promise<{
  rows: SaleReturnControlRow[];
  summary: SaleReturnControlSummary;
  error: string | null;
}> {
  const emptySummary: SaleReturnControlSummary = {
    totalReturns: 0,
    totalReturnValue: 0,
    awaitingCreditNote: 0,
    awaitingSettlement: 0,
    settled: 0,
    outstandingCredit: 0,
  };

  const supabase = createBrowserClient();
  if (!supabase) return { rows: [], summary: emptySummary, error: "Supabase not configured" };

  const [returnResult, noteResult, settlementResult] = await Promise.all([
    supabase
      .from("sale_returns")
      .select(
        "id, return_no, sale_id, returned_at, reason, merchandise_value, output_vat_reversal, settlement_status, settled_at",
      )
      .eq("organization_id", organizationId)
      .order("returned_at", { ascending: false }),
    supabase
      .from("sale_credit_notes")
      .select(
        "id, credit_note_no, return_id, sale_id, issued_at, gross_credit, output_vat_reversal, net_revenue_reversal",
      )
      .eq("organization_id", organizationId)
      .order("issued_at", { ascending: false }),
    supabase
      .from("sale_return_settlements")
      .select(
        "id, return_id, credit_note_id, settlement_type, amount, bank_account_id, external_method, note, created_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
  ]);

  const error = returnResult.error ?? noteResult.error ?? settlementResult.error;
  if (error) return { rows: [], summary: emptySummary, error: error.message };

  const noteByReturn = new Map<string, SaleCreditNoteRecord>();
  for (const row of noteResult.data ?? []) {
    noteByReturn.set(String(row.return_id), {
      id: String(row.id),
      creditNoteNo: String(row.credit_note_no),
      returnId: String(row.return_id),
      saleId: String(row.sale_id),
      issuedAt: String(row.issued_at),
      grossCredit: Number(row.gross_credit ?? 0),
      outputVatReversal: Number(row.output_vat_reversal ?? 0),
      netRevenueReversal: Number(row.net_revenue_reversal ?? 0),
    });
  }

  const settlementsByReturn = new Map<string, SaleReturnSettlementRecord[]>();
  for (const row of settlementResult.data ?? []) {
    const returnId = String(row.return_id);
    const list = settlementsByReturn.get(returnId) ?? [];
    list.push({
      id: String(row.id),
      returnId,
      creditNoteId: String(row.credit_note_id),
      settlementType: String(row.settlement_type) as SaleReturnSettlementRecord["settlementType"],
      amount: Number(row.amount ?? 0),
      bankAccountId: row.bank_account_id ? String(row.bank_account_id) : null,
      externalMethod: row.external_method
        ? (String(row.external_method) as SaleReturnSettlementRecord["externalMethod"])
        : null,
      note: row.note ? String(row.note) : null,
      createdAt: String(row.created_at),
    });
    settlementsByReturn.set(returnId, list);
  }

  const rows: SaleReturnControlRow[] = (returnResult.data ?? []).map((row) => {
    const returnId = String(row.id);
    const creditNote = noteByReturn.get(returnId) ?? null;
    const settlements = settlementsByReturn.get(returnId) ?? [];
    const settledTotal = settlements.reduce((sum, item) => sum + item.amount, 0);
    const remainingCredit = Math.max(0, (creditNote?.grossCredit ?? 0) - settledTotal);
    return {
      id: returnId,
      returnNo: String(row.return_no),
      saleId: String(row.sale_id),
      returnedAt: String(row.returned_at),
      reason: String(row.reason ?? ""),
      merchandiseValue: Number(row.merchandise_value ?? 0),
      outputVatReversal: Number(row.output_vat_reversal ?? 0),
      settlementStatus: String(row.settlement_status ?? "pending") as SaleReturnSettlementStatus,
      settledAt: row.settled_at ? String(row.settled_at) : null,
      creditNote,
      settlements,
      settledTotal,
      remainingCredit,
    };
  });

  const summary = rows.reduce<SaleReturnControlSummary>(
    (acc, row) => {
      acc.totalReturns += 1;
      acc.totalReturnValue += row.merchandiseValue;
      if (!row.creditNote) acc.awaitingCreditNote += 1;
      else if (row.remainingCredit > 0.005) {
        acc.awaitingSettlement += 1;
        acc.outstandingCredit += row.remainingCredit;
      } else {
        acc.settled += 1;
      }
      return acc;
    },
    { ...emptySummary },
  );

  return { rows, summary, error: null };
}
