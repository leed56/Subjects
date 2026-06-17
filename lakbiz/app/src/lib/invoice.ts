import type { Sale } from "@/lib/store/types";
import { formatLkr } from "./format";
import { whatsappShareUrl as buildWhatsappUrl } from "@/lib/messaging/channels";

export interface BusinessInfo {
  name: string;
  nameSi?: string;
  phone?: string;
  address?: string;
  tin?: string;
  /** VAT registration (Salli-style compliance mode) */
  vatRegistered?: boolean;
  vatNumber?: string;
  /** Fiscal quarter start month (1–12). Default 4 = April (IRD-style) */
  quarterStartMonth?: number;
}

export const defaultBusiness = (): BusinessInfo => ({
  name: "My Shop",
  nameSi: "මගේ වෙළඳසැල",
  vatRegistered: false,
  quarterStartMonth: 4,
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

  return [
    `*${business.name}*`,
    business.nameSi ? `_${business.nameSi}_` : "",
    business.phone ? `Tel: ${business.phone}` : "",
    "",
    `Bill: ${sale.billNo ?? sale.id.slice(0, 8)}`,
    `Date: ${new Date(sale.date).toLocaleString("en-LK")}`,
    sale.customerName ? `Customer: ${sale.customerName}` : "",
    "",
    lines,
    "",
    ...(sale.outputVat && sale.outputVat > 0
      ? [
          `Subtotal: ${formatLkr(sale.subtotal ?? sale.total - sale.outputVat)}`,
          `VAT (18%): ${formatLkr(sale.outputVat)}`,
          "",
        ]
      : []),
    `*Total: ${formatLkr(sale.total)}*`,
    `Payment: ${formatPaymentLabel(sale.paymentMethod, t)}`,
    "",
    t ? t("bills.thank_you") : "Thank you! / ස්තූතියි",
  ]
    .filter(Boolean)
    .join("\n");
}

export function whatsappShareUrl(text: string, phone?: string): string {
  return buildWhatsappUrl(text, phone);
}
