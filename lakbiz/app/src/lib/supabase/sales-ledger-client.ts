"use client";
import { createBrowserClient } from "./client";
import { LedgerUnavailable } from "./general-ledger-client";

export type SaleLedgerEvent = {
  id: string;
  sale_id: string;
  status: "pending" | "posted" | "needs_review";
  reason: string | null;
  journal_id: string | null;
  created_at: string;
};
export type SalesLedgerSnapshot = {
  enabled: boolean;
  events: SaleLedgerEvent[];
  reviewCount: number;
};
function client() {
  const result = createBrowserClient();
  if (!result) throw new LedgerUnavailable("A connected business account is required.");
  return result;
}
function fail(error: { message: string; code?: string }) {
  if (["42P01", "PGRST205", "PGRST202"].includes(error.code ?? ""))
    throw new LedgerUnavailable("Sales-to-ledger integration is awaiting its database migration. Automatic posting has not been activated.");
  throw new Error(error.message);
}
export async function fetchSalesLedger(orgId: string, reviewOnly = false): Promise<SalesLedgerSnapshot> {
  const db = client();
  let eventsQuery = db.from("ledger_sale_events").select("id,sale_id,status,reason,journal_id,created_at").eq("organization_id", orgId);
  if (reviewOnly) eventsQuery = eventsQuery.eq("status", "needs_review");
  const [settings, events, review] = await Promise.all([
    db.from("ledger_sales_settings").select("enabled").eq("organization_id", orgId).maybeSingle(),
    eventsQuery.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50),
    db.from("ledger_sale_events").select("id", { count: "exact", head: true })
      .eq("organization_id", orgId).eq("status", "needs_review"),
  ]);
  for (const result of [settings, events, review]) if (result.error) fail(result.error);
  if (!Number.isSafeInteger(review.count) || (review.count ?? -1) < 0)
    throw new Error("Unable to determine the number of sales requiring review.");
  return { enabled: settings.data?.enabled === true, events: (events.data ?? []) as SaleLedgerEvent[], reviewCount: review.count! };
}
export async function setSalesLedgerEnabled(orgId: string, enabled: boolean, acknowledged = false) {
  if (enabled && !acknowledged) throw new Error("Acknowledge the new-sales revenue-only scope first.");
  const { error } = await client().rpc("set_sales_ledger_enabled", {
    p_organization_id: orgId,
    p_enabled: enabled,
    p_acknowledgement: enabled && acknowledged ? "NEW_SALES_REVENUE_ONLY" : "",
  });
  if (error) fail(error);
}
