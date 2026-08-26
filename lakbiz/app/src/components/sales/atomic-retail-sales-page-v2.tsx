"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { setBottomBarOccupied } from "@/components/shell/bottom-bar-overlay";
import { ProductConditionBadge } from "@/components/product-condition-badge";
import { AdvancedSaleSelector, type AdvancedSaleLineState } from "@/components/sales/advanced-sale-selector";
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
import { BillsIcon, CostingIcon, SalesIcon } from "@/components/ui/icons";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { LK_BANKS } from "@/lib/banks";
import { customerPrimaryLabel } from "@/lib/contact-type";
import { effectiveUnitPrice } from "@/lib/company-pricing";
import { formatLkr } from "@/lib/format";
import { buildQuoteTextFromLines, whatsappShareUrl } from "@/lib/invoice";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { buildSaleInventoryAllocationLine } from "@/lib/inventory-sale-allocation";
import {
  summarizeSaleTenders,
  validateSaleTenders,
} from "@/lib/sale-tender";
import {
  buildCheckoutTenders,
  type CheckoutTenderKind,
} from "@/lib/retail-tender-checkout";
import { useAppStore } from "@/lib/store/use-app-store";
import { saveAppData } from "@/lib/store/storage";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { pullBusinessData } from "@/lib/supabase/business-sync";
import {
  finalizeSaleWithTenders,
  type AtomicSaleLine,
} from "@/lib/supabase/sale-tender-client";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import type { Product, ProductCondition } from "@/lib/types";
import { splitInclusiveTotal } from "@/lib/vat";

type CheckoutPayment = CheckoutTenderKind;
type ConditionFilter = "all" | ProductCondition;

const ADVANCED_RETAIL_SECTORS = new Set(["pharmacy", "mobile_shop", "electronics", "footwear"]);
const FAST_RETAIL_SECTORS = new Set(["pharmacy", "grocery"]);
const SUCCESS_STORAGE_KEY = "lakbiz-atomic-sale-success";

function clientId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function productSearchText(product: Product): string {
  return [
    product.name,
    product.sku,
    product.category,
    product.customFields.barcode,
    product.customFields.genericName,
    product.customFields.brand,
    product.customFields.strength,
    product.customFields.packSize,
  ]
    .filter(Boolean)
    .map(String)
    .join(" ")
    .toLowerCase();
}

function boolField(value: unknown): boolean {
  return value === true || (typeof value === "string" && value.trim().toLowerCase() === "true");
}

