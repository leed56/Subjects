import { beforeEach, describe, expect, it, vi } from "vitest";
import { bankSettlementPending, cashSettlementPending, legacySupplierWriteError, loadInvoiceSettlement, loadSupplierStatement, saveInvoiceBankSettlement, saveInvoiceCashSettlement } from "./invoice-settlements";
const state = vi.hoisted(() => ({ user: "owner", error: null as null | { code?: string; message: string }, refreshError: false, confirmError: false, foreign: false, storageFail: false, enabled: true, flagError: null as null | { code?: string; message: string }, statementError: null as null | { code?: string; message: string }, calls: [] as { name: string; args: Record<string, unknown> }[], saved: "" }));
vi.mock("./client", () => ({ createBrowserClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: state.user } }, error: null }) },
  from: (table: string) => { let invoice = ""; const builder = { select: () => builder, eq: (column: string, value: unknown) => { if (column === "id") invoice = String(value); return builder; }, maybeSingle: async () => table === "purchase_invoice_settings" ? { data: { enabled: state.enabled }, error: state.flagError } : { data: state.confirmError ? null : { id: invoice, invoice_id: "invoice", account_id: "account" }, error: null } }; return builder; },
  rpc: async (name: string, args: Record<string, unknown>) => {
    state.calls.push({ name, args });
    if (name === "settle_purchase_invoice_cash_atomic" || name === "settle_purchase_invoice_bank_atomic") { state.saved = String(args.p_settlement_id); return { data: null, error: state.error }; }
    if (name === "get_purchase_invoice_bank_settlement_snapshot") return { error: null, data: { organization_id: "org", settlement_id: args.p_settlement_id, invoice_id: "invoice", account: { organization_id: "org", id: "account" }, transaction: { organization_id: "org", id: `purchase-bank:${args.p_settlement_id}` }, supplier: { organization_id: "org", id: "supplier", payable_balance: 90 } } };
    if (name === "get_purchase_supplier_statement") return { error: state.statementError, data: { organization_id: state.foreign ? "other" : "org", supplier_id: args.p_supplier_id, payable_balance: 90, opening_minor: 0, page: args.p_page, count: 1, entries: [{ identity: "invoice:invoice", date: "2026-10-17", label: "Invoice", amount_minor: 10000, balance_minor: 10000 }] } };
    return { error: state.refreshError ? { message: "Refresh failed" } : null, data: { organization_id: state.foreign ? "other" : "org", invoice_id: args.p_invoice_id, number: "INV-1", invoice_date: "2026-10-16", total_minor: 10000, paid_minor: 1000, payable_balance: 90, payments: state.saved ? [{ id: state.saved, amount_minor: 1000, payment_date: "2026-10-17", note: "Receipt 1" }] : [] } };
  },
}) }));
const storage = new Map<string, string>();
const input = { invoiceId: "invoice", amount: 10, date: "2026-10-17", note: " Receipt 1 " };
beforeEach(() => {
  storage.clear(); Object.assign(state, { user: "owner", error: null, refreshError: false, confirmError: false, foreign: false, storageFail: false, enabled: true, flagError: null, statementError: null, calls: [], saved: "" });
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { if (state.storageFail) throw Error("Storage full"); storage.set(key, value); }, removeItem: (key: string) => storage.delete(key) } });
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, execute: () => unknown) => execute() } });
});
describe("invoice cash settlement recovery and statements", () => {
  it("replays the identical bank payment after a lost response and confirms its account before acknowledgment", async () => {
    const bank = { ...input, accountId: "account", exchangeRate: 300, fee: 2 };
    state.error = { message: "Connection lost" };
    await expect(saveInvoiceBankSettlement("org", "owner", bank)).rejects.toThrow("Connection lost");
    expect(bankSettlementPending("org", "owner")).toBe(true);
    state.error = null; state.confirmError = true;
    await expect(saveInvoiceBankSettlement("org", "owner")).rejects.toThrow("may be saved");
    expect(bankSettlementPending("org", "owner")).toBe(true);
    state.confirmError = false; const result = await saveInvoiceBankSettlement("org", "owner");
    const calls = state.calls.filter(call => call.name === "settle_purchase_invoice_bank_atomic");
    expect(calls).toHaveLength(3); expect(calls[1].args).toEqual(calls[0].args); expect(calls[2].args).toEqual(calls[0].args);
    expect(bankSettlementPending("org", "owner")).toBe(true); result.acknowledge(); expect(bankSettlementPending("org", "owner")).toBe(false);
  });
  it("rejects an invalid bank exchange rate before saving", async () => {
    await expect(saveInvoiceBankSettlement("org", "owner", { ...input, accountId: "account", exchangeRate: 0, fee: 0 })).rejects.toThrow("exchange rate");
    expect(state.calls).toHaveLength(0);
  });
  it("confirms a posted payment before acknowledging its durable command", async () => { const result = await saveInvoiceCashSettlement("org", "owner", input); expect(result.paid_minor).toBe(1000); expect(cashSettlementPending("org", "owner")).toBe(false); expect(state.calls[0].args).toMatchObject({ p_amount: 10, p_note: "Receipt 1" }); });
  it("replays the original cash command after an unknown result", async () => { state.error = { message: "Connection lost" }; await expect(saveInvoiceCashSettlement("org", "owner", input)).rejects.toThrow(); state.error = null; await saveInvoiceCashSettlement("org", "owner"); expect(state.calls[1].args).toEqual(state.calls[0].args); });
  it("retains the payment key after refresh or confirmation failure", async () => { state.refreshError = true; await expect(saveInvoiceCashSettlement("org", "owner", input)).rejects.toThrow(); expect(cashSettlementPending("org", "owner")).toBe(true); state.refreshError = false; state.confirmError = true; await expect(saveInvoiceCashSettlement("org", "owner")).rejects.toThrow("may be saved"); expect(cashSettlementPending("org", "owner")).toBe(true); });
  it("blocks changing an unresolved payment and releases definite rejection", async () => { state.error = { message: "Offline" }; await expect(saveInvoiceCashSettlement("org", "owner", input)).rejects.toThrow(); await expect(saveInvoiceCashSettlement("org", "owner", { ...input, amount: 11 })).rejects.toThrow("pending"); state.error = { code: "P0001", message: "Overpayment" }; await expect(saveInvoiceCashSettlement("org", "owner")).rejects.toThrow("Overpayment"); expect(cashSettlementPending("org", "owner")).toBe(false); });
  it("sends no mutation without storage or after user change", async () => { state.storageFail = true; await expect(saveInvoiceCashSettlement("org", "owner", input)).rejects.toThrow("Storage full"); state.storageFail = false; state.user = "other"; await expect(saveInvoiceCashSettlement("org", "owner", input)).rejects.toThrow("sign-in changed"); expect(state.calls).toHaveLength(0); });
  it("rejects invalid money and impossible dates before submission", async () => { for (const amount of [0, -1, NaN, Infinity, 0.001]) await expect(saveInvoiceCashSettlement("org", "owner", { ...input, amount })).rejects.toThrow(); await expect(saveInvoiceCashSettlement("org", "owner", { ...input, date: "2026-02-30" })).rejects.toThrow("valid date"); expect(state.calls).toHaveLength(0); });
  it("rejects foreign company financial responses", async () => { state.foreign = true; await expect(loadInvoiceSettlement("org", "invoice")).rejects.toThrow("company"); await expect(loadSupplierStatement("org", "supplier")).rejects.toThrow("company"); });
  it("keeps supplier statement pages and reconciled balances server-derived", async () => { expect(await loadSupplierStatement("org", "supplier", 2)).toMatchObject({ page: 2, payable_balance: 90 }); expect(state.calls[0].args.p_page).toBe(2); });
  it("falls back only for missing schema or a disabled-company missing statement RPC", async () => { state.flagError = { code: "PGRST205", message: "Missing schema" }; expect(await loadSupplierStatement("org", "supplier")).toBeNull(); state.flagError = null; state.enabled = false; state.statementError = { code: "PGRST202", message: "Missing function" }; expect(await loadSupplierStatement("org", "supplier")).toBeNull(); state.enabled = true; await expect(loadSupplierStatement("org", "supplier")).rejects.toThrow("Missing function"); });
  it("fails closed for authority errors and blocks legacy writes only when enabled", async () => { expect(await legacySupplierWriteError("org")).toMatch(/Legacy GRNs/); state.enabled = false; expect(await legacySupplierWriteError("org")).toBeNull(); state.flagError = { message: "Network error" }; expect(await legacySupplierWriteError("org")).toBe("Network error"); });
});
