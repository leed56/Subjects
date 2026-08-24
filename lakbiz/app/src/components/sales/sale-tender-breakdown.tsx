"use client";

import { useEffect, useMemo, useState } from "react";
import { formatLkr } from "@/lib/format";
import { saleTenderLabel } from "@/lib/sale-tender";
import {
  fetchSaleTenderReceipt,
  type SaleTenderReceiptLine,
} from "@/lib/supabase/sale-tender-read-client";
import { useSubscription } from "@/lib/subscription/subscription-provider";

type Props = {
  saleId: string;
  saleTotal: number;
};

export function SaleTenderBreakdown({ saleId, saleTotal }: Props) {
  const { org } = useSubscription();
  const [rows, setRows] = useState<SaleTenderReceiptLine[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!org.isAuthenticated || !org.id || !saleId) {
        setReady(true);
        return;
      }

      const result = await fetchSaleTenderReceipt(org.id, saleId);
      if (cancelled) return;

      if (result.schemaUnavailable) {
        // Legacy database / pre-migration invoice: the old payment-method line
        // remains authoritative, so adding a warning would only create noise.
        setRows([]);
        setError(null);
        setReady(true);
        return;
      }

      setRows(result.data);
      setError(result.error);
      setReady(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated, saleId]);

  const tenderedTotal = useMemo(
    () => rows.reduce((sum, row) => sum + row.amount, 0),
    [rows],
  );

  if (!ready || rows.length === 0) return null;

  const reconciled = Math.abs(tenderedTotal - saleTotal) <= 0.005;

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] print:mt-3 print:break-inside-avoid print:shadow-none">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 print:px-4 print:py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Payment allocation
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950">
            Payment breakdown
          </h3>
        </div>
        {rows.length > 1 && (
          <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
            Mixed payment
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-3 print:px-4 print:py-2.5">
            <span className="text-sm font-medium text-slate-700">
              {saleTenderLabel(row.kind)}
            </span>
            <span className="font-mono text-sm font-bold text-slate-950">
              {formatLkr(row.amount)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 bg-slate-50 px-5 py-3 print:px-4 print:py-2.5">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Allocated total
        </span>
        <span className="font-mono text-sm font-bold text-slate-950">
          {formatLkr(tenderedTotal)}
        </span>
      </div>

      {error && (
        <p className="no-print border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-900">
          Payment details could not be refreshed: {error}
        </p>
      )}

      {!reconciled && !error && (
        <p className="no-print border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-900">
          Payment allocation does not reconcile to the invoice total. Review this sale before settlement.
        </p>
      )}
    </section>
  );
}
