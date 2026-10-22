"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  fetchSaleReturnSettlementState,
  issueSaleReturnCreditNote,
  saleReturnSchemaUnavailable,
  settleSaleReturnCredit,
  type SaleReturnExternalMethod,
  type SaleReturnSettlementRecord,
  type SaleReturnSettlementType,
} from "@/lib/supabase/sale-return-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const card =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.035)] sm:p-5";
const input =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";

type LoadedState = Awaited<ReturnType<typeof fetchSaleReturnSettlementState>>;

function settlementLabel(
  row: SaleReturnSettlementRecord,
  si: boolean,
  bankName?: string,
): string {
  if (row.settlementType === "receivable_reduction") {
    return si ? "Customer outstanding balance අඩු කළා" : "Reduced customer outstanding balance";
  }
  if (row.settlementType === "bank_refund") {
    return bankName
      ? `${si ? "Bank refund" : "Bank refund"} · ${bankName}`
      : si ? "Bank refund" : "Bank refund";
  }
  const method = row.externalMethod ? row.externalMethod.replaceAll("_", " ") : "external";
  return `${si ? "External refund" : "External refund"} · ${method}`;
}

export default function SaleReturnSettlementPage() {
  const params = useParams();
  const saleId = params.id as string;
  const returnId = params.returnId as string;
  const { data, ready } = useAppStore();
  const { org, orgRole } = useSubscription();
  const { locale } = useLocale();
  const si = locale === "si";

  const sale = data?.sales.find((item) => item.id === saleId) ?? null;
  const customer = sale?.customerId
    ? data?.customers.find((item) => item.id === sale.customerId)
    : undefined;

  const [state, setState] = useState<LoadedState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaUpgradeNeeded, setSchemaUpgradeNeeded] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [creditNoteRequestId, setCreditNoteRequestId] = useState("");

  const [settlementType, setSettlementType] =
    useState<SaleReturnSettlementType>("external_refund");
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [externalMethod, setExternalMethod] =
    useState<SaleReturnExternalMethod>("cash");
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [settlementRequestId, setSettlementRequestId] = useState("");

  const loadState = async () => {
    if (!org.id || !returnId) return;
    setLoading(true);
    setError(null);
    const result = await fetchSaleReturnSettlementState(org.id, returnId);
    if (saleReturnSchemaUnavailable(result.error)) {
      setSchemaUpgradeNeeded(true);
      setState(null);
    } else if (result.error) {
      setError(result.error);
      setState(null);
    } else {
      setSchemaUpgradeNeeded(false);
      setState(result);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!org.isAuthenticated || !org.id || orgRole !== "owner") return;
    void loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id, org.isAuthenticated, orgRole, returnId]);

  const settledTotal = useMemo(
    () => state?.settlements.reduce((sum, item) => sum + item.amount, 0) ?? 0,
    [state?.settlements],
  );
  const remaining = Math.max(0, (state?.creditNote?.grossCredit ?? 0) - settledTotal);

  useEffect(() => {
    if (!state?.creditNote || remaining <= 0) return;
    if (settlementType === "receivable_reduction") {
      setAmount(String(Math.min(remaining, customer?.creditBalance ?? 0)));
    } else {
      setAmount(String(remaining));
    }
    setSettlementRequestId("");
  }, [settlementType, remaining, state?.creditNote, customer?.creditBalance]);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={si ? "පූරණය වෙමින්…" : "Loading return settlement…"} />
        </ProMain>
      </AppShell>
    );
  }

  if (!sale) {
    return (
      <AppShell>
        <ProMain>
          <EmptyState
            title={si ? "බිල්පත සොයාගත නොහැක" : "Bill not found"}
            action={<Link href="/bills" className={primary}>{si ? "බිල්පත්" : "All bills"}</Link>}
          />
        </ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated || orgRole !== "owner") {
    return (
      <AppShell>
        <ProMain>
          <PageHeader title={si ? "Return financial settlement" : "Return financial settlement"} />
          <EmptyState
            title={si ? "Owner approval අවශ්‍යයි" : "Owner approval required"}
            description={
              si
                ? "Credit note, customer receivable සහ bank refund financial records owner account එකෙන් පමණක් post කළ හැක."
                : "Credit notes, customer receivable reductions and bank refunds can only be posted by the owner account."
            }
            action={<Link href={`/bills/${sale.id}`} className={secondary}>{si ? "බිල්පතට ආපසු" : "Back to bill"}</Link>}
          />
        </ProMain>
      </AppShell>
    );
  }

  const handleIssueCreditNote = async () => {
    if (!org.id || issuing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(si ? "Credit note එක online සිට issue කළ යුතුයි." : "Credit notes require an online connection.");
      return;
    }
    const id = creditNoteRequestId || crypto.randomUUID();
    if (!creditNoteRequestId) setCreditNoteRequestId(id);
    setIssuing(true);
    setError(null);
    const result = await issueSaleReturnCreditNote(org.id, returnId, id);
    setIssuing(false);
    if (!result.ok) {
      if (saleReturnSchemaUnavailable(result.error)) setSchemaUpgradeNeeded(true);
      else setError(result.error ?? (si ? "Credit note issue කළ නොහැක." : "Could not issue credit note."));
      return;
    }
    setCreditNoteRequestId("");
    await loadState();
  };

  const handlePostSettlement = async () => {
    if (!org.id || posting || !state?.creditNote) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(si ? "Settlement එක online සිට post කළ යුතුයි." : "Return settlement requires an online connection.");
      return;
    }

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > remaining + 0.005) {
      setError(si ? "නිවැරදි settlement amount එකක් ඇතුළත් කරන්න." : "Enter a valid settlement amount within the remaining credit.");
      return;
    }
    if (settlementType === "receivable_reduction") {
      if (!customer) {
        setError(si ? "මෙම sale එකට customer account එකක් නැත." : "This sale has no customer account to reduce.");
        return;
      }
      if (value > customer.creditBalance + 0.005) {
        setError(
          `${si ? "Customer outstanding balance" : "Customer outstanding balance"}: ${formatLkr(customer.creditBalance)}`,
        );
        return;
      }
    }
    if (settlementType === "bank_refund" && !bankAccountId) {
      setError(si ? "Refund bank account එක තෝරන්න." : "Choose the bank account funding the refund.");
      return;
    }

    const id = settlementRequestId || crypto.randomUUID();
    if (!settlementRequestId) setSettlementRequestId(id);
    setPosting(true);
    setError(null);
    const result = await settleSaleReturnCredit(org.id, returnId, id, {
      settlementType,
      amount: value,
      bankAccountId: settlementType === "bank_refund" ? bankAccountId : undefined,
      externalMethod: settlementType === "external_refund" ? externalMethod : undefined,
      note,
    });
    setPosting(false);
    if (!result.ok) {
      if (saleReturnSchemaUnavailable(result.error)) setSchemaUpgradeNeeded(true);
      else setError(result.error ?? (si ? "Settlement post කළ නොහැක." : "Could not post settlement."));
      return;
    }

    setSettlementRequestId("");
    setNote("");

    // Receivable/bank settlement changes AppData-backed rows and increments the
    // cloud sync generation. A full reload makes this device pull that exact
    // authoritative state before it can push any older local snapshot.
    if (settlementType === "receivable_reduction" || settlementType === "bank_refund") {
      window.location.reload();
      return;
    }
    await loadState();
  };

  const returnRecord = state?.returnRecord ?? null;
  const creditNote = state?.creditNote ?? null;
  const status = returnRecord?.settlementStatus ?? "pending";
  const bankById = new Map(data.bankAccounts.map((account) => [account.id, account] as const));

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={si ? "Return financial settlement" : "Return financial settlement"}
          description={`${sale.billNo ?? sale.id.slice(0, 8)} · ${sale.customerName || "Walk-in customer"}`}
          actions={<Link href={`/bills/${sale.id}`} className={secondary}>{si ? "← බිල්පත" : "← Back to bill"}</Link>}
        />

        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-950">
            {si ? "Original invoice එක වෙනස් නොකරයි." : "The original invoice remains immutable."}
          </p>
          <p className="mt-1">
            {si
              ? "Credit note එක revenue/VAT reversal එක record කරයි. Settlement entries වෙනම record කර customer outstanding balance හෝ selected bank account එක පමණක් explicit ලෙස වෙනස් කරයි."
              : "The credit note records the revenue/VAT reversal. Settlement entries are separate and only change the customer outstanding balance or a specifically selected bank account when you choose that method."}
          </p>
        </div>

        {schemaUpgradeNeeded ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">{si ? "Return-finance database upgrade අවශ්‍යයි" : "Return-finance database upgrade required"}</p>
            <p className="mt-2 leading-6 text-amber-800">
              {si
                ? "Credit-note / settlement migrations live LakBiz Supabase project එකට apply කරන තුරු මෙම page එක financial entries post නොකරයි."
                : "The credit-note / settlement migrations must be applied to the live LakBiz Supabase project before this page can post financial entries."}
            </p>
          </div>
        ) : loading ? (
          <ProLoadingState label={si ? "Return finance පූරණය වෙමින්…" : "Loading return finance…"} />
        ) : error && !state ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>
        ) : !returnRecord ? (
          <EmptyState
            title={si ? "Return document එක සොයාගත නොහැක" : "Return document not found"}
            action={<Link href={`/bills/${sale.id}`} className={secondary}>{si ? "බිල්පතට ආපසු" : "Back to bill"}</Link>}
          />
        ) : (
          <div className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-950 p-5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{returnRecord.returnNo}</p>
                <p className="mt-2 font-mono text-2xl font-semibold">{formatLkr(returnRecord.merchandiseValue)}</p>
                <p className="mt-1 text-xs text-slate-400">{si ? "Physical return value" : "Physical return value"}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">VAT reversal</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-amber-950">{formatLkr(returnRecord.outputVatReversal)}</p>
                <p className="mt-1 text-xs text-amber-800">{creditNote ? (si ? "Credit note issued" : "Credit note issued") : (si ? "Not posted yet" : "Not posted yet")}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{si ? "Settlement" : "Settlement"}</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{status.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-slate-500">{formatLkr(settledTotal)} {si ? "posted" : "posted"}</p>
              </div>
            </section>

            {!creditNote ? (
              <section className={card}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{si ? "Step 1" : "Step 1"}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{si ? "Credit note issue කරන්න" : "Issue the credit note"}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                      {si
                        ? "මෙය return value එක revenue වලින් සහ VAT output වලින් reverse කරන immutable accounting document එකයි. Money refund තවම වෙනම පියවරකි."
                        : "This creates the immutable accounting document that reverses the return value from revenue and output VAT. Refunding money remains a separate step."}
                    </p>
                  </div>
                  <button type="button" onClick={() => void handleIssueCreditNote()} disabled={issuing} className={primary}>
                    {issuing ? (si ? "Issuing…" : "Issuing…") : (si ? "Issue credit note" : "Issue credit note")}
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className={card}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{creditNote.creditNoteNo}</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">{si ? "Credit note issued" : "Credit note issued"}</h2>
                      <p className="mt-1 text-xs text-slate-500">{new Date(creditNote.issuedAt).toLocaleString("en-LK")}</p>
                    </div>
                    <StatusBadge tone={remaining <= 0.005 ? "positive" : "warning"}>
                      {remaining <= 0.005 ? (si ? "Settled" : "Settled") : `${formatLkr(remaining)} ${si ? "remaining" : "remaining"}`}
                    </StatusBadge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{si ? "Gross credit" : "Gross credit"}</p>
                      <p className="mt-1 font-mono text-lg font-semibold text-slate-950">{formatLkr(creditNote.grossCredit)}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">VAT reversal</p>
                      <p className="mt-1 font-mono text-lg font-semibold text-amber-950">{formatLkr(creditNote.outputVatReversal)}</p>
                    </div>
                    <div className="rounded-lg bg-teal-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700">{si ? "Net revenue reversal" : "Net revenue reversal"}</p>
                      <p className="mt-1 font-mono text-lg font-semibold text-teal-950">{formatLkr(creditNote.netRevenueReversal)}</p>
                    </div>
                  </div>
                </section>

                {state?.settlements.length ? (
                  <section className={card}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{si ? "Settlement ledger" : "Settlement ledger"}</p>
                        <h2 className="mt-1 text-lg font-semibold text-slate-950">{si ? "Posted entries" : "Posted entries"}</h2>
                      </div>
                      <StatusBadge tone="info">{state.settlements.length}</StatusBadge>
                    </div>
                    <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {state.settlements.map((row) => (
                        <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {settlementLabel(row, si, row.bankAccountId ? bankById.get(row.bankAccountId)?.bankName : undefined)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {new Date(row.createdAt).toLocaleString("en-LK")}{row.note ? ` · ${row.note}` : ""}
                            </p>
                          </div>
                          <p className="font-mono text-sm font-semibold text-slate-950">{formatLkr(row.amount)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {remaining > 0.005 && (
                  <section className={card}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{si ? "Step 2" : "Step 2"}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{si ? "Credit එක settle කරන්න" : "Settle the return credit"}</h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                      {si
                        ? "Partial settlement allowed. Example: customer outstanding balance එක reduce කර ඉතිරි amount එක bank refund කරන්න."
                        : "Partial settlement is allowed. For example, reduce the customer's outstanding balance first, then refund the remainder from a bank account."}
                    </p>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        {si ? "Settlement method" : "Settlement method"}
                        <select
                          value={settlementType}
                          onChange={(event) => {
                            setSettlementType(event.target.value as SaleReturnSettlementType);
                            setError(null);
                            setSettlementRequestId("");
                          }}
                          className={`${input} mt-1.5`}
                        >
                          {customer && customer.creditBalance > 0 && (
                            <option value="receivable_reduction">{si ? "Reduce customer outstanding balance" : "Reduce customer outstanding balance"}</option>
                          )}
                          {data.bankAccounts.length > 0 && (
                            <option value="bank_refund">{si ? "Refund from LakBiz bank account" : "Refund from LakBiz bank account"}</option>
                          )}
                          <option value="external_refund">{si ? "Record refund handled outside LakBiz" : "Record refund handled outside LakBiz"}</option>
                        </select>
                      </label>

                      <label className="text-xs font-semibold text-slate-600">
                        {si ? "Amount" : "Amount"}
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={remaining}
                          value={amount}
                          onChange={(event) => {
                            setAmount(event.target.value);
                            setError(null);
                            setSettlementRequestId("");
                          }}
                          className={`${input} mt-1.5`}
                        />
                        <span className="mt-1.5 block text-[11px] font-medium text-slate-400">{formatLkr(remaining)} {si ? "remaining" : "remaining"}</span>
                      </label>
                    </div>

                    {settlementType === "receivable_reduction" && (
                      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                        <p className="font-semibold">{customer?.name}</p>
                        <p className="mt-1 text-xs text-blue-800">{si ? "Current outstanding" : "Current outstanding"}: {formatLkr(customer?.creditBalance ?? 0)}</p>
                        <p className="mt-1 text-xs leading-5 text-blue-800">
                          {si ? "මෙය customer account total receivable එක අඩු කරයි. Individual payment allocation guess නොකරයි." : "This reduces the customer's aggregate receivable. It does not guess which historical payment was applied to this invoice."}
                        </p>
                      </div>
                    )}

                    {settlementType === "bank_refund" && (
                      <label className="mt-4 block text-xs font-semibold text-slate-600">
                        {si ? "Refund bank account" : "Refund bank account"}
                        <select
                          value={bankAccountId}
                          onChange={(event) => {
                            setBankAccountId(event.target.value);
                            setError(null);
                            setSettlementRequestId("");
                          }}
                          className={`${input} mt-1.5`}
                        >
                          <option value="">{si ? "Account තෝරන්න" : "Choose account"}</option>
                          {data.bankAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.bankName} · {account.accountNumber} · {formatLkr(account.balance)}
                            </option>
                          ))}
                        </select>
                        <span className="mt-1.5 block text-[11px] font-medium leading-5 text-slate-400">
                          {si ? "Selected account balance එකෙන් withdrawal transaction එකක් automatically post වේ." : "A withdrawal transaction will be posted automatically against the selected account."}
                        </span>
                      </label>
                    )}

                    {settlementType === "external_refund" && (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-600">
                          {si ? "External refund method" : "External refund method"}
                          <select
                            value={externalMethod}
                            onChange={(event) => {
                              setExternalMethod(event.target.value as SaleReturnExternalMethod);
                              setError(null);
                              setSettlementRequestId("");
                            }}
                            className={`${input} mt-1.5`}
                          >
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="cheque">Cheque</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
                          {si ? "LakBiz තුළ cash/card-clearing ledger එකක් නැති නිසා මෙය external settlement record එකක් පමණි; fake bank movement එකක් create නොකරයි." : "LakBiz has no cash/card-clearing ledger, so this records an external settlement only; it does not fabricate a bank movement."}
                        </div>
                      </div>
                    )}

                    <label className="mt-4 block text-xs font-semibold text-slate-600">
                      {si ? "Settlement note (optional)" : "Settlement note (optional)"}
                      <input
                        type="text"
                        value={note}
                        onChange={(event) => {
                          setNote(event.target.value);
                          setSettlementRequestId("");
                        }}
                        placeholder={si ? "Reference / reason" : "Reference / reason"}
                        className={`${input} mt-1.5`}
                      />
                    </label>

                    {sale.paymentMethod === "cheque" && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
                        {si ? "Original sale එක cheque නම්, මෙම credit-note settlement එක original cheque status එක auto-cancel නොකරයි. Cheque ledger එක separately reconcile කරන්න." : "Because the original sale used a cheque, this credit-note settlement does not auto-cancel or change that original cheque. Reconcile the cheque ledger separately."}
                      </div>
                    )}

                    {error && (
                      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>
                    )}

                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="max-w-2xl text-xs leading-5 text-slate-500">
                        {si ? "Posted settlement entries immutable audit history ලෙස තබා ඇත." : "Posted settlement entries are preserved as immutable financial audit history."}
                      </p>
                      <button type="button" onClick={() => void handlePostSettlement()} disabled={posting} className={primary}>
                        {posting ? (si ? "Posting…" : "Posting…") : (si ? "Post settlement" : "Post settlement")}
                      </button>
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
