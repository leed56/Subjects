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
    const voidDateLocale = locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK";
    const voidCopy = locale === "si"
      ? {
          eyebrow: "හිමිකරු විගණන වාර්තාව",
          title: `අවලංගු කළ පරීක්ෂණ බිල්පත ${voidedSale.billNo ?? voidedSale.id}`,
          marked: "සලකුණු කළේ",
          walkIn: t("bills.walk_in_customer"),
          bannerTitle: "පරීක්ෂණ ගනුදෙනුව සක්‍රිය විකුණුම්වලින් ඉවත් කර ඇත.",
          bannerNoCash: "මුදල් හුවමාරුවක් සිදු නොවීය. ආපසු ගෙවීමක් හෝ පියවීමක් සටහන් නොවීය.",
          bannerPreserved: "මුල් ඉන්වොයිසිය, ආපසු භාරදීමේ වාර්තාව සහ බැර සටහන විගණන ඉතිහාසයේ සුරක්ෂිතව පවතී. මෙය සක්‍රිය විකුණුම්, ආපසු භාරදීම් සහ ආදායම් එකතුවලින් බැහැර කර ඇත.",
          reason: "හේතුව:",
          cardTitle: "මුල් පරීක්ෂණ විස්තර",
          cardEyebrow: "විගණනයට පමණි",
          recordedValue: "සටහන් කළ බිල් වටිනාකම",
          recordedTender: "ඉන්වොයිසියේ සටහන් කළ ගෙවීම් ක්‍රමය",
          noMoneyExchanged: "මුදල් හුවමාරු නොවීය",
          originalDate: "මුල් දිනය",
        }
      : locale === "ta"
        ? {
            eyebrow: "உரிமையாளர் தணிக்கை பதிவு",
            title: `ரத்து செய்யப்பட்ட சோதனை பில் ${voidedSale.billNo ?? voidedSale.id}`,
            marked: "குறிக்கப்பட்டது",
            walkIn: t("bills.walk_in_customer"),
            bannerTitle: "சோதனைப் பரிவர்த்தனை செயலில் உள்ள விற்பனையிலிருந்து விலக்கப்பட்டுள்ளது.",
            bannerNoCash: "பணம் பரிமாறப்படவில்லை. திருப்பிச் செலுத்துதல் அல்லது தீர்வு எதுவும் பதிவு செய்யப்படவில்லை.",
            bannerPreserved: "மூல பில், பொருள் திரும்பப் பெறுதல் பதிவு மற்றும் கடன் குறிப்பு தணிக்கை வரலாற்றில் பாதுகாக்கப்படுகின்றன. இது செயலில் உள்ள விற்பனை, திரும்பப் பெறுதல் மற்றும் வருவாய் மொத்தங்களிலிருந்து விலக்கப்பட்டுள்ளது.",
            reason: "காரணம்:",
            cardTitle: "மூல சோதனை விவரங்கள்",
            cardEyebrow: "தணிக்கைக்கு மட்டும்",
            recordedValue: "பதிவு செய்யப்பட்ட பில் மதிப்பு",
            recordedTender: "பில்லில் பதிவு செய்யப்பட்ட கட்டண முறை",
            noMoneyExchanged: "பணம் பரிமாறப்படவில்லை",
            originalDate: "மூல தேதி",
          }
        : {
            eyebrow: "Owner audit record",
            title: `Voided test bill ${voidedSale.billNo ?? voidedSale.id}`,
            marked: "Marked",
            walkIn: "Walk-in customer",
            bannerTitle: "Test transaction excluded from active sales.",
            bannerNoCash: "No cash changed hands. No refund or settlement was recorded.",
            bannerPreserved: "The original invoice, physical-return record, and credit note remain preserved in the audit history. This test is excluded from active sales, return, and revenue totals.",
            reason: "Reason:",
            cardTitle: "Original test details",
            cardEyebrow: "Audit only",
            recordedValue: "Recorded bill value",
            recordedTender: "Tender recorded on invoice",
            noMoneyExchanged: "No money exchanged",
            originalDate: "Original date",
          };
    return (
      <AppShell>
        <ProMain>
          <ProPageHeader
            eyebrow={voidCopy.eyebrow}
            title={voidCopy.title}
            description={`${voidCopy.marked} ${new Date(voidedSale.voidedAt).toLocaleString(voidDateLocale)} · ${voidedSale.customerName || voidCopy.walkIn}`}
            actions={<ProButton href="/bills" variant="secondary">← {t("bills.all_bills")}</ProButton>}
          />
          <div role="note" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <p className="font-bold">{voidCopy.bannerTitle}</p>
            <p className="mt-1">{voidCopy.bannerNoCash}</p>
            <p className="mt-1">{voidCopy.bannerPreserved}</p>
            <p className="mt-2 text-amber-800"><span className="font-semibold">{voidCopy.reason}</span> {voidedSale.voidReason}</p>
          </div>
          <ProCard title={voidCopy.cardTitle} eyebrow={voidCopy.cardEyebrow}>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{voidCopy.recordedValue}</p><p className="mt-1 font-mono text-xl font-bold">{formatLkr(voidedSale.total)}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{voidCopy.recordedTender}</p><p className="mt-1 text-xl font-bold">{paymentLabel(t, voidedSale.paymentMethod)}</p><p className="text-xs text-slate-500">{voidCopy.noMoneyExchanged}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{voidCopy.originalDate}</p><p className="mt-1 font-semibold">{new Date(voidedSale.date).toLocaleString(voidDateLocale)}</p></div>
            </div>
            <div className="divide-y divide-slate-100">
              {voidedSale.lines.map((line, index) => {
                const product = data.products.find((item) => item.id === line.productId);
                const label = org.sector === "grocery" && product
                  ? groceryProductLabel({ sku: product.sku, name: line.productName }, locale)
                  : line.productName;
                return (
                <div key={`${line.productId}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="font-semibold text-slate-800">{label}</span>
                  <span className="shrink-0 text-slate-600">{line.qty} × {formatLkr(line.unitPrice)}</span>
                </div>
                );
              })}
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
