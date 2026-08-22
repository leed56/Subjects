"use client";

import { createBrowserClient } from "@/lib/supabase/client";

export type SaleReturnSettlementStatus =
  | "pending"
  | "partial"
  | "settled_external"
  | "reduced_credit"
  | "exchange"
  | "settled_mixed";

export type SaleReturnRecord = {
  id: string;
  returnNo: string;
  saleId: string;
  returnedAt: string;
  reason: string;
  merchandiseValue: number;
  outputVatReversal: number;
  settlementStatus: SaleReturnSettlementStatus;
  settledAt?: string | null;
};

export type SaleReturnLineRecord = {
  id: string;
  returnId: string;
  saleId: string;
  saleLineOrder: number;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  returnValue: number;
  outputVatReversal: number;
  originalAllocationId: string | null;
  restocked: boolean;
};

export type SaleCreditNoteRecord = {
  id: string;
  creditNoteNo: string;
  returnId: string;
  saleId: string;
  issuedAt: string;
  grossCredit: number;
  outputVatReversal: number;
  netRevenueReversal: number;
};

export type SaleReturnSettlementType =
  | "receivable_reduction"
  | "bank_refund"
  | "external_refund";

export type SaleReturnExternalMethod = "cash" | "card" | "cheque" | "other";

export type SaleReturnSettlementRecord = {
  id: string;
  returnId: string;
  creditNoteId: string;
  settlementType: SaleReturnSettlementType;
  amount: number;
  bankAccountId?: string | null;
  externalMethod?: SaleReturnExternalMethod | null;
  note?: string | null;
  createdAt: string;
};

export type SaleReturnAllocationRequest = {
  allocationId: string;
  qty: number;
};

export type SaleReturnLineRequest = {
  lineOrder: number;
  qty: number;
  /** `true` = inspected and approved for resale. `false` = physical return
   * hold; advanced identity stays unavailable to POS until a later release. */
  restock: boolean;
  allocations?: SaleReturnAllocationRequest[];
};

export type ProcessSaleReturnResult = {
  ok: boolean;
  replayed?: boolean;
  returnId?: string;
  returnNo?: string;
  merchandiseValue?: number;
  outputVatReversal?: number;
  reversedProfit?: number | null;
  resellableQty?: number;
  settlementStatus?: SaleReturnSettlementStatus;
  error?: string;
};

export type IssueSaleReturnCreditNoteResult = {
  ok: boolean;
  replayed?: boolean;
  creditNoteId?: string;
  creditNoteNo?: string;
  grossCredit?: number;
  outputVatReversal?: number;
  netRevenueReversal?: number;
  issuedAt?: string;
  error?: string;
};

export type SettleSaleReturnCreditInput = {
  settlementType: SaleReturnSettlementType;
  amount: number;
  bankAccountId?: string;
  externalMethod?: SaleReturnExternalMethod;
  note?: string;
};

export type SettleSaleReturnCreditResult = {
  ok: boolean;
  replayed?: boolean;
  settlementId?: string;
  settlementStatus?: SaleReturnSettlementStatus;
  settledTotal?: number;
  remaining?: number;
  error?: string;
};

export function saleReturnSchemaUnavailable(error: string | null | undefined): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("sale_returns") ||
    value.includes("sale_return_lines") ||
    value.includes("process_sale_return") ||
    value.includes("inventory_return_holds") ||
    value.includes("sale_credit_notes") ||
    value.includes("sale_return_settlements") ||
    value.includes("issue_sale_return_credit_note") ||
    value.includes("settle_sale_return_credit") ||
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table") ||
    value.includes("could not find the function")
  );
}

export function saleReturnFinanceSchemaUnavailable(
  error: string | null | undefined,
): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("sale_credit_notes") ||
    value.includes("sale_return_settlements") ||
    value.includes("issue_sale_return_credit_note") ||
    value.includes("settle_sale_return_credit") ||
    value.includes("settled_at") ||
    (value.includes("schema cache") &&
      (value.includes("credit") || value.includes("settlement")))
  );
}

/**
 * Read immutable physical-return history for one original sale. Credit-note
 * enrichment is deliberately optional: migration 00008 (physical intake) must
 * remain usable even when the later 00009 finance migration has not been
 * applied yet.
 */
