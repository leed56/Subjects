import { createBrowserClient } from "./client";

export type Receipt = { organization_id: string; receipt_id: string; purchase_order_id: string; received_at: string; request_lines: { line_id: string; qty: number }[] };
export type ReceiptInvoice = { organization_id: string; id: string; supplier_id: string; supplier_invoice_no: string; invoice_date: string; currency: string; subtotal_minor: number; input_vat_minor: number; total_minor: number; foreign_total_minor?: number; recognition_rate?: number };
export type InvoiceWorkspace = { organizationId: string; userId: string; enabled: boolean; receipts: Receipt[]; invoices: ReceiptInvoice[]; billed: string[]; page?: number; receiptPage?: number; invoiceCount?: number; receiptCount?: number; orderId?: string | null };
export type InvoiceWorkspaceView = { orderId?: string; page?: number; receiptPage?: number };
export type ReceiptInvoiceInput = { receiptIds: string[]; number: string; date: string; vat: number; currency?: string; exchangeRate?: number; lines: { receipt_id: string; line_id: string; unit_cost: number }[] };
type Command = { version: 1; org: string; user: string; args: Record<string, unknown> };
const key = (org: string, user: string) => `lakbiz:receipt-invoice:${org}:${user}`;
function client() { const db = createBrowserClient(); if (!db) throw Error("Connect to LakBiz cloud to review supplier invoices."); return db; }
async function identity() { const db = client(); const result = await db.auth.getUser(); if (result.error || !result.data.user) throw Error("Sign in again to review supplier invoices."); return result.data.user.id; }
export function invoicePending(org: string, user: string) { return window.localStorage.getItem(key(org, user)) !== null; }

export async function loadInvoiceWorkspace(org: string, view: InvoiceWorkspaceView = {}): Promise<InvoiceWorkspace> {
  const db = client(); const userId = await identity();
  const flag = await db.from("purchase_invoice_settings").select("enabled").eq("organization_id", org).maybeSingle();
  if (flag.error) throw Error(["42P01", "PGRST205"].includes(flag.error.code) ? "Supplier invoice upgrade is awaiting installation." : flag.error.message);
  const workspace = await db.rpc("get_purchase_invoice_workspace", { p_organization_id: org, p_purchase_order_id: view.orderId || null, p_page: view.page ?? 0, p_receipt_page: view.receiptPage ?? 0 });
  if (!workspace.error) {
    const value = workspace.data;
    if (!value || value.organizationId !== org || value.page !== (view.page ?? 0) || value.receiptPage !== (view.receiptPage ?? 0) || value.orderId !== (view.orderId || null) || !Array.isArray(value.receipts) || !Array.isArray(value.invoices) || !Array.isArray(value.billed)
      || !Number.isSafeInteger(Number(value.invoiceCount)) || Number(value.invoiceCount) < 0 || !Number.isSafeInteger(Number(value.receiptCount)) || Number(value.receiptCount) < 0) throw Error("Invoice history response does not match this company and page.");
    if ([...value.receipts, ...value.invoices].some(row => row.organization_id !== org)) throw Error("Invoice response belongs to another company.");
    if (await identity() !== userId) throw Error("Your sign-in changed while loading invoices. Reload this workspace.");
    return { ...value, userId } as InvoiceWorkspace;
  }
  if (workspace.error.code !== "PGRST202" || flag.data?.enabled) throw Error(workspace.error.message);
  const [receipts, invoices, allocations] = await Promise.all([
    db.from("purchase_order_receipts").select("organization_id,receipt_id,purchase_order_id,received_at,request_lines").eq("organization_id", org).order("received_at", { ascending: false }).limit(201),
    db.from("purchase_receipt_invoices").select("organization_id,id,supplier_id,supplier_invoice_no,invoice_date,currency,subtotal_minor,input_vat_minor,total_minor").eq("organization_id", org).order("created_at", { ascending: false }).limit(201),
    db.from("purchase_invoice_receipts").select("organization_id,receipt_id").eq("organization_id", org).limit(4001),
  ]);
  for (const result of [receipts, invoices, allocations]) if (result.error) throw Error(result.error.message);
  if ((receipts.data?.length ?? 0) > 200 || (invoices.data?.length ?? 0) > 200 || (allocations.data?.length ?? 0) > 4000) throw Error("This workspace needs a narrower history window before billing. No records were changed.");
  for (const row of [...receipts.data ?? [], ...invoices.data ?? [], ...allocations.data ?? []]) if (row.organization_id !== org) throw Error("Invoice response belongs to another company.");
  if (await identity() !== userId) throw Error("Your sign-in changed while loading invoices. Reload this workspace.");
  return { organizationId: org, userId, enabled: flag.data?.enabled === true, receipts: receipts.data as Receipt[], invoices: invoices.data as ReceiptInvoice[], billed: (allocations.data ?? []).map(row => String(row.receipt_id)) };
}

