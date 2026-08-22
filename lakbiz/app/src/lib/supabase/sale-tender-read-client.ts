"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { SaleTenderKind } from "@/lib/sale-tender";

export type SaleTenderReceiptLine = {
  id: string;
  kind: SaleTenderKind;
  amount: number;
  createdAt: string;
};

export type SaleTenderReceiptResult = {
  data: SaleTenderReceiptLine[];
  error: string | null;
  schemaUnavailable: boolean;
};

function isSchemaUnavailable(error: string | null | undefined): boolean {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("sale_tenders") ||
    value.includes("could not find the table") ||
    value.includes("schema cache") ||
    value.includes("does not exist")
  );
}

/**
 * Customer-facing tender reader.
 *
 * Deliberately reads only sale_tenders. It never joins sale_tender_sources, so
 * bank-account ids, cheque ids and return-source ids remain behind the owner-only
 * financial boundary while the invoice can still say Cash/Card/etc. + amount.
 */
export async function fetchSaleTenderReceipt(
  organizationId: string,
  saleId: string,
): Promise<SaleTenderReceiptResult> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured", schemaUnavailable: false };
  }
  if (!organizationId || !saleId) {
    return { data: [], error: "Organization and sale are required", schemaUnavailable: false };
  }

  const { data, error } = await supabase
    .from("sale_tenders")
    .select("id, kind, amount, created_at")
    .eq("organization_id", organizationId)
    .eq("sale_id", saleId)
    .order("created_at", { ascending: true });

  if (error) {
    return {
      data: [],
      error: error.message,
      schemaUnavailable: isSchemaUnavailable(error.message),
    };
  }

  return {
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      kind: String(row.kind) as SaleTenderKind,
      amount: Number(row.amount ?? 0),
      createdAt: String(row.created_at ?? ""),
    })),
    error: null,
    schemaUnavailable: false,
  };
}