export async function fetchSaleReturns(
  organizationId: string,
  saleId: string,
): Promise<{
  returns: SaleReturnRecord[];
  lines: SaleReturnLineRecord[];
  creditNotes: SaleCreditNoteRecord[];
  error: string | null;
  financeError?: string | null;
}> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { returns: [], lines: [], creditNotes: [], error: "Supabase not configured" };
  }

  // Do not select `settled_at` here: that column belongs to finance migration
  // 00009. The physical-return workspace must still function with only 00008.
  const [returnResult, lineResult] = await Promise.all([
    supabase
      .from("sale_returns")
      .select(
        "id, return_no, sale_id, returned_at, reason, merchandise_value, output_vat_reversal, settlement_status",
      )
      .eq("organization_id", organizationId)
      .eq("sale_id", saleId)
      .order("returned_at", { ascending: false }),
    supabase
      .from("sale_return_lines")
      .select(
        "id, return_id, sale_id, sale_line_order, product_id, product_name, qty, unit_price, return_value, output_vat_reversal, original_allocation_id, restocked",
      )
      .eq("organization_id", organizationId)
      .eq("sale_id", saleId)
      .order("created_at", { ascending: true }),
  ]);

  const physicalError = returnResult.error ?? lineResult.error;
  if (physicalError) {
    return { returns: [], lines: [], creditNotes: [], error: physicalError.message };
  }

  const returns: SaleReturnRecord[] = (returnResult.data ?? []).map((row) => ({
    id: String(row.id),
    returnNo: String(row.return_no),
    saleId: String(row.sale_id),
    returnedAt: String(row.returned_at),
    reason: String(row.reason ?? ""),
    merchandiseValue: Number(row.merchandise_value ?? 0),
    outputVatReversal: Number(row.output_vat_reversal ?? 0),
    settlementStatus: String(row.settlement_status ?? "pending") as SaleReturnSettlementStatus,
  }));
  const lines: SaleReturnLineRecord[] = (lineResult.data ?? []).map((row) => ({
    id: String(row.id),
    returnId: String(row.return_id),
    saleId: String(row.sale_id),
    saleLineOrder: Number(row.sale_line_order ?? 0),
    productId: String(row.product_id),
    productName: String(row.product_name ?? ""),
    qty: Number(row.qty ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    returnValue: Number(row.return_value ?? 0),
    outputVatReversal: Number(row.output_vat_reversal ?? 0),
    originalAllocationId: row.original_allocation_id
      ? String(row.original_allocation_id)
      : null,
    restocked: Boolean(row.restocked),
  }));

  // Finance enrichment is a second, optional read. A missing finance schema is
  // not an error for physical-return intake/history.
  const creditNoteResult = await supabase
    .from("sale_credit_notes")
    .select(
      "id, credit_note_no, return_id, sale_id, issued_at, gross_credit, output_vat_reversal, net_revenue_reversal",
    )
    .eq("organization_id", organizationId)
    .eq("sale_id", saleId)
    .order("issued_at", { ascending: false });

  if (creditNoteResult.error) {
    return {
      returns,
      lines,
      creditNotes: [],
      error: null,
      financeError: saleReturnFinanceSchemaUnavailable(creditNoteResult.error.message)
        ? null
        : creditNoteResult.error.message,
    };
  }

  return {
    returns,
    lines,
    creditNotes: (creditNoteResult.data ?? []).map((row) => ({
      id: String(row.id),
      creditNoteNo: String(row.credit_note_no),
      returnId: String(row.return_id),
      saleId: String(row.sale_id),
      issuedAt: String(row.issued_at),
      grossCredit: Number(row.gross_credit ?? 0),
      outputVatReversal: Number(row.output_vat_reversal ?? 0),
      netRevenueReversal: Number(row.net_revenue_reversal ?? 0),
    })),
    error: null,
    financeError: null,
  };
}

/** Owner-only internal settlement details for one accepted return. */
export async function fetchSaleReturnSettlementState(
  organizationId: string,
  returnId: string,
): Promise<{
  returnRecord: SaleReturnRecord | null;
  creditNote: SaleCreditNoteRecord | null;
  settlements: SaleReturnSettlementRecord[];
  error: string | null;
}> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return {
      returnRecord: null,
      creditNote: null,
      settlements: [],
      error: "Supabase not configured",
    };
  }

  const [returnResult, noteResult, settlementResult] = await Promise.all([
    supabase
      .from("sale_returns")
      .select(
        "id, return_no, sale_id, returned_at, reason, merchandise_value, output_vat_reversal, settlement_status, settled_at",
      )
      .eq("organization_id", organizationId)
      .eq("id", returnId)
      .maybeSingle(),
    supabase
      .from("sale_credit_notes")
      .select(
        "id, credit_note_no, return_id, sale_id, issued_at, gross_credit, output_vat_reversal, net_revenue_reversal",
      )
      .eq("organization_id", organizationId)
      .eq("return_id", returnId)
      .maybeSingle(),
    supabase
      .from("sale_return_settlements")
      .select(
        "id, return_id, credit_note_id, settlement_type, amount, bank_account_id, external_method, note, created_at",
      )
      .eq("organization_id", organizationId)
      .eq("return_id", returnId)
      .order("created_at", { ascending: true }),
  ]);

  const error = returnResult.error ?? noteResult.error ?? settlementResult.error;
  if (error) {
    return { returnRecord: null, creditNote: null, settlements: [], error: error.message };
  }

  const r = returnResult.data;
  const n = noteResult.data;
  return {
    returnRecord: r
      ? {
          id: String(r.id),
          returnNo: String(r.return_no),
          saleId: String(r.sale_id),
          returnedAt: String(r.returned_at),
          reason: String(r.reason ?? ""),
          merchandiseValue: Number(r.merchandise_value ?? 0),
          outputVatReversal: Number(r.output_vat_reversal ?? 0),
          settlementStatus: String(r.settlement_status ?? "pending") as SaleReturnSettlementStatus,
          settledAt: r.settled_at ? String(r.settled_at) : null,
        }
      : null,
    creditNote: n
      ? {
          id: String(n.id),
          creditNoteNo: String(n.credit_note_no),
          returnId: String(n.return_id),
          saleId: String(n.sale_id),
          issuedAt: String(n.issued_at),
          grossCredit: Number(n.gross_credit ?? 0),
          outputVatReversal: Number(n.output_vat_reversal ?? 0),
          netRevenueReversal: Number(n.net_revenue_reversal ?? 0),
        }
      : null,
    settlements: (settlementResult.data ?? []).map((row) => ({
      id: String(row.id),
      returnId: String(row.return_id),
      creditNoteId: String(row.credit_note_id),
      settlementType: String(row.settlement_type) as SaleReturnSettlementType,
      amount: Number(row.amount ?? 0),
      bankAccountId: row.bank_account_id ? String(row.bank_account_id) : null,
      externalMethod: row.external_method
        ? (String(row.external_method) as SaleReturnExternalMethod)
        : null,
      note: row.note ? String(row.note) : null,
      createdAt: String(row.created_at),
    })),
    error: null,
  };
}

