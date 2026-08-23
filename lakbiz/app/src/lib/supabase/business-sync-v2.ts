"use client";

import type { BusinessInfo } from "@/lib/invoice";
import type { AppData } from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";
import { createBrowserClient } from "./client";
import { fetchAllPages } from "./pagination";
import { pullBusinessData as pullLegacyBusinessData } from "./business-sync";

export * from "./business-sync";

type TenderPaymentRow = {
  sale_id: string;
  kind: string;
};

function tenderKindPaymentMethod(kind: string): PaymentMethod | null {
  if (
    kind === "cash" ||
    kind === "bank_transfer" ||
    kind === "card" ||
    kind === "cheque" ||
    kind === "credit"
  ) {
    return kind;
  }
  return null;
}

/**
 * Overlay the normalized tender ledger onto the legacy sale snapshot.
 *
 * `business-sync.ts` predates mixed tenders and intentionally remains stable;
 * this adapter prevents its legacy payment parser from turning `mixed` into
 * `cash`. The customer-facing `sale_tenders` table contains only kind/amount
 * metadata and does not expose protected bank, cheque or return-source ids.
 */
export function applyTenderPaymentMethods(
  data: AppData,
  tenderRows: TenderPaymentRow[],
): AppData {
  if (!tenderRows.length || !data.sales.length) return data;

  const rowsBySale = new Map<string, TenderPaymentRow[]>();
  for (const row of tenderRows) {
    const rows = rowsBySale.get(row.sale_id) ?? [];
    rows.push(row);
    rowsBySale.set(row.sale_id, rows);
  }

  return {
    ...data,
    sales: data.sales.map((sale) => {
      const rows = rowsBySale.get(sale.id);
      if (!rows?.length) return sale;
      if (rows.length > 1) return { ...sale, paymentMethod: "mixed" as const };

      const singleMethod = tenderKindPaymentMethod(rows[0].kind);
      if (singleMethod) return { ...sale, paymentMethod: singleMethod };

      // A sale fully settled by return credit has no legacy PaymentMethod
      // equivalent. Treat it as normalized/mixed rather than lying as cash.
      return { ...sale, paymentMethod: "mixed" as const };
    }),
  };
}

/**
 * Compatibility wrapper around the mature business pull. All existing sync
 * semantics remain unchanged; only payment-method readback is enriched from
 * the normalized tender ledger after the base snapshot succeeds.
 */
export async function pullBusinessData(
  organizationId: string,
  localBusiness: BusinessInfo,
): Promise<AppData | null> {
  const data = await pullLegacyBusinessData(organizationId, localBusiness);
  if (!data || data.sales.length === 0) return data;

  const supabase = createBrowserClient();
  if (!supabase) return data;

  const result = await fetchAllPages<TenderPaymentRow>((from, to) =>
    supabase
      .from("sale_tenders")
      .select("sale_id, kind")
      .eq("organization_id", organizationId)
      .range(from, to),
  );

  if (result.error || !result.data) {
    // Older/self-hosted schemas without the tender ledger must retain the
    // existing snapshot rather than turning a readback enhancement into a
    // cloud-sync failure.
    return data;
  }

  return applyTenderPaymentMethods(data, result.data);
}
