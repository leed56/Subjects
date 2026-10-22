"use client";
import { useEffect, useRef, useState } from "react";
import { bankSettlementPending, cashSettlementPending, loadInvoiceSettlement, saveInvoiceCashSettlement, type InvoiceSettlement } from "@/lib/supabase/invoice-settlements";
import { formatLkr } from "@/lib/format";
import { useAppStore } from "@/lib/store/use-app-store";
const field = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-50";
const button = "min-h-11 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
export function InvoiceCashSettlement({ org, invoice, writable, onClose }: { org: string; invoice: string; writable: boolean; onClose: () => void }) {
  const { data, recordInvoiceBankSettlementToCloud } = useAppStore();
  const [snapshot, setSnapshot] = useState<InvoiceSettlement | null>(null);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [pending, setPending] = useState(false);
  const [amount, setAmount] = useState(""); const [date, setDate] = useState(""); const [note, setNote] = useState(""); const [reload, setReload] = useState(0);
  const [bankPending, setBankPending] = useState(false); const [account, setAccount] = useState(""); const [bankAmount, setBankAmount] = useState(""); const [rate, setRate] = useState(""); const [fee, setFee] = useState("0"); const [bankDate, setBankDate] = useState(""); const [bankNote, setBankNote] = useState("");
  const lock = useRef(false); const generation = useRef({ value: 0 });
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, []);
  useEffect(() => { const requests = generation.current; const request = ++requests.value; setSnapshot(null); setError("");
    void loadInvoiceSettlement(org, invoice).then(value => { if (request === requests.value) { setSnapshot(value); setPending(cashSettlementPending(org, value.userId)); setBankPending(bankSettlementPending(org, value.userId)); } }).catch(failure => { if (request === requests.value) setError(failure instanceof Error ? failure.message : "Could not load payments."); });
    return () => { requests.value++; };
  }, [org, invoice, reload]);
  const current = snapshot?.organization_id === org ? snapshot : null;
  const outstanding = current ? (Number(current.total_minor) - Number(current.paid_minor)) / 100 : 0;
  const foreignOutstanding = current?.foreign_total_minor != null ? (current.foreign_total_minor - (current.foreign_paid_minor ?? 0)) / 100 : null;
  async function save(resume = false) {
    if (!current || !writable || lock.current) return;
    const request = generation.current.value; lock.current = true; setBusy(true); setError(""); setMessage("");
    try { const value = await saveInvoiceCashSettlement(org, current.userId, resume ? undefined : { invoiceId: current.invoice_id, amount: Number(amount), date, note });
      if (request === generation.current.value) { setSnapshot(value); setAmount(""); setNote(""); setMessage("Cash payment confirmed. The invoice balance and supplier payable were updated together."); }
    } catch (failure) { if (request === generation.current.value) setError(failure instanceof Error ? failure.message : "Payment failed. Your draft was kept."); }
    finally { lock.current = false; if (request === generation.current.value) { setBusy(false); try { setPending(cashSettlementPending(org, current.userId)); } catch { setPending(true); } } }
  }
  async function saveBank(resume = false) {
    if (!current || !writable || lock.current) return;
    const request = generation.current.value; lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const result = await recordInvoiceBankSettlementToCloud(resume ? undefined : { invoiceId: current.invoice_id, accountId: account, amount: Number(bankAmount), exchangeRate: current.currency && current.currency !== "LKR" ? Number(rate) : 1, fee: Number(fee), date: bankDate, note: bankNote });
      if (!result.ok) throw Error(result.error ?? "Payment could not be confirmed.");
      if (request === generation.current.value) { if (result.invoice?.invoice_id === invoice) setSnapshot(result.invoice); else setReload(value => value + 1); setBankAmount(""); setBankNote(""); setMessage("Bank payment confirmed. Supplier and bank balances were refreshed."); }
    } catch (failure) { if (request === generation.current.value) setError(failure instanceof Error ? failure.message : "Payment failed. Your draft was kept."); }
    finally { lock.current = false; if (request === generation.current.value) { setBusy(false); try { setBankPending(bankSettlementPending(org, current.userId)); } catch { setBankPending(true); } } }
  }
  return <section ref={panel} tabIndex={-1} aria-label="Invoice cash settlement" className="mb-5 mt-5 scroll-mt-5 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Invoice settlement</p><h2 className="mt-1 text-lg font-bold">{current?.number ?? "Cash payment"}</h2></div><button className="min-h-11 px-3 text-sm font-semibold" disabled={busy} onClick={onClose}>Close payment</button></div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{message}</p>}
    {!current && !error && <p role="status" className="mt-3 text-sm">Loading invoice balance…</p>}
    {!current && error && <button className={`${button} mt-3`} onClick={() => setReload(value => value + 1)}>Retry payment details</button>}
    {current && <><dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-950 p-4 text-white">{[["Invoice", Number(current.total_minor) / 100], ["Paid", Number(current.paid_minor) / 100], ["Outstanding", outstanding]].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-slate-300">{label}</dt><dd className="mt-1 break-words font-bold">{formatLkr(Number(value))}</dd></div>)}</dl>
      {current.currency && current.currency !== "LKR" && foreignOutstanding != null && <p className="mt-3 text-sm font-semibold text-slate-700">Foreign amount outstanding: {current.currency} {foreignOutstanding.toFixed(2)}</p>}
      <button className="mt-2 min-h-11 text-sm font-semibold text-teal-800 disabled:opacity-50" disabled={busy} onClick={() => setReload(value => value + 1)}>Refresh invoice balance</button>
      {pending && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p>A cash payment needs confirmation. Check the original request before entering another payment.</p><button className={`${button} mt-3`} disabled={busy || !writable} onClick={() => void save(true)}>Check pending cash payment</button></div>}
      {current.currency && current.currency !== "LKR" && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This {current.currency} invoice requires a foreign-currency bank settlement. Cash entry is available for LKR invoices.</p>}
      <form className="mt-4" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy || pending || bankPending || !writable || outstanding <= 0 || Boolean(current.currency && current.currency !== "LKR")} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Cash amount (LKR)<input required type="number" min="0.01" step="0.01" max={outstanding} className={field} value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <label className="text-sm font-semibold">Payment date<input required type="date" min={current.invoice_date} className={field} value={date} onChange={event => setDate(event.target.value)} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Receipt reference / note<input maxLength={500} className={field} value={note} onChange={event => setNote(event.target.value)} /></label>
        <button className={button} type="submit">{busy ? "Confirming payment…" : "Record cash payment"}</button>
      </fieldset></form>
      <p className="mt-3 text-xs text-slate-500">Use cash entry for money already paid to the supplier.</p>
      <div className="mt-6 border-t border-slate-200 pt-5"><h3 className="font-bold">Record bank payment</h3><p className="mt-1 text-sm text-slate-500">Record a transfer already made to the supplier. Include the actual payment rate and any bank fee.</p>
      {bankPending && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p>A bank payment needs confirmation before another can be recorded.</p><button type="button" className={`${button} mt-3`} disabled={busy || !writable} onClick={() => void saveBank(true)}>Check pending bank payment</button></div>}
      <form className="mt-4" onSubmit={event => { event.preventDefault(); void saveBank(); }}><fieldset disabled={busy || bankPending || pending || !writable || (current.currency && current.currency !== "LKR" ? foreignOutstanding == null || foreignOutstanding <= 0 : outstanding <= 0)} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Bank account<select required className={field} value={account} onChange={event => setAccount(event.target.value)}><option value="">Select an account</option>{data?.bankAccounts.map(row => <option key={row.id} value={row.id}>{row.bankName} · {row.accountNumber}</option>)}</select></label>
        <label className="text-sm font-semibold">Payment amount ({current.currency ?? "LKR"})<input required type="number" min="0.01" step="0.01" max={current.currency && current.currency !== "LKR" && current.foreign_total_minor != null ? (current.foreign_total_minor - (current.foreign_paid_minor ?? 0)) / 100 : outstanding} className={field} value={bankAmount} onChange={event => setBankAmount(event.target.value)} /></label>
        {current.currency && current.currency !== "LKR" && <label className="text-sm font-semibold">Payment rate (LKR per {current.currency})<input required type="number" min="0.000001" step="0.000001" className={field} value={rate} onChange={event => setRate(event.target.value)} /></label>}
        <label className="text-sm font-semibold">Bank fee (LKR)<input required type="number" min="0" step="0.01" className={field} value={fee} onChange={event => setFee(event.target.value)} /></label>
        <label className="text-sm font-semibold">Payment date<input required type="date" min={current.invoice_date} className={field} value={bankDate} onChange={event => setBankDate(event.target.value)} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Transfer reference / note<input maxLength={500} className={field} value={bankNote} onChange={event => setBankNote(event.target.value)} /></label>
        <button className={button} type="submit">{busy ? "Confirming payment…" : "Record bank payment"}</button>
      </fieldset></form>{current.bank_payments && current.bank_payments.length > 0 && <><h4 className="mt-5 text-sm font-bold">Recent bank payments</h4><ul className="mt-2 divide-y divide-slate-100">{current.bank_payments.map(payment => <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{payment.payment_date}<span className="block text-xs text-slate-500">FX difference {formatLkr(Number(payment.exchange_difference_minor) / 100)} · fee {formatLkr(Number(payment.fee_minor) / 100)}</span></span><strong>{formatLkr(Number(payment.paid_minor) / 100)}</strong></li>)}</ul></>}</div>
      <h3 className="mt-5 font-bold">Recent cash payments</h3>{!current.payments.length ? <p className="mt-2 text-sm text-slate-500">No cash settlements recorded.</p> : <ul className="mt-2 divide-y divide-slate-100">{current.payments.map(payment => <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{payment.payment_date}<span className="block break-words text-xs text-slate-500">{payment.note}</span></span><strong>{formatLkr(Number(payment.amount_minor) / 100)}</strong></li>)}</ul>}
      {current.payments.length === 50 && <p className="mt-2 text-xs text-slate-500">Showing the latest 50 payments. The paid total includes every settlement.</p>}
    </>}
  </section>;
}
