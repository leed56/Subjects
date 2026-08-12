"use client";

import type { ACJob } from "@/lib/store/types";
import type { BusinessInfo } from "@/lib/invoice";
import { jobInvoiceWhatsappUrl, taxInvoiceAmountsForJob } from "@/lib/job-invoice";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { amountInWordsLkr, formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { jobTypeLabel } from "@/lib/ac-job-types";

/** Printable/WhatsApp-shareable customer invoice for an AC job (Phase 9).
 * Mirrors InvoiceView's layout deliberately — same visual language as the
 * Sales bill — but built as its own component: InvoiceView's helpers
 * (buildInvoiceText, taxInvoiceAmounts) are typed directly against Sale's
 * `lines`/`billNo`/`discount` shape and aren't a clean fit for ACJob. See
 * job-invoice.ts for why this only ever shows one line item, not the
 * Job Sheet's internal cost lines. */
interface JobInvoiceViewProps {
  job: ACJob;
  business: BusinessInfo;
  customerAddress?: string;
  showActions?: boolean;
}

export function JobInvoiceView({ job, business, customerAddress, showActions = true }: JobInvoiceViewProps) {
  const { t, locale } = useLocale();
  const waUrl = jobInvoiceWhatsappUrl(job, business, locale, t);
  const amounts = taxInvoiceAmountsForJob(job, business);
  const isTaxInvoice = amounts.isTaxInvoice;
  const balance = job.quotedAmount - job.depositAmount;
  const address = customerAddress ?? job.address;
  const showBuyer = Boolean(job.customerName || address || job.phone);

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
          <MessageSendButton
            phone={job.phone}
            recipientName={job.customerName}
            context={{ type: "ac_job", job, business }}
            defaultTemplate="job_completed"
            contextId={job.id}
            variant="compact"
          />
        </div>
      )}

      <article
        className={`invoice-paper mx-auto max-w-md rounded-xl border bg-white p-6 shadow-sm ${
          isTaxInvoice ? "tax-invoice-paper border-slate-900" : "border-slate-200"
        }`}
      >
        {isTaxInvoice && (
          <div className="mb-4 border-2 border-slate-900 px-3 py-2 text-center">
            <p className="text-lg font-bold uppercase tracking-wide text-slate-900">{t("inv.tax_invoice")}</p>
            <p className="text-xs font-semibold text-slate-600">බදු ඉන්වොයිසිය</p>
          </div>
        )}

        <header className="border-b border-dashed border-slate-300 pb-4 text-center">
          {business.logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoDataUrl} alt={business.name} className="mx-auto mb-2 h-16 w-auto object-contain" />
          )}
          <h1 className="text-xl font-bold text-slate-900">{business.name}</h1>
          {business.nameSi && <p className="text-sm text-slate-600">{business.nameSi}</p>}
          {business.address && <p className="mt-1 text-xs text-slate-500">{business.address}</p>}
          {(business.phone || business.email) && (
            <p className="text-xs text-slate-500">
              {business.phone && `${t("bills.tel")}: ${business.phone}`}
              {business.phone && business.email && " · "}
              {business.email}
            </p>
          )}
          {business.brNumber && <p className="text-xs text-slate-500">{t("shop.br_number")}: {business.brNumber}</p>}
          {business.vatRegistered && business.vatNumber && (
            <p className="text-xs text-slate-500">{t("vat.vat_number")}: {business.vatNumber}</p>
          )}
          {business.tin && <p className="text-xs text-slate-500">TIN: {business.tin}</p>}
        </header>

        {isTaxInvoice && (
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded border border-slate-300 p-2 text-left">
              <p className="font-bold uppercase text-slate-700">{t("inv.seller")}</p>
              <p className="mt-1 font-semibold text-slate-900">{business.name}</p>
              {business.address && <p className="text-slate-600">{business.address}</p>}
              {business.vatNumber && <p className="text-slate-600">{t("inv.vat_reg_no")}: {business.vatNumber}</p>}
              {business.tin && <p className="text-slate-600">TIN: {business.tin}</p>}
              {business.brNumber && <p className="text-slate-600">{t("shop.br_number")}: {business.brNumber}</p>}
            </div>
            {showBuyer && (
              <div className="rounded border border-slate-300 p-2 text-left">
                <p className="font-bold uppercase text-slate-700">{t("inv.buyer")}</p>
                {job.customerName && <p className="mt-1 font-semibold text-slate-900">{job.customerName}</p>}
                {address && <p className="text-slate-600">{address}</p>}
                {job.phone && <p className="text-slate-600">{job.phone}</p>}
              </div>
            )}
          </div>
        )}

        {!isTaxInvoice && (
          <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("inv.invoice")}</p>
        )}

        {isTaxInvoice && (
          <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t("inv.bill_no")}: {job.jobNo}
          </p>
        )}

        <div className="mt-3 space-y-1 text-sm text-slate-600">
          {!isTaxInvoice && (
            <div className="flex justify-between">
              <span>{t("inv.bill_no")}</span>
              <span className="font-mono font-medium text-slate-900">{job.jobNo}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t("common.date")}</span>
            <span>{new Date(job.date).toLocaleDateString("en-LK")}</span>
          </div>
          {job.customerName && (
            <div className="flex justify-between">
              <span>{t("common.customer")}</span>
              <span className="font-medium text-slate-900">{job.customerName}</span>
            </div>
          )}
          {job.phone && (
            <div className="flex justify-between">
              <span>{t("common.phone")}</span>
              <span>{job.phone}</span>
            </div>
          )}
          {address && (
            <div className="flex justify-between gap-4">
              <span>{t("common.address")}</span>
              <span className="text-right">{address}</span>
            </div>
          )}
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">{t("bills.item")}</th>
              <th className="py-2 text-right">{t("bills.amount")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-2 text-slate-800">
                {jobTypeLabel(job.jobType, locale)} — {job.description}
              </td>
              <td className="py-2 text-right tabular-nums">{formatLkr(job.quotedAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3 text-sm">
          {isTaxInvoice && (
            <>
              <div className="flex justify-between text-slate-600">
                <span>{t("inv.taxable_amount")}</span>
                <span className="tabular-nums">{formatLkr(amounts.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t("vat.output_vat")} (18%)</span>
                <span className="tabular-nums">{formatLkr(amounts.vat)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-bold text-slate-900">
            <span>{t("inv.total")}</span>
            <span className="tabular-nums">{formatLkr(job.quotedAmount)}</span>
          </div>
          <p className="pt-1 text-xs italic text-slate-500">{amountInWordsLkr(job.quotedAmount)}</p>
          {job.depositAmount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>{t("jobs.deposit_label")}</span>
              <span className="tabular-nums">-{formatLkr(job.depositAmount)}</span>
            </div>
          )}
          {balance > 0 ? (
            <div className="flex justify-between font-semibold text-amber-700">
              <span>{t("common.balance")}</span>
              <span className="tabular-nums">{formatLkr(balance)}</span>
            </div>
          ) : (
            job.depositAmount > 0 && (
              <p className="text-center text-xs font-semibold text-emerald-700">{t("jinv.paid_in_full")}</p>
            )
          )}
        </div>

        <footer className="mt-6 text-center text-xs text-slate-400">
          {business.invoiceFooter && <p className="mb-2 whitespace-pre-line text-slate-500">{business.invoiceFooter}</p>}
          {isTaxInvoice && <p className="mt-3 text-left text-[10px] leading-relaxed text-slate-500">{t("inv.compliance_note")}</p>}
          {t("bills.thank_you")}
          <br />
          {t("inv.footer")}
        </footer>
      </article>
    </div>
  );
}
