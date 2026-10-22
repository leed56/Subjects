import { createBrowserClient } from "./client";
import { snapshotFromResponse, type PurchaseSnapshot } from "./purchase-authority";

export type ShipmentAction = "save" | "dispatch" | "land" | "cancel" | "close_short";
export type ShipmentCommand = { shipmentId: string; version: number; action: ShipmentAction; input: Record<string, unknown> };
export type ShipmentDocument = { name: string; kind: "invoice" | "packing_list" | "bill_of_lading" | "customs" | "other"; url: string };
export type ShipmentSnapshot = { organization_id: string; shipment: { id: string; organization_id: string; purchase_order_id: string; status: string; version: number; reference?: string; currency?: string; exchange_rate?: number; allocation_basis?: string; charges?: Record<string, number>; documents?: ShipmentDocument[]; note?: string }; lines: unknown[]; receipts: unknown[] };
const key = (org: string, user: string) => `lakbiz:shipment-command:${org}:${user}`;
function client() { const db = createBrowserClient(); if (!db) throw Error("Connect to LakBiz cloud to manage shipments."); return db; }
async function userId() { const result = await client().auth.getUser(); if (result.error || !result.data.user) throw Error("Sign in again before managing shipments."); return result.data.user.id; }
export function shipmentPending(org: string, user: string) { return window.localStorage.getItem(key(org, user)) !== null; }
export function shipmentPendingAction(org: string, user: string): string | null {
  const raw = window.localStorage.getItem(key(org, user));
  if (!raw) return null;
  const command = JSON.parse(raw);
  if (command.version !== 1 || command.user !== user || command.args?.p_organization_id !== org || typeof command.args?.p_action !== "string") throw Error("The pending shipment change needs review. Keep this browser data.");
  return command.args.p_action;
}

export type ShipmentListItem = { id: string; organization_id: string; purchase_order_id: string; reference: string; status: string; version: number; currency: string; created_at: string };
export async function listShipments(org: string, page = 0): Promise<{ items: ShipmentListItem[]; hasMore: boolean }> {
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw Error("Invalid shipment history page.");
  const user = await userId();
  const result = await client().from("purchase_shipments").select("id,organization_id,purchase_order_id,reference,status,version,currency,created_at").eq("organization_id", org).order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * 50, page * 50 + 50);
  if (result.error) throw Error(result.error.message);
  const rows = result.data ?? [];
  if (rows.some(row => row.organization_id !== org || !row.id || !row.purchase_order_id || !Number.isSafeInteger(Number(row.version)))) throw Error("Shipment list does not match this company.");
  if (await userId() !== user) throw Error("Your sign-in changed. Reload shipments.");
  return { items: rows.slice(0, 50) as ShipmentListItem[], hasMore: rows.length > 50 };
}

export async function loadShipment(org: string, shipmentId: string): Promise<ShipmentSnapshot> {
  const user = await userId();
  const response = await client().rpc("get_purchase_shipment", { p_organization_id: org, p_shipment_id: shipmentId });
  if (response.error) throw Error(response.error.message);
  const value = response.data;
  if (!value || value.organization_id !== org || value.shipment?.organization_id !== org || value.shipment?.id !== shipmentId || !Number.isSafeInteger(Number(value.shipment?.version)) || !Array.isArray(value.lines) || !Array.isArray(value.receipts)) throw Error("Shipment response does not match this company and shipment.");
  if (await userId() !== user) throw Error("Your sign-in changed. Reload the shipment.");
  return value as ShipmentSnapshot;
}

