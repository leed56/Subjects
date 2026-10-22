import { createBrowserClient } from "./client";

export type CashSettlementInput = { invoiceId: string; amount: number; date: string; note: string };
export type BankSettlementInput = { invoiceId: string; accountId: string; amount: number; exchangeRate: number; fee: number; date: string; note: string };
export type InvoiceSettlement = { organization_id: string; invoice_id: string; number: string; invoice_date: string; currency?: string; foreign_total_minor?: number; foreign_paid_minor?: number; total_minor: number; paid_minor: number; payable_balance: number; payments: { id: string; amount_minor: number; payment_date: string; note: string }[]; bank_payments?: { id: string; foreign_amount_minor: number; paid_minor: number; exchange_difference_minor: number; fee_minor: number; payment_date: string }[]; userId: string };
export type SupplierStatement = { organization_id: string; supplier_id: string; payable_balance: number; opening_minor: number; count: number; page: number; entries: { identity: string; date: string; label: string; amount_minor: number; balance_minor: number }[] };
const key = (org: string, user: string) => `lakbiz:invoice-cash:${org}:${user}`;
const bankKey = (org: string, user: string) => `lakbiz:invoice-bank:${org}:${user}`;
function client() { const db = createBrowserClient(); if (!db) throw Error("Cloud not connected"); return db; }
async function userId() { const result = await client().auth.getUser(); if (result.error || !result.data.user) throw Error("Sign in again before reviewing payments."); return result.data.user.id; }
function minor(value: unknown) { if (value == null || !Number.isSafeInteger(Number(value))) throw Error("Invalid financial amount in server response."); return Number(value); }
export function cashSettlementPending(org: string, user: string) { return window.localStorage.getItem(key(org, user)) !== null; }
export function bankSettlementPending(org: string, user: string) { return window.localStorage.getItem(bankKey(org, user)) !== null; }
export async function loadInvoiceSettlement(org: string, invoice: string): Promise<InvoiceSettlement> {
  const user = await userId(); const result = await client().rpc("get_purchase_invoice_settlement", { p_organization_id: org, p_invoice_id: invoice });
  if (result.error) throw Error(result.error.message);
  const value = result.data;
  if (!value || value.organization_id !== org || value.invoice_id !== invoice || !Array.isArray(value.payments)) throw Error("Invoice response does not match this company and bill.");
  value.total_minor = minor(value.total_minor); value.paid_minor = minor(value.paid_minor);
  if (value.foreign_total_minor != null) { value.foreign_total_minor = minor(value.foreign_total_minor); value.foreign_paid_minor = minor(value.foreign_paid_minor); if (value.foreign_paid_minor < 0 || value.foreign_paid_minor > value.foreign_total_minor) throw Error("Foreign invoice balance requires review."); }
  if (value.total_minor < 0 || value.paid_minor < 0 || value.paid_minor > value.total_minor || !Number.isFinite(Number(value.payable_balance))) throw Error("Invoice balance requires review.");
  for (const payment of value.payments) if (!payment.id || minor(payment.amount_minor) <= 0) throw Error("Invalid payment audit response.");
  if (await userId() !== user) throw Error("Your sign-in changed. Reload payments.");
  return { ...value, userId: user } as InvoiceSettlement;
}
export async function saveInvoiceCashSettlement(org: string, user: string, input?: CashSettlementInput): Promise<InvoiceSettlement> {
  if (!navigator.locks) throw Error("Use an updated browser to coordinate payment saves safely.");
  return navigator.locks.request(key(org, user), async () => {
    if (await userId() !== user) throw Error("Your sign-in changed. Reload payments.");
    const storageKey = key(org, user); const raw = window.localStorage.getItem(storageKey);
    if (raw && input) throw Error("Check the pending cash payment before entering another payment.");
    let args: Record<string, unknown>;
    if (raw) {
      const command = JSON.parse(raw);
      if (command.version !== 1 || command.user !== user || command.args?.p_organization_id !== org || !command.args.p_settlement_id || !command.args.p_invoice_id) throw Error("The pending payment needs review. Keep this browser data.");
      args = command.args;
    } else {
      if (!input?.invoiceId || !Number.isFinite(input.amount) || input.amount <= 0 || !Number.isSafeInteger(Math.round(input.amount * 100)) || Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.000001) throw Error("Enter a positive payment amount with at most two decimals.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date || input.note.trim().length > 500) throw Error("Enter a valid date and a note up to 500 characters.");
      args = { p_organization_id: org, p_settlement_id: crypto.randomUUID(), p_invoice_id: input.invoiceId, p_amount: input.amount, p_payment_date: input.date, p_note: input.note.trim() };
    }
    window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, user, args }));
    const result = await client().rpc("settle_purchase_invoice_cash_atomic", args);
    if (result.error) { if (/^(P0001|22\w{3}|23\w{3}|42501)$/.test(result.error.code ?? "")) window.localStorage.removeItem(storageKey); throw Error(result.error.message); }
    const next = await loadInvoiceSettlement(org, String(args.p_invoice_id));
    const confirmed = await client().from("purchase_invoice_cash_settlements").select("id,invoice_id").eq("organization_id", org).eq("id", args.p_settlement_id).maybeSingle();
    if (confirmed.error || confirmed.data?.id !== args.p_settlement_id || confirmed.data?.invoice_id !== args.p_invoice_id || next.userId !== user) throw Error("Payment may be saved. Check the pending payment again before continuing.");
    window.localStorage.removeItem(storageKey); return next;
  });
}

