"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { CreditNoteView } from "@/components/sales/credit-note-view";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import {
  fetchSaleReturns,
  fetchSaleReturnSettlementState,
  saleReturnFinanceSchemaUnavailable,
  type SaleReturnLineRecord,
} from "@/lib/supabase/sale-return-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700";

export default function CreditNotePage() {
  const params = useParams();
  const saleId = params.id as string;
  const returnId = params.returnId as string;
  const { data, ready } = useAppStore();
  const { org, orgRole } = useSubscription();
  const sale = data?.sales.find((item) => item.id === saleId) ?? null;
  const customer = sale?.customerId
    ? data?.customers.find((item) => item.id === sale.customerId)
    : undefined;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<SaleReturnLineRecord[]>([]);
  const [returnRecord, setReturnRecord] = useState<Awaited<ReturnType<typeof fetchSaleReturnSettlementState>>["returnRecord"]>(null);
  const [creditNote, setCreditNote] = useState<Awaited<ReturnType<typeof fetchSaleReturnSettlementState>>["creditNote"]>(null);

  useEffect(() => {
    if (!org.isAuthenticated || !org.id || orgRole !== "owner" || !sale) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchSaleReturnSettlementState(org.id, returnId),
      fetchSaleReturns(org.id, sale.id),
    ]).then(([settlementState, history]) => {
      if (cancelled) return;
      const nextError = settlementState.error ?? history.error;
      if (nextError) {
        setError(nextError);
        setLoading(false);
        return;
      }
      setReturnRecord(settlementState.returnRecord);
      setCreditNote(settlementState.creditNote);
      setLines(history.lines.filter((line) => line.returnId === returnId));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated, orgRole, returnId, sale]);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain><ProLoadingState label="Loading credit note…" /></ProMain>
      </AppShell>
    );
  }

  if (!sale) {
    return (
      <AppShell>
        <ProMain><EmptyState title="Bill not found" action={<Link href="/bills" className={secondary}>All bills</Link>} /></ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated || orgRole !== "owner") {
    return (
      <AppShell>
        <ProMain>
          <PageHeader title="Credit note" />
          <EmptyState
            title="Owner approval required"
            description="Customer credit-note documents are issued and printed from the owner financial workflow."
            action={<Link href={`/bills/${sale.id}`} className={secondary}>Back to bill</Link>}
          />
        </ProMain>
      </AppShell>
    );
  }

  const schemaMissing = saleReturnFinanceSchemaUnavailable(error);

  return (
    <AppShell>
      <ProMain>
        <div className="no-print">
          <PageHeader
            title={creditNote ? `Credit note · ${creditNote.creditNoteNo}` : "Credit note"}
            description={`${sale.billNo ?? sale.id.slice(0, 8)} · ${sale.customerName || "Walk-in customer"}`}
            actions={
              <div className="flex flex-wrap gap-2">
                <Link href={`/bills/${sale.id}/returns/${returnId}`} className={secondary}>← Settlement</Link>
                {creditNote && (
                  <button type="button" onClick={() => window.print()} className={primary}>Print / Save PDF</button>
                )}
              </div>
            }
          />
        </div>

        {loading ? (
          <ProLoadingState label="Loading credit note…" />
        ) : schemaMissing ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">Credit-note database upgrade required</p>
            <p className="mt-2 leading-6 text-amber-800">Apply the return-finance migration to the verified LakBiz Supabase project before issuing or printing credit notes.</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>
        ) : !returnRecord ? (
          <EmptyState title="Return document not found" action={<Link href={`/bills/${sale.id}`} className={secondary}>Back to bill</Link>} />
        ) : !creditNote ? (
          <EmptyState
            title="Credit note has not been issued yet"
            description="Issue the immutable credit note from the return settlement page first."
            action={<Link href={`/bills/${sale.id}/returns/${returnId}`} className={primary}>Open settlement</Link>}
          />
        ) : (
          <CreditNoteView
            business={data.business}
            sale={sale}
            returnRecord={returnRecord}
            creditNote={creditNote}
            lines={lines}
            customerPhone={customer?.phone}
            customerAddress={customer?.address}
            customerVatNumber={customer?.vatNumber}
          />
        )}
      </ProMain>
    </AppShell>
  );
}
