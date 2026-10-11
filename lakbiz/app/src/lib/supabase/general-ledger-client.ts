"use client";
import { createBrowserClient } from "./client";
import type {
  JournalInputLine,
  LedgerAccount,
  TrialBalanceRow,
} from "../general-ledger";
export type JournalBatch = {
  id: string;
  journal_date: string;
  memo: string;
  source_key: string;
  created_at: string;
};
export type LedgerSnapshot = {
  accounts: LedgerAccount[];
  journals: JournalBatch[];
  trial: TrialBalanceRow[];
};
export class LedgerUnavailable extends Error {}
function minor(value: string | number) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Ledger balance exceeds the supported display precision.");
  return amount;
}
function requireClient() {
  const client = createBrowserClient();
  if (!client)
    throw new LedgerUnavailable("A connected business account is required.");
  return client;
}
function fail(error: { message: string; code?: string }) {
  if (["42P01", "PGRST205", "PGRST202"].includes(error.code ?? ""))
    throw new LedgerUnavailable(
      "The accounting database update has not been enabled for this environment yet.",
    );
  throw new Error(error.message);
}
export async function fetchGeneralLedger(
  orgId: string,
): Promise<LedgerSnapshot> {
  const client = requireClient();
  const [accounts, journals, totals] = await Promise.all([
    client
      .from("ledger_accounts")
      .select("id,code,name,kind")
      .eq("organization_id", orgId)
      .order("code"),
    client
      .from("journal_batches")
      .select("id,journal_date,memo,source_key,created_at")
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .order("journal_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(50),
    client.rpc("get_general_ledger_trial_balance", {
      p_organization_id: orgId,
    }),
  ]);
  for (const result of [accounts, journals, totals])
    if (result.error) fail(result.error);
  return {
    accounts: (accounts.data ?? []) as LedgerAccount[],
    journals: (journals.data ?? []) as JournalBatch[],
    trial: (totals.data ?? []).map(
      (row: {
        account_id: string;
        code: string;
        name: string;
        kind: string;
        debit_minor: string | number;
        credit_minor: string | number;
      }) => ({
        id: row.account_id,
        code: row.code,
        name: row.name,
        kind: row.kind,
        debitMinor: minor(row.debit_minor),
        creditMinor: minor(row.credit_minor),
      }),
    ),
  };
}
export async function initializeGeneralLedger(orgId: string) {
  const { error } = await requireClient().rpc("initialize_general_ledger", {
    p_organization_id: orgId,
  });
  if (error) fail(error);
}
export async function postGeneralLedgerJournal(
  orgId: string,
  key: string,
  date: string,
  memo: string,
  lines: JournalInputLine[],
) {
  const { data, error } = await requireClient().rpc(
    "post_general_ledger_journal",
    {
      p_organization_id: orgId,
      p_source_key: key,
      p_date: date,
      p_memo: memo,
      p_lines: lines,
    },
  );
  if (error) fail(error);
  return String(data);
}

export type LedgerDetailLine = {
  id: string;
  account_id: string;
  line_no: number;
  debitMinor: number;
  creditMinor: number;
  journal: JournalBatch;
};
export async function fetchLedgerDetail(
  orgId: string,
  selection: { batchId: string } | { accountId: string },
  page: number,
): Promise<LedgerDetailLine[]> {
  if (!Number.isSafeInteger(page) || page < 0)
    throw new Error("Invalid ledger page.");
  let query = requireClient()
    .from("journal_lines")
    .select(
      "id,account_id,line_no,debit_minor,credit_minor,journal:journal_batches!inner(id,journal_date,memo,source_key,created_at)",
    )
    .eq("organization_id", orgId)
    .eq("journal.organization_id", orgId)
    .eq("journal.status", "posted");
  query =
    "batchId" in selection
      ? query.eq("batch_id", selection.batchId)
      : query.eq("account_id", selection.accountId);
  const { data, error } = await query
    .order("batch_id")
    .order("line_no")
    .range(page * 50, page * 50 + 49);
  if (error) fail(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    account_id: row.account_id,
    line_no: row.line_no,
    debitMinor: minor(row.debit_minor),
    creditMinor: minor(row.credit_minor),
    journal: row.journal as unknown as JournalBatch,
  }));
}
