import { describe, expect, it } from "vitest";
import type { Purchase, Sale } from "@/lib/store/types";
import type { ReturnAccountingAdjustment } from "@/lib/supabase/return-accounting-client";
import type { VatQuarterSummary } from "@/lib/vat";
import { buildVatReconciliationCsv, type VatReturnReconciliationLabels } from "./vat-returns";

const labels: VatReturnReconciliationLabels = {
  billNo: "Bill #",
  date: "Date",
  customer: "Customer",
  outputVat: "Output VAT",
  grnNo: "GRN #",
  supplier: "Supplier",
  inputVat: "Input VAT",
  netPayable: "Net payable",
  outputTotal: "Output VAT total",
  inputTotal: "Input VAT total",
  creditNotes: "Issued return credit notes",
  creditNoteNo: "Credit note #",
  originalBill: "Original bill",
  grossCredit: "Gross credit",
  returnVatReversal: "VAT reversal from credit notes",
};

const sale = {
  id: "sale-1",
  billNo: "INV-1001",
  date: "2026-08-10T10:00:00.000Z",
  customerName: "Test Customer",
  outputVat: 1800,
} as Sale;

const purchase = {
  id: "purchase-1",
  grnNo: "GRN-10",
  date: "2026-08-11T10:00:00.000Z",
  supplierName: "Test Supplier",
  inputVat: 900,
} as Purchase;

const creditNote: ReturnAccountingAdjustment = {
  creditNoteId: "cn-id-1",
  creditNoteNo: "CN-0001",
  returnId: "return-1",
  saleId: "sale-1",
  issuedAt: "2026-08-12T10:00:00.000Z",
  grossCredit: 5900,
  outputVatReversal: 900,
  netRevenueReversal: 5000,
};

const summary: VatQuarterSummary = {
  bounds: {
    start: new Date("2026-07-01T00:00:00.000Z"),
    end: new Date("2026-09-30T23:59:59.999Z"),
    label: "Jul 2026 – Sep 2026",
    key: "2026-FYQ2",
  },
  outputVat: 900,
  outputVatBeforeReturns: 1800,
  returnVatReversal: 900,
  creditNoteCount: 1,
  inputVat: 900,
  netPayable: 0,
  salesCount: 1,
  purchasesCount: 1,
  enabled: true,
};

describe("buildVatReconciliationCsv", () => {
  it("keeps the original invoice and lists the issued credit note as a separate reconciliation document", () => {
    const csv = buildVatReconciliationCsv([sale], [purchase], [creditNote], summary, labels);

    expect(csv).toContain("INV-1001");
    expect(csv).toContain("CN-0001");
    expect(csv).toContain("Issued return credit notes");
    expect(csv).toContain("CN-0001,8/12/2026,INV-1001,5900,900");
  });

  it("exports net VAT totals together with the explicit credit-note VAT reversal", () => {
    const csv = buildVatReconciliationCsv([sale], [purchase], [creditNote], summary, labels);

    expect(csv).toContain("Net payable,0");
    expect(csv).toContain("Output VAT total,900");
    expect(csv).toContain("Input VAT total,900");
    expect(csv).toContain("VAT reversal from credit notes,900");
  });

  it("does not fabricate credit-note rows when there are no issued notes in the period", () => {
    const noReturnsSummary = { ...summary, returnVatReversal: 0, creditNoteCount: 0, outputVat: 1800, netPayable: 900 };
    const csv = buildVatReconciliationCsv([sale], [purchase], [], noReturnsSummary, labels);

    expect(csv).toContain("Issued return credit notes");
    expect(csv).not.toContain("CN-0001");
    expect(csv).toContain("VAT reversal from credit notes,0");
  });
});
