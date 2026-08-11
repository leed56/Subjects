import type { ACJob } from "@/lib/store/types";
import type { BusinessInfo } from "./invoice";
import { formatLkr } from "./format";
import { whatsappShareUrl as buildWhatsappUrl } from "@/lib/messaging/channels";
import { splitInclusiveTotal } from "./vat";
import { jobTypeLabel } from "./ac-job-types";

/**
 * Formal customer-facing invoice for an AC job (Phase 9).
 *
 * Deliberately NOT built from job_items (the parts/labour/subcontract
 * lines entered on the Job Sheet in Phase 5, see JobSheetDrawer in
 * jobs/page.tsx) — those are internal cost tracking, already hidden from
 * data_entry there via canSeeFinancials, and aggregated into the Phase 8
 * job-costing report. Printing them on a customer-facing document would
 * hand the shop's cost basis and margin straight to the customer. This
 * invoice has a single line item: the agreed job (type + description) at
 * the single quotedAmount the customer was quoted — the same number the
 * Job Sheet, dashboard, and every job-related WhatsApp template already
 * treat as "what the customer owes," just formatted as a proper printable
 * document (mirrors InvoiceView/invoice.ts, adapted for ACJob instead of
 * Sale — that file's functions are too tightly coupled to Sale's `lines`/
 * `billNo`/`discount` shape to share directly).
 *
 * Reuses job.jobNo as the invoice reference rather than introducing a
 * separate invoice-number sequence/counter — avoids a new DB column for a
 * first cut; a distinct numbering scheme is a possible follow-up if ever
 * needed.
 */

export function taxInvoiceAmountsForJob(job: ACJob, business: BusinessInfo) {
  const isTaxInvoice = business.vatRegistered === true;
  if (!isTaxInvoice) {
    return { isTaxInvoice: false as const, vat: 0, subtotal: job.quotedAmount, total: job.quotedAmount };
  }
  const { subtotal, vat } = splitInclusiveTotal(job.quotedAmount);
  return { isTaxInvoice: true as const, vat, subtotal, total: job.quotedAmount };
}

export function buildJobInvoiceText(
  job: ACJob,
  business: BusinessInfo,
  locale: "si" | "en",
  t?: (key: string) => string,
): string {
  const amounts = taxInvoiceAmountsForJob(job, business);
  const balance = job.quotedAmount - job.depositAmount;
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
    business.brNumber ? `${t ? t("shop.br_number") : "BR"}: ${business.brNumber}` : "",
    "",
    `${t ? t("inv.bill_no") : "Invoice"}: ${job.jobNo}`,
    `${t ? t("common.date") : "Date"}: ${new Date(job.date).toLocaleDateString("en-LK")}`,
    job.customerName ? `${t ? t("common.customer") : "Customer"}: ${job.customerName}` : "",
    job.address ? `${t ? t("common.address") : "Address"}: ${job.address}` : "",
    "",
    `${jobTypeLabel(job.jobType, locale)} — ${job.description}`,
    "",
    ...(amounts.isTaxInvoice
      ? [
          `${t ? t("inv.taxable_amount") : "Taxable amount"}: ${formatLkr(amounts.subtotal)}`,
          `${t ? t("vat.output_vat") : "VAT"} (18%): ${formatLkr(amounts.vat)}`,
          "",
        ]
      : []),
    `*${t ? t("inv.total") : "Total"}: ${formatLkr(job.quotedAmount)}*`,
    job.depositAmount > 0 ? `${t ? t("jobs.deposit_label") : "Deposit"}: ${formatLkr(job.depositAmount)}` : "",
    balance > 0
      ? `*${t ? t("common.balance") : "Balance"}: ${formatLkr(balance)}*`
      : job.depositAmount > 0
        ? t
          ? t("jinv.paid_in_full")
          : "Paid in full"
        : "",
    "",
    t ? t("bills.thank_you") : "Thank you! / ස්තූතියි",
    amounts.isTaxInvoice && t ? t("inv.compliance_note") : "",
    business.invoiceFooter ? business.invoiceFooter : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function jobInvoiceWhatsappUrl(job: ACJob, business: BusinessInfo, locale: "si" | "en", t?: (key: string) => string, phone?: string): string {
  const text = buildJobInvoiceText(job, business, locale, t);
  return buildWhatsappUrl(text, phone ?? job.phone ?? business.phone);
}
