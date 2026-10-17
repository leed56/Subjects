import { createBrowserClient } from "./client";
import type { AppData, PurchaseOrder, PurchaseOrderInput, PurchaseOrderReceiveLine, StockLog } from "@/lib/store/types";

export async function purchaseAuthority(organizationId: string): Promise<{ enabled: boolean; error: string | null }> {
  const db = createBrowserClient();
  if (!db) return { enabled: false, error: "Cloud not connected" };
  try {
    const { data, error } = await db.from("purchase_receipt_settings").select("enabled").eq("organization_id", organizationId).maybeSingle();
    if (error && ["42P01", "PGRST205"].includes(error.code)) return { enabled: false, error: null };
    return { enabled: data?.enabled === true, error: error?.message ?? null };
  } catch (error) { return { enabled: false, error: error instanceof Error ? error.message : "Could not verify purchasing authority" }; }
}

type Action = { kind: "create"; input: PurchaseOrderInput } | { kind: "receive"; order: PurchaseOrder; lines: PurchaseOrderReceiveLine[] }
  | { kind: "cancel"; orderId: string } | { kind: "resume" };
type Pending = { version: 1; intent: string; orderId: string; rpc: string; args: Record<string, unknown> };
type Snapshot = { order: PurchaseOrder; products: { id: string; stockQty: number; buyPrice: number }[]; logs: StockLog[] };
export type PurchaseActionResult = { handled: false } | { handled: true; error: string } | { handled: true; snapshot: Snapshot; acknowledge: () => void };
const key = (org: string, user: string) => `lakbiz:purchase-command:${org}:${user}`;

function pending(org: string, user: string): Pending | null {
  const raw = window.localStorage.getItem(key(org, user));
  if (!raw) return null;
  const value = JSON.parse(raw) as Pending;
  if (value.version !== 1 || !value.orderId || !value.intent || !value.args ||
    !["create_purchase_order_atomic", "receive_purchase_order_atomic", "cancel_purchase_order_atomic"].includes(value.rpc)) {
    throw new Error("The pending purchasing request could not be read. Keep this browser data and resolve the request before continuing.");
  }
  return value;
}

export function hasPendingPurchase(org: string, user: string): boolean {
  // A damaged record still needs attention; never silently discard its key.
  try { return window.localStorage.getItem(key(org, user)) !== null; } catch { return true; }
}

function prepare(action: Exclude<Action, { kind: "resume" }>, org: string): Pending {
  if (action.kind === "create") {
    const input = { ...action.input, lines: [...action.input.lines].sort((a, b) => a.productId.localeCompare(b.productId)) };
    const orderId = crypto.randomUUID();
    return { version: 1, orderId, intent: JSON.stringify({ kind: "create", input }), rpc: "create_purchase_order_atomic",
      args: { p_organization_id: org, p_purchase_order_id: orderId, p_input: input } };
  }
  if (action.kind === "cancel") return { version: 1, orderId: action.orderId, intent: JSON.stringify(action), rpc: "cancel_purchase_order_atomic",
    args: { p_organization_id: org, p_purchase_order_id: action.orderId } };
  const lines = [...action.lines].sort((a, b) => a.productId.localeCompare(b.productId));
  const receiptLines = lines.map(input => {
    const line = action.order.lines.find(line => line.productId === input.productId);
    if (!line?.id) throw new Error("Reload this purchase order to obtain its stable receipt lines before receiving.");
    return { line_id: line.id, qty: input.qtyReceived, expected_received: line.qtyReceived };
  });
  return { version: 1, orderId: action.order.id, intent: JSON.stringify({ kind: "receive", orderId: action.order.id, lines }), rpc: "receive_purchase_order_atomic",
    args: { p_organization_id: org, p_purchase_order_id: action.order.id, p_receipt_id: crypto.randomUUID(), p_lines: receiptLines } };
}