export function validateReceiptInvoice(input: ReceiptInvoiceInput): string | null {
  const currency = input.currency ?? "LKR";
  if (!["LKR", "USD", "EUR", "GBP", "INR", "AED", "CNY"].includes(currency)) return "Choose a supported invoice currency.";
  if (currency !== "LKR" && (!Number.isFinite(input.exchangeRate) || !input.exchangeRate || input.exchangeRate <= 0 || Math.abs(input.exchangeRate * 1_000_000 - Math.round(input.exchangeRate * 1_000_000)) > 0.000001 || !Number.isSafeInteger(Math.round(input.exchangeRate * 1_000_000)))) return "Enter a positive exchange rate with at most six decimals.";
  if (currency !== "LKR" && input.vat !== 0) return "Record local import VAT with the shipment, separate from a foreign invoice.";
  if (!input.number.trim() || input.number.trim().length > 100) return "Enter the supplier invoice number (up to 100 characters).";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date) return "Enter a valid invoice date.";
  if (!Number.isSafeInteger(Math.round(input.vat * 100)) || input.vat < 0 || Math.abs(input.vat * 100 - Math.round(input.vat * 100)) > 0.000001) return "VAT must be a nonnegative amount with at most two decimals.";
  if (!input.receiptIds.length || input.receiptIds.length > 20 || new Set(input.receiptIds).size !== input.receiptIds.length) return "Select 1 to 20 different deliveries from one purchase order.";
  if (!input.lines.length || input.lines.length > 4000 || new Set(input.lines.map(line => `${line.receipt_id}:${line.line_id}`)).size !== input.lines.length) return "Each received line needs one invoice rate.";
  if (input.lines.some(line => !input.receiptIds.includes(line.receipt_id) || !line.line_id || !Number.isFinite(line.unit_cost) || line.unit_cost < 0 || !Number.isSafeInteger(Math.round(line.unit_cost * 100)) || Math.abs(line.unit_cost * 100 - Math.round(line.unit_cost * 100)) > 0.000001)) return "Enter a valid nonnegative rate with at most two decimals for every received line.";
  return null;
}

/** Unknown outcomes retain the exact request. A refresh must succeed before acknowledgment. */
export async function saveReceiptInvoice(org: string, user: string, input?: ReceiptInvoiceInput, view: InvoiceWorkspaceView = {}): Promise<InvoiceWorkspace> {
  if (!navigator.locks) throw Error("Use an updated browser that can coordinate invoice saves between tabs.");
  return navigator.locks.request(key(org, user), async () => {
    if (await identity() !== user) throw Error("Your sign-in changed. Reload this workspace before saving.");
    const db = client(); const storageKey = key(org, user); const raw = window.localStorage.getItem(storageKey);
    if (raw && input) throw Error("Check the pending invoice before starting or changing another bill.");
    let command: Command;
    if (raw) {
      command = JSON.parse(raw) as Command;
      if (command.version !== 1 || command.org !== org || command.user !== user || command.args?.p_organization_id !== org || !command.args.p_invoice_id) throw Error("The pending invoice needs review. Keep this browser data.");
    } else {
      if (!input) throw Error("No pending invoice was found.");
      const problem = validateReceiptInvoice(input); if (problem) throw Error(problem);
      command = { version: 1, org, user, args: { p_organization_id: org, p_invoice_id: crypto.randomUUID(), p_receipt_ids: [...input.receiptIds].sort(), p_supplier_invoice_no: input.number.trim(), p_invoice_date: input.date, p_input_vat: input.vat, p_lines: [...input.lines].sort((a, b) => `${a.receipt_id}:${a.line_id}`.localeCompare(`${b.receipt_id}:${b.line_id}`)), ...(input.currency && input.currency !== "LKR" ? { p_currency: input.currency, p_exchange_rate: input.exchangeRate } : {}) } };
    }
    window.localStorage.setItem(storageKey, JSON.stringify(command));
    const response = await db.rpc(command.args.p_currency ? "record_purchase_receipt_invoice_fx_atomic" : "record_purchase_receipt_invoice_atomic", command.args);
    if (response.error) {
      if (/^(P0001|22\w{3}|23\w{3}|42501)$/.test(response.error.code ?? "")) window.localStorage.removeItem(storageKey);
      throw Error(response.error.message);
    }
    const next = await loadInvoiceWorkspace(org, view);
    const confirmed = await db.from("purchase_receipt_invoices").select("id,organization_id").eq("organization_id", org).eq("id", command.args.p_invoice_id).maybeSingle();
    if (next.userId !== user || confirmed.error || confirmed.data?.id !== command.args.p_invoice_id || confirmed.data?.organization_id !== org) throw Error("The bill may be saved. Check the pending invoice again before continuing.");
    window.localStorage.removeItem(storageKey);
    return next;
  });
}
