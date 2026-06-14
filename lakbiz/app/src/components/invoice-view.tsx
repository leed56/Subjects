"use client";

import type { Sale } from "@/lib/store/types";
import type { BusinessInfo } from "@/lib/invoice";
import { buildInvoiceText, whatsappShareUrl } from "@/lib/invoice";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { paymentLabel } from "@/lib/i18n/payment";

interface InvoiceViewProps {
  sale: Sale;
  business: BusinessInfo;
  customerPhone?: string;
  showActions?: boolean;
}

export function InvoiceView({
  sale,
  business,
  customerPhone,
  showActions = true,
}: InvoiceViewProps) {
  const { t } = useLocale();
  const billNo = sale.billNo ?? sale.id.slice(0, 8).toUpperCase();
  const invoiceText = buildInvoiceText(sale, business, t);
  const waUrl = whatsappShareUrl(invoiceText, customerPhone ?? business.phone);

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
        </div>
      )}

      <article className="invoice-paper mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="border-b border-dashed border-slate-300 pb-4 text-center">
          <h1 className="text-xl font-bold text-slate-900">{business.name}</h1>
          {business.nameSi && (
            <p className="text-sm text-slate-600">{business.nameSi}</p>
          )}
          {business.address && (
            <p className="mt-1 text-xs text-slate-500">{business.address}</p>
          )}
          {business.phone && (
            <p className="text-xs text-slate-500">
              {t("bills.tel")}: {business.phone}
            </p>
          )}
          {business.tin && (
            <p className="text-xs text-slate-500">TIN: {business.tin}</p>
          )}
        </header>

        <div className="mt-4 space-y-1 text-sm text-slate-600">
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
              <th className="py-2 text-right">{t("bills.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((line, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 text-slate-800">{line.productName}</td>
                <td className="py-2 text-right">{line.qty}</td>
                <td className="py-2 text-right">
                  {formatLkr(line.unitPrice * line.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 border-t border-dashed border-slate-300 pt-3">
          <div className="flex justify-between text-lg font-bold text-slate-900">
            <span>{t("inv.total")}</span>
            <span>{formatLkr(sale.total)}</span>
          </div>
          {sale.paymentMethod === "credit" && (
            <p className="mt-2 text-center text-xs text-amber-700">
              {t("bills.credit_note")}
            </p>
          )}
        </div>

        <footer className="mt-6 text-center text-xs text-slate-400">
          {t("bills.thank_you")}
          <br />
          {t("inv.footer")}
        </footer>
      </article>
    </div>
  );
}
