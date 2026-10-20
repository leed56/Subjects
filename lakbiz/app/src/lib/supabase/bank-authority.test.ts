import { beforeEach, expect, it, vi } from "vitest";
import { emptyAppData } from "@/lib/store/storage";
import { hasPendingBankCommand, mergeBankSnapshot, performBankCommand } from "./bank-authority";

const state = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], error: false, foreign: false, refreshError: false }));
vi.mock("./client", () => ({ createBrowserClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) },
  rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === "purchase_bank_command") { state.calls.push(args); return { error: state.error ? { message: "Connection lost" } : null }; }
    return { error: state.refreshError ? { message: "Refresh failed" } : null, data: { organization_id: state.foreign ? "other" : "org", command_id: args.p_command_id, accounts: [{ id: "a", organization_id: "org", bank_name: "Bank", account_name: "Account", account_number: "123", balance: 50 }], transactions: [], transfers: [], cheques: [], deleted_accounts: [] } };
  },
}) }));
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear(); Object.assign(state, { calls: [], error: false, foreign: false, refreshError: false });
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, run: () => unknown) => run() } });
});
it("replays a lost banking command and retains it until the refreshed snapshot is saved", async () => {
  state.error = true;
  await expect(performBankCommand("org", "owner", "transaction_create", { accountId: "a", type: "deposit", amount: 10 })).rejects.toThrow("Connection lost");
  expect(hasPendingBankCommand("org", "owner")).toBe(true);
  state.error = false; const result = await performBankCommand("org", "owner");
  expect(state.calls[1]).toEqual(state.calls[0]); expect(hasPendingBankCommand("org", "owner")).toBe(true);
  const data = emptyAppData(); data.bankAccounts = [{ id: "a", bankName: "Bank", accountName: "Account", accountNumber: "123", balance: 40 }, { id: "other", bankName: "Bank", accountName: "Other", accountNumber: "456", balance: 8 }];
  const merged = mergeBankSnapshot(data, result.snapshot);
  expect(merged.bankAccounts.find(account => account.id === "a")?.balance).toBe(50); expect(merged.bankAccounts.find(account => account.id === "other")?.balance).toBe(8);
  result.acknowledge(); expect(hasPendingBankCommand("org", "owner")).toBe(false);
});
it("keeps the command when a company-scoped snapshot cannot be verified", async () => {
  state.foreign = true;
  await expect(performBankCommand("org", "owner", "account_delete", { id: "a" })).rejects.toThrow("company");
  expect(hasPendingBankCommand("org", "owner")).toBe(true);
});
