"use client";
import { useEffect, useRef, useState } from "react";
import { cashSettlementPending, loadInvoiceSettlement, saveInvoiceCashSettlement, type InvoiceSettlement } from "@/lib/supabase/invoice-settlements";
import { formatLkr } from "@/lib/format";
const field = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-50";
const button = "min-h-11 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
export function InvoiceCashSettlement({ org, invoice, writable, onClose }: { org: string; invoice: string; writable: boolean; onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<InvoiceSettlement | null>(null);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [pending, setPending] = useState(false);
  const [amount, setAmount] = useState(""); const [date, setDate] = useState(""); const [note, setNote] = useState(""); const [reload, setReload] = useState(0);
  const lock = useRef(false); const generation = useRef({ value: 0 });
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, []);
  useEffect(() => { const requests = generation.current; const request = ++requests.value; setSnapshot(null); setError("");
    void loadInvoiceSettlement(org, invoice).then(value => { if (request === requests.value) { setSnapshot(value); setPending(cashSettlementPending(org, value.userId)); } }).catch(failure => { if (request === requests.value) setError(failure instanceof Error ? failure.message : "Could not load payments."); });
    return () => { requests.value++; };
  }, [org, invoice, reload]);
  const current = snapshot?.organization_id === org ? snapshot : null;
  const outstanding = current ? (Number(current.total_minor) - Number(current.paid_minor)) / 100 : 0;
  async function save(resume = false) {
    if (!current || !writable || lock.current) return;
    const request = generation.current.value; lock.current = true; setBusy(true); setError(""); setMessage("");
    try { const value = await saveInvoiceCashSettlement(org, current.userId, resume ? undefined : { invoiceId: current.invoice_id, amount: Number(amount), date, note });
      if (request === generation.current.value) { setSnapshot(value); setAmount(""); setNote(""); setMessage("Cash payment confirmed. The invoice balance and supplier payable were updated together."); }
    } catch (failure) { if (request === generation.current.value) setError(failure instanceof Error ? failure.message : "Payment failed. Your draft was kept."); }
    finally { lock.current = false; if (request === generation.current.value) { setBusy(false); try { setPending(cashSettlementPending(org, current.userId)); } catch { setPending(true); } } }
  }
  return <section ref={panel} tabIndex={-1} aria-label="Invoice cash settlement" className="mb-5 mt-5 scroll-mt-5 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Invoice settlement</p><h2 className="mt-1 text-lg font-bold">{current?.number ?? "Cash payment"}</h2></div><button className="min-h-11 px-3 text-sm font-semibold" disabled={busy} onClick={onClose}>Close payment</button></div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{message}</p>}
    {!current && !error && <p role="status" className="mt-3 text-sm">Loading invoice balance…</p>}
    {!current && error && <button className={`${button} mt-3`} onClick={() => setReload(value => value + 1)}>Retry payment details</button>}
    {current && <><dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-950 p-4 text-white">{[["Invoice", Number(current.total_minor) / 100], ["Cash paid", Number(current.paid_minor) / 100], ["Outstanding", outstanding]].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-slate-300">{label}</dt><dd className="mt-1 break-words font-bold">{formatLkr(Number(value))}</dd></div>)}</dl>
      <button className="mt-2 min-h-11 text-sm font-semibold text-teal-800 disabled:opacity-50" disabled={busy} onClick={() => setReload(value => value + 1)}>Refresh invoice balance</button>
      {pending && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p>A cash payment needs confirmation. Check the original request before entering another payment.</p><button className={`${button} mt-3`} disabled={busy || !writable} onClick={() => void save(true)}>Check pending cash payment</button></div>}
      <form className="mt-4" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy || pending || !writable || outstanding <= 0} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Cash amount (LKR)<input required type="number" min="0.01" step="0.01" max={outstanding} className={field} value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <label className="text-sm font-semibold">Payment date<input required type="date" min={current.invoice_date} className={field} value={date} onChange={event => setDate(event.target.value)} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Receipt reference / note<input maxLength={500} className={field} value={note} onChange={event => setNote(event.target.value)} /></label>
        <button className={button} type="submit">{busy ? "Confirming payment…" : "Record cash payment"}</button>
      </fieldset></form>
      <p className="mt-3 text-xs text-slate-500">Use this for cash already paid to the supplier. Bank transfers and foreign-currency settlement are not available here.</p>
      <h3 className="mt-5 font-bold">Recent cash payments</h3>{!current.payments.length ? <p className="mt-2 text-sm text-slate-500">No cash settlements recorded.</p> : <ul className="mt-2 divide-y divide-slate-100">{current.payments.map(payment => <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{payment.payment_date}<span className="block break-words text-xs text-slate-500">{payment.note}</span></span><strong>{formatLkr(Number(payment.amount_minor) / 100)}</strong></li>)}</ul>}
      {current.payments.length === 50 && <p className="mt-2 text-xs text-slate-500">Showing the latest 50 payments. The paid total includes every settlement.</p>}
    </>}
  </section>;
}
