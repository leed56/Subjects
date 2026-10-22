"use client";
import { useEffect, useRef, useState } from "react";
import { loadSupplierStatement, type SupplierStatement as Statement } from "@/lib/supabase/invoice-settlements";
import { formatLkr } from "@/lib/format";
import type { LedgerEntry } from "@/lib/ledger";
export function SupplierStatement({ org, supplier, entries, onClose }: { org?: string; supplier: { id: string; name: string; payableBalance: number }; entries: (LedgerEntry & { balance: number })[]; onClose: () => void }) {
  const [statement, setStatement] = useState<Statement | null>(null); const [loading, setLoading] = useState(Boolean(org)); const [error, setError] = useState(""); const [page, setPage] = useState(0); const [attempt, setAttempt] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; closeButton.current?.focus();
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close.current(); } else if (event.key === "Tab" && !dialog.current?.contains(document.activeElement)) { event.preventDefault(); closeButton.current?.focus(); } };
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); document.body.style.overflow = overflow; if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  useEffect(() => { let active = true; setStatement(null); setError(""); if (!org) { setLoading(false); return; } setLoading(true);
    void loadSupplierStatement(org, supplier.id, page).then(value => { if (active) setStatement(value); }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : "Statement could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [org, supplier.id, page, attempt]);
  const current = statement && statement.organization_id === org && statement.supplier_id === supplier.id ? statement : null;
  const rows = current ? current.entries.map(entry => ({ date: entry.date, label: entry.label, amount: Number(entry.amount_minor) / 100, balance: Number(entry.balance_minor) / 100 })) : entries;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><section ref={dialog} role="dialog" aria-modal="true" aria-label="Supplier statement" className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-5 shadow-xl" onKeyDown={event => {
    if (event.key === "Tab") { const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])'); const first = controls[0]; const last = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
  }}>
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Supplier statement</p><h2 className="mt-2 text-xl font-bold">{supplier.name}</h2><p className="mt-1 text-sm text-slate-600">Payable: {loading || error ? "—" : formatLkr(current ? Number(current.payable_balance) : supplier.payableBalance)}</p></div><button ref={closeButton} aria-label="Close supplier statement" className="min-h-11 px-3 text-sm font-semibold" onClick={onClose}>Close</button></div>
    {loading ? <p role="status" className="py-8 text-sm">Loading supplier statement…</p> : error ? <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"><p>{error}</p><button className="mt-2 min-h-11 font-bold underline" onClick={() => setAttempt(value => value + 1)}>Retry statement</button></div> : <>
      {current && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Opening / reconciliation balance: {formatLkr(Number(current.opening_minor) / 100)}. Includes legacy credit GRNs, supplier payments, delivery-linked invoices and cash settlements.</p>}
      <div className="mt-4 overflow-auto rounded-xl border border-slate-200">{!rows.length ? <p className="p-5 text-sm text-slate-500">No supplier transactions recorded.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Date / details</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Balance</th></tr></thead><tbody>{rows.map((entry, index) => <tr key={index} className="border-t border-slate-100"><td className="p-3"><span className="block text-xs text-slate-500">{new Date(entry.date).toLocaleDateString("en-LK")}</span>{entry.label}</td><td className="p-3 text-right font-mono">{formatLkr(entry.amount)}</td><td className="p-3 text-right font-mono font-bold">{formatLkr(entry.balance)}</td></tr>)}</tbody></table>}</div>
      {current && <div className="mt-4 flex items-center justify-between gap-2 text-sm"><button className="min-h-11 px-3 font-semibold disabled:opacity-40" disabled={!page} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} · {current.count} entries</span><button className="min-h-11 px-3 font-semibold disabled:opacity-40" disabled={(page + 1) * 50 >= Number(current.count)} onClick={() => setPage(value => value + 1)}>Next</button></div>}
    </>}
  </section></div>;
}
