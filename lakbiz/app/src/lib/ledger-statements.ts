import type { TrialBalanceRow } from "./general-ledger";
import { ledgerCsv, ledgerDecimal } from "./ledger-report";

export type StatementLine = TrialBalanceRow & { amountMinor: number };
export type LedgerStatements = {
  income: StatementLine[];
  expenses: StatementLine[];
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  incomeMinor: number;
  expenseMinor: number;
  profitMinor: number;
  assetMinor: number;
  liabilityMinor: number;
  equityMinor: number;
  equityWithEarningsMinor: number;
  differenceMinor: number;
};
const kinds = new Set(["asset", "liability", "equity", "income", "expense"]);
function safe(value: bigint): number {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error("Statement total exceeds supported precision.");
  return Number(value);
}
function sum(lines: StatementLine[]): bigint {
  return lines.reduce(
    (total, row) => total + BigInt(row.amountMinor),
    BigInt(0),
  );
}

/** Income/equity/liability balances are credit-positive; assets/expenses debit-positive. */
export function buildLedgerStatements(
  trial: TrialBalanceRow[],
): LedgerStatements {
  const seen = new Set<string>();
  const rows = trial.map((row) => {
    if (seen.has(row.id))
      throw new Error("Duplicate account in statement data.");
    seen.add(row.id);
    if (!kinds.has(row.kind))
      throw new Error("Unknown account classification.");
    if (
      ![row.debitMinor, row.creditMinor].every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      ) ||
      (row.debitMinor > 0 && row.creditMinor > 0)
    )
      throw new Error("Invalid trial balance data.");
    const debitNet = BigInt(row.debitMinor) - BigInt(row.creditMinor);
    return {
      ...row,
      amountMinor: safe(
        row.kind === "asset" || row.kind === "expense" ? debitNet : -debitNet,
      ),
    };
  });
  const income = rows.filter((row) => row.kind === "income");
  const expenses = rows.filter((row) => row.kind === "expense");
  const assets = rows.filter((row) => row.kind === "asset");
  const liabilities = rows.filter((row) => row.kind === "liability");
  const equity = rows.filter((row) => row.kind === "equity");
  const profit = sum(income) - sum(expenses);
  const equityWithEarnings = sum(equity) + profit;
  return {
    income,
    expenses,
    assets,
    liabilities,
    equity,
    incomeMinor: safe(sum(income)),
    expenseMinor: safe(sum(expenses)),
    profitMinor: safe(profit),
    assetMinor: safe(sum(assets)),
    liabilityMinor: safe(sum(liabilities)),
    equityMinor: safe(sum(equity)),
    equityWithEarningsMinor: safe(equityWithEarnings),
    differenceMinor: safe(sum(assets) - sum(liabilities) - equityWithEarnings),
  };
}

export function statementCsv(trial: TrialBalanceRow[]): string {
  const summary = buildLedgerStatements(trial);
  // Separate magnitude and sign keeps negative values exact without exporting formula-like text.
  const amount = (label: string, value: number): (string | number)[] => [
    label,
    value < 0 ? "Negative" : "Positive / zero",
    ledgerDecimal(Math.abs(value)),
  ];
  return ledgerCsv([
    ["Scope", "All-time posted accounting journals only", "Currency", "LKR"],
    [
      "Limitation",
      "Not reconciled to existing sales, stock, purchases or banking records; not a statutory statement",
    ],
    [
      "Account code",
      "Account name",
      "Classification",
      "Debit LKR",
      "Credit LKR",
    ],
    ...trial.map((row) => [
      row.code,
      row.name,
      row.kind,
      ledgerDecimal(row.debitMinor),
      ledgerDecimal(row.creditMinor),
    ]),
    [],
    ["Summary", "Sign", "Magnitude LKR"],
    amount("Income", summary.incomeMinor),
    amount("Expenses", summary.expenseMinor),
    amount("Net profit / loss", summary.profitMinor),
    amount("Assets", summary.assetMinor),
    amount("Liabilities", summary.liabilityMinor),
    amount("Posted equity", summary.equityMinor),
    amount(
      "Equity including unclosed earnings",
      summary.equityWithEarningsMinor,
    ),
    amount("Balance-sheet difference", summary.differenceMinor),
  ]);
}
