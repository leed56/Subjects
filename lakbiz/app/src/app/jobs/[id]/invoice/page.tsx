"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { JobInvoiceView } from "@/components/job-invoice-view";
import {
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
} from "@/components/ui/pro-shell";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { jobStatusLabel } from "@/lib/ac-jobs";
import { useAppStore } from "@/lib/store/use-app-store";
import { invoiceableLinesTotal, type InvoiceLineItem } from "@/lib/job-invoice";

/** Printable AC job invoice — mirrors /bills/[id]'s structure exactly,
 * adapted for ACJob instead of Sale. Reachable only via a link from the
 * Job Sheet (see jobs/page.tsx); not its own nav entry, same as
 * /bills/[id] isn't either. */
export default function JobInvoicePage() {
  const params = useParams();
  const id = params.id as string;
  const { data, ready } = useAppStore();
  const { t, locale } = useLocale();

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const job = data.acJobs.find((j) => j.id === id);
  if (!job) {
    return (
      <AppShell>
        <ProMain>
          <ProCard>
            <ProEmptyState
              title={t("jinv.not_found")}
              description="This job may have been deleted or belongs to another workspace."
              action={<ProButton href="/jobs">{t("jobs.all")}</ProButton>}
            />
          </ProCard>
        </ProMain>
      </AppShell>
    );
  }

  const customer = job.customerId ? data.customers.find((c) => c.id === job.customerId) : undefined;
  // job-parts-materials phase — the narrow, internal-cost-free
  // projection JobInvoiceView/job-invoice.ts require (see their own
  // header comments): only what a customer-facing document may ever see.
  const invoiceItems: InvoiceLineItem[] = data.jobItems
    .filter((i) => i.jobId === job.id)
    .map((i) => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit, customerPrice: i.customerPrice, discount: i.discount, invoiceable: i.invoiceable }));
  const invoiceableItems = invoiceItems.filter((i) => i.invoiceable && i.customerPrice != null);
  const invoiceTotal = invoiceableItems.length > 0 ? invoiceableLinesTotal(invoiceableItems) : job.quotedAmount;
  const balance = invoiceTotal - job.depositAmount;

  return (
    <AppShell>
      <ProMain>
        <div className="no-print">
          <ProPageHeader
            eyebrow={t("jinv.eyebrow")}
            title={`${t("inv.bill_no")} ${job.jobNo}`}
            description={`${new Date(job.date).toLocaleString("en-LK")} · ${job.customerName || t("common.customer")} · ${jobStatusLabel(job.status, locale)}`}
            actions={
              <>
                <ProButton href="/jobs" variant="secondary">← {t("jobs.all")}</ProButton>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 active:scale-[0.98]"
                >
                  {t("common.view_print")}
                </button>
              </>
            }
          />

          <section className="mb-6 grid gap-4 sm:grid-cols-3">
            <ProCard>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("common.total")}</p>
              <p className="mt-2 font-mono text-2xl font-black text-slate-950">{formatLkr(invoiceTotal)}</p>
            </ProCard>
            <ProCard>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("jobs.deposit_label")}</p>
              <p className="mt-2 font-mono text-2xl font-black text-slate-950">{formatLkr(job.depositAmount)}</p>
            </ProCard>
            <ProCard>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("common.balance")}</p>
              <p className={`mt-2 font-mono text-2xl font-black ${balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {formatLkr(balance)}
              </p>
            </ProCard>
          </section>
        </div>

        <div className="mx-auto max-w-3xl">
          <JobInvoiceView job={job} business={data.business} customerAddress={customer?.address} items={invoiceItems} />
        </div>
      </ProMain>
    </AppShell>
  );
}
