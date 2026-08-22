"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  fetchSaleReturns,
  saleReturnSchemaUnavailable,
  type SaleCreditNoteRecord,
  type SaleReturnLineRecord,
  type SaleReturnRecord,
} from "@/lib/supabase/sale-return-client";
import { useSubscription } from "@/lib/subscription/subscription-provider";

type Props = { saleId: string };

function isUnsettled(status: SaleReturnRecord["settlementStatus"]): boolean {
  return status === "pending" || status === "partial";
}

export function SaleReturnHistory({ saleId }: Props) {
  const { org, orgRole } = useSubscription();
  const { locale } = useLocale();
  const si = locale === "si";
  const [returns, setReturns] = useState<SaleReturnRecord[]>([]);
  const [lines, setLines] = useState<SaleReturnLineRecord[]>([]);
  const [creditNotes, setCreditNotes] = useState<SaleCreditNoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.isAuthenticated || !org.id || !saleId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchSaleReturns(org.id, saleId).then((result) => {
      if (cancelled) return;
      setReturns(result.returns);
      setLines(result.lines);
      setCreditNotes(result.creditNotes);
      setError(result.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated, saleId]);

  const linesByReturn = useMemo(() => {
    const map = new Map<string, SaleReturnLineRecord[]>();
    for (const line of lines) {
      const list = map.get(line.returnId) ?? [];
      list.push(line);
      map.set(line.returnId, list);
    }
    return map;
  }, [lines]);

  const creditNoteByReturn = useMemo(
    () => new Map(creditNotes.map((note) => [note.returnId, note] as const)),
    [creditNotes],
  );

  if (!org.isAuthenticated || saleReturnSchemaUnavailable(error)) return null;
  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500 no-print">
        {si ? "Return history පූරණය වෙමින්…" : "Loading return history…"}
      </div>
    );
  }
  if (error || returns.length === 0) return null;

  const totalReturned = returns.reduce((sum, item) => sum + item.merchandiseValue, 0);
  const pendingCount = returns.filter((item) => isUnsettled(item.settlementStatus)).length;

  return (
    <section className="mt-4 rounded-xl border border-amber-200 bg-white p-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
            {si ? "Customer returns" : "Customer returns"}
          </p>
          <h2 className="mt-1 text-sm font-bold text-slate-950">
            {returns.length} {si ? "return document" : returns.length === 1 ? "return document" : "return documents"} · {formatLkr(totalReturned)}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {si ? "Original invoice එක වෙනස් කර නැත. Return documents සහ credit notes වෙනම audit trail ලෙස තබා ඇත." : "The original invoice is unchanged. Return documents and credit notes are preserved as separate audit records."}
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
            {pendingCount} {si ? "financial action pending" : "financial action pending"}
          </span>
        )}
      </div>

      <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {returns.map((item) => {
          const itemLines = linesByReturn.get(item.id) ?? [];
          const creditNote = creditNoteByReturn.get(item.id);
          const restockedQty = itemLines
            .filter((line) => line.restocked)
            .reduce((sum, line) => sum + line.qty, 0);
          const holdQty = itemLines
            .filter((line) => !line.restocked)
            .reduce((sum, line) => sum + line.qty, 0);
          return (
            <div key={item.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold text-slate-900">{item.returnNo}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {new Date(item.returnedAt).toLocaleString("en-LK")} · {item.reason}
                  </p>
                  {creditNote && (
                    <p className="mt-1 font-mono text-[11px] font-semibold text-teal-700">
                      {creditNote.creditNoteNo} · {si ? "credit note" : "credit note"}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-slate-950">{formatLkr(item.merchandiseValue)}</p>
                  <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide ${isUnsettled(item.settlementStatus) ? "text-amber-700" : "text-emerald-700"}`}>
                    {item.settlementStatus.replaceAll("_", " ")}
                  </p>
                </div>
              </div>

              <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                {itemLines.map((line) => (
                  <div key={line.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{line.productName}</span>
                    <span className="font-mono font-semibold text-slate-900">× {line.qty} · {formatLkr(line.returnValue)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                {restockedQty > 0 && <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{restockedQty} approved for resale</span>}
                {holdQty > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">{holdQty} on return hold</span>}
                {creditNote && <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-700">VAT / revenue reversed</span>}
                {orgRole === "owner" && (
                  <div className="ml-auto flex flex-wrap items-center gap-1.5 no-print">
                    {creditNote && (
                      <Link
                        href={`/bills/${saleId}/returns/${item.id}/credit-note`}
                        className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-800 transition hover:bg-teal-100"
                      >
                        {si ? "Credit note" : "Credit note"}
                      </Link>
                    )}
                    <Link
                      href={`/bills/${saleId}/returns/${item.id}`}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                    >
                      {creditNote ? (si ? "Settlement" : "Settlement") : (si ? "Issue credit note" : "Issue credit note")}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingCount > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-900 no-print">
          {si ? "Pending/partial කියන්නේ physical return එක record කර ඇති නමුත් credit note හෝ refund / receivable settlement සම්පූර්ණ නැති බවයි." : "Pending/partial means the physical return is recorded, but its credit note or refund / receivable settlement is not fully completed yet."}
        </p>
      )}
    </section>
  );
}