/** Receipt commands require stock refresh and are deliberately handled separately. */
export async function saveShipmentCommand(org: string, user: string, input?: ShipmentCommand): Promise<ShipmentSnapshot> {
  if (!navigator.locks) throw Error("Use an updated browser to coordinate shipment changes safely.");
  const storageKey = key(org, user);
  return navigator.locks.request(storageKey, async () => {
    if (await userId() !== user) throw Error("Your sign-in changed. Reload the shipment.");
    const raw = window.localStorage.getItem(storageKey);
    if (raw && input) throw Error("Check the pending shipment change before starting another.");
    let args: Record<string, unknown>;
    if (raw) {
      const command = JSON.parse(raw);
      if (command.version !== 1 || command.user !== user || command.args?.p_organization_id !== org || !command.args.p_command_id || !command.args.p_shipment_id || !["save", "dispatch", "land", "cancel", "close_short"].includes(command.args.p_action)) throw Error("The pending shipment change needs review. Keep this browser data.");
      args = command.args;
    } else {
      if (!input || !input.shipmentId || !Number.isSafeInteger(input.version) || input.version < 0 || !["save", "dispatch", "land", "cancel", "close_short"].includes(input.action) || !input.input || Array.isArray(input.input)) throw Error("Enter a valid shipment change.");
      args = { p_organization_id: org, p_command_id: crypto.randomUUID(), p_shipment_id: input.shipmentId, p_expected_version: input.version, p_action: input.action, p_input: input.input };
    }
    const stored = JSON.stringify({ version: 1, user, args });
    window.localStorage.setItem(storageKey, stored);
    const response = await client().rpc("purchase_shipment_command", args);
    if (response.error) { if (/^(P0001|22\w{3}|23\w{3}|42501)$/.test(response.error.code ?? "")) window.localStorage.removeItem(storageKey); throw Error(response.error.message); }
    const next = await loadShipment(org, String(args.p_shipment_id));
    if (await userId() !== user || next.shipment.version <= Number(args.p_expected_version)) throw Error("The shipment may be updated. Check the pending change again before continuing.");
    if (window.localStorage.getItem(storageKey) === stored) window.localStorage.removeItem(storageKey);
    return next;
  });
}

export type ShipmentReceiptInput = { shipmentId: string; orderId: string; version: number; lines: Record<string, unknown>[] };
export type ShipmentReceiptResult = { shipment: ShipmentSnapshot; purchase: PurchaseSnapshot; acknowledge: () => void };

/** The caller must save the returned purchase snapshot locally before acknowledgment. */
export async function receiveShipment(org: string, user: string, input?: ShipmentReceiptInput): Promise<ShipmentReceiptResult> {
  if (!navigator.locks) throw Error("Use an updated browser to coordinate shipment receiving safely.");
  const storageKey = key(org, user);
  return navigator.locks.request(storageKey, async () => {
    if (await userId() !== user) throw Error("Your sign-in changed. Reload the shipment.");
    const raw = window.localStorage.getItem(storageKey);
    if (raw && input) throw Error("Check the pending shipment change before receiving another delivery.");
    let args: Record<string, unknown>; let orderId: string;
    if (raw) {
      const command = JSON.parse(raw);
      if (command.version !== 1 || command.user !== user || command.args?.p_organization_id !== org || command.args.p_action !== "receive" || !command.args.p_command_id || !command.args.p_shipment_id || !command.orderId) throw Error("The pending shipment change needs review. Keep this browser data.");
      args = command.args; orderId = command.orderId;
    } else {
      if (!input?.shipmentId || !input.orderId || !Number.isSafeInteger(input.version) || input.version < 1 || !Array.isArray(input.lines) || !input.lines.length) throw Error("Choose a shipment and the lines being received.");
      const current = await loadShipment(org, input.shipmentId);
      if (current.shipment.purchase_order_id !== input.orderId || current.shipment.version !== input.version || current.shipment.status !== "landed") throw Error("Shipment details changed. Reload before receiving this delivery.");
      orderId = input.orderId;
      args = { p_organization_id: org, p_command_id: crypto.randomUUID(), p_shipment_id: input.shipmentId, p_expected_version: input.version, p_action: "receive", p_input: { lines: input.lines } };
    }
    const stored = JSON.stringify({ version: 1, user, orderId, args });
    window.localStorage.setItem(storageKey, stored);
    const db = client(); const result = await db.rpc("purchase_shipment_command", args);
    if (result.error) { if (/^(P0001|22\w{3}|23\w{3}|42501)$/.test(result.error.code ?? "")) window.localStorage.removeItem(storageKey); throw Error(result.error.message); }
    const shipment = await loadShipment(org, String(args.p_shipment_id));
    const refreshed = await db.rpc("get_purchase_order_authority_snapshot", { p_organization_id: org, p_purchase_order_id: orderId });
    if (refreshed.error) throw Error(`Shipment may be received. Check the pending delivery again. ${refreshed.error.message}`);
    const purchase = snapshotFromResponse(refreshed.data, org, orderId);
    if (await userId() !== user || shipment.shipment.version <= Number(args.p_expected_version) || shipment.shipment.purchase_order_id !== orderId) throw Error("The delivery may be received. Check the pending shipment again before continuing.");
    return { shipment, purchase, acknowledge: () => { if (window.localStorage.getItem(storageKey) === stored) window.localStorage.removeItem(storageKey); } };
  });
}