export function AtomicRetailSalesPageV2() {
  const { data, ready } = useAppStore();
  const { t, locale } = useLocale();
  const { org, canSeeFinancials } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const si = locale === "si";
  const fastRetail = FAST_RETAIL_SECTORS.has(org.sector);
  const advancedRetail = ADVANCED_RETAIL_SECTORS.has(org.sector);
  const conditionRelevant = !fastRetail;

  const [cart, setCart] = useState<Record<string, number>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [inventoryStates, setInventoryStates] = useState<Record<string, AdvancedSaleLineState>>({});
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [resultLimit, setResultLimit] = useState(30);
  const [discount, setDiscount] = useState(0);
  const [cashReceived, setCashReceived] = useState<number | "">("");
  const [payment, setPayment] = useState<CheckoutPayment>("cash");
  const [splitPayment, setSplitPayment] = useState(false);
  const [secondaryPayment, setSecondaryPayment] = useState<CheckoutPayment>("card");
  const [secondaryAmount, setSecondaryAmount] = useState<number | "">("");
  const [customerId, setCustomerId] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState(LK_BANKS[0]);
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [postDated, setPostDated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [lastBillId, setLastBillId] = useState<string | null>(null);
  const [pendingSaleId, setPendingSaleId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SUCCESS_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { saleId?: string; billNo?: string; paymentMethod?: string };
      sessionStorage.removeItem(SUCCESS_STORAGE_KEY);
      if (saved.saleId) setLastBillId(saved.saleId);
      const paymentNote = saved.paymentMethod === "mixed"
        ? (si ? " · බෙදා ගෙවීම" : " · Split payment")
        : "";
      setMessage(
        si
          ? `විකිණීම සම්පූර්ණයි${saved.billNo ? ` · ${saved.billNo}` : ""}${paymentNote}. තොගය සහ ගෙවීම එකම transaction එකක සුරකින ලදී.`
          : `Sale completed${saved.billNo ? ` · ${saved.billNo}` : ""}${paymentNote}. Payment and inventory were committed in one transaction.`,
      );
    } catch {
      sessionStorage.removeItem(SUCCESS_STORAGE_KEY);
    }
  }, [si]);

  const lines = useMemo(() => {
    if (!data) return [];
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = data.products.find((row) => row.id === productId)!;
        const unitPrice = effectiveUnitPrice(
          product,
          customerId,
          data,
          priceOverrides[productId],
        );
        return { product, qty, unitPrice };
      });
  }, [cart, priceOverrides, data, customerId]);

  // Tell the shared mobile bottom nav to step aside only while our own
  // fixed settlement bar is actually showing (lines non-empty) — see
  // bottom-bar-overlay.ts.
  useEffect(() => {
    setBottomBarOccupied(lines.length > 0);
    return () => setBottomBarOccupied(false);
  }, [lines.length]);

  const gross = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const discountClamped = Math.min(Math.max(0, discount), gross);
  const netTotal = gross - discountClamped;
  const billVat = data?.business.vatRegistered ? splitInclusiveTotal(netTotal) : null;
  const cartCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const secondaryAmountValue = secondaryAmount === "" ? 0 : Math.max(0, Number(secondaryAmount));
  const primaryTenderPreview = splitPayment
    ? Math.max(0, netTotal - secondaryAmountValue)
    : netTotal;
  const cashTenderPreview =
    (payment === "cash" ? primaryTenderPreview : 0) +
    (splitPayment && secondaryPayment === "cash" ? secondaryAmountValue : 0);
  const changeDue = cashReceived === "" ? 0 : Math.max(0, Number(cashReceived) - cashTenderPreview);
  const paymentSummaryLabel = splitPayment
    ? (si ? "බෙදා ගෙවීම" : "Split payment")
    : paymentLabel(t, payment);
  const identityBlocked = advancedRetail && lines.some((line) => {
    const state = inventoryStates[line.product.id];
    return !state || state.loading || !state.ready || state.degraded;
  });

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain><ProLoadingState label={t("common.loading")} /></ProMain>
      </AppShell>
    );
  }

  const selectedCustomer = customerId
    ? data.customers.find((customer) => customer.id === customerId)
    : undefined;
  const buyerName = selectedCustomer?.name ?? walkInName.trim();
  const quoteText = buildQuoteTextFromLines(
    lines.map((line) => ({
      productName: line.product.name,
      qty: line.qty,
      unitPrice: line.unitPrice,
    })),
    netTotal,
    data.business,
    { customerName: buyerName || undefined, discount: discountClamped, t },
  );
  const quoteWaUrl = whatsappShareUrl(quoteText, selectedCustomer?.phone);

  const inStock = data.products.filter((product) => product.active && product.stockQty > 0);
  const query = search.trim().toLowerCase();
  const searched = query ? inStock.filter((product) => productSearchText(product).includes(query)) : inStock;
  const categoryFiltered = fastRetail && categoryFilter !== "all"
    ? searched.filter((product) => product.category === categoryFilter)
    : searched;
  const filtered = !conditionRelevant || conditionFilter === "all"
    ? categoryFiltered
    : categoryFiltered.filter((product) => product.condition === conditionFilter);
  const categoryCounts = new Map<string, number>();
  if (fastRetail) {
    for (const product of inStock) {
      const category = product.category || "General";
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const categories = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12);
  const visibleProducts = fastRetail ? filtered.slice(0, resultLimit) : filtered;
  const exactMatch = query
    ? filtered.find((product) =>
        (product.sku ?? "").trim().toLowerCase() === query ||
        String(product.customFields.barcode ?? "").trim().toLowerCase() === query,
      )
    : undefined;
  const quickAddCandidate = exactMatch ?? filtered[0];

  const customerOptionText = (customer: (typeof data.customers)[number]) =>
    `${customerPrimaryLabel(customer)}${customer.creditBalance > 0 ? ` (${t("sales.owes")} ${formatLkr(customer.creditBalance)})` : ""}`;

  const setQty = (productId: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, Number.isFinite(qty) ? qty : 0));
    setCart((current) => ({ ...current, [productId]: clamped }));
    setPendingSaleId(null);
    if (clamped <= 0) {
      setInventoryStates((current) => {
        if (!current[productId]) return current;
        const next = { ...current };
        delete next[productId];
        return next;
      });
    }
  };

  const addOne = (product: Product) => {
    setQty(product.id, (cart[product.id] ?? 0) + 1, product.stockQty);
    if (fastRetail) {
      setSearch("");
      setCategoryFilter("all");
      setResultLimit(30);
    }
  };

  const resetPricingForCustomer = (id: string) => {
    setCustomerId(id);
    setPriceOverrides({});
    setPendingSaleId(null);
    const customer = data.customers.find((row) => row.id === id);
    setWalkInName(customer?.name ?? "");
  };

  const buildAtomicLines = (): AtomicSaleLine[] => lines.map((line, index) => {
    const base: AtomicSaleLine = {
      productId: line.product.id,
      qty: line.qty,
      unitPrice: line.unitPrice,
      lineOrder: index,
    };
    if (!advancedRetail) return base;
    const state = inventoryStates[line.product.id];
    if (!state || state.mode === "simple") return base;
    const allocation = buildSaleInventoryAllocationLine(
      line.product.id,
      line.qty,
      state.mode,
      state.selection,
    );
    if (!allocation) return base;
    return {
      ...base,
      ...(allocation.variantId ? { variantId: allocation.variantId } : {}),
      ...(allocation.unitIds?.length ? { unitIds: allocation.unitIds } : {}),
    };
  });

  const handleSale = async () => {
    if (saving || lines.length === 0) return;
    if (!org.id) {
      setMessage("Organization is not ready for checkout.");
      return;
    }
    if (netTotal <= 0) {
      setMessage(si ? "විකිණීමේ මුළු වටිනාකම ශූන්‍යයට වඩා වැඩි විය යුතුයි." : "Sale total must be greater than zero.");
      return;
    }
    if (identityBlocked) {
      setMessage(
        si
          ? "Checkout කිරීමට පෙර prescription / batch / variant / IMEI තේරීම් සම්පූර්ණ කරන්න."
          : "Complete prescription, batch, variant or IMEI requirements before checkout.",
      );
      return;
    }

    const saleId = pendingSaleId ?? clientId("sale");
    const tenderPlan = buildCheckoutTenders({
      saleTotal: netTotal,
      primaryKind: payment,
      primaryId: `${saleId}-tender-1`,
      split: splitPayment,
      secondaryKind: secondaryPayment,
      secondaryAmount: secondaryAmountValue,
      secondaryId: `${saleId}-tender-2`,
      cheque: {
        chequeNo,
        chequeBank,
        chequeDate,
        postDated,
      },
    });
    if (tenderPlan.error) {
      setMessage(tenderPlan.error);
      return;
    }

    if (
      tenderPlan.cashTenderAmount > 0 &&
      cashReceived !== "" &&
      Number(cashReceived) < tenderPlan.cashTenderAmount
    ) {
      setMessage(si ? "ලැබුණු මුදල cash කොටසට වඩා අඩුයි." : "Cash received is below the cash portion of the sale.");
      return;
    }
    if (tenderPlan.creditTenderAmount > 0 && !customerId) {
      setMessage(t("sales.credit_need_customer"));
      return;
    }
    if (tenderPlan.creditTenderAmount > 0 && selectedCustomer?.creditLimit != null) {
      const nextBalance = selectedCustomer.creditBalance + tenderPlan.creditTenderAmount;
      if (nextBalance > selectedCustomer.creditLimit) {
        setMessage(
          t("sales.credit_limit_exceeded")
            .replace("{{limit}}", formatLkr(selectedCustomer.creditLimit))
            .replace("{{balance}}", formatLkr(nextBalance)),
        );
        return;
      }
    }

    let atomicLines: AtomicSaleLine[];
    try {
      atomicLines = buildAtomicLines();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inventory selection is incomplete.");
      return;
    }

    const validation = validateSaleTenders(tenderPlan.tenders, {
      saleTotal: netTotal,
      hasCustomerAccount: Boolean(customerId),
    });
    if (validation.length) {
      setMessage(validation[0]);
      return;
    }

    const tenderSummary = summarizeSaleTenders(netTotal, tenderPlan.tenders);
    if (!tenderSummary.settled || tenderSummary.changeDue > 0) {
      setMessage("Payment allocation does not settle the invoice exactly.");
      return;
    }

    if (!pendingSaleId) setPendingSaleId(saleId);
    setSaving(true);
    setMessage("");

    const result = await finalizeSaleWithTenders(org.id, {
      saleId,
      customerId: customerId || undefined,
      customerName: buyerName || undefined,
      discount: discountClamped,
      lines: atomicLines,
      tenders: tenderPlan.tenders,
    });

    if (!result.ok || !result.saleId) {
      setSaving(false);
      setMessage(result.error ?? t("sales.failed"));
      return;
    }

    const fresh = await pullBusinessData(org.id, data.business).catch(() => null);
    if (fresh) {
      const committedSale = fresh.sales.find((sale) => sale.id === result.saleId);
      if (committedSale && result.paymentMethod === "mixed") {
        // pullBusinessData currently normalizes legacy payment methods. Preserve
        // the authoritative v3 finalizer response for this newly committed sale
        // so the immediate receipt/recent-sales reload is truthful.
        committedSale.paymentMethod = "mixed";
      }
      saveAppData(fresh, org.id);
    }
    sessionStorage.setItem(
      SUCCESS_STORAGE_KEY,
      JSON.stringify({
        saleId: result.saleId,
        billNo: result.billNo,
        paymentMethod: result.paymentMethod ?? tenderPlan.paymentMethod,
      }),
    );
    window.location.replace("/sales");
  };

  return (
    <AppShell>
      <ProMain>
        <ProPageHeader
          eyebrow={org.sector === "pharmacy" ? (si ? "ආරක්ෂිත Pharmacy POS" : "Protected Pharmacy POS") : t("sales.pos_eyebrow")}
          title={t("sales.title")}
          description={
            org.sector === "pharmacy"
              ? (si ? "Prescription, FEFO batch සහ ගෙවීම එකම checkout transaction එකක පාලනය කරයි." : "Prescription checks, FEFO batch allocation and payment commit in one checkout transaction.")
              : (si ? "ගෙවීම සහ තොගය එකම checkout transaction එකක සුරකියි." : "Payment and stock commit together in one checkout transaction.")
          }
          actions={
            <>
              <ProBadge tone="emerald">Atomic checkout</ProBadge>
              <ProButton href="/stock" variant="secondary">{t("sales.add_stock_link")}</ProButton>
              {lastBillId && <ProButton href={`/bills/${lastBillId}`} variant="dark">{t("sales.view_bill")}</ProButton>}
            </>
          }
        />

        <WriteDisabledHint className="mb-5" />

        {message && (
          <div className="mb-5 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">
            {message}
            {lastBillId && (
              <Link href={`/bills/${lastBillId}`} className="ml-2 font-bold underline">
                {t("sales.view_bill")}
              </Link>
            )}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <ProStatCard
            label={t("sales.cart_items")}
            value={String(cartCount)}
            hint={lines.length ? `${lines.length} ${t("sales.product_lines")}` : t("sales.no_selected")}
            icon={<SalesIcon className="h-5 w-5" />}
            tone="teal"
          />
          <ProStatCard
            label={t("sales.gross")}
            value={formatLkr(gross)}
            hint={discountClamped > 0 ? `${t("sales.discount")} ${formatLkr(discountClamped)}` : t("sales.before_discount")}
            icon={<BillsIcon className="h-5 w-5" />}
            tone="slate"
          />
          <ProStatCard
            label={t("common.total")}
            value={formatLkr(netTotal)}
            hint={paymentSummaryLabel}
            icon={<CostingIcon className="h-5 w-5" />}
            tone="emerald"
          />
        </section>

        {inStock.length === 0 ? (
          <section className="mt-6">
            <ProCard>
              <ProEmptyState
                title={t("sales.no_stock")}
                description={t("sales.add_stock_first_desc")}
                action={<ProButton href="/stock">{t("sales.add_stock_link")}</ProButton>}
              />
            </ProCard>
          </section>
        ) : (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            <div className="space-y-4">
              <ProCard
                title={t("sales.products_title")}
                eyebrow={t("sales.fast_checkout_eyebrow")}
                action={<ProBadge tone="emerald">{inStock.length} available</ProBadge>}
              >
                <div className="relative">
                  <input
                    type="search"
                    value={search}
                    autoFocus={fastRetail}
                    autoComplete="off"
                    onChange={(event) => {
                      setSearch(event.target.value);
                      if (fastRetail) setResultLimit(30);
                    }}
                    onKeyDown={(event) => {
                      if (!fastRetail) return;
                      if (event.key === "Enter" && quickAddCandidate) {
                        event.preventDefault();
                        addOne(quickAddCandidate);
                      }
                      if (event.key === "Escape") setSearch("");
                    }}
                    placeholder={
                      org.sector === "pharmacy"
                        ? (si ? "ඖෂධය, generic නම, brand, strength, code හෝ barcode…" : "Search medicine, generic, brand, strength, code or barcode…")
                        : fastRetail
                          ? (si ? "Barcode scan කරන්න හෝ භාණ්ඩය, brand හෝ code සොයන්න…" : "Scan barcode or search product, brand or code…")
                          : t("sales.search_placeholder")
                    }
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  />
                </div>

                {fastRetail && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      onClick={() => { setCategoryFilter("all"); setResultLimit(30); }}
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${categoryFilter === "all" ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                    >
                      {si ? "සියල්ල" : "All"} <span className="opacity-70">{inStock.length}</span>
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.name}
                        type="button"
                        onClick={() => { setCategoryFilter(category.name); setResultLimit(30); }}
                        className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${categoryFilter === category.name ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                      >
                        {category.name} <span className="opacity-70">{category.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {conditionRelevant && (
                  <div className="mt-3 flex gap-2">
                    {(["all", "new", "used"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setConditionFilter(value)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${conditionFilter === value ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        {value === "all" ? t("stock.filter_all") : value === "new" ? t("stock.condition_new") : t("stock.condition_used")}
                      </button>
                    ))}
                  </div>
                )}
              </ProCard>

              {filtered.length === 0 ? (
                <ProCard><ProEmptyState title={t("sales.no_match")} description={t("sales.search_no_match_desc")} /></ProCard>
              ) : (
                <div className={fastRetail ? "grid gap-2 md:grid-cols-2 2xl:grid-cols-3" : "grid gap-3 md:grid-cols-2"}>
                  {visibleProducts.map((product) => {
                    const qty = cart[product.id] ?? 0;
                    const selected = qty > 0;
                    const unitPrice = effectiveUnitPrice(product, customerId, data, priceOverrides[product.id]);
                    const rx = org.sector === "pharmacy" && boolField(product.customFields.requiresPrescription);
                    return (
                      <article
                        key={product.id}
                        className={`rounded-xl border bg-white p-4 transition ${selected ? "border-teal-300 ring-2 ring-teal-100" : "border-slate-200 hover:border-teal-200"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-sm font-bold text-slate-950">{product.name}</h2>
                              {conditionRelevant && <ProductConditionBadge condition={product.condition} />}
                              {rx && <ProBadge tone="amber">Rx</ProBadge>}
                            </div>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {product.sku ? `${product.sku} · ` : ""}{product.category || "General"}
                            </p>
                            {org.sector === "pharmacy" && (
                              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
                                {[product.customFields.genericName, product.customFields.strength, product.customFields.brand, product.customFields.packSize]
                                  .filter(Boolean).map(String).join(" · ") || (si ? "Batch පාලිත තොග" : "Batch-controlled stock")}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-slate-950">{formatLkr(unitPrice)}</p>
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">{product.stockQty} in stock</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            <button
                              type="button"
                              aria-label={`Decrease ${product.name}`}
                              onClick={() => setQty(product.id, qty - 1, product.stockQty)}
                              className="flex h-10 w-10 items-center justify-center text-lg font-bold text-slate-600 hover:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400"
                            >−</button>
                            <input
                              aria-label={`${product.name} quantity`}
                              type="number"
                              min={0}
                              max={product.stockQty}
                              step="any"
                              value={qty || ""}
                              onChange={(event) => setQty(product.id, Number(event.target.value), product.stockQty)}
                              className="h-10 w-14 border-x border-slate-200 bg-white text-center text-sm font-bold outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400"
                            />
                            <button
                              type="button"
                              aria-label={`Increase ${product.name}`}
                              onClick={() => setQty(product.id, qty + 1, product.stockQty)}
                              className="flex h-10 w-10 items-center justify-center text-lg font-bold text-teal-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400"
                            >+</button>
                          </div>
                          <span className="font-mono text-sm font-bold text-teal-700">{formatLkr(unitPrice * qty)}</span>
                        </div>
                      </article>
                    );
                  })}
                  {fastRetail && filtered.length > visibleProducts.length && (
                    <button
                      type="button"
                      onClick={() => setResultLimit((value) => value + 30)}
                      className="min-h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-left hover:border-teal-300 hover:bg-teal-50"
                    >
                      <span className="block text-sm font-bold text-slate-800">{si ? "තවත් භාණ්ඩ පෙන්වන්න" : "Show more products"}</span>
                      <span className="mt-1 block text-xs text-slate-500">{visibleProducts.length} / {filtered.length}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
              <ProCard title={t("sales.cart_title")} eyebrow={t("sales.checkout_eyebrow")}>
                {lines.length === 0 ? (
                  <ProEmptyState title={t("sales.no_selected")} description={t("sales.choose_products_desc")} />
                ) : (
                  <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
                    {lines.map((line) => (
                      <div key={line.product.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-950">{line.product.name}</p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">× {line.qty}</p>
                          </div>
                          <p className="shrink-0 font-mono text-sm font-bold text-slate-950">{formatLkr(line.unitPrice * line.qty)}</p>
                        </div>
                        <label className="mt-3 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                          {t("sales.unit_price")}
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={line.unitPrice}
                            onChange={(event) => {
                              setPriceOverrides((current) => ({ ...current, [line.product.id]: Math.max(0, Number(event.target.value)) }));
                              setPendingSaleId(null);
                            }}
                            className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-xs font-bold text-slate-700 outline-none focus:border-teal-300"
                          />
                        </label>
                        {advancedRetail && (
                          <AdvancedSaleSelector
                            productId={line.product.id}
                            qty={line.qty}
                            value={inventoryStates[line.product.id]?.selection}
                            onChange={(next) => setInventoryStates((current) => ({ ...current, [line.product.id]: next }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 space-y-3 border-t border-slate-200 pt-5 text-sm font-semibold text-slate-600">
                  <div className="flex justify-between"><span>{t("sales.gross")}</span><span className="font-mono font-bold text-slate-950">{formatLkr(gross)}</span></div>
                  <label className="flex items-center justify-between gap-2">
                    <span>{t("sales.discount")}</span>
                    <input
                      type="number"
                      min={0}
                      max={gross}
                      value={discount || ""}
                      onChange={(event) => { setDiscount(Number(event.target.value)); setPendingSaleId(null); }}
                      className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-bold text-slate-900 outline-none focus:border-teal-300"
                    />
                  </label>
                  {billVat && (
                    <div className="rounded-lg bg-slate-900 px-3 py-2.5 text-xs text-slate-200">
                      <div className="flex justify-between"><span>{t("vat.taxable")}</span><span className="font-mono">{formatLkr(billVat.subtotal)}</span></div>
                      <div className="mt-1 flex justify-between text-teal-300"><span>{t("vat.output_vat")} (18%)</span><span className="font-mono font-bold">{formatLkr(billVat.vat)}</span></div>
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-xl bg-slate-950 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">{t("common.total")}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">{formatLkr(netTotal)}</p>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-bold text-slate-700">
                    {t("common.customer")}
                    <select
                      value={customerId}
                      onChange={(event) => resetPricingForCustomer(event.target.value)}
                      className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-300"
                    >
                      <option value="">{t("sales.walk_in_label")}</option>
                      {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customerOptionText(customer)}</option>)}
                    </select>
                  </label>

                  {!customerId && (
                    <label className="block text-sm font-bold text-slate-700">
                      {t("sales.walkin_name")}
                      <input
                        value={walkInName}
                        onChange={(event) => { setWalkInName(event.target.value); setPendingSaleId(null); }}
                        className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300"
                      />
                    </label>
                  )}

                  <div>
                    <p className="text-sm font-bold text-slate-700">{t("common.payment")}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(PAYMENT_OPTIONS as CheckoutPayment[]).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            setPayment(method);
                            if (splitPayment && secondaryPayment === method) {
                              const alternate = (PAYMENT_OPTIONS as CheckoutPayment[]).find((item) => item !== method) ?? "cash";
                              setSecondaryPayment(alternate);
                            }
                            setPendingSaleId(null);
                          }}
                          className={`rounded-lg border px-3 py-3 text-sm font-bold transition ${payment === method ? "border-teal-300 bg-teal-50 text-teal-800 ring-2 ring-teal-100" : "border-slate-200 bg-white text-slate-600 hover:border-teal-200"}`}
                        >
                          {paymentLabel(t, method)}
                        </button>
                      ))}
                    </div>

                    <label className={`mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition ${splitPayment ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-slate-50"}`}>
                      <div>
                        <span className="block text-sm font-bold text-slate-800">{si ? "ගෙවීම දෙකට බෙදන්න" : "Split payment"}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{si ? "උදා: cash + card, cash + credit" : "For example cash + card or cash + customer credit"}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={splitPayment}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setSplitPayment(enabled);
                          if (enabled) {
                            if (secondaryPayment === payment) {
                              const alternate = (PAYMENT_OPTIONS as CheckoutPayment[]).find((item) => item !== payment) ?? "card";
                              setSecondaryPayment(alternate);
                            }
                            if (secondaryAmount === "" || Number(secondaryAmount) <= 0 || Number(secondaryAmount) >= netTotal) {
                              setSecondaryAmount(netTotal > 0 ? Math.round((netTotal / 2) * 100) / 100 : "");
                            }
                          }
                          setPendingSaleId(null);
                        }}
                        className="h-5 w-5 accent-teal-600"
                      />
                    </label>
                  </div>

                  {splitPayment && (
                    <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">{si ? "දෙවන ගෙවීම" : "Second payment"}</p>
                          <p className="mt-1 text-xs text-slate-500">{si ? "මෙම මුදල දෙවන ක්‍රමයට යයි. ඉතිරිය පළමු ක්‍රමයට." : "This amount uses the second method; the balance stays on the first."}</p>
                        </div>
                        <ProBadge tone="emerald">Mixed</ProBadge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(PAYMENT_OPTIONS as CheckoutPayment[])
                          .filter((method) => method !== payment)
                          .map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => { setSecondaryPayment(method); setPendingSaleId(null); }}
                              className={`rounded-lg border px-3 py-2.5 text-xs font-bold transition ${secondaryPayment === method ? "border-teal-300 bg-white text-teal-800 ring-2 ring-teal-100" : "border-slate-200 bg-white/70 text-slate-600 hover:border-teal-200"}`}
                            >
                              {paymentLabel(t, method)}
                            </button>
                          ))}
                      </div>

                      <label className="mt-3 block text-xs font-bold text-slate-600">
                        {si ? "දෙවන ගෙවීම් මුදල" : "Second payment amount"}
                        <input
                          type="number"
                          min={0.01}
                          max={Math.max(0.01, netTotal - 0.01)}
                          step="any"
                          value={secondaryAmount}
                          onChange={(event) => {
                            setSecondaryAmount(event.target.value === "" ? "" : Number(event.target.value));
                            setPendingSaleId(null);
                          }}
                          className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm font-bold text-slate-900 outline-none focus:border-teal-300"
                        />
                      </label>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                          <p className="font-semibold text-slate-500">{paymentLabel(t, payment)}</p>
                          <p className="mt-1 font-mono text-sm font-bold text-slate-900">{formatLkr(primaryTenderPreview)}</p>
                        </div>
                        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                          <p className="font-semibold text-slate-500">{paymentLabel(t, secondaryPayment)}</p>
                          <p className="mt-1 font-mono text-sm font-bold text-slate-900">{formatLkr(secondaryAmountValue)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {cashTenderPreview > 0 && netTotal > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>{si ? "Cash කොටස" : "Cash portion"}</span>
                        <span className="font-mono text-slate-800">{formatLkr(cashTenderPreview)}</span>
                      </div>
                      <label className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
                        <span>{t("sales.cash_received")}</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={cashReceived}
                          onChange={(event) => setCashReceived(event.target.value === "" ? "" : Number(event.target.value))}
                          className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-bold outline-none focus:border-teal-300"
                        />
                      </label>
                      {cashReceived !== "" && (
                        <div className="mt-3 flex justify-between text-sm font-bold text-teal-800"><span>{t("sales.change_due")}</span><span className="font-mono">{formatLkr(changeDue)}</span></div>
                      )}
                    </div>
                  )}

                  {(payment === "cheque" || (splitPayment && secondaryPayment === "cheque")) && (
                    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                      <label className="text-xs font-bold text-slate-600">Cheque no.
                        <input value={chequeNo} onChange={(event) => { setChequeNo(event.target.value); setPendingSaleId(null); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-300" />
                      </label>
                      <label className="text-xs font-bold text-slate-600">Bank
                        <select value={chequeBank} onChange={(event) => { setChequeBank(event.target.value); setPendingSaleId(null); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-300">
                          {LK_BANKS.map((bank) => <option key={bank}>{bank}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-bold text-slate-600">Cheque date
                        <input type="date" value={chequeDate} onChange={(event) => { setChequeDate(event.target.value); setPendingSaleId(null); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-300" />
                      </label>
                      <label className="flex min-h-10 items-center gap-2 self-end rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                        <input type="checkbox" checked={postDated} onChange={(event) => { setPostDated(event.target.checked); setPendingSaleId(null); }} /> Post-dated
                      </label>
                    </div>
                  )}

                  {lines.length > 0 && (
                    <a
                      href={quoteWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 w-full items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                    >
                      {t("bills.quote_whatsapp")}
                    </a>
                  )}

                  <button
                    type="button"
                    disabled={lines.length === 0 || !canWrite || saving || identityBlocked || netTotal <= 0}
                    title={!canWrite ? (disabledHint ?? undefined) : identityBlocked ? (si ? "Prescription / batch / variant / IMEI අවශ්‍යතා සම්පූර්ණ කරන්න" : "Complete prescription / inventory requirements") : undefined}
                    onClick={() => void handleSale()}
                    className="w-full rounded-lg bg-teal-600 py-4 text-sm font-bold text-white shadow-[0_8px_20px_rgba(13,148,136,0.2)] transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? t("common.saving") : identityBlocked ? (si ? "Checkout අවශ්‍යතා සම්පූර්ණ කරන්න" : "Complete checkout requirements") : splitPayment ? (si ? "බෙදා ගෙවීමෙන් විකිණීම සම්පූර්ණ කරන්න" : "Complete split-payment sale") : t("sales.complete")}
                  </button>
                </div>
              </ProCard>
            </aside>
          </section>
        )}

        {data.sales.length > 0 && (
          <section className="mt-6">
            <ProCard title={t("sales.recent")} action={<ProBadge tone="slate">Latest 10</ProBadge>}>
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t("common.date")}</th>
                      <th className="px-4 py-3">{t("common.customer")}</th>
                      <th className="px-4 py-3">{t("common.payment")}</th>
                      <th className="px-4 py-3">{t("common.total")}</th>
                      {canSeeFinancials && <th className="px-4 py-3">{t("sales.profit")}</th>}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.slice(0, 10).map((sale) => (
                      <tr key={sale.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-600">{new Date(sale.date).toLocaleString("en-LK")}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{sale.customerName || "—"}</td>
                        <td className="px-4 py-3"><ProBadge tone="slate">{sale.paymentMethod === "mixed" ? (si ? "බෙදා ගෙවීම" : "Mixed") : paymentLabel(t, sale.paymentMethod)}</ProBadge></td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{formatLkr(sale.total)}</td>
                        {canSeeFinancials && <td className="px-4 py-3 font-mono font-bold text-teal-700">{formatLkr(sale.profit)}</td>}
                        <td className="px-4 py-3 text-right"><Link href={`/bills/${sale.id}`} className="font-bold text-teal-700 hover:underline">{t("sales.bill")}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ProCard>
          </section>
        )}
      </ProMain>

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-xl safe-area-pb xl:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{cartCount} items</p>
              <p className="text-lg font-bold text-slate-950">{formatLkr(netTotal)}</p>
              {splitPayment && <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600">{si ? "බෙදා ගෙවීම" : "Split payment"}</p>}
            </div>
            <button
              type="button"
              disabled={!canWrite || saving || identityBlocked || netTotal <= 0}
              onClick={() => void handleSale()}
              className="rounded-lg bg-teal-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? t("common.saving") : identityBlocked ? (si ? "අවශ්‍යතා" : "Requirements") : t("sales.complete")}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
