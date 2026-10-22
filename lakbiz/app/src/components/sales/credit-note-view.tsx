"use client";

import type { BusinessInfo } from "@/lib/invoice";
import { formatLkr } from "@/lib/format";
import type { Sale } from "@/lib/store/types";
import type {
  SaleCreditNoteRecord,
  SaleReturnLineRecord,
  SaleReturnRecord,
} from "@/lib/supabase/sale-return-client";

type Props = {
  business: BusinessInfo;
  sale: Sale;
  returnRecord: SaleReturnRecord;
  creditNote: SaleCreditNoteRecord;
  lines: SaleReturnLineRecord[];
  customerPhone?: string;
  customerAddress?: string;
  customerVatNumber?: string;
};

export function CreditNoteView({
  business,
  sale,
  returnRecord,
  creditNote,
  lines,
  customerPhone,
  customerAddress,
  customerVatNumber,
}: Props) {
  const originalBillNo = sale.billNo ?? sale.id.slice(0, 8).toUpperCase();
  const isTaxDocument = business.vatRegistered === true && Boolean(business.vatNumber);

  return (
    <article className="credit-note-paper mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none sm:p-8">
      {isTaxDocument && (
        <div className="mb-5 border-2 border-slate-900 px-4 py-2 text-center">
          <p className="text-lg font-bold uppercase tracking-[0.12em] text-slate-950">Credit Note</p>
          <p className="text-xs font-semibold text-slate-600">Tax adjustment document</p>
        </div>
      )}

      <header className="border-b border-dashed border-slate-300 pb-5 text-center">
        {business.logoDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logoDataUrl} alt={business.name} className="mx-auto mb-2 h-14 w-auto object-contain" />
        )}
        <h1 className="text-xl font-bold text-slate-950">{business.name}</h1>
        {business.nameSi && <p className="text-sm text-slate-600">{business.nameSi}</p>}
        {business.address && <p className="mt-1 text-xs text-slate-500">{business.address}</p>}
        {(business.phone || business.email) && (
          <p className="text-xs text-slate-500">
            {business.phone ?? ""}{business.phone && business.email ? " · " : ""}{business.email ?? ""}
          </p>
        )}
        {business.brNumber && <p className="text-xs text-slate-500">BR: {business.brNumber}</p>}
        {business.vatNumber && <p className="text-xs text-slate-500">VAT: {business.vatNumber}</p>}
        {business.tin && <p className="text-xs text-slate-500">TIN: {business.tin}</p>}
      </header>

      {!isTaxDocument && (
        <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Credit Note</p>
      )}

      <section className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Document</p>
          <dl className="mt-2 space-y-1.5">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Credit note</dt><dd className="font-mono font-semibold text-slate-950">{creditNote.creditNoteNo}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Issued</dt><dd className="text-right font-medium text-slate-900">{new Date(creditNote.issuedAt).toLocaleString("en-LK")}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Return</dt><dd className="font-mono font-semibold text-slate-900">{returnRecord.returnNo}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Original invoice</dt><dd className="font-mono font-semibold text-slate-900">{originalBillNo}</dd></div>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Customer</p>
          <p className="mt-2 font-semibold text-slate-950">{sale.customerName || "Walk-in customer"}</p>
          {customerAddress && <p className="mt-1 text-xs leading-5 text-slate-600">{customerAddress}</p>}
          {customerPhone && <p className="text-xs text-slate-600">{customerPhone}</p>}
          {customerVatNumber && <p className="text-xs text-slate-600">VAT: {customerVatNumber}</p>}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Returned item</th>
              <th className="px-3 py-2.5 text-right">Qty</th>
              <th className="px-3 py-2.5 text-right">Unit price</th>
              <th className="px-3 py-2.5 text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-3 font-medium text-slate-900">{line.productName}</td>
                <td className="px-3 py-3 text-right font-mono text-slate-700">{line.qty}</td>
                <td className="px-3 py-3 text-right font-mono text-slate-700">{formatLkr(line.unitPrice)}</td>
                <td className="px-3 py-3 text-right font-mono font-semibold text-slate-950">{formatLkr(line.returnValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5 ml-auto max-w-sm space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
          <span className="text-slate-500">Gross credit</span>
          <span className="font-mono font-semibold text-slate-950">{formatLkr(creditNote.grossCredit)}</span>
        </div>
        {creditNote.outputVatReversal > 0 && (
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
            <span className="text-slate-500">VAT reversal</span>
            <span className="font-mono font-semibold text-slate-950">{formatLkr(creditNote.outputVatReversal)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-950 px-3 py-3 text-white">
          <span className="font-semibold">Credit amount</span>
          <span className="font-mono text-lg font-bold">{formatLkr(creditNote.grossCredit)}</span>
        </div>
      </section>

      <section className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
        <p><span className="font-semibold text-slate-800">Reason:</span> {returnRecord.reason}</p>
        <p className="mt-1">This credit note is linked to the original invoice above. The original invoice remains unchanged as part of the audit trail.</p>
      </section>

      <footer className="mt-8 border-t border-dashed border-slate-300 pt-4 text-center text-[10px] leading-5 text-slate-400">
        <p>Generated by LakBiz · {creditNote.creditNoteNo}</p>
      </footer>
    </article>
  );
}
