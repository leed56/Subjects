"use client";

import Link from "next/link";
import { useState } from "react";
import { ExportActions } from "@/components/export/export-actions";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { Drawer, DrawerFooter } from "@/components/ui/overlay";
import {
  ActionMenu,
  AlertRow,
  Button,
  EmptyState,
  MetricCard,
  PageHeader,
  SearchInput,
  StatusBadge,
} from "@/components/ui/primitives";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { BillsIcon, CostingIcon, CustomersIcon, ReportsIcon } from "@/components/ui/icons";
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
  return customers.find((customer) => customer.id === sale.customerId)?.phone;
}

const linkButtonBase =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4.5 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.98]";
const PAGE_SIZE = 25;

export default function BillsPageV2() {
  const { data, ready, updateBusinessToCloud } = useAppStore();
  const { t } = useLocale();
  const { canSeeFinancials, can, orgRole } = useSubscription();

  const [editBiz, setEditBiz] = useState(false);
  const [savingBiz, setSavingBiz] = useState(false);
  const [bizMessage, setBizMessage] = useState("");
  const [bizName, setBizName] = useState("");
  const [bizNameSi, setBizNameSi] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizTin, setBizTin] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const openBizEdit = () => {
    setBizName(data.business.name);
    setBizNameSi(data.business.nameSi ?? "");
    setBizPhone(data.business.phone ?? "");
    setBizAddress(data.business.address ?? "");
    setBizTin(data.business.tin ?? "");
    setBizMessage("");
    setEditBiz(true);
  };

  const salesTotal = data.sales.reduce((sum, sale) => sum + sale.total, 0);
  const profitTotal = data.sales.reduce((sum, sale) => sum + sale.profit, 0);
  const creditTotal = data.sales
    .filter((sale) => sale.paymentMethod === "credit")
    .reduce((sum, sale) => sum + sale.total, 0);

  const query = search.trim().toLowerCase();
  const bills = query
    ? data.sales.filter(
        (sale) =>
          (sale.billNo ?? sale.id).toLowerCase().includes(query) ||
          (sale.customerName ?? "").toLowerCase().includes(query) ||
          paymentLabel(t, sale.paymentMethod).toLowerCase().includes(query),
      )
    : data.sales;

  const pageCount = Math.max(1, Math.ceil(bills.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedBills = bills.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = bills.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, bills.length);

  const canExport = can("export");
  const invoiceIdentityIncomplete =
    !data.business.phone || !data.business.address || !data.business.tin;

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

  const paymentTone = (sale: Sale): "neutral" | "warning" | "info" | "positive" => {
    if (sale.paymentMethod === "credit") return "warning";
    if (sale.paymentMethod === "cash") return "positive";
    if (sale.paymentMethod === "bank_transfer" || sale.paymentMethod === "card") return "info";
    return "neutral";
  };

  const billColumns: DataTableColumn<Sale>[] = [
    {
      key: "bill",
      header: t("bills.bill_no"),
      render: (sale) => (
        <Link
          href={`/bills/${sale.id}`}
          className="font-mono text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline"
        >
          {sale.billNo ?? sale.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "date",
      header: t("common.date"),
      render: (sale) => (
        <span className="whitespace-nowrap text-slate-500">
          {new Date(sale.date).toLocaleDateString("en-LK")}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "customer",
      header: t("common.customer"),
      render: (sale) => (
        <span className="font-medium text-slate-950">
          {sale.customerName || t("bills.walk_in_customer")}
        </span>
      ),
    },
    {
      key: "payment",
      header: t("common.payment"),
      render: (sale) => (
        <StatusBadge tone={paymentTone(sale)}>{paymentLabel(t, sale.paymentMethod)}</StatusBadge>
      ),
      hideOnMobile: true,
    },
    {
      key: "total",
      header: t("common.total"),
      align: "right",
      render: (sale) => (
        <span className="font-mono font-semibold tabular-nums text-slate-950">
          {formatLkr(sale.total)}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (sale) => {
        const phone = customerPhoneForSale(sale, data.customers);
        const invoiceWa = whatsappShareUrl(buildInvoiceText(sale, data.business, t), phone);
        const quoteWa = whatsappShareUrl(buildQuoteText(sale, data.business, t), phone);

        return (
          <div className="flex items-center justify-end gap-1.5">
            <Link
              href={`/bills/${sale.id}`}
              className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
            >
              {t("common.view_print")}
            </Link>
            <MessageSendButton
              phone={phone}
              recipientName={sale.customerName ?? t("common.customer")}
              context={{ type: "sale", sale, business: data.business }}
              defaultTemplate="bill_receipt"
              contextId={sale.id}
              variant="icon"
            />
            <ActionMenu
              label={t("common.actions")}
              items={[
                {
                  label: t("bills.whatsapp"),
                  onSelect: () => window.open(invoiceWa, "_blank", "noopener,noreferrer"),
                },
                {
                  label: t("bills.quote_whatsapp"),
                  onSelect: () => window.open(quoteWa, "_blank", "noopener,noreferrer"),
                },
              ]}
            />
          </div>
        );
      },
    },
  ];

  const inputClass =
    "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";

  return (
    <AppShell>
      <ProMain>
        <PageHeader
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
                      paymentLabel: (method) => paymentLabel(t, method),
                    })
                  }
                  onPrintPdf={() =>
                    printSalesReport(data.business, bills, {
                      includeProfit: canSeeFinancials,
                      labels: salesExportLabels,
                      reportTitle: t("export.sales_report"),
                      paymentLabel: (method) => paymentLabel(t, method),
                    })
                  }
                />
              )}
              {orgRole === "owner" && (
                <Link
                  href="/returns"
                  className={`${linkButtonBase} border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50`}
                >
                  {t("nav.returns")}
                </Link>
              )}
              <Button variant="secondary" onClick={openBizEdit}>
                {t("bills.shop_details")}
              </Button>
              <Link
                href="/sales"
                className={`${linkButtonBase} bg-teal-600 text-white shadow-sm shadow-teal-950/15 hover:bg-teal-700`}
              >
                {t("bills.create_sale")}
              </Link>
            </>
          }
          metrics={
            <div
              className={`grid gap-3 sm:grid-cols-2 ${
                canSeeFinancials ? "xl:grid-cols-4" : "xl:grid-cols-2"
              }`}
            >
              <MetricCard
                label={t("bills.count")}
                value={String(data.sales.length)}
                hint={t("bills.invoices_issued")}
                icon={<BillsIcon className="h-4.5 w-4.5" />}
              />
              <MetricCard
                label={t("bills.total_billed")}
                value={formatLkr(salesTotal)}
                icon={<CostingIcon className="h-4.5 w-4.5" />}
                tone="positive"
              />
              {canSeeFinancials && (
                <MetricCard
                  label={t("bills.recorded_profit")}
                  value={formatLkr(profitTotal)}
                  icon={<ReportsIcon className="h-4.5 w-4.5" />}
                  tone={profitTotal < 0 ? "danger" : "positive"}
                />
              )}
              {canSeeFinancials && (
                <MetricCard
                  label={t("bills.credit_bills")}
                  value={formatLkr(creditTotal)}
                  hint={t("bills.credit_sales")}
                  icon={<CustomersIcon className="h-4.5 w-4.5" />}
                  tone={creditTotal > 0 ? "warning" : "default"}
                />
              )}
            </div>
          }
        />

        {invoiceIdentityIncomplete && (
          <div className="mb-5">
            <AlertRow
              tone="info"
              action={
                <Button size="sm" variant="secondary" onClick={openBizEdit}>
                  {t("bills.shop_details")}
                </Button>
              }
            >
              {t("bills.shop_header")}
            </AlertRow>
          </div>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder={t("bills.search_placeholder")}
            className="w-full sm:max-w-xl"
          />
          <p className="shrink-0 text-xs font-medium text-slate-400">
            {rangeStart}-{rangeEnd} / {bills.length}
          </p>
        </div>

        <DataTable
          columns={billColumns}
          rows={pagedBills}
          emptyState={
            <EmptyState
              icon={<BillsIcon className="h-5 w-5" />}
              title={data.sales.length === 0 ? t("bills.no_bills") : t("sales.no_match")}
              description={
                data.sales.length === 0
                  ? t("bills.no_bills_desc")
                  : t("bills.search_no_match_desc")
              }
              action={
                data.sales.length === 0 ? (
                  <Link
                    href="/sales"
                    className={`${linkButtonBase} bg-teal-600 text-white shadow-sm hover:bg-teal-700`}
                  >
                    {t("bills.create_sale")}
                  </Link>
                ) : undefined
              }
            />
          }
        />

        {bills.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-xs font-medium tabular-nums text-slate-500">
              {currentPage} / {pageCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                ←
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Next page"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
              >
                →
              </Button>
            </div>
          </div>
        )}
      </ProMain>

      <Drawer
        open={editBiz}
        onClose={() => setEditBiz(false)}
        title={t("bills.shop_header")}
        description={t("bills.invoice_identity_eyebrow")}
        size="lg"
        footer={
          <DrawerFooter
            onCancel={() => setEditBiz(false)}
            cancelLabel={t("common.cancel")}
            primaryLabel={savingBiz ? t("common.saving") : t("common.save")}
            primaryType="submit"
            primaryForm="bill-shop-details-form"
            primaryDisabled={savingBiz}
          />
        }
      >
        <form
          id="bill-shop-details-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (savingBiz) return;
            setSavingBiz(true);
            setBizMessage("");
            const result = await updateBusinessToCloud({
              ...data.business,
              name: bizName,
              nameSi: bizNameSi,
              phone: bizPhone,
              address: bizAddress,
              tin: bizTin,
            });
            setSavingBiz(false);
            if (!result.ok) {
              setBizMessage(result.error ?? t("common.save_failed"));
              return;
            }
            setEditBiz(false);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {bizMessage && (
              <div className="sm:col-span-2">
                <AlertRow tone="warning">{bizMessage}</AlertRow>
              </div>
            )}
            <label className="block text-sm font-medium text-slate-700">
              {t("bills.shop_name")}
              <input
                required
                value={bizName}
                onChange={(event) => setBizName(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("bills.shop_name_si")}
              <input
                value={bizNameSi}
                onChange={(event) => setBizNameSi(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("bills.phone_wa")}
              <input
                value={bizPhone}
                onChange={(event) => setBizPhone(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("bills.tin")}
              <input
                value={bizTin}
                onChange={(event) => setBizTin(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              {t("common.address")}
              <input
                value={bizAddress}
                onChange={(event) => setBizAddress(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
          </div>
        </form>
      </Drawer>
    </AppShell>
  );
}
