"use client";

import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { InvoiceView } from "@/components/invoice-view";
import {
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProPageShell,
} from "@/components/ui/pro-shell";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { paymentLabel } from "@/lib/i18n/payment";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export default function BillDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, ready } = useAppStore();
  const { t } = useLocale();
  const { canSeeFinancials } = useSubscription();

  if (!ready || !data) {
    return (
      <ProPageShell>
        <SiteHeader />
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </ProPageShell>
    );
  }

  const sale = data.sales.find((s) => s.id === id);
  if (!sale) {
    return (
      <ProPageShell>
        <SiteHeader />
        <ProMain>
          <ProCard>
            <ProEmptyState
              title={t("bills.not_found")}
              description="This bill may have been deleted or belongs to another workspace."
              action={<ProButton href="/bills">{t("bills.all_bills")}</ProButton>}
            />
          </ProCard>
        </ProMain>
      </ProPageShell>
    );
  }

  const customer = sale.customerId
    ? data.customers.find((c) => c.id === sale.customerId)
    : undefined;

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <div className="no-print">
          <ProPageHeader
            eyebrow="Invoice preview"
            title={`${t("bills.bill_no")} ${sale.billNo ?? sale.id.slice(0, 8)}`}
            description={`${new Date(sale.date).toLocaleString("en-LK")} · ${sale.customerName || "Walk-in customer"} · ${paymentLabel(t, sale.paymentMethod)}`}
            actions={
              <>
                <ProButton href="/bills" variant="secondary">← {t("bills.all_bills")}</ProButton>
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

          <section className={`mb-6 grid gap-4 ${canSeeFinancials ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <ProCard>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("common.total")}</p>
              <p className="mt-2 font-mono text-2xl font-black text-slate-950">{formatLkr(sale.total)}</p>
            </ProCard>
            {canSeeFinancials && (
            <ProCard>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("common.profit")}</p>
              <p className="mt-2 font-mono text-2xl font-black text-teal-700">{formatLkr(sale.profit)}</p>
            </ProCard>
            )}
            <ProCard>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("common.payment")}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{paymentLabel(t, sale.paymentMethod)}</p>
            </ProCard>
          </section>
        </div>

        <div className="mx-auto max-w-3xl">
          <InvoiceView
            sale={sale}
            business={data.business}
            customerPhone={customer?.phone}
            customerAddress={customer?.address}
            customerVatNumber={customer?.vatNumber}
          />
        </div>
      </ProMain>
    </ProPageShell>
  );
}
