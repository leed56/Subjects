"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProPageHeader } from "@/components/ui/pro-shell";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { invoicePending, loadInvoiceWorkspace, saveReceiptInvoice, type InvoiceWorkspace } from "@/lib/supabase/receipt-invoices";
import { formatLkr } from "@/lib/format";
import { purchaseLineMinor } from "@/lib/landed-cost";
import { InvoiceCashSettlement } from "@/components/invoice-cash-settlement";

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const field = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50";
const button = "min-h-11 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";

export default function SupplierInvoicesPage() {
  const { org, orgRole, isReadOnly, can } = useSubscription();
  const { data } = useAppStore();
  const [loaded, setLoaded] = useState<InvoiceWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [vat, setVat] = useState("0");
  const [rates, setRates] = useState<Record<string, string>>({});
  const [settlementInvoice, setSettlementInvoice] = useState("");
  const lock = useRef(false);
  const generation = useRef({ value: 0 });
  const owner = orgRole === "owner";
  const scope = `${org.id}:${orgRole}:${org.isAuthenticated}`;
  const activeScope = useRef(scope); activeScope.current = scope;
  const snapshot = loaded?.organizationId === org.id ? loaded : null;
  const writable = owner && org.isAuthenticated && !isReadOnly && can("write") && snapshot?.enabled;
  const order = data?.purchaseOrders.find(row => row.id === orderId);
  const receipts = snapshot?.receipts.filter(row => row.purchase_order_id === orderId && !snapshot.billed.includes(row.receipt_id)) ?? [];
  const lines = receipts.filter(row => selected.includes(row.receipt_id)).flatMap(receipt => receipt.request_lines.map(line => ({ receipt_id: receipt.receipt_id, line_id: line.line_id, qty: Number(line.qty), orderLine: order?.lines.find(item => item.id === line.line_id) })));
  const rateKey = (receipt: string, line: string) => `${receipt}:${line}`;
  let subtotal: number | null = null;
  if (lines.length) {
    try { const amount = lines.reduce((total, line) => total + purchaseLineMinor(line.qty, Number(rates[rateKey(line.receipt_id, line.line_id)] ?? line.orderLine?.unitCost ?? NaN)), 0); if (Number.isSafeInteger(amount)) subtotal = amount / 100; }
    catch { /* Invalid drafts remain editable; no approximate total is shown. */ }
  }
  const refresh = useCallback(async () => {
    const request = ++generation.current.value;
    if (!org.id || !org.isAuthenticated || !owner) { setLoaded(null); setLoading(false); return; }
    setLoading(true);
    try { const next = await loadInvoiceWorkspace(org.id); if (request === generation.current.value) { setLoaded(next); setPending(invoicePending(org.id, next.userId)); setError(""); } }
    catch (failure) { if (request === generation.current.value) { setLoaded(null); setError(failure instanceof Error ? failure.message : "Invoices could not be loaded."); } }
    finally { if (request === generation.current.value) setLoading(false); }
  }, [org.id, org.isAuthenticated, owner]);
  useEffect(() => { const requests = generation.current; setSelected([]); setOrderId(""); setRates({}); setNumber(""); setDate(""); setVat("0"); setMessage(""); setPending(false); setBusy(false); setSettlementInvoice(""); void refresh(); return () => { requests.value++; }; }, [refresh]);

  async function save(resume = false) {
    if (lock.current || !writable || !snapshot || !org.id) return;
    const captured = scope; lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      if (!resume && (!lines.length || lines.some(line => !line.orderLine))) throw Error("Reload the purchase orders before billing these delivery lines.");
      const next = await saveReceiptInvoice(org.id, snapshot.userId, resume ? undefined : { receiptIds: selected, number, date, vat: Number(vat), lines: lines.map(line => ({ receipt_id: line.receipt_id, line_id: line.line_id, unit_cost: Number(rates[rateKey(line.receipt_id, line.line_id)] ?? line.orderLine?.unitCost ?? NaN) })) });
      if (activeScope.current !== captured) return;
      setLoaded(next); setSelected([]); setRates({}); setNumber(""); setVat("0"); setPending(false); setMessage("Supplier invoice recorded. Received stock was preserved. Review the bill in invoice history.");
    } catch (failure) { if (activeScope.current === captured) setError(failure instanceof Error ? failure.message : "Invoice could not finish. Your draft has been kept."); }
    finally { lock.current = false; if (activeScope.current === captured) { setBusy(false); try { setPending(invoicePending(org.id, snapshot.userId)); } catch { setPending(true); } } }
  }
  return <AppShell><ProMain>
    <ProPageHeader eyebrow="Supplier accounts" title="Delivery-linked invoices" description="Match supplier bills to received goods, with VAT separated and a permanent audit trail." actions={<Link href="/suppliers" className="text-sm font-bold text-teal-800">Back to suppliers →</Link>} />
    {!owner ? <p className={card}>Owner access is required to review supplier costs and invoices.</p> : <>
      {error && <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p>{error}</p><button disabled={busy || loading} className="mt-3 min-h-11 font-bold underline" onClick={() => void refresh()}>Reload invoice history</button></div>}
      {message && <p role="status" className="mb-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">{message}</p>}
      {loading && <p role="status" className={card}>Loading supplier invoices…</p>}
      {!org.isAuthenticated && <p className={card}>Connect an authenticated company to review received deliveries and supplier bills.</p>}
      {snapshot && <>
        {settlementInvoice && org.id && <InvoiceCashSettlement key={`${org.id}:${settlementInvoice}`} org={org.id} invoice={settlementInvoice} writable={Boolean(writable)} onClose={() => setSettlementInvoice("")} />}
        {!snapshot.enabled && <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Recording bills awaits the purchasing rollout and company certification.</p>}
        {pending && <section className={`${card} mb-5`}><h2 className="font-bold">An invoice needs confirmation</h2><p className="mt-2 text-sm text-slate-600">Check the original request before entering another bill.</p><button className={`${button} mt-3`} disabled={busy || !writable} onClick={() => void save(true)}>Check pending invoice</button></section>}
        <form onSubmit={event => { event.preventDefault(); void save(); }} className="grid items-start gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className={card}><h2 className="text-lg font-bold">Match received deliveries</h2><p className="mt-1 text-sm text-slate-500">Choose complete deliveries from one order. Quantities come from the receipt audit.</p><fieldset disabled={busy || pending || !writable} className="mt-4 space-y-4">
            <label className="block text-sm font-semibold">Purchase order<select className={field} value={orderId} onChange={event => { setOrderId(event.target.value); setSelected([]); setRates({}); }}><option value="">Choose a received order</option>{data?.purchaseOrders.filter(po => snapshot.receipts.some(receipt => receipt.purchase_order_id === po.id && !snapshot.billed.includes(receipt.receipt_id))).map(po => <option key={po.id} value={po.id}>{po.poNo} · {po.supplierName}</option>)}</select></label>
            {!receipts.length && <p className="text-sm text-slate-500">Choose an order with an uninvoiced delivery to begin.</p>}
            {receipts.map(receipt => <label key={receipt.receipt_id} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={selected.includes(receipt.receipt_id)} onChange={event => setSelected(current => event.target.checked ? [...current, receipt.receipt_id] : current.filter(id => id !== receipt.receipt_id))} /><span className="min-w-0"><span className="block font-semibold">Received {new Date(receipt.received_at).toLocaleDateString()}</span><span className="block break-all text-xs text-slate-500">{receipt.receipt_id}</span></span></label>)}
            {lines.map(line => <label key={rateKey(line.receipt_id, line.line_id)} className="block rounded-xl bg-slate-50 p-3 text-sm font-semibold">{line.orderLine?.productName ?? "Purchase line unavailable"}<span className="mt-1 block text-xs font-normal text-slate-500">Quantity {line.qty} · invoice rate (LKR)</span><input required className={field} type="number" min="0" step="0.01" value={rates[rateKey(line.receipt_id, line.line_id)] ?? String(line.orderLine?.unitCost ?? "")} onChange={event => setRates(current => ({ ...current, [rateKey(line.receipt_id, line.line_id)]: event.target.value }))} /></label>)}
          </fieldset></section>
          <section className={card}><h2 className="text-lg font-bold">Supplier bill</h2><fieldset disabled={busy || pending || !writable} className="mt-4 space-y-4">
            <label className="block text-sm font-semibold">Supplier invoice number<input required maxLength={100} className={field} value={number} onChange={event => setNumber(event.target.value)} /></label>
            <label className="block text-sm font-semibold">Invoice date<input required type="date" className={field} value={date} onChange={event => setDate(event.target.value)} /></label>
            <label className="block text-sm font-semibold">Recoverable input VAT (LKR)<input required type="number" min="0" step="0.01" className={field} value={vat} onChange={event => setVat(event.target.value)} /></label>
            <dl className="space-y-3 rounded-xl bg-slate-950 p-4 text-sm text-white"><div className="flex justify-between gap-3"><dt>Received goods</dt><dd>{subtotal === null ? "—" : formatLkr(subtotal)}</dd></div><div className="flex justify-between gap-3"><dt>Input VAT</dt><dd>{formatLkr(Number(vat) || 0)}</dd></div><div className="flex justify-between gap-3 border-t border-white/20 pt-3 font-bold"><dt>Supplier payable</dt><dd>{subtotal === null ? "—" : formatLkr(subtotal + (Number(vat) || 0))}</dd></div></dl>
            <button className={`${button} w-full`} disabled={!lines.length} type="submit">{busy ? "Confirming invoice…" : "Record supplier invoice"}</button>
          </fieldset></section>
        </form>
        <section className={`${card} mt-5`}><h2 className="text-lg font-bold">Invoice history</h2><p className="mt-1 text-sm text-slate-500">Each bill links to existing deliveries. Supplier payments are reviewed separately.</p>{!snapshot.invoices.length ? <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No delivery-linked supplier invoices yet.</p> : <ul className="mt-4 divide-y divide-slate-100">{snapshot.invoices.map(invoice => <li key={invoice.id} className="flex flex-wrap justify-between gap-3 py-4"><div><p className="font-bold">{invoice.supplier_invoice_no}</p><p className="mt-1 text-sm text-slate-500">{data?.suppliers.find(supplier => supplier.id === invoice.supplier_id)?.name ?? "Supplier"} · {invoice.invoice_date}</p></div><div className="text-right"><p className="font-mono font-bold">{formatLkr(Number(invoice.total_minor) / 100)}</p><p className="mt-1 text-xs text-slate-500">Input VAT {formatLkr(Number(invoice.input_vat_minor) / 100)}</p><button className="mt-2 min-h-11 text-sm font-bold text-teal-800" onClick={() => setSettlementInvoice(invoice.id)}>Review / pay cash</button></div></li>)}</ul>}</section>
      </>}
    </>}
  </ProMain></AppShell>;
}
