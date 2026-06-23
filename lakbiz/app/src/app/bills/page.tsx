"use client";

import Link from "next/link";
import { useState } from "react";
import { ExportActions } from "@/components/export/export-actions";
import { MessageSendButton } from "@/components/messaging/message-send-button";
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
import { buildInvoiceText, buildQuoteText, whatsappShareUrl } from "@/lib/invoice";
import { exportSalesCsv, printSalesReport } from "@/lib/export";
import { useLocale } from "@/lib/i18n/locale-provider";
import { paymentLabel } from "@/lib/i18n/payment";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Sale } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";

function customerPhoneForSale(
  sale: Sale,
  customers: { id: string; phone?: string }[],
): string | undefined {
  if (!sale.customerId) return undefined;
  return customers.find((c) => c.id === sale.customerId)?.phone;
}

export default function BillsPage() {
  const { data, ready, updateBusiness } = useAppStore();
  const { t } = useLocale();
  const { canSeeFinancials, can } = useSubscription();
  const [editBiz, setEditBiz] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizNameSi, setBizNameSi] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizTin, setBizTin] = useState("");
  const [search, setSearch] = useState("");

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

  const openBizEdit = () => {
    setBizName(data.business.name);
    setBizNameSi(data.business.nameSi ?? "");
    setBizPhone(data.business.phone ?? "");
    setBizAddress(data.business.address ?? "");
    setBizTin(data.business.tin ?? "");
    setEditBiz(true);
  };

  const salesTotal = data.sales.reduce((sum, s) => sum + s.total, 0);
  const profitTotal = data.sales.reduce((sum, s) => sum + s.profit, 0);
  const creditTotal = data.sales
    .filter((s) => s.paymentMethod === "credit")
    .reduce((sum, s) => sum + s.total, 0);
  const query = search.trim().toLowerCase();
  const bills = query
    ? data.sales.filter(
        (s) =>
          (s.billNo ?? s.id).toLowerCase().includes(query) ||
          (s.customerName ?? "").toLowerCase().includes(query) ||
          paymentLabel(t, s.paymentMethod).toLowerCase().includes(query),
      )
    : data.sales;

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
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow="Billing archive"
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
              <ProButton href="/sales">{t("bills.create_sale")}</ProButton>
              <button
                type="button"
                onClick={openBizEdit}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:border-teal-200 hover:text-teal-800 active:scale-[0.98]"
              >
                {t("bills.shop_details")}
              </button>
            </>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard label={t("bills.count")} value={String(data.sales.length)} hint="Invoices issued" icon="🧾" tone="teal" />
          <ProStatCard label={t("common.total")} value={formatLkr(salesTotal)} hint="Total billed value" icon="💸" tone="emerald" />
          {canSeeFinancials && (
            <ProStatCard label={t("common.profit")} value={formatLkr(profitTotal)} hint="Recorded sale profit" icon="📈" tone="blue" />
          )}
          {canSeeFinancials && (
            <ProStatCard label="Credit bills" value={formatLkr(creditTotal)} hint="Customer credit sales" icon="🤝" tone="amber" />
          )}
        </section>

        {editBiz && (
          <section className="mt-6">
            <ProCard eyebrow="Invoice branding" title={t("bills.shop_header")}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateBusiness({
                    ...data.business,
                    name: bizName,
                    nameSi: bizNameSi,
                    phone: bizPhone,
                    address: bizAddress,
                    tin: bizTin,
                  });
                  setEditBiz(false);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required placeholder={t("bills.shop_name")} value={bizName} onChange={(e) => setBizName(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("bills.shop_name_si")} value={bizNameSi} onChange={(e) => setBizNameSi(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("bills.phone_wa")} value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("bills.tin")} value={bizTin} onChange={(e) => setBizTin(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("common.address")} value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100 sm:col-span-2" />
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button type="submit" className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">
                    {t("common.save")}
                  </button>
                  <button type="button" onClick={() => setEditBiz(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                    {t("common.cancel")}
                  </button>
                </div>
              </form>
            </ProCard>
          </section>
        )}

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <ProCard eyebrow="Invoice identity" title={data.business.name || "LakBiz"} action={<ProBadge tone={data.business.tin ? "emerald" : "slate"}>{data.business.tin ? "TIN ready" : "Basic"}</ProBadge>}>
            <div className="space-y-3 text-sm font-semibold text-slate-600">
              {data.business.nameSi && <p>{data.business.nameSi}</p>}
              {data.business.phone && <p>{t("bills.tel")}: {data.business.phone}</p>}
              {data.business.address && <p>{data.business.address}</p>}
              {data.business.tin && <p>{t("bills.tin")}: {data.business.tin}</p>}
              {!data.business.phone && !data.business.address && !data.business.tin && (
                <p className="text-slate-500">Add shop contact, address and TIN to make printed invoices look more professional.</p>
              )}
            </div>
          </ProCard>

          <ProCard title="Find invoices" eyebrow="Search archive" action={<ProBadge tone={bills.length === data.sales.length ? "slate" : "teal"}>{bills.length} shown</ProBadge>}>
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bill number, customer, or payment type..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pl-11 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
              />
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            </div>
          </ProCard>
        </section>

        <section className="mt-6">
          {data.sales.length === 0 ? (
            <ProCard>
              <ProEmptyState
                title={t("bills.no_bills")}
                description="Create a sale first, then invoices will appear here for print, sharing and records."
                action={<ProButton href="/sales">{t("bills.create_sale")}</ProButton>}
              />
            </ProCard>
          ) : bills.length === 0 ? (
            <ProCard>
              <ProEmptyState title={t("sales.no_match")} description="Try searching by bill number, customer or payment type." />
            </ProCard>
          ) : (
            <ProCard title="Invoice history" action={<ProBadge tone="teal">{bills.length} invoices</ProBadge>}>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
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
                        <td className="px-4 py-3 font-mono text-xs font-black text-slate-700">{s.billNo ?? s.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{new Date(s.date).toLocaleString("en-LK")}</td>
                        <td className="px-4 py-3 font-black text-slate-900">{s.customerName || "—"}</td>
                        <td className="px-4 py-3 font-mono font-black text-slate-950">{formatLkr(s.total)}</td>
                        <td className="px-4 py-3"><ProBadge tone="slate">{paymentLabel(t, s.paymentMethod)}</ProBadge></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Link href={`/bills/${s.id}`} className="font-black text-teal-700 hover:underline">{t("common.view_print")}</Link>
                            <a
                              href={invoiceWa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-green-600 px-2 py-1 text-xs font-black text-white hover:bg-green-700"
                            >
                              WA
                            </a>
                            <a
                              href={quoteWa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-green-600 px-2 py-1 text-xs font-black text-green-700 hover:bg-green-50"
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
                        <p className="font-mono text-xs font-black uppercase tracking-wide text-teal-700">{s.billNo ?? s.id.slice(0, 8)}</p>
                        <p className="mt-2 text-base font-black text-slate-950">{s.customerName || "Walk-in customer"}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{new Date(s.date).toLocaleString("en-LK")}</p>
                      </div>
                      <ProBadge tone="slate">{paymentLabel(t, s.paymentMethod)}</ProBadge>
                    </div>
                    <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-3">
                      <p className="font-mono text-xl font-black text-slate-950">{formatLkr(s.total)}</p>
                      <p className="text-xs font-black text-teal-700">{t("common.view_print")} →</p>
                    </div>
                  </Link>
                ))}
              </div>
            </ProCard>
          )}
        </section>
      </ProMain>
    </ProPageShell>
  );
}
