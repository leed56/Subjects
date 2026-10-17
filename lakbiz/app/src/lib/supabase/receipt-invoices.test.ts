import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoicePending, loadInvoiceWorkspace, saveReceiptInvoice, validateReceiptInvoice, type ReceiptInvoiceInput } from "./receipt-invoices";

const state = vi.hoisted(() => ({ user: "owner", error: null as null | { code?: string; message: string }, failRefresh: false, failStorage: false, foreign: false, calls: [] as Record<string, unknown>[], saved: "", count: 0 }));
vi.mock("./client", () => ({ createBrowserClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: state.user } }, error: null }) },
  from: (table: string) => {
    const builder = { select: (columns: string) => { if (table === "purchase_order_receipts" && (!columns.includes("received_at") || columns.includes("created_at"))) throw Error("Receipt timestamp does not match the prepared schema"); return builder; }, eq: () => builder, order: (column: string) => { if (table === "purchase_order_receipts" && column !== "received_at") throw Error("Invalid receipt sort column"); return builder; },
      maybeSingle: async () => ({ data: { enabled: true }, error: null }),
      limit: async () => ({ error: state.failRefresh ? { message: "Refresh failed" } : null, data: table === "purchase_receipt_invoices" && state.saved ? Array.from({ length: state.count || 1 }, () => ({ organization_id: state.foreign ? "other" : "org", id: state.saved, total_minor: 1200 })) : [] }) };
    return builder;
  },
  rpc: async (_rpc: string, args: Record<string, unknown>) => { state.calls.push(args); if (!state.error) state.saved = String(args.p_invoice_id); return { data: null, error: state.error }; },
}) }));
const storage = new Map<string, string>();
const input: ReceiptInvoiceInput = { receiptIds: ["receipt"], number: " INV-001 ", date: "2026-10-16", vat: 2, lines: [{ receipt_id: "receipt", line_id: "line", unit_cost: 10 }] };
beforeEach(() => {
  storage.clear(); Object.assign(state, { user: "owner", error: null, failRefresh: false, failStorage: false, foreign: false, calls: [], saved: "", count: 0 });
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { if (state.failStorage) throw Error("Storage full"); storage.set(key, value); }, removeItem: (key: string) => storage.delete(key) } });
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, execute: () => unknown) => execute() } });
});
describe("delivery-linked invoice recovery", () => {
  it("sends server-derived receipt identities and acknowledges only after history confirms the invoice", async () => {
    await saveReceiptInvoice("org", "owner", input);
    expect(state.calls[0]).toMatchObject({ p_supplier_invoice_no: "INV-001", p_receipt_ids: ["receipt"], p_lines: input.lines });
    expect(invoicePending("org", "owner")).toBe(false);
  });
  it("replays the identical request after an uncertain response", async () => {
    state.error = { message: "Connection lost" };
    await expect(saveReceiptInvoice("org", "owner", input)).rejects.toThrow("Connection lost");
    expect(invoicePending("org", "owner")).toBe(true);
    state.error = null; await saveReceiptInvoice("org", "owner");
    expect(state.calls[1]).toEqual(state.calls[0]);
  });
  it("retains the request after a committed save and failed history reload", async () => {
    state.failRefresh = true; await expect(saveReceiptInvoice("org", "owner", input)).rejects.toThrow("Refresh failed");
    expect(invoicePending("org", "owner")).toBe(true);
    state.failRefresh = false; await saveReceiptInvoice("org", "owner"); expect(state.calls[1]).toEqual(state.calls[0]);
  });
  it("blocks a different invoice while one is uncertain", async () => {
    state.error = { message: "Offline" }; await expect(saveReceiptInvoice("org", "owner", input)).rejects.toThrow();
    await expect(saveReceiptInvoice("org", "owner", { ...input, number: "different" })).rejects.toThrow("pending"); expect(state.calls).toHaveLength(1);
  });
  it("sends nothing without durable storage or with a changed user", async () => {
    state.failStorage = true; await expect(saveReceiptInvoice("org", "owner", input)).rejects.toThrow("Storage full");
    state.failStorage = false; state.user = "other"; await expect(saveReceiptInvoice("org", "owner", input)).rejects.toThrow("sign-in changed"); expect(state.calls).toHaveLength(0);
  });
  it("releases definitively rejected commands so a preserved draft can be corrected", async () => {
    state.error = { code: "P0001", message: "Already billed" }; await expect(saveReceiptInvoice("org", "owner", input)).rejects.toThrow("Already billed"); expect(invoicePending("org", "owner")).toBe(false);
  });
  it("refuses foreign-company history and incomplete result windows", async () => {
    state.saved = "invoice"; state.foreign = true; await expect(loadInvoiceWorkspace("org")).rejects.toThrow("another company");
    state.foreign = false; state.count = 201; await expect(loadInvoiceWorkspace("org")).rejects.toThrow("narrower history");
  });
  it("rejects invalid dates, duplicate identities and fractional minor-unit prices", () => {
    expect(validateReceiptInvoice(input)).toBeNull();
    expect(validateReceiptInvoice({ ...input, date: "2026-02-30" })).toMatch(/date/);
    expect(validateReceiptInvoice({ ...input, receiptIds: ["receipt", "receipt"] })).toMatch(/different/);
    expect(validateReceiptInvoice({ ...input, lines: [...input.lines, ...input.lines] })).toMatch(/one invoice rate/);
    expect(validateReceiptInvoice({ ...input, vat: NaN })).toMatch(/VAT/);
    expect(validateReceiptInvoice({ ...input, lines: [{ ...input.lines[0], unit_cost: 0.001 }] })).toMatch(/rate/);
  });
});
