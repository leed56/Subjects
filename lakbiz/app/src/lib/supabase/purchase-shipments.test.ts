import { beforeEach, expect, it, vi } from "vitest";
import { receiveShipment, saveShipmentCommand, shipmentPending } from "./purchase-shipments";

const state = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], error: false, refreshError: false, purchaseRefreshError: false, foreign: false }));
vi.mock("./client", () => ({ createBrowserClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) },
  rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === "purchase_shipment_command") { state.calls.push(args); return { error: state.error ? { message: "Connection lost" } : null }; }
    if (name === "get_purchase_order_authority_snapshot") return { error: state.purchaseRefreshError ? { message: "Refresh failed" } : null, data: { order: { organization_id: "org", id: "order", status: "partial", po_no: "PO-1", order_date: "2026-10-17", supplier_name: "Supplier", expected_total: 10 }, lines: [], products: [], logs: [] } };
    return { error: state.refreshError ? { message: "Refresh failed" } : null, data: { organization_id: state.foreign ? "other" : "org", shipment: { organization_id: "org", id: "shipment", purchase_order_id: "order", version: state.calls.length ? 2 : 1, status: state.calls.length ? "received" : "landed" }, lines: [], receipts: [] } };
  },
}) }));
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear(); Object.assign(state, { calls: [], error: false, refreshError: false, purchaseRefreshError: false, foreign: false });
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, run: () => unknown) => run() } });
});
it("replays an uncertain shipment command with the original key and version", async () => {
  state.error = true;
  await expect(saveShipmentCommand("org", "owner", { shipmentId: "shipment", version: 1, action: "dispatch", input: {} })).rejects.toThrow("Connection lost");
  expect(shipmentPending("org", "owner")).toBe(true);
  state.error = false; await saveShipmentCommand("org", "owner");
  expect(state.calls[1]).toEqual(state.calls[0]); expect(shipmentPending("org", "owner")).toBe(false);
});
it("retains a command when the refreshed shipment cannot be verified", async () => {
  state.foreign = true;
  await expect(saveShipmentCommand("org", "owner", { shipmentId: "shipment", version: 1, action: "land", input: {} })).rejects.toThrow("company");
  expect(shipmentPending("org", "owner")).toBe(true);
});
it("keeps shipment receipt pending until the refreshed purchase snapshot is saved", async () => {
  const result = await receiveShipment("org", "owner", { shipmentId: "shipment", orderId: "order", version: 1, lines: [{ line_id: "line", qty: 1, expected_received: 0 }] });
  expect(result.purchase.order.id).toBe("order"); expect(shipmentPending("org", "owner")).toBe(true);
  result.acknowledge(); expect(shipmentPending("org", "owner")).toBe(false);
});
it("replays shipment receiving after a missing stock refresh", async () => {
  state.purchaseRefreshError = true;
  await expect(receiveShipment("org", "owner", { shipmentId: "shipment", orderId: "order", version: 1, lines: [{ line_id: "line", qty: 1, expected_received: 0 }] })).rejects.toThrow("Refresh failed");
  state.purchaseRefreshError = false; const result = await receiveShipment("org", "owner");
  expect(state.calls[1]).toEqual(state.calls[0]); expect(shipmentPending("org", "owner")).toBe(true); result.acknowledge();
});
