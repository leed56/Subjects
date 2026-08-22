import type { BusinessInfo } from "@/lib/invoice";
import type { Purchase, Sale } from "@/lib/store/types";
import type { ReturnAccountingAdjustment } from "@/lib/supabase/return-accounting-client";
import type { VatQuarterSummary } from "@/lib/vat";
import { downloadCsv, exportFilename, rowsToCsv } from "./csv";
import { printHtmlReport, tableHtml } from "./print-report";

export type VatReturnReconciliationLabels = {
  billNo: string;
  date: string;
  customer: string;
  outputVat: string;
  grnNo: string;
  supplier: string;
  inputVat: string;
  netPayable: string;
  outputTotal: string;
  inputTotal: string;
  creditNotes?: string;
  creditNoteNo?: string;
  originalBill?: string;
  grossCredit?: string;
  returnVatReversal?: string;
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK");
}

export function buildVatReconciliationCsv(
  sales: Sale[],
  purchases: Purchase[],
  creditNotes: ReturnAccountingAdjustment[],
  summary: VatQuarterSummary,
  labels: VatReturnReconciliationLabels,
): string {
  const noteTitle = labels.creditNotes ?? "Issued return credit notes";
  const noteNo = labels.creditNoteNo ?? "Credit note #";
  const originalBill = labels.originalBill ?? "Original bill";
  const grossCredit = labels.grossCredit ?? "Gross credit";
  const vatReversal = labels.returnVatReversal ?? "VAT reversal";
  const salesById = new Map(sales.map((sale) => [sale.id, sale] as const));

  const rows: (string | number)[][] = [
    [labels.netPayable, summary.netPayable],
    [labels.outputTotal, summary.outputVat],
    [labels.inputTotal, summary.inputVat],
    [vatReversal, summary.returnVatReversal],
    [],
    [labels.billNo, labels.date, labels.customer, labels.outputVat],
    ...sales.map((sale) => [
      sale.billNo ?? sale.id.slice(0, 8),
      shortDate(sale.date),
      sale.customerName ?? "",
      sale.outputVat ?? 0,
    ]),
    [],
    [noteTitle],
    [noteNo, labels.date, originalBill, grossCredit, vatReversal],
    ...creditNotes.map((note) => {
      const original = salesById.get(note.saleId);
      return [
        note.creditNoteNo,
        shortDate(note.issuedAt),
        original?.billNo ?? note.saleId.slice(0, 8),
        note.grossCredit,
        note.outputVatReversal,
      ];
    }),
    [],
    [labels.grnNo, labels.date, labels.supplier, labels.inputVat],
    ...purchases.map((purchase) => [
      purchase.grnNo,
      shortDate(purchase.date),
      purchase.supplierName,
      purchase.inputVat ?? 0,
    ]),
  ];

  return rowsToCsv(rows);
}

export function exportVatReconciliationCsv(
  business: BusinessInfo,
  sales: Sale[],
  purchases: Purchase[],
  creditNotes: ReturnAccountingAdjustment[],
  summary: VatQuarterSummary,
  labels: VatReturnReconciliationLabels,
): void {
  downloadCsv(
    exportFilename(business.name, "vat-return"),
    buildVatReconciliationCsv(sales, purchases, creditNotes, summary, labels),
  );
}

export function printVatReconciliationReport(
  business: BusinessInfo,
  sales: Sale[],
  purchases: Purchase[],
  creditNotes: ReturnAccountingAdjustment[],
  summary: VatQuarterSummary,
  labels: VatReturnReconciliationLabels,
  reportTitle: string,
): void {
  const noteTitle = labels.creditNotes ?? "Issued return credit notes";
  const noteNo = labels.creditNoteNo ?? "Credit note #";
  const originalBill = labels.originalBill ?? "Original bill";
  const grossCredit = labels.grossCredit ?? "Gross credit";
  const vatReversal = labels.returnVatReversal ?? "VAT reversal";
  const salesById = new Map(sales.map((sale) => [sale.id, sale] as const));

  const salesTable = tableHtml(
    [labels.billNo, labels.date, labels.customer, labels.outputVat],
    sales.map((sale) => [
      sale.billNo ?? sale.id.slice(0, 8),
      shortDate(sale.date),
      sale.customerName ?? "—",
      sale.outputVat ?? 0,
    ]),
    [3],
  );
  const creditNotesTable = tableHtml(
    [noteNo, labels.date, originalBill, grossCredit, vatReversal],
    creditNotes.map((note) => {
      const original = salesById.get(note.saleId);
      return [
        note.creditNoteNo,
        shortDate(note.issuedAt),
        original?.billNo ?? note.saleId.slice(0, 8),
        note.grossCredit,
        note.outputVatReversal,
      ];
    }),
    [3, 4],
  );
  const purchasesTable = tableHtml(
    [labels.grnNo, labels.date, labels.supplier, labels.inputVat],
    purchases.map((purchase) => [
      purchase.grnNo,
      shortDate(purchase.date),
      purchase.supplierName,
      purchase.inputVat ?? 0,
    ]),
    [3],
  );

  printHtmlReport({
    title: reportTitle,
    subtitle: summary.bounds.label,
    shopName: business.name,
    bodyHtml: `
      <p><strong>${labels.netPayable}:</strong> ${summary.netPayable.toLocaleString("en-LK")}</p>
      <p><strong>${labels.outputTotal}:</strong> ${summary.outputVat.toLocaleString("en-LK")}
         · <strong>${labels.inputTotal}:</strong> ${summary.inputVat.toLocaleString("en-LK")}
         · <strong>${vatReversal}:</strong> ${summary.returnVatReversal.toLocaleString("en-LK")}</p>
      <h2 style="font-size:1rem;margin:24px 0 8px">${labels.outputVat}</h2>
      ${salesTable}
      <h2 style="font-size:1rem;margin:24px 0 8px">${noteTitle}</h2>
      ${creditNotes.length > 0 ? creditNotesTable : "<p>No issued return credit notes in this period.</p>"}
      <h2 style="font-size:1rem;margin:24px 0 8px">${labels.inputVat}</h2>
      ${purchasesTable}
    `,
  });
}
