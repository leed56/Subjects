"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  advancedInventorySchemaUnavailable,
  fetchSaleInventoryTrace,
  type SaleInventoryTraceRow,
} from "@/lib/supabase/inventory-trace-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

type Props = { saleId: string };

export function SaleInventoryTrace({ saleId }: Props) {
  const { data } = useAppStore();
  const { org } = useSubscription();
  const { locale } = useLocale();
  const si = locale === "si";
  const [rows, setRows] = useState<SaleInventoryTraceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!org.isAuthenticated || !org.id || !saleId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchSaleInventoryTrace(org.id, saleId).then((result) => {
      if (cancelled) return;
      setRows(result.data);
      setError(result.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated, saleId]);

  const grouped = useMemo(() => {
    const map = new Map<string, SaleInventoryTraceRow[]>();
    for (const row of rows) {
      const list = map.get(row.productId) ?? [];
      list.push(row);
      map.set(row.productId, list);
    }
    return Array.from(map.entries());
  }, [rows]);

  if (!org.isAuthenticated || advancedInventorySchemaUnavailable(error)) return null;
  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500 no-print">
        {si ? "Batch / IMEI traceability පූරණය වෙමින්…" : "Loading batch / IMEI traceability…"}
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800 no-print">
        {si ? "Inventory traceability දැන් ලබාගත නොහැක." : "Inventory traceability is temporarily unavailable."}
      </div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 print:break-inside-avoid">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
            {si ? "තොග Traceability" : "Inventory traceability"}
          </p>
          <h2 className="mt-1 text-sm font-bold text-slate-950">
            {si ? "මෙම බිල්පතට නිකුත් කළ නිශ්චිත stock" : "Exact stock issued on this bill"}
          </h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
          {si ? "Traceable" : "Traceable"}
        </span>
      </div>

      <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {grouped.map(([productId, productRows]) => {
          const product = data?.products.find((item) => item.id === productId);
          return (
            <div key={productId} className="p-3">
              <p className="text-xs font-bold text-slate-950">
                {product?.name ?? productId}
              </p>
              <div className="mt-2 space-y-1.5">
                {productRows.map((row) => {
                  const identity = [
                    row.variantLabel,
                    row.batchNo ? `Batch ${row.batchNo}` : null,
                    row.expiryDate ? `Exp ${row.expiryDate}` : null,
                    row.imei ? `IMEI ${row.imei}` : null,
                    row.secondaryImei ? `IMEI 2 ${row.secondaryImei}` : null,
                    row.serialNo ? `Serial ${row.serialNo}` : null,
                    !row.imei && !row.serialNo && row.barcode ? `Barcode ${row.barcode}` : null,
                    row.warrantyExpiry ? `${si ? "Warranty" : "Warranty"} ${row.warrantyExpiry}` : null,
                  ].filter(Boolean);
                  return (
                    <div key={row.allocationId} className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                      <span className="font-medium">{identity.join(" · ") || (si ? "Variant allocation" : "Variant allocation")}</span>
                      <span className="font-mono font-bold text-slate-900">× {row.qty}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
