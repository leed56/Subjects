"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { InvoiceView } from "@/components/invoice-view";
import { SaleInventoryTrace } from "@/components/sales/sale-inventory-trace";
import { SaleReturnHistory } from "@/components/sales/sale-return-history";
import { SaleTenderBreakdown } from "@/components/sales/sale-tender-breakdown";
import {
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
} from "@/components/ui/pro-shell";
import { formatLkr } from "@/lib/format";
import { groceryProductLabel } from "@/lib/grocery-localization";
import { useLocale } from "@/lib/i18n/locale-provider";
import { paymentLabel } from "@/lib/i18n/payment";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export default function BillDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, ready } = useAppStore();
  const { t, locale } = useLocale();
  const { canSeeFinancials, orgRole, org } = useSubscription();

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const sale = data.sales.find((s) => s.id === id);
  const voidedSale = data.voidedSales.find((s) => s.id === id);
  if (!sale && voidedSale && orgRole === "owner") {
    return (
      <AppShell>
        <ProMain>
          <ProPageHeader
            eyebrow="Owner audit record"
            title={`Voided test bill ${voidedSale.billNo ?? voidedSale.id}`}
            description={`Marked ${new Date(voidedSale.voidedAt).toLocaleString("en-LK")} · ${voidedSale.customerName || "Walk-in customer"}`}
            actions={<ProButton href="/bills" variant="secondary">← {t("bills.all_bills")}</ProButton>}
          />
          <div role="note" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <p className="font-bold">Test transaction excluded from active sales.</p>
            <p className="mt-1">No cash changed hands. No refund or settlement was recorded.</p>
            <p className="mt-1">The original invoice, physical-return record, and credit note remain preserved in the audit history. This test is excluded from active sales, return, and revenue totals.</p>
            <p className="mt-2 text-amber-800"><span className="font-semibold">Reason:</span> {voidedSale.voidReason}</p>
          </div>
          <ProCard title="Original test details" eyebrow="Audit only">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recorded bill value</p><p className="mt-1 font-mono text-xl font-bold">{formatLkr(voidedSale.total)}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tender recorded on invoice</p><p className="mt-1 text-xl font-bold">{paymentLabel(t, voidedSale.paymentMethod)}</p><p className="text-xs text-slate-500">No money exchanged</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Original date</p><p className="mt-1 font-semibold">{new Date(voidedSale.date).toLocaleString("en-LK")}</p></div>
            </div>
            <div className="divide-y divide-slate-100">
              {voidedSale.lines.map((line, index) => (
                <div key={`${line.productId}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="font-semibold text-slate-800">{line.productName}</span>
                  <span className="shrink-0 text-slate-600">{line.qty} × {formatLkr(line.unitPrice)}</span>
                </div>
              ))}
            </div>
          </ProCard>
        </ProMain>
      </AppShell>
    );
  }
  if (!sale) {
    return (
      <AppShell>
        <ProMain>
          <ProCard>
            <ProEmptyState
              title={t("bills.not_found")}
              description="This bill may have been deleted or belongs to another workspace."
              action={<ProButton href="/bills">{t("bills.all_bills")}</ProButton>}
            />
          </ProCard>
        </ProMain>
      </AppShell>
    );
  }

  const invoiceSale =
    org.sector === "grocery"
      ? {
          ...sale,
          lines: sale.lines.map((line) => {
            const product = data.products.find((item) => item.id === line.productId);
            if (!product) return line;
            return {
              ...line,
              productName: groceryProductLabel(
                { sku: product.sku, name: line.productName },
                locale,
              ),
            };
          }),
        }
      : sale;

  const customer = sale.customerId
    ? data.customers.find((c) => c.id === sale.customerId)
    : undefined;
  const canApproveReturn = orgRole === "owner" || orgRole === "manager";

  return (
    <AppShell>
      <ProMain>
        <div className="no-print">
          <ProPageHeader
            eyebrow="Invoice preview"
            title={`${t("bills.bill_no")} ${sale.billNo ?? sale.id.slice(0, 8)}`}
            description={`${new Date(sale.date).toLocaleString("en-LK")} · ${sale.customerName || "Walk-in customer"} · ${paymentLabel(t, sale.paymentMethod)}`}
            actions={
              <>
                <ProButton href="/bills" variant="secondary">← {t("bills.all_bills")}</ProButton>
                {canApproveReturn && (
                  <ProButton href={`/bills/${sale.id}/return`} variant="secondary">
                    Customer return
                  </ProButton>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 active:scale-[0.98]"
                >
                  {t("common.view_print")}
                </button>
              </>
            }
          />

          <section className={`mb-6 grid gap-4 ${canSeeFinancials ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <ProCard>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{t("common.total")}</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-950">{formatLkr(sale.total)}</p>
            </ProCard>
            {canSeeFinancials && (
              <ProCard>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{t("common.profit")}</p>
                <p className="mt-2 font-mono text-2xl font-bold text-teal-700">{formatLkr(sale.profit)}</p>
              </ProCard>
            )}
            <ProCard>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{t("common.payment")}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{paymentLabel(t, sale.paymentMethod)}</p>
            </ProCard>
          </section>
        </div>

        <div className="mx-auto max-w-3xl">
          <InvoiceView
            sale={invoiceSale}
            business={data.business}
            customerPhone={customer?.phone}
            customerAddress={customer?.address}
            customerVatNumber={customer?.vatNumber}
          />
          <SaleTenderBreakdown saleId={sale.id} saleTotal={sale.total} />
          <SaleInventoryTrace saleId={sale.id} />
          <SaleReturnHistory saleId={sale.id} />
        </div>
      </ProMain>
    </AppShell>
  );
}
