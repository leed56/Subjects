"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  fetchReturnCenter,
  type ReturnCenterRow,
} from "@/lib/supabase/return-center-client";
import { saleReturnSchemaUnavailable } from "@/lib/supabase/sale-return-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const card =
  "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]";
const secondary =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50";
const primary =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-teal-700";

function statusTone(status: ReturnCenterRow["settlementStatus"]) {
  if (status === "pending" || status === "partial") return "warning" as const;
  return "positive" as const;
}

function statusLabel(status: ReturnCenterRow["settlementStatus"]): string {
  if (status === "pending") return "Financial action pending";
  if (status === "partial") return "Partially settled";
  if (status === "reduced_credit") return "Customer credit reduced";
  if (status === "settled_external") return "Refund settled";
  if (status === "settled_mixed") return "Mixed settlement complete";
  if (status === "exchange") return "Exchange";
  return status.replaceAll("_", " ");
}

export default function ReturnsControlCenterPage() {
  const { data, ready } = useAppStore();
  const { org, orgRole } = useSubscription();
  const { locale } = useLocale();
  const si = locale === "si";
  const [rows, setRows] = useState<ReturnCenterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [financeSchemaMissing, setFinanceSchemaMissing] = useState(false);

  useEffect(() => {
    if (!org.isAuthenticated || !org.id || orgRole !== "owner") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFinanceSchemaMissing(false);
    void fetchReturnCenter(org.id).then((result) => {
      if (cancelled) return;
      setRows(result.data);
      setFinanceSchemaMissing(result.financeSchemaMissing);
      setError(result.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated, orgRole]);

  const saleById = useMemo(
    () => new Map((data?.sales ?? []).map((sale) => [sale.id, sale] as const)),
    [data?.sales],
  );

  const pending = rows.filter(
    (row) => !row.creditNoteId || row.settlementStatus === "pending" || row.settlementStatus === "partial",
  );
  const completed = rows.filter(
    (row) => row.creditNoteId && row.settlementStatus !== "pending" && row.settlementStatus !== "partial",
  );
  const issuedCreditTotal = rows
    .filter((row) => row.creditNoteId)
    .reduce((sum, row) => sum + row.merchandiseValue, 0);
  const vatReversal = rows
    .filter((row) => row.creditNoteId)
    .reduce((sum, row) => sum + row.outputVatReversal, 0);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain><ProLoadingState label={si ? "Returns පූරණය වෙමින්…" : "Loading returns…"} /></ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated || orgRole !== "owner") {
    return (
      <AppShell>
        <ProMain>
          <PageHeader title={si ? "Returns & credit notes" : "Returns & credit notes"} />
          <EmptyState
            title={si ? "Owner access පමණයි" : "Owner access only"}
            description={
              si
                ? "Credit notes, refund settlement සහ VAT/revenue reversal owner financial controls වේ."
                : "Credit notes, refund settlement and VAT/revenue reversals are owner financial controls."
            }
            action={<Link href="/dashboard" className={secondary}>Dashboard</Link>}
          />
        </ProMain>
      </AppShell>
    );
  }

  const physicalSchemaMissing = saleReturnSchemaUnavailable(error);

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={si ? "Returns & credit notes" : "Returns & credit notes"}
          description={
            si
              ? "Physical return → credit note → receivable/refund settlement එකම audit trail එකකින් පාලනය කරන්න. Original invoice කිසිවිටෙක rewrite නොකරයි."
              : "Control physical returns, credit notes and refund/receivable settlement from one audit trail. Original invoices are never rewritten."
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/bills" className={secondary}>{si ? "Bills" : "Bills"}</Link>
              <Link href="/vat" className={primary}>{si ? "VAT & tax" : "VAT & tax"}</Link>
            </div>
          }
        />

        {loading ? (
          <ProLoadingState label={si ? "Return control center පූරණය වෙමින්…" : "Loading return control center…"} />
        ) : physicalSchemaMissing ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">{si ? "Customer-return database upgrade අවශ්‍යයි" : "Customer-return database upgrade required"}</p>
            <p className="mt-2 leading-6 text-amber-800">
              {si
                ? "Verified LakBiz Supabase project එකට return migrations apply කළ පසු මෙම workspace එක සක්‍රීය වේ."
                : "This workspace activates after the customer-return migrations are applied to the verified LakBiz Supabase project."}
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>
        ) : (
          <div className="space-y-5">
            {financeSchemaMissing && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
                {si
                  ? "Physical returns දක්වයි. Credit-note / settlement migration තවම live database එකට apply කර නැති නිසා financial actions තාවකාලිකව unavailable."
                  : "Physical returns are available, but the credit-note / settlement migration is not yet installed on the live database, so financial actions remain unavailable."}
              </div>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Action needed</p>
                <p className="mt-2 text-3xl font-semibold">{pending.length}</p>
                <p className="mt-1 text-xs text-slate-400">returns awaiting finance completion</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Return documents</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{rows.length}</p>
                <p className="mt-1 text-xs text-slate-500">immutable physical-return records</p>
              </div>
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-700">Issued credits</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-teal-950">{formatLkr(issuedCreditTotal)}</p>
                <p className="mt-1 text-xs text-teal-800">recognized revenue credits</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">VAT reversed</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-amber-950">{formatLkr(vatReversal)}</p>
                <p className="mt-1 text-xs text-amber-800">issued credit notes only</p>
              </div>
            </section>

            {rows.length === 0 ? (
              <section className={card}>
                <EmptyState
                  title={si ? "Customer returns තවම නැත" : "No customer returns yet"}
                  description={
                    si
                      ? "Return එකක් record කළ පසු physical intake, credit note සහ settlement status මෙහි පෙන්වයි."
                      : "Once a return is recorded, its physical intake, credit note and settlement status appear here."
                  }
                  action={<Link href="/bills" className={secondary}>{si ? "Bills බලන්න" : "View bills"}</Link>}
                />
              </section>
            ) : (
              <>
                {pending.length > 0 && (
                  <section className={card}>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">Needs attention</p>
                        <h2 className="mt-1 text-lg font-semibold text-slate-950">Complete return accounting</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-500">Issue missing credit notes first, then settle the customer credit/refund explicitly.</p>
                      </div>
                      <StatusBadge tone="warning">{pending.length}</StatusBadge>
                    </div>

                    <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {pending.map((row) => {
                        const sale = saleById.get(row.saleId);
                        const remaining = Math.max(0, row.merchandiseValue - row.settledTotal);
                        return (
                          <article key={row.returnId} className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-mono text-xs font-bold text-slate-900">{row.returnNo}</p>
                                  <StatusBadge tone={row.creditNoteId ? "info" : "warning"}>
                                    {row.creditNoteId ? row.creditNoteNo ?? "Credit note issued" : "Credit note required"}
                                  </StatusBadge>
                                </div>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-950">{sale?.customerName || "Walk-in customer"}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {sale?.billNo ?? row.saleId.slice(0, 8)} · {new Date(row.returnedAt).toLocaleDateString("en-LK")} · {row.reason}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono text-base font-semibold text-slate-950">{formatLkr(row.merchandiseValue)}</p>
                                <p className="mt-1 text-[11px] font-semibold text-amber-700">{statusLabel(row.settlementStatus)}</p>
                                {row.creditNoteId && remaining > 0.005 && <p className="mt-0.5 text-[11px] text-slate-500">{formatLkr(remaining)} remaining</p>}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <Link href={`/bills/${row.saleId}`} className={secondary}>Original bill</Link>
                              {row.creditNoteId && (
                                <Link href={`/bills/${row.saleId}/returns/${row.returnId}/credit-note`} className={secondary}>Credit note</Link>
                              )}
                              <Link href={`/bills/${row.saleId}/returns/${row.returnId}`} className={primary}>
                                {row.creditNoteId ? "Continue settlement" : "Issue credit note"}
                              </Link>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

                {completed.length > 0 && (
                  <section className={card}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Completed</p>
                        <h2 className="mt-1 text-lg font-semibold text-slate-950">Settled return credits</h2>
                      </div>
                      <StatusBadge tone="positive">{completed.length}</StatusBadge>
                    </div>
                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                      {completed.map((row) => {
                        const sale = saleById.get(row.saleId);
                        return (
                          <article key={row.returnId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-mono text-xs font-bold text-slate-900">{row.creditNoteNo ?? row.returnNo}</p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-950">{sale?.customerName || "Walk-in customer"}</p>
                                <p className="mt-1 text-xs text-slate-500">{sale?.billNo ?? row.saleId.slice(0, 8)} · {statusLabel(row.settlementStatus)}</p>
                              </div>
                              <p className="font-mono text-sm font-semibold text-slate-950">{formatLkr(row.merchandiseValue)}</p>
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <Link href={`/bills/${row.saleId}/returns/${row.returnId}/credit-note`} className={secondary}>View credit note</Link>
                              <Link href={`/bills/${row.saleId}/returns/${row.returnId}`} className={secondary}>Audit settlement</Link>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </ProMain>
    </AppShell>
  );
}
