"use client";
import { ProCard } from "@/components/ui/pro-shell";
import { Button } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import type { TrialBalanceRow } from "@/lib/general-ledger";
import {
  buildLedgerStatements,
  statementCsv,
  type StatementLine,
} from "@/lib/ledger-statements";
import { ledgerDecimal } from "@/lib/ledger-report";

function money(value: number): string {
  const [whole, fraction] = ledgerDecimal(Math.abs(value)).split(".");
  return `${value < 0 ? "−" : ""}LKR ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
function AccountBreakdown({
  rows,
  onAccount,
}: {
  rows: StatementLine[];
  onAccount: (id: string) => void;
}) {
  return (
    <DataTable
      rows={rows}
      columns={[
        {
          key: "account",
          header: "Account",
          render: (row) => (
            <button
              type="button"
              className="text-left font-medium text-blue-700 hover:underline"
              onClick={() => onAccount(row.id)}
            >
              {row.code} · {row.name}
            </button>
          ),
        },
        {
          key: "amount",
          header: "Ledger balance",
          align: "right",
          render: (row) => money(row.amountMinor),
        },
      ]}
    />
  );
}

export function LedgerStatements({
  trial,
  onAccount,
}: {
  trial: TrialBalanceRow[];
  onAccount: (id: string) => void;
}) {
  let summary;
  try {
    summary = buildLedgerStatements(trial);
  } catch (error) {
    return (
      <ProCard title="Ledger statements unavailable">
        <p role="alert" className="text-sm text-red-700">
          {error instanceof Error ? error.message : "Invalid statement data."}
        </p>
      </ProCard>
    );
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([statementCsv(trial)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "lakbiz-all-time-ledger-statements.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section aria-label="Ledger financial summaries" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <div>
          <h2 className="font-bold text-slate-900">
            Ledger financial summaries · all time
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Posted accounting journals only. Includes all journal dates,
            including future-dated entries. Not linked or reconciled to existing
            sales, purchases, stock or banking. These are not complete business
            or statutory statements.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={download}>
          Export ledger statements CSV
        </Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ProCard title="Profit and loss · all-time journals">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Income", value: summary.incomeMinor },
              { label: "Expenses", value: summary.expenseMinor },
              { label: "Net profit / loss", value: summary.profitMinor },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="mt-1 font-bold text-slate-900">
                  {money(item.value)}
                </p>
              </div>
            ))}
          </div>
          <h3 className="mb-2 text-sm font-semibold">Income accounts</h3>
          <AccountBreakdown rows={summary.income} onAccount={onAccount} />
          <h3 className="mb-2 mt-4 text-sm font-semibold">Expense accounts</h3>
          <AccountBreakdown rows={summary.expenses} onAccount={onAccount} />
        </ProCard>
        <ProCard title="Balance sheet · all-time journal balances">
          <dl className="mb-4 space-y-2 text-sm">
            {[
              { label: "Assets", value: summary.assetMinor },
              { label: "Liabilities", value: summary.liabilityMinor },
              { label: "Posted equity", value: summary.equityMinor },
              { label: "Unclosed earnings", value: summary.profitMinor },
              {
                label: "Equity including earnings",
                value: summary.equityWithEarningsMinor,
              },
            ].map((item) => (
              <div key={item.label} className="flex justify-between gap-3">
                <dt className="text-slate-500">{item.label}</dt>
                <dd className="font-semibold">{money(item.value)}</dd>
              </div>
            ))}
          </dl>
          <p
            role="status"
            className={`mb-4 rounded-xl p-3 text-sm ${summary.differenceMinor === 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
          >
            {summary.differenceMinor === 0
              ? "Ledger equation balances. This does not verify completeness or reconciliation."
              : `Ledger equation does not balance. Difference: ${money(summary.differenceMinor)}. Check entries before relying on these reports.`}
          </p>
          <h3 className="mb-2 text-sm font-semibold">Assets</h3>
          <AccountBreakdown rows={summary.assets} onAccount={onAccount} />
          <h3 className="mb-2 mt-4 text-sm font-semibold">Liabilities</h3>
          <AccountBreakdown rows={summary.liabilities} onAccount={onAccount} />
          <h3 className="mb-2 mt-4 text-sm font-semibold">Equity</h3>
          <AccountBreakdown rows={summary.equity} onAccount={onAccount} />
          <p className="mt-3 text-xs text-slate-500">
            Unclosed earnings are calculated, not posted as a second equity
            journal. Negative balances are retained rather than hidden.
          </p>
        </ProCard>
      </div>
    </section>
  );
}
