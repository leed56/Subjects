"use client";

import type { Sale } from "@/lib/store/types";
import type { BusinessInfo } from "@/lib/invoice";
import { buildInvoiceText, buildQuoteText, whatsappShareUrl } from "@/lib/invoice";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { amountInWordsLkr, formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { paymentLabel } from "@/lib/i18n/payment";

interface InvoiceViewProps {
  sale: Sale;
  business: BusinessInfo;
  customerPhone?: string;
  customerAddress?: string;
  showActions?: boolean;
}

export function InvoiceView({
  sale,
  business,
  customerPhone,
  customerAddress,
  showActions = true,
}: InvoiceViewProps) {
  const { t } = useLocale();
  const billNo = sale.billNo ?? sale.id.slice(0, 8).toUpperCase();
  const invoiceText = buildInvoiceText(sale, business, t);
  const quoteText = buildQuoteText(sale, business, t);
  const waUrl = whatsappShareUrl(invoiceText, customerPhone ?? business.phone);
  const quoteWaUrl = whatsappShareUrl(quoteText, customerPhone ?? business.phone);

  const hasVat =
    business.vatRegistered === true &&
    sale.outputVat != null &&
    sale.outputVat > 0;
  const subtotal = sale.subtotal ?? sale.total - (sale.outputVat ?? 0);
  const discount = sale.discount ?? 0;
  const gross = sale.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  return (
    <div>
      {showActions && (
        <div className="no-print mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            {t("bills.print")}
          </button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            {t("bills.whatsapp")}
          </a>
          <a
            href={quoteWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-green-600 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
          >
            {t("bills.quote_whatsapp")}
          </a>
          <MessageSendButton
            phone={customerPhone}
            recipientName={sale.customerName ?? t("common.customer")}
            context={{ type: "sale", sale, business }}
            defaultTemplate="bill_receipt"
            contextId={sale.id}
            variant="compact"
          />
          <MessageSendButton
            phone={customerPhone}
            recipientName={sale.customerName ?? t("common.customer")}
            context={{ type: "sale", sale, business }}
            defaultTemplate="sales_quote"
            contextId={sale.id}
            variant="compact"
            label={t("bills.quote_whatsapp")}
          />
        </div>
      )}

      <article className="invoice-paper mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="border-b border-dashed border-slate-300 pb-4 text-center">
          {business.logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logoDataUrl}
              alt={business.name}
              className="mx-auto mb-2 h-16 w-auto object-contain"
            />
          )}
          <h1 className="text-xl font-bold text-slate-900">{business.name}</h1>
          {business.nameSi && (
            <p className="text-sm text-slate-600">{business.nameSi}</p>
          )}
          {business.address && (
            <p className="mt-1 text-xs text-slate-500">{business.address}</p>
          )}
          {(business.phone || business.email) && (
            <p className="text-xs text-slate-500">
              {business.phone && `${t("bills.tel")}: ${business.phone}`}
              {business.phone && business.email && " · "}
              {business.email}
            </p>
          )}
          {business.brNumber && (
            <p className="text-xs text-slate-500">
              {t("shop.br_number")}: {business.brNumber}
            </p>
          )}
          {business.vatRegistered && business.vatNumber && (
            <p className="text-xs text-slate-500">
              {t("vat.vat_number")}: {business.vatNumber}
            </p>
          )}
          {business.tin && (
            <p className="text-xs text-slate-500">TIN: {business.tin}</p>
          )}
        </header>

        <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {hasVat ? t("inv.tax_invoice") : t("inv.invoice")}
        </p>

        <div className="mt-3 space-y-1 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>{t("inv.bill_no")}</span>
            <span className="font-mono font-medium text-slate-900">{billNo}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("common.date")}</span>
            <span>{new Date(sale.date).toLocaleString("en-LK")}</span>
          </div>
          {sale.customerName && (
            <div className="flex justify-between">
              <span>{t("common.customer")}</span>
              <span className="font-medium text-slate-900">
                {sale.customerName}
              </span>
            </div>
          )}
          {customerPhone && (
            <div className="flex justify-between">
              <span>{t("common.phone")}</span>
              <span>{customerPhone}</span>
            </div>
          )}
          {customerAddress && (
            <div className="flex justify-between gap-4">
              <span>{t("common.address")}</span>
              <span className="text-right">{customerAddress}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t("common.payment")}</span>
            <span>{paymentLabel(t, sale.paymentMethod)}</span>
          </div>
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">{t("bills.item")}</th>
              <th className="py-2 text-right">{t("common.qty")}</th>
              <th className="py-2 text-right">{t("inv.unit_price")}</th>
              <th className="py-2 text-right">{t("bills.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((line, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 text-slate-800">{line.productName}</td>
                <td className="py-2 text-right">{line.qty}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatLkr(line.unitPrice)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatLkr(line.unitPrice * line.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3 text-sm">
          {discount > 0 && (
            <>
              <div className="flex justify-between text-slate-600">
                <span>{t("sales.gross")}</span>
                <span className="tabular-nums">{formatLkr(gross)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>{t("sales.discount")}</span>
                <span className="tabular-nums">-{formatLkr(discount)}</span>
              </div>
            </>
          )}
          {hasVat && (
            <>
              <div className="flex justify-between text-slate-600">
                <span>{t("vat.subtotal")}</span>
                <span className="tabular-nums">{formatLkr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t("vat.output_vat")} (18%)</span>
                <span className="tabular-nums">
                  {formatLkr(sale.outputVat ?? 0)}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-bold text-slate-900">
            <span>{t("inv.total")}</span>
            <span className="tabular-nums">{formatLkr(sale.total)}</span>
          </div>
          <p className="pt-1 text-xs italic text-slate-500">
            {amountInWordsLkr(sale.total)}
          </p>
          {sale.paymentMethod === "credit" && (
            <p className="mt-2 text-center text-xs text-amber-700">
              {t("bills.credit_note")}
            </p>
          )}
        </div>

        <footer className="mt-6 text-center text-xs text-slate-400">
          {business.invoiceFooter && (
            <p className="mb-2 whitespace-pre-line text-slate-500">
              {business.invoiceFooter}
            </p>
          )}
          {t("bills.thank_you")}
          <br />
          {t("inv.footer")}
        </footer>
      </article>
    </div>
  );
}
