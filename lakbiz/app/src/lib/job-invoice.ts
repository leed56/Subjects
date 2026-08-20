import type { ACJob } from "@/lib/store/types";
import type { BusinessInfo } from "./invoice";
import { formatLkr } from "./format";
import { whatsappShareUrl as buildWhatsappUrl } from "@/lib/messaging/channels";
import { splitInclusiveTotal } from "./vat";
import { jobTypeLabel } from "./ac-job-types";

/**
 * Formal customer-facing invoice for an AC job (Phase 9; itemized lines
 * added in the job-parts-materials phase).
 *
 * Deliberately NOT built from the raw job_items rows (the parts/labour
 * lines entered on the Job Sheet, see JobSheetDrawer in jobs/page.tsx) —
 * those carry internal cost (unitPrice/lineTotal), already hidden from
 * non-financial roles via canSeeFinancials and the DB-level masked view,
 * and printing that shape on a customer-facing document would risk
 * leaking the shop's cost basis. Instead this file only ever accepts the
 * narrow `InvoiceLineItem` projection below — name/qty/unit/customerPrice/
 * discount/invoiceable — built by the caller, so "internal cost leaks
 * onto the invoice" is a type-level impossibility here, not just a
 * rendering choice (see docs/JOB_PARTS_ARCHITECTURE.md §2.3/§4).
 *
 * Two rendering modes, chosen per job, not per app-wide flag: if the job
 * has any invoiceable line with a customer price, the invoice itemizes
 * (Part 12 of the brief — "parts and labor should flow into the existing
 * job invoice"); otherwise it falls back to the original single line
 * (job type + description) at the flat quotedAmount, exactly as every
 * job before this phase already invoices. No backfill needed — this is a
 * per-render branch, not a schema flag.
 *
 * Reuses job.jobNo as the invoice reference rather than introducing a
 * separate invoice-number sequence/counter — avoids a new DB column for a
 * first cut; a distinct numbering scheme is a possible follow-up if ever
 * needed.
 */

/** The only shape this file (and JobInvoiceView) ever sees for a line
 * item — deliberately missing unitPrice/lineTotal/source/supplierId/
 * every other internal-cost field a real JobItem carries. */
export type InvoiceLineItem = {
  id: string;
  name: string;
  qty: number;
  unit?: string;
  customerPrice?: number;
  discount?: number;
  invoiceable: boolean;
};

/** Sum of qty × customerPrice − discount across every invoiceable line
 * that actually has a customer price set. A line with invoiceable=false,
 * or no customerPrice at all, contributes nothing — same rule in one
 * place, reused by both the printable invoice and the WhatsApp text.
 *
 * Known interaction, disclosed rather than worked around: job_items.
 * customer_price is masked to null for non-financial roles at the DB
 * layer (see the job_items view — same rule as unit_price, established
 * in HVAC Phase 6, unchanged by this phase). A technician/data_entry
 * viewing this job's invoice therefore always sees zero invoiceable
 * lines here and correctly falls back to the flat quotedAmount total —
 * the same figure that page has always shown every role, unmasked. That
 * fallback is a safe default, not a bug: it never shows a wrong total,
 * it just doesn't itemize for a role the rest of this app already
 * doesn't show per-line pricing to. Loosening customer_price masking
 * specifically for the print-the-invoice context is a policy decision
 * for a future phase, not decided here. */
export function invoiceableLinesTotal(items: InvoiceLineItem[]): number {
  return items
    .filter((i) => i.invoiceable && i.customerPrice != null)
    .reduce((sum, i) => sum + Math.max(0, i.qty * (i.customerPrice ?? 0) - (i.discount ?? 0)), 0);
}

export function taxInvoiceAmountsForJob(job: ACJob, business: BusinessInfo, invoiceTotalOverride?: number) {
  const total = invoiceTotalOverride ?? job.quotedAmount;
  const isTaxInvoice = business.vatRegistered === true;
  if (!isTaxInvoice) {
    return { isTaxInvoice: false as const, vat: 0, subtotal: total, total };
  }
  const { subtotal, vat } = splitInclusiveTotal(total);
  return { isTaxInvoice: true as const, vat, subtotal, total };
}

export function buildJobInvoiceText(
  job: ACJob,
  business: BusinessInfo,
  locale: "si" | "en",
  t?: (key: string) => string,
  items?: InvoiceLineItem[],
): string {
  const invoiceableItems = (items ?? []).filter((i) => i.invoiceable && i.customerPrice != null);
  const hasItemizedLines = invoiceableItems.length > 0;
  const invoiceTotal = hasItemizedLines ? invoiceableLinesTotal(invoiceableItems) : job.quotedAmount;
  const amounts = taxInvoiceAmountsForJob(job, business, hasItemizedLines ? invoiceTotal : undefined);
  const balance = invoiceTotal - job.depositAmount;
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
    ...(hasItemizedLines
      ? invoiceableItems.map((i) => {
          const lineTotal = Math.max(0, i.qty * (i.customerPrice ?? 0) - (i.discount ?? 0));
          return `${i.name} × ${i.qty}${i.unit ? ` ${i.unit}` : ""}: ${formatLkr(lineTotal)}`;
        })
      : [`${jobTypeLabel(job.jobType, locale)} — ${job.description}`]),
    "",
    ...(amounts.isTaxInvoice
      ? [
          `${t ? t("inv.taxable_amount") : "Taxable amount"}: ${formatLkr(amounts.subtotal)}`,
          `${t ? t("vat.output_vat") : "VAT"} (18%): ${formatLkr(amounts.vat)}`,
          "",
        ]
      : []),
    `*${t ? t("inv.total") : "Total"}: ${formatLkr(invoiceTotal)}*`,
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

export function jobInvoiceWhatsappUrl(
  job: ACJob,
  business: BusinessInfo,
  locale: "si" | "en",
  t?: (key: string) => string,
  phone?: string,
  items?: InvoiceLineItem[],
): string {
  const text = buildJobInvoiceText(job, business, locale, t, items);
  return buildWhatsappUrl(text, phone ?? job.phone ?? business.phone);
}
