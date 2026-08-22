"use client";

import { createBrowserClient } from "@/lib/supabase/client";

export type SaleReturnSettlementStatus =
  | "pending"
  | "settled_external"
  | "reduced_credit"
  | "exchange";

export type SaleReturnRecord = {
  id: string;
  returnNo: string;
  saleId: string;
  returnedAt: string;
  reason: string;
  merchandiseValue: number;
  outputVatReversal: number;
  settlementStatus: SaleReturnSettlementStatus;
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

export function saleReturnSchemaUnavailable(error: string | null | undefined): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("sale_returns") ||
    value.includes("sale_return_lines") ||
    value.includes("process_sale_return") ||
    value.includes("inventory_return_holds") ||
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table") ||
    value.includes("could not find the function")
  );
}

/** Read immutable return history for one original sale. */
export async function fetchSaleReturns(
  organizationId: string,
  saleId: string,
): Promise<{
  returns: SaleReturnRecord[];
  lines: SaleReturnLineRecord[];
  error: string | null;
}> {
  const supabase = createBrowserClient();
  if (!supabase) return { returns: [], lines: [], error: "Supabase not configured" };

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

  const error = returnResult.error ?? lineResult.error;
  if (error) return { returns: [], lines: [], error: error.message };

  return {
    returns: (returnResult.data ?? []).map((row) => ({
      id: String(row.id),
      returnNo: String(row.return_no),
      saleId: String(row.sale_id),
      returnedAt: String(row.returned_at),
      reason: String(row.reason ?? ""),
      merchandiseValue: Number(row.merchandise_value ?? 0),
      outputVatReversal: Number(row.output_vat_reversal ?? 0),
      settlementStatus: String(row.settlement_status ?? "pending") as SaleReturnSettlementStatus,
    })),
    lines: (lineResult.data ?? []).map((row) => ({
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
