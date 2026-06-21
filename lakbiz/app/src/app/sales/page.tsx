"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { splitInclusiveTotal } from "@/lib/vat";
import { useAppStore } from "@/lib/store/use-app-store";
import type { PaymentMethod } from "@/lib/types";

export default function SalesPage() {
  const { data, ready, createSale } = useAppStore();
  const { t } = useLocale();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState(0);
  const [cashReceived, setCashReceived] = useState<number | "">("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [customerId, setCustomerId] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState(LK_BANKS[0]);
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [postDated, setPostDated] = useState(false);
  const [message, setMessage] = useState("");
  const [lastBillId, setLastBillId] = useState<string | null>(null);

  const lines = useMemo(() => {
    if (!data) return [];
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const p = data.products.find((x) => x.id === productId)!;
        const unitPrice = priceOverrides[productId] ?? p.sellPrice;
        return { product: p, qty, unitPrice };
      });
  }, [cart, priceOverrides, data]);

  const gross = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discountClamped = Math.min(Math.max(0, discount), gross);
  const netTotal = gross - discountClamped;
  const vatEnabled = data?.business.vatRegistered === true;
  const billVat = vatEnabled ? splitInclusiveTotal(netTotal) : null;
  const changeDue = cashReceived === "" ? 0 : Math.max(0, Number(cashReceived) - netTotal);
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);

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

  const setQty = (id: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, Number.isFinite(qty) ? qty : 0));
    setCart((c) => ({ ...c, [id]: clamped }));
  };

  const setOverride = (id: string, value: number) => {
    setPriceOverrides((o) => ({ ...o, [id]: Math.max(0, value) }));
  };

  const resetAfterSale = () => {
    setCart({});
    setPriceOverrides({});
    setWalkInName("");
    setChequeNo("");
    setDiscount(0);
    setCashReceived("");
    setSearch("");
  };

  const handleSale = () => {
    if (payment === "credit" && !customerId) {
      setMessage(t("sales.credit_need_customer"));
      return;
    }
    if (payment === "credit" && customerId) {
      const cust = data.customers.find((c) => c.id === customerId);
      if (cust?.creditLimit != null && cust.creditBalance + netTotal > cust.creditLimit) {
        setMessage(
          t("sales.credit_limit_exceeded")
            .replace("{{limit}}", formatLkr(cust.creditLimit))
            .replace("{{balance}}", formatLkr(cust.creditBalance + netTotal)),
        );
        return;
      }
    }
    if (payment === "cheque" && (!chequeNo || !chequeDate)) {
      setMessage(t("sales.cheque_need"));
      return;
    }

    const saleId = createSale(
      lines.map((l) => ({
        productId: l.product.id,
        qty: l.qty,
        unitPrice: l.unitPrice,
      })),
      payment,
      {
        customerId: customerId || undefined,
        customerName: walkInName || undefined,
        discount: discountClamped || undefined,
        chequeNo: payment === "cheque" ? chequeNo : undefined,
        chequeBank: payment === "cheque" ? chequeBank : undefined,
        chequeDate: payment === "cheque" ? chequeDate : undefined,
        postDated: payment === "cheque" ? postDated : undefined,
      },
    );

    if (saleId) {
      resetAfterSale();
      setLastBillId(saleId);
      setMessage(
        payment === "credit"
          ? t("sales.credit_saved")
          : payment === "cheque"
            ? t("sales.cheque_saved")
            : t("sales.saved"),
      );
      setTimeout(() => setMessage(""), 6000);
    } else {
      setMessage(t("sales.failed"));
    }
  };

  const inStock = data.products.filter((p) => p.stockQty > 0);
  const query = search.trim().toLowerCase();
  const filtered = query
    ? inStock.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.sku ?? "").toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      )
    : inStock;

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow="Point of sale"
          title={t("sales.title")}
          description={t("sales.subtitle")}
          actions={
            <>
              <ProButton href="/stock" variant="secondary">{t("sales.add_stock_link")}</ProButton>
              {lastBillId && <ProButton href={`/bills/${lastBillId}`} variant="dark">{t("sales.view_bill")}</ProButton>}
            </>
          }
        />

        {message && (
          <div className="mb-5 rounded-[1.25rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 shadow-sm">
            {message}
            {lastBillId && (
              <Link href={`/bills/${lastBillId}`} className="ml-2 font-black underline">
                {t("sales.view_bill")}
              </Link>
            )}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <ProStatCard label="Cart items" value={String(cartCount)} hint={lines.length ? `${lines.length} product lines` : t("sales.no_selected")} icon="🛒" tone="teal" />
          <ProStatCard label={t("sales.gross")} value={formatLkr(gross)} hint={discountClamped > 0 ? `${t("sales.discount")} ${formatLkr(discountClamped)}` : "Before discount"} icon="🧾" tone="slate" />
          <ProStatCard label={t("common.total")} value={formatLkr(netTotal)} hint={paymentLabel(t, payment)} icon="💸" tone="emerald" />
        </section>

        {inStock.length === 0 ? (
          <section className="mt-6">
            <ProCard>
              <ProEmptyState
                title={t("sales.no_stock")}
                description="Add products and stock quantities before creating your first sale."
                action={<ProButton href="/stock">{t("sales.add_stock_link")}</ProButton>}
              />
            </ProCard>
          </section>
        ) : (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            <div className="space-y-4">
              <ProCard
                title="Products"
                eyebrow="Fast checkout"
                action={<ProBadge tone="emerald">{inStock.length} available</ProBadge>}
              >
                <div className="relative">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("sales.search_placeholder")}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pl-11 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  />
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                </div>
              </ProCard>

              {filtered.length === 0 ? (
                <ProCard>
                  <ProEmptyState title={t("sales.no_match")} description="Try searching by product name, SKU, or category." />
                </ProCard>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filtered.map((p) => {
                    const unit = String(p.customFields.unit ?? "pcs");
                    const qty = cart[p.id] ?? 0;
                    const selected = qty > 0;
                    return (
                      <article
                        key={p.id}
                        className={`rounded-[1.5rem] border bg-white p-4 shadow-lg shadow-slate-950/5 ring-1 transition ${
                          selected
                            ? "border-teal-200 ring-teal-100"
                            : "border-white ring-slate-200/60 hover:-translate-y-0.5 hover:border-teal-100 hover:ring-teal-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-sm font-black text-slate-950">{p.name}</h2>
                              {selected && <ProBadge tone="teal">In cart</ProBadge>}
                            </div>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {p.sku ? `${p.sku} · ` : ""}{p.category || "General"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-black text-slate-950">{formatLkr(p.sellPrice)}</p>
                            <p className="text-xs font-bold text-slate-400">{p.stockQty} {unit} {t("sales.left")}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                            <button
                              onClick={() => setQty(p.id, qty - 1, p.stockQty)}
                              className="flex h-11 w-11 items-center justify-center text-xl font-black text-slate-600 transition hover:bg-white"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={p.stockQty}
                              step="any"
                              value={qty || ""}
                              onChange={(e) => setQty(p.id, Number(e.target.value), p.stockQty)}
                              className="h-11 w-16 border-x border-slate-200 bg-white text-center text-sm font-black text-slate-950 outline-none"
                            />
                            <button
                              onClick={() => setQty(p.id, qty + 1, p.stockQty)}
                              className="flex h-11 w-11 items-center justify-center text-xl font-black text-teal-700 transition hover:bg-white"
                            >
                              +
                            </button>
                          </div>
                          <p className="text-right text-sm font-black text-teal-700">
                            {formatLkr((priceOverrides[p.id] ?? p.sellPrice) * qty)}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="xl:sticky xl:top-24 xl:self-start">
              <ProCard title={t("sales.bill_summary")} eyebrow="Checkout" action={<ProBadge tone={lines.length ? "teal" : "slate"}>{cartCount} items</ProBadge>}>
                <div className="space-y-3">
                  {lines.length === 0 ? (
                    <ProEmptyState title={t("sales.no_selected")} description="Choose products from the left to build the bill." />
                  ) : (
                    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                      {lines.map((l) => (
                        <div key={l.product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-950">{l.product.name}</p>
                              <p className="text-xs font-bold text-slate-500">× {l.qty}</p>
                            </div>
                            <p className="shrink-0 font-mono text-sm font-black text-slate-950">{formatLkr(l.unitPrice * l.qty)}</p>
                          </div>
                          <label className="mt-3 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                            {t("sales.unit_price")}
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={l.unitPrice}
                              onChange={(e) => setOverride(l.product.id, Number(e.target.value))}
                              className="w-28 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-right text-xs font-black text-slate-700 outline-none focus:border-teal-300"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-3 border-t border-slate-200 pt-5 text-sm font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span>{t("sales.gross")}</span>
                    <span className="font-mono font-black text-slate-950">{formatLkr(gross)}</span>
                  </div>
                  <label className="flex items-center justify-between gap-2">
                    <span>{t("sales.discount")}</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={discount || ""}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      placeholder="0"
                      className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-black text-slate-900 outline-none focus:border-teal-300"
                    />
                  </label>
                  {billVat && (
                    <div className="rounded-2xl bg-slate-950 p-3 text-white">
                      <div className="flex justify-between text-slate-300">
                        <span>{t("vat.subtotal")}</span>
                        <span className="font-mono">{formatLkr(billVat.subtotal)}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-teal-300">
                        <span>{t("vat.output_vat")} (18%)</span>
                        <span className="font-mono font-black">{formatLkr(billVat.vat)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-[1.25rem] bg-gradient-to-br from-teal-600 to-emerald-600 p-4 text-white shadow-lg shadow-teal-700/20">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">{t("common.total")}</p>
                  <p className="mt-1 text-3xl font-black tracking-tight">{formatLkr(netTotal)}</p>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-black text-slate-700">
                    {t("common.customer")}
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                    >
                      <option value="">{t("sales.walkin")}</option>
                      {data.customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.creditBalance > 0 ? ` (${t("sales.owes")} ${formatLkr(c.creditBalance)})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!customerId && (
                    <label className="block text-sm font-black text-slate-700">
                      {t("sales.walkin_name")}
                      <input
                        value={walkInName}
                        onChange={(e) => setWalkInName(e.target.value)}
                        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                      />
                    </label>
                  )}

                  <div>
                    <p className="text-sm font-black text-slate-700">{t("common.payment")}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {PAYMENT_OPTIONS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPayment(m)}
                          className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                            payment === m
                              ? "border-teal-200 bg-teal-50 text-teal-800 ring-4 ring-teal-100"
                              : "border-slate-200 bg-white text-slate-600 hover:border-teal-200"
                          }`}
                        >
                          {paymentLabel(t, m)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {payment === "cash" && netTotal > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="flex items-center justify-between gap-2 text-sm font-black text-slate-700">
                        <span>{t("sales.cash_received")}</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-black text-slate-900 outline-none focus:border-teal-300"
                        />
                      </label>
                      {cashReceived !== "" && (
                        <div className="mt-3 flex items-center justify-between text-sm font-black text-teal-800">
                          <span>{t("sales.change_due")}</span>
                          <span className="font-mono">{formatLkr(changeDue)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {payment === "credit" && data.customers.length === 0 && (
                    <p className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                      <Link href="/customers" className="underline">{t("cust.add")}</Link> {t("sales.add_customer_first")}
                    </p>
                  )}

                  {payment === "cheque" && (
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <input
                        placeholder={t("sales.cheque_no")}
                        value={chequeNo}
                        onChange={(e) => setChequeNo(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300"
                      />
                      <select
                        value={chequeBank}
                        onChange={(e) => setChequeBank(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300"
                      >
                        {LK_BANKS.map((b) => <option key={b}>{b}</option>)}
                      </select>
                      <input
                        type="date"
                        value={chequeDate}
                        onChange={(e) => setChequeDate(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300"
                      />
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <input type="checkbox" checked={postDated} onChange={(e) => setPostDated(e.target.checked)} />
                        {t("sales.pdc")}
                      </label>
                    </div>
                  )}

                  <button
                    disabled={lines.length === 0}
                    onClick={handleSale}
                    className="w-full rounded-2xl bg-teal-600 py-4 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("sales.complete")}
                  </button>
                </div>
              </ProCard>
            </aside>
          </section>
        )}

        {data.sales.length > 0 && (
          <section className="mt-8">
            <ProCard title={t("sales.recent")} action={<ProBadge tone="slate">Latest 10</ProBadge>}>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t("common.date")}</th>
                      <th className="px-4 py-3">{t("common.customer")}</th>
                      <th className="px-4 py-3">{t("common.payment")}</th>
                      <th className="px-4 py-3">{t("common.total")}</th>
                      <th className="px-4 py-3">{t("common.profit")}</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.slice(0, 10).map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-600">{new Date(s.date).toLocaleString("en-LK")}</td>
                        <td className="px-4 py-3 font-black text-slate-900">{s.customerName || "—"}</td>
                        <td className="px-4 py-3"><ProBadge tone="slate">{paymentLabel(t, s.paymentMethod)}</ProBadge></td>
                        <td className="px-4 py-3 font-mono font-black text-slate-900">{formatLkr(s.total)}</td>
                        <td className="px-4 py-3 font-mono font-black text-teal-700">{formatLkr(s.profit)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/bills/${s.id}`} className="font-black text-teal-700 hover:underline">{t("sales.bill")}</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {data.sales.slice(0, 10).map((s) => (
                  <Link key={s.id} href={`/bills/${s.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{s.customerName || "Walk-in"}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{new Date(s.date).toLocaleString("en-LK")}</p>
                      </div>
                      <ProBadge tone="slate">{paymentLabel(t, s.paymentMethod)}</ProBadge>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <p className="font-mono text-lg font-black text-slate-950">{formatLkr(s.total)}</p>
                      <p className="text-xs font-black text-teal-700">{t("sales.bill")} →</p>
                    </div>
                  </Link>
                ))}
              </div>
            </ProCard>
          </section>
        )}
      </ProMain>

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl shadow-slate-950/20 backdrop-blur-xl safe-area-pb xl:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">{cartCount} items</p>
              <p className="text-lg font-black text-slate-950">{formatLkr(netTotal)}</p>
            </div>
            <button
              onClick={handleSale}
              className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20"
            >
              {t("sales.complete")}
            </button>
          </div>
        </div>
      )}
    </ProPageShell>
  );
}
