"use client";

import Link from "next/link";
import { useState } from "react";
import { ExportActions } from "@/components/export/export-actions";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { AppShell } from "@/components/shell/app-shell";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProStatCard,
} from "@/components/ui/pro-shell";
import { BillsIcon, CostingIcon, ReportsIcon, CustomersIcon } from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
import { buildInvoiceText, buildQuoteText, whatsappShareUrl } from "@/lib/invoice";
import { exportSalesCsv, printSalesReport } from "@/lib/export";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Sale } from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";

function customerPhoneForSale(
  sale: Sale,
  customers: { id: string; phone?: string }[],
): string | undefined {
  if (!sale.customerId) return undefined;
  return customers.find((c) => c.id === sale.customerId)?.phone;
}

export default function BillsPage() {
  const { data, ready } = useAppStore();
  const { t } = useLocale();
  const { canSeeFinancials, can, orgRole } = useSubscription();
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "all">("all");
  const [invoiceType, setInvoiceType] = useState<"all" | "vehicle" | "retail">("all");

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const salesTotal = data.sales.reduce((sum, s) => sum + s.total, 0);
  const profitTotal = data.sales.reduce((sum, s) => sum + s.profit, 0);
  const creditTotal = data.sales
    .filter((s) => s.paymentMethod === "credit")
    .reduce((sum, s) => sum + s.total, 0);
  const query = search.trim().toLowerCase();
  const vehicleSaleIds = new Set(data.vehicles.map((vehicle) => vehicle.id));
  const bills = data.sales.filter((sale) => {
    const isVehicle = vehicleSaleIds.has(sale.id);
    if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) return false;
    if (invoiceType === "vehicle" && !isVehicle) return false;
    if (invoiceType === "retail" && isVehicle) return false;
    if (!query) return true;
    return (
      (sale.billNo ?? sale.id).toLowerCase().includes(query) ||
      (sale.customerName ?? "").toLowerCase().includes(query) ||
      paymentLabel(t, sale.paymentMethod).toLowerCase().includes(query) ||
      sale.lines.some((line) => line.productName.toLowerCase().includes(query))
    );
  });

  const canExport = can("export");
  const salesExportLabels = {
    billNo: t("bills.bill_no"),
    date: t("common.date"),
    customer: t("common.customer"),
    payment: t("common.payment"),
    items: t("common.items"),
    discount: t("sales.discount"),
    subtotal: t("vat.subtotal"),
    vat: t("vat.output_vat"),
    total: t("common.total"),
    profit: t("common.profit"),
  };

  return (
    <AppShell>
      <ProMain>
        <ProPageHeader
          eyebrow={t("bills.archive_eyebrow")}
          title={t("bills.title")}
          description={`${t("bills.subtitle")} · ${data.sales.length} ${t("bills.count")}`}
          actions={
            <>
              {canExport && (
                <ExportActions
                  disabled={bills.length === 0}
                  onExportCsv={() =>
                    exportSalesCsv(data.business, bills, {
                      includeProfit: canSeeFinancials,
                      labels: salesExportLabels,
                      paymentLabel: (m) => paymentLabel(t, m),
                    })
                  }
                  onPrintPdf={() =>
                    printSalesReport(data.business, bills, {
                      includeProfit: canSeeFinancials,
                      labels: salesExportLabels,
                      reportTitle: t("export.sales_report"),
                      paymentLabel: (m) => paymentLabel(t, m),
                    })
                  }
                />
              )}
              {orgRole === "owner" && (
                <ProButton href="/returns" variant="secondary">Returns control</ProButton>
              )}
              <ProButton href="/sales">{t("bills.create_sale")}</ProButton>
              <ProButton href="/settings/shop" variant="secondary">
                {t("bills.shop_details")}
              </ProButton>
            </>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard label={t("bills.count")} value={String(data.sales.length)} hint={t("bills.invoices_issued")} icon={<BillsIcon className="h-5 w-5" />} tone="teal" />
          <ProStatCard label={t("common.total")} value={formatLkr(salesTotal)} hint={t("bills.total_billed")} icon={<CostingIcon className="h-5 w-5" />} tone="emerald" />
          {canSeeFinancials && (
            <ProStatCard label={t("common.profit")} value={formatLkr(profitTotal)} hint={t("bills.recorded_profit")} icon={<ReportsIcon className="h-5 w-5" />} tone="blue" />
          )}
          {canSeeFinancials && (
            <ProStatCard label={t("bills.credit_bills")} value={formatLkr(creditTotal)} hint={t("bills.credit_sales")} icon={<CustomersIcon className="h-5 w-5" />} tone="amber" />
          )}
        </section>

        <section className="mt-6">
          <ProCard title={t("bills.find_invoices")} eyebrow={t("bills.search_archive_eyebrow")} action={<ProBadge tone={bills.length === data.sales.length ? "slate" : "teal"}>{bills.length} {t("bills.shown")}</ProBadge>}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
              <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("bills.search_placeholder")}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pl-11 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
              />
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              </div>
              <select value={invoiceType} onChange={(event) => setInvoiceType(event.target.value as typeof invoiceType)} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100">
                <option value="all">{t("bills.all_invoice_types")}</option>
                <option value="vehicle">{t("bills.vehicle_invoices")}</option>
                <option value="retail">{t("bills.retail_service")}</option>
              </select>
              <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as PaymentMethod | "all")} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100">
                <option value="all">{t("bills.all_payment_methods")}</option>
                {PAYMENT_OPTIONS.map((method) => <option key={method} value={method}>{paymentLabel(t, method)}</option>)}
              </select>
            </div>
          </ProCard>
        </section>

        <section className="mt-6">
          {data.sales.length === 0 ? (
            <ProCard>
              <ProEmptyState
                title={t("bills.no_bills")}
                description={t("bills.no_bills_desc")}
                action={<ProButton href="/sales">{t("bills.create_sale")}</ProButton>}
              />
            </ProCard>
          ) : bills.length === 0 ? (
            <ProCard>
              <ProEmptyState title={t("sales.no_match")} description={t("bills.search_no_match_desc")} />
            </ProCard>
          ) : (
            <ProCard title={t("bills.invoice_history")} action={<ProBadge tone="teal">{bills.length} {t("bills.invoices_count")}</ProBadge>}>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t("bills.bill_no")}</th>
                      <th className="px-4 py-3">{t("common.date")}</th>
                      <th className="px-4 py-3">{t("common.customer")}</th>
                      <th className="px-4 py-3">{t("common.total")}</th>
                      <th className="px-4 py-3">{t("common.payment")}</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((s) => {
                      const isVehicle = vehicleSaleIds.has(s.id);
                      const phone = customerPhoneForSale(s, data.customers);
                      const invoiceWa = whatsappShareUrl(
                        buildInvoiceText(s, data.business, t),
                        phone,
                      );
                      const quoteWa = whatsappShareUrl(
                        buildQuoteText(s, data.business, t),
                        phone,
                      );
                      return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-bold text-slate-700">{s.billNo ?? s.id.slice(0, 8)}</p>
                          {isVehicle && <span className="mt-1 inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-700">{t("nav.vehicles")}</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{new Date(s.date).toLocaleString("en-LK")}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{s.customerName || "—"}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-950">{formatLkr(s.total)}</td>
                        <td className="px-4 py-3"><ProBadge tone="slate">{paymentLabel(t, s.paymentMethod)}</ProBadge></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Link href={`/bills/${s.id}`} className="font-bold text-teal-700 hover:underline">{t("common.view_print")}</Link>
                            <a
                              href={invoiceWa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-green-600 px-2 py-1 text-xs font-bold text-white hover:bg-green-700"
                            >
                              {t("bills.wa_short")}
                            </a>
                            <a
                              href={quoteWa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-green-600 px-2 py-1 text-xs font-bold text-green-700 hover:bg-green-50"
                            >
                              {t("bills.quote_whatsapp")}
                            </a>
                            <MessageSendButton
                              phone={phone}
                              recipientName={s.customerName ?? t("common.customer")}
                              context={{ type: "sale", sale: s, business: data.business }}
                              defaultTemplate="bill_receipt"
                              contextId={s.id}
                              variant="icon"
                            />
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {bills.map((s) => (
                  <Link key={s.id} href={`/bills/${s.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-xs font-bold uppercase tracking-wide text-teal-700">{s.billNo ?? s.id.slice(0, 8)}</p>
                          {vehicleSaleIds.has(s.id) && <ProBadge tone="teal">{t("nav.vehicles")}</ProBadge>}
                        </div>
                        <p className="mt-2 text-base font-bold text-slate-950">{s.customerName || t("bills.walk_in_customer")}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{new Date(s.date).toLocaleString("en-LK")}</p>
                      </div>
                      <ProBadge tone="slate">{paymentLabel(t, s.paymentMethod)}</ProBadge>
                    </div>
                    <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-3">
                      <p className="font-mono text-xl font-bold text-slate-950">{formatLkr(s.total)}</p>
                      <p className="text-xs font-bold text-teal-700">{t("common.view_print")} →</p>
                    </div>
                  </Link>
                ))}
              </div>
            </ProCard>
          )}
        </section>
      </ProMain>
    </AppShell>
  );
}
