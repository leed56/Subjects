"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { getVatQuarterSummary } from "@/lib/vat";
import { useAppStore } from "@/lib/store/use-app-store";

export default function VatReturnPage() {
  const { data, ready } = useAppStore();
  const { t } = useLocale();

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-950">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-10 text-slate-100">
          {t("common.loading")}
        </main>
      </div>
    );
  }

  const summary = getVatQuarterSummary(data);

  if (!summary.enabled) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-slate-900">{t("vat.title")}</h1>
          <p className="mt-3 text-slate-600">{t("vat.enable_hint")}</p>
          <Link
            href="/settings/shop"
            className="mt-6 inline-block rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white"
          >
            {t("vat.shop_settings")}
          </Link>
        </main>
      </div>
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
    <div className="min-h-full bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-400">
            {t("vat.ready_to_file")}
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("vat.title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{summary.bounds.label}</p>
          {data.business.vatNumber && (
            <p className="mt-1 text-xs text-slate-500">
              {t("vat.vat_number")}: {data.business.vatNumber}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:p-8">
          <p className="text-sm text-teal-300/80">{t("vat.net_payable")}</p>
          <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-teal-400 sm:text-5xl">
            {formatLkr(summary.netPayable)}
          </p>
          <p className="mt-3 text-xs text-slate-500">{t("vat.ird_note")}</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">{t("vat.output_vat")}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-400">
              {formatLkr(summary.outputVat)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {summary.salesCount} {t("vat.sales_in_period")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">{t("vat.input_vat")}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-teal-300">
              {formatLkr(summary.inputVat)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {summary.purchasesCount} {t("vat.purchases_in_period")}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="text-sm font-semibold text-slate-300">{t("vat.sales_list")}</h2>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
              {quarterSales.length === 0 && (
                <li className="text-slate-500">{t("vat.no_sales")}</li>
              )}
              {quarterSales.map((s) => (
                <li
                  key={s.id}
                  className="flex justify-between rounded-lg border border-slate-800 px-3 py-2"
                >
                  <span className="text-slate-400">
                    {s.billNo ?? s.id.slice(0, 8)}
                  </span>
                  <span className="font-mono tabular-nums text-amber-400/90">
                    {formatLkr(s.outputVat ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-slate-300">
              {t("vat.purchases_list")}
            </h2>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
              {quarterPurchases.length === 0 && (
                <li className="text-slate-500">{t("vat.no_purchases")}</li>
              )}
              {quarterPurchases.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-lg border border-slate-800 px-3 py-2"
                >
                  <span className="text-slate-400">{p.grnNo}</span>
                  <span className="font-mono tabular-nums text-teal-300/90">
                    {formatLkr(p.inputVat ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/sales"
            className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t("nav.sales")}
          </Link>
          <Link
            href="/suppliers"
            className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200"
          >
            {t("sup.record_purchase")}
          </Link>
          <Link
            href="/settings/shop"
            className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200"
          >
            {t("vat.shop_settings")}
          </Link>
        </div>
      </main>
    </div>
  );
}
