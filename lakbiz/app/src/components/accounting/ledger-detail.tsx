"use client";
import { useEffect, useState } from "react";
import { ProCard, ProLoadingState } from "@/components/ui/pro-shell";
import { Button, EmptyState } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import { formatLkr } from "@/lib/format";
import type { LedgerAccount } from "@/lib/general-ledger";
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
  const [result, setResult] = useState<{
    key: string;
    rows?: LedgerDetailLine[];
    error?: string;
  } | null>(null);
  const batchId = "batchId" in selection ? selection.batchId : null;
  const accountId = "accountId" in selection ? selection.accountId : null;
  const key = `${orgId}:${batchId}:${accountId}:${page}`;
  useEffect(() => {
    let alive = true;
    const target = batchId ? { batchId } : { accountId: accountId! };
    fetchLedgerDetail(orgId, target, page)
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
  }, [orgId, batchId, accountId, page, key]);
  const current = result?.key === key ? result : null;
  const rows = current?.rows;
  const account = accounts.find((item) => item.id === accountId);
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
