"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProStatCard,
} from "@/components/ui/pro-shell";
import { BillsIcon, CostingIcon, ReportsIcon, CustomersIcon } from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
import {
  fetchOrgSaleReturnControl,
  saleReturnControlSchemaUnavailable,
  type SaleReturnControlRow,
  type SaleReturnControlSummary,
} from "@/lib/supabase/sale-return-control-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const emptySummary: SaleReturnControlSummary = {
  totalReturns: 0,
  totalReturnValue: 0,
  awaitingCreditNote: 0,
  awaitingSettlement: 0,
  settled: 0,
  outstandingCredit: 0,
};

function isActionable(row: SaleReturnControlRow): boolean {
  return !row.creditNote || row.remainingCredit > 0.005;
}

function ReturnStatus({ row }: { row: SaleReturnControlRow }) {
  if (!row.creditNote) return <ProBadge tone="amber">Credit note required</ProBadge>;
  if (row.remainingCredit > 0.005) {
    return <ProBadge tone="amber">{formatLkr(row.remainingCredit)} remaining</ProBadge>;
  }
  return <ProBadge tone="emerald">Settled</ProBadge>;
}

export default function ReturnsControlPage() {
  const { data, ready } = useAppStore();
  const { org, orgRole } = useSubscription();
  const [rows, setRows] = useState<SaleReturnControlRow[]>([]);
  const [summary, setSummary] = useState<SaleReturnControlSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.isAuthenticated || !org.id || orgRole !== "owner") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchOrgSaleReturnControl(org.id).then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setSummary(result.summary);
      setError(result.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated, orgRole]);

  const salesById = useMemo(
    () => new Map((data?.sales ?? []).map((sale) => [sale.id, sale] as const)),
    [data?.sales],
  );
  const actionable = useMemo(() => rows.filter(isActionable), [rows]);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label="Loading returns control…" />
        </ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated || orgRole !== "owner") {
    return (
      <AppShell>
        <ProMain>
          <ProCard>
            <ProEmptyState
              title="Owner-only returns control"
              description="Return financial actions, credit notes and refund settlement remain private to the business owner."
              action={<ProButton href="/bills">Back to bills</ProButton>}
            />
          </ProCard>
        </ProMain>
      </AppShell>
    );
  }

  const schemaMissing = saleReturnControlSchemaUnavailable(error);

  return (
    <AppShell>
      <ProMain>
        <ProPageHeader
          eyebrow="Owner financial control"
          title="Customer returns"
          description="One control center for physical return documents, credit-note recognition and refund or receivable settlement. Original invoices remain immutable."
          actions={<ProButton href="/bills" variant="secondary">All bills</ProButton>}
        />

        {schemaMissing ? (
          <ProCard>
            <ProEmptyState
              title="Return-finance database upgrade required"
              description="The return and credit-note migrations must be applied to the verified LakBiz Supabase project before this control center can load live return ledgers."
              action={<ProButton href="/bills" variant="secondary">Back to bills</ProButton>}
            />
          </ProCard>
        ) : loading ? (
          <ProLoadingState label="Loading return ledgers…" />
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">
            Could not load return control: {error}
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ProStatCard
                label="Return documents"
                value={String(summary.totalReturns)}
                hint={`${summary.settled} fully settled`}
                icon={<BillsIcon className="h-5 w-5" />}
                tone="teal"
              />
              <ProStatCard
                label="Returned value"
                value={formatLkr(summary.totalReturnValue)}
                hint="Physical returns recorded"
                icon={<CostingIcon className="h-5 w-5" />}
                tone="blue"
              />
              <ProStatCard
                label="Financial action"
                value={String(summary.awaitingCreditNote + summary.awaitingSettlement)}
                hint={`${summary.awaitingCreditNote} credit note · ${summary.awaitingSettlement} settlement`}
                icon={<ReportsIcon className="h-5 w-5" />}
                tone={summary.awaitingCreditNote + summary.awaitingSettlement > 0 ? "amber" : "emerald"}
              />
              <ProStatCard
                label="Outstanding return credit"
                value={formatLkr(summary.outstandingCredit)}
                hint="Issued but not fully settled"
                icon={<CustomersIcon className="h-5 w-5" />}
                tone={summary.outstandingCredit > 0 ? "amber" : "emerald"}
              />
            </section>

            <section className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_1.4fr]">
              <ProCard
                title="Needs financial action"
                action={<ProBadge tone={actionable.length > 0 ? "amber" : "emerald"}>{actionable.length}</ProBadge>}
              >
                {actionable.length === 0 ? (
                  <ProEmptyState
                    title="All return finances are reconciled"
                    description="New physical returns will appear here until their credit note and settlement are complete."
                    size="compact"
                  />
                ) : (
                  <div className="space-y-2.5">
                    {actionable.map((row) => {
                      const sale = salesById.get(row.saleId);
                      return (
                        <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-teal-700">{row.returnNo}</p>
                              <p className="mt-1 truncate text-sm font-bold text-slate-950">
                                {sale?.customerName || "Walk-in customer"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {sale?.billNo ?? row.saleId.slice(0, 8)} · {new Date(row.returnedAt).toLocaleDateString("en-LK")}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-base font-bold text-slate-950">{formatLkr(row.merchandiseValue)}</p>
                              <div className="mt-1"><ReturnStatus row={row} /></div>
                            </div>
                          </div>
                          <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{row.reason || "Customer return"}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                            <Link href={`/bills/${row.saleId}`} className="text-xs font-bold text-slate-600 hover:text-teal-700">Original bill</Link>
                            <span className="text-slate-300">·</span>
                            <Link href={`/bills/${row.saleId}/returns/${row.id}`} className="text-xs font-bold text-teal-700 hover:underline">
                              {row.creditNote ? "Open settlement" : "Issue credit note"} →
                            </Link>
                            {row.creditNote && (
                              <>
                                <span className="text-slate-300">·</span>
                                <Link href={`/bills/${row.saleId}/returns/${row.id}/credit-note`} className="text-xs font-bold text-slate-600 hover:text-teal-700">Credit note</Link>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ProCard>

              <ProCard title="Return register" action={<ProBadge tone="slate">{rows.length}</ProBadge>}>
                {rows.length === 0 ? (
                  <ProEmptyState
                    title="No customer returns yet"
                    description="Approved physical return documents will appear here without modifying the original bill."
                    size="compact"
                  />
                ) : (
                  <div className="max-h-[36rem] divide-y divide-slate-100 overflow-y-auto pr-1">
                    {rows.map((row) => {
                      const sale = salesById.get(row.saleId);
                      return (
                        <div key={row.id} className="flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/bills/${row.saleId}/returns/${row.id}`} className="font-mono text-xs font-bold text-teal-700 hover:underline">{row.returnNo}</Link>
                              {row.creditNote && <span className="font-mono text-[11px] font-semibold text-slate-500">{row.creditNote.creditNoteNo}</span>}
                            </div>
                            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{sale?.customerName || "Walk-in customer"}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {sale?.billNo ?? row.saleId.slice(0, 8)} · {new Date(row.returnedAt).toLocaleString("en-LK")}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                            <div className="text-right">
                              <p className="font-mono text-sm font-bold text-slate-950">{formatLkr(row.merchandiseValue)}</p>
                              {row.creditNote && row.settledTotal > 0 && (
                                <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{formatLkr(row.settledTotal)} settled</p>
                              )}
                            </div>
                            <ReturnStatus row={row} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ProCard>
            </section>
          </>
        )}
      </ProMain>
    </AppShell>
  );
}
