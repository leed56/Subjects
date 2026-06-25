import type { Sale } from "@/lib/store/types";
import { formatLkr } from "./format";
import { whatsappShareUrl as buildWhatsappUrl } from "@/lib/messaging/channels";
import { splitInclusiveTotal } from "./vat";

export interface BusinessInfo {
  name: string;
  nameSi?: string;
  phone?: string;
  /** Second contact / WhatsApp number */
  email?: string;
  address?: string;
  tin?: string;
  /** Business Registration (BR) number */
  brNumber?: string;
  /** Small downscaled logo as a data URL, printed on the invoice header */
  logoDataUrl?: string;
  /** Footer / terms note printed at the bottom of each invoice */
  invoiceFooter?: string;
  /** VAT registration (Salli-style compliance mode) */
  vatRegistered?: boolean;
  vatNumber?: string;
  /** Fiscal quarter start month (1–12). Default 4 = April (IRD-style) */
  quarterStartMonth?: number;
  /** Company income tax rate as % (e.g. 30 standard, 15 export, 45 special). Owner/manager only. */
  companyIncomeTaxRate?: number;
}

export const defaultBusiness = (): BusinessInfo => ({
  name: "My Shop",
  nameSi: "මගේ වෙළඳසැල",
  vatRegistered: false,
  quarterStartMonth: 4,
  companyIncomeTaxRate: 30,
});

export function generateBillNo(existingSaleCount: number): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(existingSaleCount + 1).padStart(4, "0");
  return `LB-${d}-${seq}`;
}

export function generateGrnNo(existingPurchaseCount: number): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(existingPurchaseCount + 1).padStart(4, "0");
  return `GRN-${d}-${seq}`;
}

export function formatPaymentLabel(
  method: Sale["paymentMethod"],
  t?: (key: string) => string,
): string {
  if (t) {
    const keys: Record<Sale["paymentMethod"], string> = {
      cash: "pay.cash",
      bank_transfer: "pay.bank",
      card: "pay.card",
      cheque: "pay.cheque",
      credit: "pay.credit",
    };
    return t(keys[method]);
  }
  const labels: Record<Sale["paymentMethod"], string> = {
    cash: "Cash / මුදල්",
    bank_transfer: "Bank Transfer",
    card: "Card",
    cheque: "Cheque / චෙක්",
    credit: "Credit / ණය",
  };
  return labels[method];
}

export function taxInvoiceAmounts(sale: Sale, business: BusinessInfo) {
  const isTaxInvoice = business.vatRegistered === true;
  if (!isTaxInvoice) {
    return { isTaxInvoice: false as const, vat: 0, subtotal: sale.total, total: sale.total };
  }
  const vat = sale.outputVat ?? splitInclusiveTotal(sale.total).vat;
  const subtotal = sale.subtotal ?? sale.total - vat;
  return { isTaxInvoice: true as const, vat, subtotal, total: sale.total };
}

