import { createBrowserClient } from "./client";
import { invoiceNotices } from "@/lib/invoice-notices";

export const invoiceSetupPending = invoiceNotices.en.setup;
const interrupted = "Invoice sync was interrupted. Keep the pending bill and reconnect before retrying.";

/** Read-only deployment check; never probe an invoice-writing function. */
export async function completedInvoiceCommitReady(orgId: string): Promise<boolean> {
  const client = createBrowserClient();
  if (!client || !orgId) return false;
  try {
    const { data, error } = await client.rpc("completed_invoice_commit_ready", { p_organization_id: orgId }, { get: true });
    return !error && data === true;
  } catch { return false; }
}

/** Recorded invoices are server history, never snapshot-updated or pruned. */
export async function pendingLegacyInvoiceIds(orgId: string, ids: string[]): Promise<{ ids: Set<string>; error: string | null }> {
  try { return await resolvePendingLegacyInvoiceIds(orgId, ids); }
  catch { return { ids: new Set(), error: interrupted }; }
}

async function resolvePendingLegacyInvoiceIds(orgId: string, ids: string[]): Promise<{ ids: Set<string>; error: string | null }> {
  const pending = new Set(ids);
  if (!pending.size) return { ids: pending, error: null };
  const client = createBrowserClient();
  if (!client) return { ids: new Set(), error: "Supabase not configured" };
  const unique = [...pending];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const { data, error } = await client.from("sales").select("id").eq("organization_id", orgId).in("id", unique.slice(offset, offset + 100));
    if (error) return { ids: new Set(), error: error.message };
    for (const row of data ?? []) pending.delete(String(row.id));
  }
  if (pending.size) {
    const { data, error } = await client.from("organizations").select("sector").eq("id", orgId).single();
    if (error) return { ids: new Set(), error: error.message };
    if (!data || !["ac_hvac", "electricals", "spare_parts", "car_sales"].includes(data.sector)) {
      return { ids: new Set(), error: "New invoices for this shop must be completed through its POS checkout. Refresh before retrying." };
    }
    if (!await completedInvoiceCommitReady(orgId)) return { ids: new Set(), error: invoiceSetupPending };
  }
  return { ids: pending, error: null };
}

export async function recordCompletedInvoice(
  orgId: string,
  sale: Record<string, unknown>,
  lines: Record<string, unknown>[],
  context: Record<string, unknown> = {},
): Promise<string | null> {
  const client = createBrowserClient();
  if (!client) return "Supabase not configured";
  try {
    const { data, error } = await client.rpc("record_completed_invoice", {
      p_organization_id: orgId,
      p_sale: sale,
      p_lines: lines,
      p_context: context,
    });
    if (error) return error.code === "PGRST202" || error.code === "42883" ? invoiceSetupPending : error.message;
    return data?.ok === true ? null : "Invoice commit was not confirmed. Retry with the same invoice identifier.";
  } catch { return interrupted; }
}
