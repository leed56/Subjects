"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { saleReturnFinanceSchemaUnavailable } from "@/lib/supabase/sale-return-client";

export type ReturnCenterStatus =
  | "pending"
  | "partial"
  | "settled_external"
  | "reduced_credit"
  | "exchange"
  | "settled_mixed";

export type ReturnCenterRow = {
  returnId: string;
  returnNo: string;
  saleId: string;
  returnedAt: string;
  reason: string;
  merchandiseValue: number;
  outputVatReversal: number;
  settlementStatus: ReturnCenterStatus;
  creditNoteId?: string;
  creditNoteNo?: string;
  issuedAt?: string;
  settledTotal: number;
};

/**
 * Owner return-control read model. Physical returns remain readable even when
 * the later credit-note migration is not installed; financeSchemaMissing tells
 * the UI to keep those rows visible while disabling settlement assumptions.
 */
export async function fetchReturnCenter(
  organizationId: string,
): Promise<{
  data: ReturnCenterRow[];
  financeSchemaMissing: boolean;
  error: string | null;
}> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: [], financeSchemaMissing: false, error: "Supabase not configured" };
  }

  const returnResult = await supabase
    .from("sale_returns")
    .select(
      "id, return_no, sale_id, returned_at, reason, merchandise_value, output_vat_reversal, settlement_status",
    )
    .eq("organization_id", organizationId)
    .order("returned_at", { ascending: false });

  if (returnResult.error) {
    return {
      data: [],
      financeSchemaMissing: saleReturnFinanceSchemaUnavailable(returnResult.error.message),
      error: returnResult.error.message,
    };
  }

  const base = (returnResult.data ?? []).map((row) => ({
    returnId: String(row.id),
    returnNo: String(row.return_no),
    saleId: String(row.sale_id),
    returnedAt: String(row.returned_at),
    reason: String(row.reason ?? ""),
    merchandiseValue: Number(row.merchandise_value ?? 0),
    outputVatReversal: Number(row.output_vat_reversal ?? 0),
    settlementStatus: String(row.settlement_status ?? "pending") as ReturnCenterStatus,
    settledTotal: 0,
  } satisfies ReturnCenterRow));

  if (base.length === 0) {
    return { data: [], financeSchemaMissing: false, error: null };
  }

  const [noteResult, settlementResult] = await Promise.all([
    supabase
      .from("sale_credit_notes")
      .select("id, credit_note_no, return_id, issued_at")
      .eq("organization_id", organizationId),
    supabase
      .from("sale_return_settlements")
      .select("return_id, amount")
      .eq("organization_id", organizationId),
  ]);

  const financeError = noteResult.error ?? settlementResult.error;
  if (financeError) {
    if (saleReturnFinanceSchemaUnavailable(financeError.message)) {
      return { data: base, financeSchemaMissing: true, error: null };
    }
    return { data: base, financeSchemaMissing: false, error: financeError.message };
  }

  const noteByReturn = new Map(
    (noteResult.data ?? []).map((row) => [
      String(row.return_id),
      {
        creditNoteId: String(row.id),
        creditNoteNo: String(row.credit_note_no),
        issuedAt: String(row.issued_at),
      },
    ] as const),
  );
  const settledByReturn = new Map<string, number>();
  for (const row of settlementResult.data ?? []) {
    const returnId = String(row.return_id);
    settledByReturn.set(
      returnId,
      (settledByReturn.get(returnId) ?? 0) + Number(row.amount ?? 0),
    );
  }

  return {
    data: base.map((row) => ({
      ...row,
      ...noteByReturn.get(row.returnId),
      settledTotal: settledByReturn.get(row.returnId) ?? 0,
    })),
    financeSchemaMissing: false,
    error: null,
  };
}