export function buildInvoiceText(
  sale: Sale,
  business: BusinessInfo,
  t?: (key: string) => string,
): string {
  const lines = sale.lines
    .map(
      (l) =>
        `${l.productName} x${l.qty} = ${formatLkr(l.unitPrice * l.qty)}`,
    )
    .join("\n");

  const amounts = taxInvoiceAmounts(sale, business);
  const title = amounts.isTaxInvoice
    ? (t ? t("inv.tax_invoice") : "TAX INVOICE / බදු ඉන්වොයිසිය")
    : (t ? t("inv.invoice") : "INVOICE");

  return [
    title,
    `*${business.name}*`,
    business.nameSi ? `_${business.nameSi}_` : "",
    business.address ? business.address : "",
    business.phone ? `Tel: ${business.phone}` : "",
    business.vatRegistered && business.vatNumber
      ? `${t ? t("inv.vat_reg_no") : "VAT Reg No"}: ${business.vatNumber}`
      : "",
    business.tin ? `TIN: ${business.tin}` : "",
    business.brNumber
      ? `${t ? t("shop.br_number") : "BR"}: ${business.brNumber}`
      : "",
    "",
    `${t ? t("inv.bill_no") : "Bill"}: ${sale.billNo ?? sale.id.slice(0, 8)}`,
    `${t ? t("common.date") : "Date"}: ${new Date(sale.date).toLocaleString("en-LK")}`,
    sale.customerName ? `${t ? t("common.customer") : "Customer"}: ${sale.customerName}` : "",
    "",
    lines,
    "",
    ...(sale.discount && sale.discount > 0
      ? [`${t ? t("sales.discount") : "Discount"}: -${formatLkr(sale.discount)}`]
      : []),
    ...(amounts.isTaxInvoice
      ? [
          `${t ? t("inv.taxable_amount") : "Taxable amount"}: ${formatLkr(amounts.subtotal)}`,
          `${t ? t("vat.output_vat") : "VAT"} (18%): ${formatLkr(amounts.vat)}`,
          "",
        ]
      : []),
    `*${t ? t("inv.total") : "Total"}: ${formatLkr(sale.total)}*`,
    `${t ? t("common.payment") : "Payment"}: ${formatPaymentLabel(sale.paymentMethod, t)}`,
    "",
    t ? t("bills.thank_you") : "Thank you! / ස්තූතියි",
    amounts.isTaxInvoice && t ? t("inv.compliance_note") : "",
    business.invoiceFooter ? business.invoiceFooter : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** WhatsApp-friendly price quote (Phase D) — same line items, quote header. */
export function buildQuoteText(
  sale: Sale,
  business: BusinessInfo,
  t?: (key: string) => string,
): string {
  const lines = sale.lines
    .map(
      (l) =>
        `${l.productName} x${l.qty} @ ${formatLkr(l.unitPrice)} = ${formatLkr(l.unitPrice * l.qty)}`,
    )
    .join("\n");

  return [
    `*${business.name}*`,
    t ? t("msg.quote_header") : "PRICE QUOTE / ඇස්තමේන්තුව",
    "",
    sale.customerName ? `${t ? t("common.customer") : "Customer"}: ${sale.customerName}` : "",
    `Date: ${new Date().toLocaleDateString("en-LK")}`,
    "",
    lines,
    "",
    ...(sale.discount && sale.discount > 0
      ? [`Discount: -${formatLkr(sale.discount)}`]
      : []),
    `*${t ? t("msg.quote_total") : "Quoted total"}: ${formatLkr(sale.total)}*`,
    "",
    t ? t("msg.quote_validity") : "Valid for 7 days. Reply to confirm.",
    business.phone ? `${t ? t("bills.tel") : "Tel"}: ${business.phone}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export type QuoteLineInput = {
  productName: string;
  qty: number;
  unitPrice: number;
};

/** Ad-hoc quote from POS cart before a sale is saved (Phase D). */
export function buildQuoteTextFromLines(
  cartLines: QuoteLineInput[],
  total: number,
  business: BusinessInfo,
  options?: { customerName?: string; discount?: number; t?: (key: string) => string },
): string {
  const t = options?.t;
  const lines = cartLines
    .map(
      (l) =>
        `${l.productName} x${l.qty} @ ${formatLkr(l.unitPrice)} = ${formatLkr(l.unitPrice * l.qty)}`,
    )
    .join("\n");

  return [
    `*${business.name}*`,
    t ? t("msg.quote_header") : "PRICE QUOTE / ඇස්තමේන්තුව",
    "",
    options?.customerName
      ? `${t ? t("common.customer") : "Customer"}: ${options.customerName}`
      : "",
    `Date: ${new Date().toLocaleDateString("en-LK")}`,
    "",
    lines,
    "",
    ...(options?.discount && options.discount > 0
      ? [`Discount: -${formatLkr(options.discount)}`]
      : []),
    `*${t ? t("msg.quote_total") : "Quoted total"}: ${formatLkr(total)}*`,
    "",
    t ? t("msg.quote_validity") : "Valid for 7 days. Reply to confirm.",
    business.phone ? `${t ? t("bills.tel") : "Tel"}: ${business.phone}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function whatsappShareUrl(text: string, phone?: string): string {
  return buildWhatsappUrl(text, phone);
}
