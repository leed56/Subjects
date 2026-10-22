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

export type ConfigurePosBankRouteResult = {
  ok: boolean;
  error?: string;
};

export type PosBankRouteResult = {
  bankAccountId: string | null;
  error: string | null;
};

export function saleTenderSchemaUnavailable(error: string | null | undefined): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("sale_tenders") ||
    value.includes("sale_tender_sources") ||
    value.includes("pos_payment_routes") ||
    value.includes("finalize_sale_with_tenders") ||
    value.includes("finalize_sale_with_private_tenders") ||
    value.includes("finalize_sale_with_private_tenders_v2") ||
    value.includes("finalize_sale_with_private_tenders_v3") ||
    value.includes("configure_pos_bank_route") ||
    value.includes("could not find the function") ||
    value.includes("schema cache") ||
    value.includes("does not exist")
  );
}

/** Owner-only read; RLS intentionally returns no route to nonowners. */
export async function fetchPosBankRoute(
  organizationId: string,
): Promise<PosBankRouteResult> {
  const supabase = createBrowserClient();
  if (!supabase) return { bankAccountId: null, error: "Supabase not configured" };
  if (!organizationId) return { bankAccountId: null, error: "Organization is required" };

  const { data, error } = await supabase
    .from("pos_payment_routes")
    .select("bank_account_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) return { bankAccountId: null, error: error.message };
  return {
    bankAccountId: data?.bank_account_id ? String(data.bank_account_id) : null,
    error: null,
  };
}

/**
 * Owner-only setup for the hidden bank destination used by operational POS
 * bank-transfer tenders. Cashier/data-entry sessions never need to receive the
 * bank-account id or balance; the database resolves this route privately.
 */
export async function configurePosBankRoute(
  organizationId: string,
  bankAccountId: string,
): Promise<ConfigurePosBankRouteResult> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  if (!organizationId || !bankAccountId) {
    return { ok: false, error: "Organization and bank account are required" };
  }

  const { data, error } = await supabase.rpc("configure_pos_bank_route", {
    p_organization_id: organizationId,
    p_bank_account_id: bankAccountId,
  });

  if (error) return { ok: false, error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  return { ok: row.ok !== false };
}

/**
 * Calls the database transaction that owns the COMPLETE mixed-tender commit.
 *
 * Migration 00015 protects bank / cheque source identifiers, 00016 hardens
 * retries before hidden-source normalization, and 00017 allows a shop whose
 * plan/sector genuinely has no Banking module to record a customer bank-transfer
 * tender without fabricating an internal bank account or bank-ledger posting.
 * Banking-enabled shops still require the owner's private POS bank route.
 *
 * The current Sales page remains on the legacy path until these migrations are
 * deployed and verified on the real LakBiz database; there must never be two
 * authorities decrementing stock or posting receivables for the same checkout.
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

  const { data, error } = await supabase.rpc("finalize_sale_with_private_tenders_v3", {
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
      // bank_account_id and cheque_id are owner-only optional overrides.
      // Operational sessions normally omit both and use the privacy-safe
      // server route / inline cheque capture instead.
      ...(tender.bankAccountId ? { bank_account_id: tender.bankAccountId } : {}),
      ...(tender.chequeId ? { cheque_id: tender.chequeId } : {}),
      ...(tender.chequeNo?.trim() ? { cheque_no: tender.chequeNo.trim() } : {}),
      ...(tender.chequeBank?.trim() ? { cheque_bank: tender.chequeBank.trim() } : {}),
      ...(tender.chequeDate ? { cheque_date: tender.chequeDate } : {}),
      ...(tender.postDated != null ? { post_dated: tender.postDated } : {}),
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
