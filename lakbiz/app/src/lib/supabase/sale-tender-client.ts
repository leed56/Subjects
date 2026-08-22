"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { SaleTenderDraft } from "@/lib/sale-tender";

export type AtomicSaleLine = {
  productId: string;
  qty: number;
  unitPrice?: number;
  lineOrder?: number;
  /** Advanced inventory selection for variant / variant+lot / variant+serial. */
  variantId?: string;
  /** Exact IMEI/serial unit ids for serialized stock. */
  unitIds?: string[];
};

export type FinalizeSaleWithTendersInput = {
  saleId: string;
  customerId?: string;
  customerName?: string;
  discount?: number;
  lines: AtomicSaleLine[];
  tenders: SaleTenderDraft[];
};

export type FinalizeSaleWithTendersResult = {
  ok: boolean;
  replayed?: boolean;
  saleId?: string;
  billNo?: string;
  total?: number;
  paymentMethod?: string;
  creditAmount?: number;
  tenderCount?: number;
  error?: string;
};

export function saleTenderSchemaUnavailable(error: string | null | undefined): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("sale_tenders") ||
    value.includes("sale_tender_sources") ||
    value.includes("finalize_sale_with_tenders") ||
    value.includes("could not find the function") ||
    value.includes("schema cache") ||
    value.includes("does not exist")
  );
}

/**
 * Calls the database transaction that owns the COMPLETE mixed-tender commit.
 *
 * This client is intentionally not wired into the existing Sales page yet.
 * Switching the POS before migration 00014 is deployed would split authority
 * between the legacy local-first sale path and the atomic tender transaction.
 */
export async function finalizeSaleWithTenders(
  organizationId: string,
  input: FinalizeSaleWithTendersInput,
): Promise<FinalizeSaleWithTendersResult> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  if (!organizationId || !input.saleId) {
    return { ok: false, error: "Organization and sale id are required" };
  }
  if (!input.lines.length) return { ok: false, error: "Add at least one sale item" };
  if (!input.tenders.length) return { ok: false, error: "Add at least one payment tender" };

  const { data, error } = await supabase.rpc("finalize_sale_with_tenders", {
    p_organization_id: organizationId,
    p_sale_id: input.saleId,
    p_customer_id: input.customerId ?? null,
    p_customer_name: input.customerName?.trim() || null,
    p_discount: Math.max(0, input.discount ?? 0),
    p_lines: input.lines.map((line, index) => ({
      product_id: line.productId,
      qty: line.qty,
      ...(line.unitPrice != null ? { unit_price: line.unitPrice } : {}),
      line_order: line.lineOrder ?? index,
      ...(line.variantId ? { variant_id: line.variantId } : {}),
      ...(line.unitIds?.length ? { unit_ids: line.unitIds } : {}),
    })),
    p_tenders: input.tenders.map((tender) => ({
      id: tender.id,
      kind: tender.kind,
      amount: tender.amount,
      ...(tender.bankAccountId ? { bank_account_id: tender.bankAccountId } : {}),
      ...(tender.chequeId ? { cheque_id: tender.chequeId } : {}),
      ...(tender.returnId ? { return_id: tender.returnId } : {}),
      ...(tender.note?.trim() ? { note: tender.note.trim() } : {}),
    })),
  });

  if (error) return { ok: false, error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: row.ok !== false,
    replayed: Boolean(row.replayed),
    saleId: row.sale_id ? String(row.sale_id) : input.saleId,
    billNo: row.bill_no ? String(row.bill_no) : undefined,
    total: row.total == null ? undefined : Number(row.total),
    paymentMethod: row.payment_method ? String(row.payment_method) : undefined,
    creditAmount: row.credit_amount == null ? undefined : Number(row.credit_amount),
    tenderCount: row.tender_count == null ? undefined : Number(row.tender_count),
  };
}