/** Records an already completed transfer. Unknown outcomes retain the same command. */
export type BankSettlementResult = { invoice: InvoiceSettlement; account: Record<string, unknown>; transaction: Record<string, unknown>; supplier: { id: string; organization_id: string; payable_balance: number }; acknowledge: () => void };
export async function saveInvoiceBankSettlement(org: string, user: string, input?: BankSettlementInput): Promise<BankSettlementResult> {
  if (!navigator.locks) throw Error("Use an updated browser to coordinate payment saves safely.");
  const storageKey = bankKey(org, user);
  return navigator.locks.request(storageKey, async () => {
    if (await userId() !== user) throw Error("Your sign-in changed. Reload payments.");
    const raw = window.localStorage.getItem(storageKey);
    if (raw && input) throw Error("Check the pending bank payment before entering another payment.");
    let args: Record<string, unknown>;
    if (raw) {
      const command = JSON.parse(raw);
      if (command.version !== 1 || command.user !== user || command.args?.p_organization_id !== org || !command.args.p_settlement_id || !command.args.p_invoice_id || !command.args.p_account_id) throw Error("The pending payment needs review. Keep this browser data.");
      args = command.args;
    } else {
      const decimal = (value: number, places: number) => Number.isFinite(value) && Number.isSafeInteger(Math.round(value * 10 ** places)) && Math.abs(value * 10 ** places - Math.round(value * 10 ** places)) < 0.000001;
      if (!input?.invoiceId || !input.accountId || !decimal(input.amount, 2) || input.amount <= 0 || !decimal(input.exchangeRate, 6) || input.exchangeRate <= 0 || !decimal(input.fee, 2) || input.fee < 0) throw Error("Enter an account, a positive amount and exchange rate, and a valid bank fee.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date || input.note.trim().length > 500) throw Error("Enter a valid date and a note up to 500 characters.");
      args = { p_organization_id: org, p_settlement_id: crypto.randomUUID(), p_invoice_id: input.invoiceId, p_account_id: input.accountId, p_foreign_amount: input.amount, p_exchange_rate: input.exchangeRate, p_fee: input.fee, p_payment_date: input.date, p_note: input.note.trim() };
    }
    window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, user, args }));
    const result = await client().rpc("settle_purchase_invoice_bank_atomic", args);
    if (result.error) { if (/^(P0001|22\w{3}|23\w{3}|42501)$/.test(result.error.code ?? "")) window.localStorage.removeItem(storageKey); throw Error(result.error.message); }
    const next = await loadInvoiceSettlement(org, String(args.p_invoice_id));
    const confirmed = await client().from("purchase_invoice_bank_settlements").select("id,invoice_id,account_id").eq("organization_id", org).eq("id", args.p_settlement_id).maybeSingle();
    if (confirmed.error || confirmed.data?.id !== args.p_settlement_id || confirmed.data?.invoice_id !== args.p_invoice_id || confirmed.data?.account_id !== args.p_account_id || next.userId !== user || await userId() !== user) throw Error("Payment may be saved. Check the pending payment again before continuing.");
    const refreshed = await client().rpc("get_purchase_invoice_bank_settlement_snapshot", { p_organization_id: org, p_settlement_id: args.p_settlement_id });
    const value = refreshed.data;
    if (refreshed.error || !value || value.organization_id !== org || value.settlement_id !== args.p_settlement_id || value.invoice_id !== args.p_invoice_id || value.account?.organization_id !== org || value.account?.id !== args.p_account_id || value.transaction?.organization_id !== org || value.transaction?.id !== `purchase-bank:${args.p_settlement_id}` || value.supplier?.organization_id !== org || !value.supplier?.id || value.supplier.payable_balance == null || !Number.isFinite(Number(value.supplier.payable_balance)) || await userId() !== user) throw Error("Payment may be saved. Check the pending payment again before continuing.");
    const stored = JSON.stringify({ version: 1, user, args });
    return { invoice: next, account: value.account, transaction: value.transaction, supplier: { ...value.supplier, payable_balance: Number(value.supplier.payable_balance) }, acknowledge: () => { if (window.localStorage.getItem(storageKey) === stored) window.localStorage.removeItem(storageKey); } };
  });
}
export async function loadSupplierStatement(org: string, supplier: string, page = 0): Promise<SupplierStatement | null> {
  const db = client(); const flag = await db.from("purchase_invoice_settings").select("enabled").eq("organization_id", org).maybeSingle();
  if (flag.error && ["42P01", "PGRST205"].includes(flag.error.code)) return null;
  if (flag.error) throw Error(flag.error.message);
  const response = await db.rpc("get_purchase_supplier_statement", { p_organization_id: org, p_supplier_id: supplier, p_page: page });
  if (response.error?.code === "PGRST202" && !flag.data?.enabled) return null;
  if (response.error) throw Error(response.error.message);
  const value = response.data;
  if (!value || value.organization_id !== org || value.supplier_id !== supplier || value.page !== page || !Array.isArray(value.entries) || !Number.isSafeInteger(Number(value.count)) || Number(value.count) < 0 || !Number.isFinite(Number(value.payable_balance))) throw Error("Statement response does not match this supplier and company.");
  minor(value.opening_minor); for (const entry of value.entries) { minor(entry.amount_minor); minor(entry.balance_minor); if (!entry.identity || !Number.isFinite(Date.parse(entry.date))) throw Error("Invalid supplier statement entry."); }
  return value as SupplierStatement;
}
/** Called before legacy optimistic stock/payable mutation, never after it. */
export async function legacySupplierWriteError(org: string): Promise<string | null> {
  const flag = await supplierInvoiceAuthority(org);
  return flag.error ?? (flag.enabled ? "Use delivery-linked invoices and their cash settlement controls. Legacy GRNs and unallocated supplier payments are unavailable while invoice authority is enabled." : null);
}
export async function supplierInvoiceAuthority(org: string): Promise<{ enabled: boolean; error: string | null }> {
  try {
    const flag = await client().from("purchase_invoice_settings").select("enabled").eq("organization_id", org).maybeSingle();
    if (flag.error && ["42P01", "PGRST205"].includes(flag.error.code)) return { enabled: false, error: null };
    return { enabled: flag.data?.enabled === true, error: flag.error?.message ?? null };
  } catch (failure) { return { enabled: false, error: failure instanceof Error ? failure.message : "Could not verify supplier payment authority." }; }
}
