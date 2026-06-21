"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProPageShell,
  ProStatCard,
} from "@/components/ui/pro-shell";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import { getVatQuarterSummary } from "@/lib/vat";

export default function VatReturnPage() {
  const { data, ready } = useAppStore();
  const { t } = useLocale();

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

  const summary = getVatQuarterSummary(data);

  if (!summary.enabled) {
    return (
      <ProPageShell>
        <SiteHeader />
        <ProMain>
          <ProCard>
            <ProEmptyState
              title={t("vat.title")}
              description={t("vat.enable_hint")}
              action={<ProButton href="/settings/shop">{t("vat.shop_settings")}</ProButton>}
            />
          </ProCard>
        </ProMain>
      </ProPageShell>
    );
  }

  const quarterSales = data.sales.filter((s) => {
    const d = new Date(s.date).getTime();
    return d >= summary.bounds.start.getTime() && d <= summary.bounds.end.getTime();
  });
  const quarterPurchases = data.purchases.filter((p) => {
    const d = new Date(p.date).getTime();
    return d >= summary.bounds.start.getTime() && d <= summary.bounds.end.getTime();
  });

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow={t("vat.ready_to_file")}
          title={t("vat.title")}
          description={
            <span>
              {summary.bounds.label}
              {data.business.vatNumber && (
                <span className="mt-1 block text-sm font-bold text-slate-500">
                  {t("vat.vat_number")}: {data.business.vatNumber}
                </span>
              )}
            </span>
          }
          actions={
            <>
              <ProButton href="/sales" variant="secondary">{t("nav.sales")}</ProButton>
              <ProButton href="/suppliers" variant="secondary">{t("sup.record_purchase")}</ProButton>
              <ProButton href="/settings/shop">{t("vat.shop_settings")}</ProButton>
            </>
          }
        />

        <section className="mb-6 overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/20 ring-1 ring-slate-800 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-300">{t("vat.net_payable")}</p>
              <p className="mt-3 font-mono text-4xl font-black tracking-tight text-teal-300 sm:text-5xl">
                {formatLkr(summary.netPayable)}
              </p>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-400">{t("vat.ird_note")}</p>
            </div>
            <ProBadge tone={summary.netPayable > 0 ? "amber" : "emerald"}>
              {summary.netPayable > 0 ? "Payable" : "Input credit"}
            </ProBadge>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard label={t("vat.output_vat")} value={formatLkr(summary.outputVat)} hint={`${summary.salesCount} ${t("vat.sales_in_period")}`} icon="🧾" tone="amber" />
          <ProStatCard label={t("vat.input_vat")} value={formatLkr(summary.inputVat)} hint={`${summary.purchasesCount} ${t("vat.purchases_in_period")}`} icon="📥" tone="teal" />
          <ProStatCard label={t("vat.sales_list")} value={String(quarterSales.length)} hint="Invoices in quarter" icon="💸" tone="blue" />
          <ProStatCard label={t("vat.purchases_list")} value={String(quarterPurchases.length)} hint="Purchase records" icon="📦" tone="emerald" />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <ProCard title={t("vat.sales_list")} action={<ProBadge tone="amber">{formatLkr(summary.outputVat)}</ProBadge>}>
            {quarterSales.length === 0 ? (
              <ProEmptyState title={t("vat.no_sales")} description="Sales with output VAT will appear here for this period." />
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {quarterSales.map((s) => (
                  <Link key={s.id} href={`/bills/${s.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-black uppercase tracking-wide text-slate-500">{s.billNo ?? s.id.slice(0, 8)}</p>
                      <p className="mt-1 truncate text-sm font-black text-slate-950">{s.customerName || "Walk-in customer"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{new Date(s.date).toLocaleDateString("en-LK")}</p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-black text-amber-700">{formatLkr(s.outputVat ?? 0)}</p>
                  </Link>
                ))}
              </div>
            )}
          </ProCard>

          <ProCard title={t("vat.purchases_list")} action={<ProBadge tone="teal">{formatLkr(summary.inputVat)}</ProBadge>}>
            {quarterPurchases.length === 0 ? (
              <ProEmptyState title={t("vat.no_purchases")} description="Purchases with input VAT will appear here for this period." />
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {quarterPurchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-black uppercase tracking-wide text-slate-500">{p.grnNo}</p>
                      <p className="mt-1 truncate text-sm font-black text-slate-950">{p.supplierName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{new Date(p.date).toLocaleDateString("en-LK")}</p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-black text-teal-700">{formatLkr(p.inputVat ?? 0)}</p>
                  </div>
                ))}
              </div>
            )}
          </ProCard>
        </section>
      </ProMain>
    </ProPageShell>
  );
}
