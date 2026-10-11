"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ProCard, ProLoadingState } from "@/components/ui/pro-shell";
import { Button, EmptyState } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import { formatLkr } from "@/lib/format";
import type { LedgerAccount } from "@/lib/general-ledger";
import {
  ledgerCsv,
  ledgerDecimal,
  validateLedgerDateRange,
} from "@/lib/ledger-report";
import {
  fetchLedgerDetail,
  type LedgerDetailLine,
} from "@/lib/supabase/general-ledger-client";

export function LedgerDetail({
  orgId,
  selection,
  accounts,
  onClose,
}: {
  orgId: string;
  selection: { batchId: string } | { accountId: string };
  accounts: LedgerAccount[];
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [draftDates, setDraftDates] = useState({ from: "", to: "" });
  const [dates, setDates] = useState({ from: "", to: "" });
  const [filterError, setFilterError] = useState("");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    rows?: LedgerDetailLine[];
    error?: string;
  } | null>(null);
  const batchId = "batchId" in selection ? selection.batchId : null;
  const accountId = "accountId" in selection ? selection.accountId : null;
  const key = `${orgId}:${batchId}:${accountId}:${page}:${dates.from}:${dates.to}:${revision}`;
  useEffect(() => {
    let alive = true;
    const target = batchId ? { batchId } : { accountId: accountId! };
    fetchLedgerDetail(orgId, target, page, { from: dates.from, to: dates.to })
      .then((rows) => {
        if (alive) setResult({ key, rows });
      })
      .catch((error) => {
        if (alive)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load entries.",
          });
      });
    return () => {
      alive = false;
    };
  }, [orgId, batchId, accountId, page, key, dates.from, dates.to]);
  const current = result?.key === key ? result : null;
  const rows = current?.rows;
  const account = accounts.find((item) => item.id === accountId);
  function applyDates(event: FormEvent) {
    event.preventDefault();
    try {
      validateLedgerDateRange(draftDates);
      setDates({ ...draftDates });
      setPage(0);
      setRevision((value) => value + 1);
      setFilterError("");
    } catch (error) {
      setFilterError(error instanceof Error ? error.message : "Invalid dates.");
    }
  }
  function exportPage() {
    if (!rows?.length) return;
    const csv = ledgerCsv([
      [
        "Scope",
        "Current page only",
        "Page",
        page + 1,
        "From",
        dates.from || "Unbounded",
        "To",
        dates.to || "Unbounded",
        "Currency",
        "LKR",
      ],
      [
        "Date",
        "Journal reference",
        "Description",
        "Account code",
        "Account name",
        "Line",
        "Debit LKR",
        "Credit LKR",
      ],
      ...rows.map((row) => {
        const item = accounts.find((a) => a.id === row.account_id);
        return [
          row.journal.journal_date,
          row.journal.id,
          row.journal.memo,
          item?.code ?? "",
          item?.name ?? "Unknown account",
          row.line_no,
          ledgerDecimal(row.debitMinor),
          ledgerDecimal(row.creditMinor),
        ];
      }),
    ]);
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `lakbiz-ledger-page-${page + 1}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <ProCard
      title={
        batchId
          ? "Journal entries · LKR"
          : `${account?.code ?? ""} · ${account?.name ?? "Account transactions"}`
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Posted entries only · page {page + 1} · 50 entries per page · ordered
          by journal reference and line
        </p>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close details
        </Button>
      </div>
      <form
        onSubmit={applyDates}
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <label className="text-sm">
          From date (inclusive)
          <input
            type="date"
            value={draftDates.from}
            onChange={(e) =>
              setDraftDates((value) => ({ ...value, from: e.target.value }))
            }
            className="mt-1 block rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          To date (inclusive)
          <input
            type="date"
            value={draftDates.to}
            onChange={(e) =>
              setDraftDates((value) => ({ ...value, to: e.target.value }))
            }
            className="mt-1 block rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <Button type="submit" variant="secondary">
          Apply dates
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!rows?.length}
          onClick={exportPage}
        >
          Export this page CSV
        </Button>
      </form>
      {filterError && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {filterError}
        </p>
      )}
      <p className="mb-3 text-xs text-slate-500">
        Applied dates: {dates.from || "No start limit"} to{" "}
        {dates.to || "No end limit"}. Export includes this page only, not a
        complete statement or running balance.
      </p>
      {!current ? (
        <ProLoadingState label="Loading entries" />
      ) : current.error ? (
        <p role="alert" className="text-sm text-red-700">
          {current.error}
        </p>
      ) : (
        <DataTable
          rows={rows ?? []}
          columns={[
            {
              key: "date",
              header: "Date",
              render: (row) => row.journal.journal_date,
            },
            {
              key: "journal",
              header: "Journal / description",
              render: (row) => (
                <div>
                  <p>{row.journal.memo}</p>
                  <p className="font-mono text-xs text-slate-500">
                    {row.journal.id}
                  </p>
                </div>
              ),
            },
            {
              key: "account",
              header: "Account",
              render: (row) => {
                const item = accounts.find((a) => a.id === row.account_id);
                return `${item?.code ?? ""} · ${item?.name ?? "Unknown account"}`;
              },
            },
            { key: "line", header: "Line", render: (row) => row.line_no },
            {
              key: "debit",
              header: "Debit",
              align: "right",
              render: (row) => formatLkr(row.debitMinor / 100),
            },
            {
              key: "credit",
              header: "Credit",
              align: "right",
              render: (row) => formatLkr(row.creditMinor / 100),
            },
          ]}
          emptyState={<EmptyState title="No entries on this page" />}
        />
      )}
      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={!current}
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh / retry
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!current || page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!rows || rows.length < 50}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </ProCard>
  );
}
