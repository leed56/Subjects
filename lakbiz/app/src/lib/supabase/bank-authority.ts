import { createBrowserClient } from "./client";
import type { AppData } from "@/lib/store/types";

export type BankAction = "account_create" | "account_delete" | "transaction_create" | "transaction_reverse" | "transfer_create" | "cheque_create" | "cheque_status";
type Row = Record<string, unknown>;
export type BankSnapshot = { accounts: Row[]; transactions: Row[]; transfers: Row[]; cheques: Row[]; deleted_accounts: string[] };
const actions: BankAction[] = ["account_create", "account_delete", "transaction_create", "transaction_reverse", "transfer_create", "cheque_create", "cheque_status"];
const key = (org: string, user: string) => `lakbiz:bank-command:${org}:${user}`;
function client() { const db = createBrowserClient(); if (!db) throw Error("Connect to the cloud before changing banking records."); return db; }
async function identity() { const result = await client().auth.getUser(); if (result.error || !result.data.user) throw Error("Sign in again before changing banking records."); return result.data.user.id; }
export function hasPendingBankCommand(org: string, user: string): boolean { try { return window.localStorage.getItem(key(org, user)) !== null; } catch { return true; } }
function numeric(value: unknown): number { const result = Number(value); if (value == null || !Number.isFinite(result)) throw Error("Banking response contains an invalid amount."); return result; }
function text(value: unknown): string { if (typeof value !== "string" || !value) throw Error("Banking response contains a missing identity."); return value; }
function optional(value: unknown): string | undefined { return value == null ? undefined : String(value); }

export function mergeBankSnapshot(data: AppData, snapshot: BankSnapshot): AppData {
  const replace = <T extends { id: string }>(old: T[], rows: T[], deleted: string[] = []) => {
    const ids = new Set([...rows.map(row => row.id), ...deleted]);
    return [...rows, ...old.filter(row => !ids.has(row.id))];
  };
  const accounts = snapshot.accounts.map(row => ({ id: text(row.id), bankName: text(row.bank_name), branch: optional(row.branch), accountName: text(row.account_name), accountNumber: text(row.account_number), balance: numeric(row.balance) }));
  const transactions = snapshot.transactions.map(row => ({ id: text(row.id), accountId: text(row.account_id), type: text(row.type) as AppData["bankTransactions"][number]["type"], amount: numeric(row.amount), description: optional(row.description), reference: optional(row.reference), date: text(row.txn_date), reversedBy: optional(row.reversed_by) }));
  const transfers = snapshot.transfers.map(row => ({ id: text(row.id), fromAccountId: text(row.from_account_id), toAccountId: text(row.to_account_id), amount: numeric(row.amount), description: optional(row.description), date: text(row.transfer_date) }));
  const cheques = snapshot.cheques.map(row => ({ id: text(row.id), direction: text(row.direction) as AppData["cheques"][number]["direction"], chequeNo: text(row.cheque_no), bankName: text(row.bank_name), partyName: text(row.party_name), customerId: optional(row.customer_id), amount: numeric(row.amount), chequeDate: text(row.cheque_date), postDated: Boolean(row.post_dated), status: text(row.status) as AppData["cheques"][number]["status"], linkedSaleId: optional(row.linked_sale_id), bankAccountId: optional(row.bank_account_id), note: optional(row.note) }));
  return { ...data, bankAccounts: replace(data.bankAccounts, accounts, snapshot.deleted_accounts), bankTransactions: replace(data.bankTransactions, transactions), bankTransfers: replace(data.bankTransfers, transfers), cheques: replace(data.cheques, cheques) };
}

/** A command remains durable until its verified snapshot has been saved locally. */
export async function performBankCommand(org: string, user: string, action?: BankAction, input?: object): Promise<{ snapshot: BankSnapshot; acknowledge: () => void }> {
  if (!navigator.locks) throw Error("Use an updated browser to coordinate banking changes.");
  const storageKey = key(org, user);
  return navigator.locks.request(storageKey, async () => {
    if (await identity() !== user) throw Error("Your sign-in changed. Reopen banking.");
    const raw = window.localStorage.getItem(storageKey);
    if (raw && action) throw Error("Check the pending banking action before starting another.");
    let args: Record<string, unknown>;
    if (raw) {
      const command = JSON.parse(raw);
      if (command.version !== 1 || command.user !== user || command.args?.p_organization_id !== org || !command.args.p_command_id || !actions.includes(command.args.p_action)) throw Error("The pending banking action needs review. Keep this browser data.");
      args = command.args;
    } else {
      if (!action || !actions.includes(action) || !input || Array.isArray(input)) throw Error("Enter a valid banking action.");
      args = { p_organization_id: org, p_command_id: crypto.randomUUID(), p_action: action, p_input: input };
    }
    const stored = JSON.stringify({ version: 1, user, args });
    window.localStorage.setItem(storageKey, stored);
    const db = client(); const result = await db.rpc("purchase_bank_command", args);
    if (result.error) { if (/^(P0001|22\w{3}|23\w{3}|42501)$/.test(result.error.code ?? "")) window.localStorage.removeItem(storageKey); throw Error(result.error.message); }
    const refreshed = await db.rpc("get_purchase_bank_command_snapshot", { p_organization_id: org, p_command_id: args.p_command_id });
    if (refreshed.error) throw Error(`The banking action may be saved. Check it again. ${refreshed.error.message}`);
    const value = refreshed.data;
    if (!value || value.organization_id !== org || value.command_id !== args.p_command_id || !["accounts", "transactions", "transfers", "cheques", "deleted_accounts"].every(k => Array.isArray(value[k])) || ["accounts", "transactions", "transfers", "cheques"].some(k => value[k].some((row: Row) => row.organization_id !== org)) || value.deleted_accounts.some((id: unknown) => typeof id !== "string")) throw Error("Banking response does not match this company and command.");
    if (await identity() !== user) throw Error("Your sign-in changed. Check the pending banking action again.");
    return { snapshot: value as BankSnapshot, acknowledge: () => { if (window.localStorage.getItem(storageKey) === stored) window.localStorage.removeItem(storageKey); } };
  });
}
