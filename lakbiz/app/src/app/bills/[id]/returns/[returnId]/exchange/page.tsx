"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { formatLkr } from "@/lib/format";
import { computeSaleExchangePlan } from "@/lib/sale-exchange";
import {
  fetchSaleReturnSettlementState,
  saleReturnFinanceSchemaUnavailable,
} from "@/lib/supabase/sale-return-client";
import {
  applySaleReturnExchange,
  fetchSaleExchangeLinks,
  saleExchangeSchemaUnavailable,
  type SaleExchangeLink,
} from "@/lib/supabase/sale-exchange-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)]";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

type ReturnState = Awaited<ReturnType<typeof fetchSaleReturnSettlementState>>;

export default function SaleExchangePage() {
  const params = useParams();
  const saleId = params.id as string;
  const returnId = params.returnId as string;
  const { data, ready } = useAppStore();
  const { org, orgRole } = useSubscription();

  const sale = data?.sales.find((item) => item.id === saleId) ?? null;
  const customer = sale?.customerId
    ? data?.customers.find((item) => item.id === sale.customerId)
    : undefined;

  const [returnState, setReturnState] = useState<ReturnState | null>(null);
  const [exchangeLinks, setExchangeLinks] = useState<SaleExchangeLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaUpgradeNeeded, setSchemaUpgradeNeeded] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [posting, setPosting] = useState(false);
  const [requestId, setRequestId] = useState("");

  const load = async () => {
    if (!org.id || !returnId || orgRole !== "owner") return;
    setLoading(true);
    setError(null);

    const [stateResult, linkResult] = await Promise.all([
      fetchSaleReturnSettlementState(org.id, returnId),
      fetchSaleExchangeLinks(org.id),
    ]);

    const nextError = stateResult.error ?? linkResult.error;
    if (
      saleReturnFinanceSchemaUnavailable(stateResult.error) ||
      saleExchangeSchemaUnavailable(linkResult.error)
    ) {
      setSchemaUpgradeNeeded(true);
      setReturnState(stateResult.error ? null : stateResult);
      setExchangeLinks([]);
      setLoading(false);
      return;
    }

    if (nextError) {
      setError(nextError);
      setLoading(false);
      return;
    }

    setSchemaUpgradeNeeded(false);
    setReturnState(stateResult);
    setExchangeLinks(linkResult.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!org.isAuthenticated || !org.id || orgRole !== "owner") return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id, org.isAuthenticated, orgRole, returnId]);

  const settledTotal = useMemo(
    () =>
      returnState?.settlements.reduce((sum, settlement) => sum + settlement.amount, 0) ?? 0,
    [returnState?.settlements],
  );
  const returnCredit = Math.max(
    0,
    (returnState?.creditNote?.grossCredit ?? 0) - settledTotal,
  );

  const usedReplacementSaleIds = useMemo(
    () => new Set(exchangeLinks.map((link) => link.replacementSaleId)),
    [exchangeLinks],
  );
  const currentReturnLinks = useMemo(
    () => exchangeLinks.filter((link) => link.returnId === returnId),
    [exchangeLinks, returnId],
  );

  const candidateSales = useMemo(() => {
    if (!data || !sale?.customerId || !returnState?.creditNote) return [];
    const issuedAt = new Date(returnState.creditNote.issuedAt).getTime();
    return data.sales
      .filter(
        (candidate) =>
          candidate.id !== sale.id &&
          candidate.customerId === sale.customerId &&
          candidate.paymentMethod === "credit" &&
          candidate.creditAmount > 0 &&
          new Date(candidate.date).getTime() >= issuedAt &&
          !usedReplacementSaleIds.has(candidate.id),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, returnState?.creditNote, sale, usedReplacementSaleIds]);

  const selectedSale = candidateSales.find((item) => item.id === selectedSaleId) ?? null;
  const plan = selectedSale
    ? computeSaleExchangePlan(returnCredit, selectedSale.creditAmount)
    : null;

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain><ProLoadingState label="Loading exchange workspace…" /></ProMain>
      </AppShell>
    );
  }

  if (!sale) {
    return (
      <AppShell>
        <ProMain>
          <EmptyState title="Bill not found" action={<Link href="/bills" className={primary}>All bills</Link>} />
        </ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated || orgRole !== "owner") {
    return (
      <AppShell>
        <ProMain>
          <PageHeader title="Customer exchange" />
          <EmptyState
            title="Owner approval required"
            description="Exchange credit changes customer receivables and is therefore part of the owner-only financial workflow."
            action={<Link href={`/bills/${sale.id}`} className={secondary}>Back to bill</Link>}
          />
        </ProMain>
      </AppShell>
    );
  }

  const handleApplyExchange = async () => {
    if (!org.id || !selectedSale || !plan || posting || plan.appliedCredit <= 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Exchange credit must be applied while online.");
      return;
    }

    const id = requestId || crypto.randomUUID();
    if (!requestId) setRequestId(id);
    setPosting(true);
    setError(null);
    const result = await applySaleReturnExchange(
      org.id,
      returnId,
      id,
      selectedSale.id,
    );
    setPosting(false);

    if (!result.ok) {
      if (saleExchangeSchemaUnavailable(result.error)) setSchemaUpgradeNeeded(true);
      else setError(result.error ?? "Could not apply exchange credit.");
      return;
    }

    setRequestId("");
    // The RPC updates customer credit_balance and advances sync_generation.
    // Reload so this device pulls the authoritative customer balance before it
    // can push an older local snapshot back to the cloud.
    window.location.reload();
  };

  const returnRecord = returnState?.returnRecord ?? null;
  const creditNote = returnState?.creditNote ?? null;

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title="Customer exchange"
          description={`${sale.billNo ?? sale.id.slice(0, 8)} · ${sale.customerName || "Walk-in customer"}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={`/bills/${sale.id}/returns/${returnId}`} className={secondary}>Return settlement</Link>
              <Link href={`/bills/${sale.id}`} className={secondary}>Original bill</Link>
            </div>
          }
        />

        <section className="mb-5 overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-[0_16px_36px_rgba(15,23,42,0.16)] sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">Safe accounting model</p>
          <h2 className="mt-2 text-xl font-semibold">Return + credit note + new sale</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            LakBiz does not edit the original invoice and does not disguise exchange credit as a discount. Create the replacement as a normal full-value CREDIT sale for the same customer, then apply the issued return credit against that new receivable.
          </p>
        </section>

        {schemaUpgradeNeeded ? (
          <section className={card}>
            <EmptyState
              title="Exchange database upgrade required"
              description="Apply migration 20260822000012 to the verified LakBiz Supabase project before exchange credit can be linked to replacement invoices."
              action={<Link href={`/bills/${sale.id}/returns/${returnId}`} className={secondary}>Return settlement</Link>}
            />
          </section>
        ) : loading ? (
          <ProLoadingState label="Loading exchange credit…" />
        ) : error && !returnState ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">{error}</div>
        ) : !returnRecord ? (
          <EmptyState title="Return document not found" action={<Link href={`/bills/${sale.id}`} className={secondary}>Back to bill</Link>} />
        ) : !creditNote ? (
          <section className={card}>
            <EmptyState
              title="Issue the credit note first"
              description="The physical return is not exchange currency by itself. The owner must first issue the immutable credit note so revenue and VAT are recognized correctly."
              action={<Link href={`/bills/${sale.id}/returns/${returnId}`} className={primary}>Issue credit note</Link>}
            />
          </section>
        ) : !sale.customerId || !customer ? (
          <section className={card}>
            <EmptyState
              title="Customer account required for this exchange phase"
              description="This invoice is a walk-in sale. LakBiz will not guess that return credit was cash, discount or card payment. Use normal refund settlement for this return until generalized multi-tender exchange allocation is implemented."
              action={<Link href={`/bills/${sale.id}/returns/${returnId}`} className={primary}>Open settlement</Link>}
            />
          </section>
        ) : (
          <div className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">{error}</div>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Credit note</p>
                <p className="mt-2 font-mono text-lg font-semibold text-teal-300">{creditNote.creditNoteNo}</p>
                <p className="mt-1 text-xs text-slate-400">{returnRecord.returnNo}</p>
              </div>
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-700">Return credit available</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-teal-950">{formatLkr(returnCredit)}</p>
                <p className="mt-1 text-xs text-teal-800">After earlier settlements</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Customer account</p>
                <p className="mt-2 truncate text-base font-semibold text-slate-950">{customer.name}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">Outstanding {formatLkr(customer.creditBalance)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Exchange links</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{currentReturnLinks.length}</p>
                <p className="mt-1 text-xs text-slate-500">Replacement invoices linked</p>
              </div>
            </section>

            {currentReturnLinks.length > 0 && (
              <section className={card}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">Exchange audit</p>
                    <h2 className="mt-1 text-base font-semibold text-slate-950">Already applied</h2>
                  </div>
                  <StatusBadge tone="positive">{currentReturnLinks.length}</StatusBadge>
                </div>
                <div className="mt-4 space-y-2">
                  {currentReturnLinks.map((link) => {
                    const replacement = data.sales.find((item) => item.id === link.replacementSaleId);
                    return (
                      <div key={link.settlementId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="font-mono text-xs font-bold text-slate-900">{replacement?.billNo ?? link.replacementSaleId.slice(0, 8)}</p>
                          <p className="mt-1 text-xs text-slate-500">{new Date(link.createdAt).toLocaleString("en-LK")}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-semibold text-teal-800">{formatLkr(link.amount)}</span>
                          <Link href={`/bills/${link.replacementSaleId}`} className="text-xs font-bold text-teal-700 hover:underline">Replacement bill</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {returnCredit <= 0.005 ? (
              <section className={card}>
                <EmptyState
                  title="Return credit is fully settled"
                  description="No additional exchange credit is available. Existing exchange/refund/receivable settlement history remains immutable."
                  action={<Link href={`/bills/${sale.id}/returns/${returnId}`} className={secondary}>View settlement history</Link>}
                />
              </section>
            ) : (
              <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className={card}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">Step 1</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Create the replacement invoice</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    In Sales, choose <strong>{customer.name}</strong>, add the replacement item(s), and select <strong>Credit</strong> as payment. Keep the invoice at its real full selling price. Do not enter the return credit as a discount and do not record a separate customer payment before linking it here.
                  </p>
                  <Link href="/sales" className={`${primary} mt-4 w-full`}>Open Sales / POS</Link>
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
                    First safe phase: exchanges require an existing customer account. This avoids inventing tender allocation for walk-in invoices.
                  </div>
                </div>

                <div className={card}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">Step 2</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Apply return credit to the new sale</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Only same-customer CREDIT invoices created after this credit note are eligible. A replacement invoice already used by another exchange is never offered twice.
                  </p>

                  {candidateSales.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                      No eligible replacement credit sale is available yet. Create it in Sales, then return to this page and refresh.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {candidateSales.map((candidate) => {
                        const selected = candidate.id === selectedSaleId;
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => {
                              setSelectedSaleId(candidate.id);
                              setRequestId("");
                              setError(null);
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                              selected
                                ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block font-mono text-xs font-bold text-slate-900">{candidate.billNo ?? candidate.id.slice(0, 8)}</span>
                              <span className="mt-1 block text-xs text-slate-500">{new Date(candidate.date).toLocaleString("en-LK")} · CREDIT sale</span>
                            </span>
                            <span className="shrink-0 font-mono text-sm font-bold text-slate-950">{formatLkr(candidate.creditAmount)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedSale && plan && (
                    <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">Credit applied</p>
                          <p className="mt-1 font-mono text-base font-semibold text-teal-300">{formatLkr(plan.appliedCredit)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">Customer still owes</p>
                          <p className="mt-1 font-mono text-base font-semibold text-white">{formatLkr(plan.replacementBalanceAfterCredit)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">Return credit left</p>
                          <p className="mt-1 font-mono text-base font-semibold text-white">{formatLkr(plan.remainingReturnCredit)}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-300">
                        {plan.replacementBalanceAfterCredit > 0
                          ? "Replacement costs more: only the price difference stays as normal customer receivable."
                          : plan.remainingReturnCredit > 0
                            ? "Replacement costs less: unused return credit stays open for another explicit settlement."
                            : "Equal-value exchange: the replacement receivable and return credit both settle exactly."}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!selectedSale || !plan || plan.appliedCredit <= 0 || posting}
                    onClick={() => void handleApplyExchange()}
                    className={`${primary} mt-4 w-full`}
                  >
                    {posting ? "Applying exchange credit…" : "Apply exchange credit"}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </ProMain>
    </AppShell>
  );
}