type Row = Record<string, unknown>;
function record(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid purchasing response. Retry checking the pending action.");
  return value as Row;
}
function number(value: unknown): number {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) throw new Error("Invalid quantity in purchasing response. Retry checking the pending action.");
  return n;
}
function snapshotFromResponse(value: unknown, org: string, orderId: string): Snapshot {
  const raw = record(value); const po = record(raw.order);
  if (po.organization_id !== org || po.id !== orderId || !Array.isArray(raw.lines) || !Array.isArray(raw.products) || !Array.isArray(raw.logs)
    || !["pending", "partial", "received", "cancelled"].includes(String(po.status))) throw new Error("Purchasing response does not match this organization and order.");
  const scoped = (value: unknown) => { const row = record(value); if (row.organization_id !== org) throw new Error("Purchasing response has invalid organization ownership."); return row; };
  return {
    order: { id: orderId, poNo: String(po.po_no), date: String(po.order_date), supplierId: String(po.supplier_id ?? ""), supplierName: String(po.supplier_name),
      expectedTotal: number(po.expected_total), status: po.status as PurchaseOrder["status"], relatedJobId: po.related_job_id ? String(po.related_job_id) : undefined,
      note: po.note ? String(po.note) : undefined, receivedDate: po.received_date ? String(po.received_date) : undefined,
      lines: raw.lines.map(value => { const line = scoped(value); if (line.purchase_order_id !== orderId || !line.id) throw new Error("Invalid purchase line identity.");
        return { id: String(line.id), productId: String(line.product_id), productName: String(line.product_name), qtyOrdered: number(line.qty_ordered), qtyReceived: number(line.qty_received), unitCost: number(line.unit_cost) }; }) },
    products: raw.products.map(value => { const row = scoped(value); return { id: String(row.id), stockQty: number(row.stock_qty), buyPrice: number(row.buy_price) }; }),
    logs: raw.logs.map(value => { const row = scoped(value); return { id: String(row.id), productId: String(row.product_id), productName: String(row.product_name),
      type: "purchase", qty: number(row.qty), note: row.note ? String(row.note) : undefined, date: String(row.log_date), relatedSupplierId: row.related_supplier_id ? String(row.related_supplier_id) : undefined,
      userId: row.user_id ? String(row.user_id) : undefined }; }),
  };
}

export function mergePurchaseSnapshot(data: AppData, snapshot: Snapshot): AppData {
  const products = new Map(snapshot.products.map(row => [row.id, row]));
  const logs = new Map(data.stockLogs.map(row => [row.id, row]));
  for (const row of snapshot.logs) logs.set(row.id, row);
  return { ...data, purchaseOrders: [snapshot.order, ...data.purchaseOrders.filter(row => row.id !== snapshot.order.id)],
    products: data.products.map(product => ({ ...product, ...products.get(product.id) })), stockLogs: [...logs.values()].sort((a, b) => b.date.localeCompare(a.date)) };
}

export async function performPurchaseAction(org: string, user: string, action: Action): Promise<PurchaseActionResult> {
  const execute = async (): Promise<PurchaseActionResult> => {
    try {
      const existing = pending(org, user);
      const authority = await purchaseAuthority(org);
      if (authority.error) return { handled: true, error: authority.error };
      if (!authority.enabled) return existing || action.kind === "resume"
        ? { handled: true, error: "Atomic purchasing is disabled. The pending request is preserved for review." } : { handled: false };
      if (!navigator.locks) return { handled: true, error: "This browser cannot safely coordinate purchasing tabs. Use an updated browser to continue." };
      const command = action.kind === "resume" ? existing : existing ?? prepare(action, org);
      if (!command) return { handled: true, error: "There is no pending purchase action." };
      if (existing && action.kind !== "resume") {
        const intended = prepare(action, org).intent;
        if (existing.intent !== intended) return { handled: true, error: "Check the pending purchase action before changing its quantities or starting another order." };
      }
      if (command.args.p_organization_id !== org) throw new Error("Pending request belongs to a different organization.");
      // Persist before the first mutation; failed storage must never send it.
      window.localStorage.setItem(key(org, user), JSON.stringify(command));
      const db = createBrowserClient();
      if (!db) throw new Error("Cloud not connected");
      const result = await db.rpc(command.rpc, command.args);
      if (result.error) {
        // These database errors guarantee this transaction failed. Unknown
        // transport outcomes retain the exact command for a safe replay.
        if (/^(P0001|22\w{3}|23\w{3}|42501)$/.test(result.error.code ?? "")) window.localStorage.removeItem(key(org, user));
        return { handled: true, error: result.error.message };
      }
      const refreshed = await db.rpc("get_purchase_order_authority_snapshot", { p_organization_id: org, p_purchase_order_id: command.orderId });
      if (refreshed.error) return { handled: true, error: `Saved on the server; checking the purchase order failed. Check the pending action again. ${refreshed.error.message}` };
      const snapshot = snapshotFromResponse(refreshed.data, org, command.orderId);
      return { handled: true, snapshot, acknowledge: () => window.localStorage.removeItem(key(org, user)) };
    } catch (error) { return { handled: true, error: error instanceof Error ? error.message : "Purchasing failed. Check the pending action before retrying." }; }
  };
  // Web Locks serialize this storage record across tabs, including flag reads.
  return navigator.locks ? navigator.locks.request(key(org, user), execute) : execute();
}
