import { createBrowserClient } from "./client";
export type ReceivingCatalogue = { organizationId: string; orderId: string; lineId: string | null; enabled: boolean;
  lines: { id: string; product_id: string; product_name: string; qty_ordered: number; qty_received: number; tracking_mode: "simple" | "variant" | "lot" | "variant_lot" | "serial" | "variant_serial"; fefo_enabled: boolean }[];
  variants: { id: string; label: string }[]; lots: { id: string; batch_no: string; expiry_date: string | null; variant_id: string | null }[] };
export async function loadReceivingCatalogue(org: string, order: string, line: string | null): Promise<ReceivingCatalogue> {
  const db = createBrowserClient(); if (!db) throw Error("Connect to LakBiz cloud to receive exact stock identities.");
  const result = await db.rpc("get_purchase_receiving_catalogue", { p_organization_id: org, p_purchase_order_id: order, p_line_id: line });
  if (result.error) throw Error(result.error.code === "PGRST202" ? "Exact receiving upgrade is awaiting installation." : result.error.message);
  const value = result.data;
  if (!value || value.organizationId !== org || value.orderId !== order || value.lineId !== line || !Array.isArray(value.lines) || !Array.isArray(value.variants) || !Array.isArray(value.lots)) throw Error("Receiving response does not match this company and order.");
  for (const row of value.lines) if (!row.id || !row.product_id || !Number.isFinite(Number(row.qty_ordered)) || !Number.isFinite(Number(row.qty_received))) throw Error("Order quantity requires review.");
  return value as ReceivingCatalogue;
}