/**
 * Transactional physical return intake. Financial settlement is intentionally
 * not part of this call; every new return starts as settlement_status=pending.
 */
export async function processSaleReturn(
  organizationId: string,
  saleId: string,
  returnId: string,
  reason: string,
  lines: SaleReturnLineRequest[],
): Promise<ProcessSaleReturnResult> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  if (!organizationId || !saleId || !returnId) {
    return { ok: false, error: "Organization, sale and return id are required" };
  }
  if (!reason.trim()) return { ok: false, error: "Return reason is required" };
  if (!lines.length) return { ok: false, error: "Select at least one item to return" };

  const { data, error } = await supabase.rpc("process_sale_return", {
    p_organization_id: organizationId,
    p_sale_id: saleId,
    p_return_id: returnId,
    p_reason: reason.trim(),
    p_lines: lines.map((line) => ({
      line_order: line.lineOrder,
      qty: line.qty,
      restock: line.restock,
      allocations: (line.allocations ?? []).map((allocation) => ({
        allocation_id: allocation.allocationId,
        qty: allocation.qty,
      })),
    })),
  });

  if (error) return { ok: false, error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: row.ok !== false,
    replayed: Boolean(row.replayed),
    returnId: row.return_id ? String(row.return_id) : returnId,
    returnNo: row.return_no ? String(row.return_no) : undefined,
    merchandiseValue: Number(row.merchandise_value ?? 0),
    outputVatReversal: Number(row.output_vat_reversal ?? 0),
    reversedProfit:
      row.reversed_profit == null ? null : Number(row.reversed_profit),
    resellableQty: Number(row.resellable_qty ?? 0),
    settlementStatus: String(
      row.settlement_status ?? "pending",
    ) as SaleReturnSettlementStatus,
  };
}

/** Owner-only accounting recognition. Does not move cash/bank/receivables. */
export async function issueSaleReturnCreditNote(
  organizationId: string,
  returnId: string,
  creditNoteId: string,
): Promise<IssueSaleReturnCreditNoteResult> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  if (!organizationId || !returnId || !creditNoteId) {
    return { ok: false, error: "Organization, return and credit note id are required" };
  }

  const { data, error } = await supabase.rpc("issue_sale_return_credit_note", {
    p_organization_id: organizationId,
    p_return_id: returnId,
    p_credit_note_id: creditNoteId,
  });
  if (error) return { ok: false, error: error.message };

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: row.ok !== false,
    replayed: Boolean(row.replayed),
    creditNoteId: row.credit_note_id ? String(row.credit_note_id) : creditNoteId,
    creditNoteNo: row.credit_note_no ? String(row.credit_note_no) : undefined,
    grossCredit: Number(row.gross_credit ?? 0),
    outputVatReversal: Number(row.output_vat_reversal ?? 0),
    netRevenueReversal: Number(row.net_revenue_reversal ?? 0),
    issuedAt: row.issued_at ? String(row.issued_at) : undefined,
  };
}

/** Post one owner-approved settlement entry; may be called repeatedly for a split settlement. */
export async function settleSaleReturnCredit(
  organizationId: string,
  returnId: string,
  settlementId: string,
  input: SettleSaleReturnCreditInput,
): Promise<SettleSaleReturnCreditResult> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  if (!organizationId || !returnId || !settlementId) {
    return { ok: false, error: "Organization, return and settlement id are required" };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Settlement amount must be positive" };
  }

  const { data, error } = await supabase.rpc("settle_sale_return_credit", {
    p_organization_id: organizationId,
    p_return_id: returnId,
    p_settlement_id: settlementId,
    p_settlement_type: input.settlementType,
    p_amount: input.amount,
    p_bank_account_id: input.bankAccountId ?? null,
    p_external_method: input.externalMethod ?? null,
    p_note: input.note?.trim() || null,
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
    settledTotal: Number(row.settled_total ?? 0),
    remaining: Number(row.remaining ?? 0),
  };
}
