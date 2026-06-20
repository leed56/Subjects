"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
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
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>(
    {},
  );
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState(0);
  const [cashReceived, setCashReceived] = useState<number | "">("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [customerId, setCustomerId] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState(LK_BANKS[0]);
  const [chequeDate, setChequeDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
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
  const changeDue =
    cashReceived === "" ? 0 : Math.max(0, Number(cashReceived) - netTotal);

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">{t("common.loading")}</main>
      </div>
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
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{t("sales.title")}</h1>
          <p className="text-slate-600">{t("sales.subtitle")}</p>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {message}
            {lastBillId && (
              <span className="mt-2 block">
                <Link
                  href={`/bills/${lastBillId}`}
                  className="font-semibold underline"
                >
                  {t("sales.view_bill")}
                </Link>
              </span>
            )}
          </div>
        )}

        {inStock.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-medium text-slate-700">{t("sales.no_stock")}</p>
            <p className="mt-2 text-sm text-slate-500">
              <Link href="/stock" className="text-teal-700 underline">
                {t("sales.add_stock_link")}
              </Link>{" "}
              {t("sales.first")}.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("sales.search_placeholder")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {filtered.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
                  {t("sales.no_match")}
                </p>
              )}
              {filtered.map((p) => {
                const unit = String(p.customFields.unit ?? "pcs");
                const qty = cart[p.id] ?? 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-sm text-slate-500">
                        {formatLkr(p.sellPrice)} · {p.stockQty} {unit}{" "}
                        {t("sales.left")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(p.id, qty - 1, p.stockQty)}
                        className="h-8 w-8 rounded border text-lg"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={p.stockQty}
                        step="any"
                        value={qty || ""}
                        onChange={(e) =>
                          setQty(p.id, Number(e.target.value), p.stockQty)
                        }
                        className="w-16 rounded border px-2 py-1 text-center text-sm"
                      />
                      <button
                        onClick={() => setQty(p.id, qty + 1, p.stockQty)}
                        className="h-8 w-8 rounded border text-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">
                {t("sales.bill_summary")}
              </h2>
              <ul className="mt-3 space-y-3 text-sm text-slate-600">
                {lines.length === 0 && <li>{t("sales.no_selected")}</li>}
                {lines.map((l) => (
                  <li key={l.product.id} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="truncate pr-2">
                        {l.product.name} × {l.qty}
                      </span>
                      <span className="tabular-nums">
                        {formatLkr(l.unitPrice * l.qty)}
                      </span>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      {t("sales.unit_price")}
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={l.unitPrice}
                        onChange={(e) =>
                          setOverride(l.product.id, Number(e.target.value))
                        }
                        className="w-24 rounded border px-2 py-1 text-right text-xs text-slate-700"
                      />
                    </label>
                  </li>
                ))}
              </ul>

              <div className="mt-3 space-y-1 border-t pt-3 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>{t("sales.gross")}</span>
                  <span className="tabular-nums">{formatLkr(gross)}</span>
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
                    className="w-28 rounded border px-2 py-1 text-right text-sm"
                  />
                </label>
                {billVat && (
                  <>
                    <div className="flex justify-between">
                      <span>{t("vat.subtotal")}</span>
                      <span className="tabular-nums">
                        {formatLkr(billVat.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-teal-700">
                      <span>{t("vat.output_vat")} (18%)</span>
                      <span className="tabular-nums">
                        {formatLkr(billVat.vat)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <p className="mt-3 border-t pt-3 text-lg font-bold text-slate-900">
                {t("common.total")}: {formatLkr(netTotal)}
              </p>

              <label className="mt-4 block text-sm">
                {t("common.customer")}
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">{t("sales.walkin")}</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.creditBalance > 0
                        ? ` (${t("sales.owes")} ${formatLkr(c.creditBalance)})`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              {!customerId && (
                <label className="mt-3 block text-sm">
                  {t("sales.walkin_name")}
                  <input
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              )}

              <label className="mt-3 block text-sm">
                {t("common.payment")}
                <select
                  value={payment}
                  onChange={(e) => setPayment(e.target.value as PaymentMethod)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  {PAYMENT_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {paymentLabel(t, m)}
                    </option>
                  ))}
                </select>
              </label>

              {payment === "cash" && netTotal > 0 && (
                <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                  <label className="flex items-center justify-between gap-2 text-sm">
                    <span>{t("sales.cash_received")}</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={cashReceived}
                      onChange={(e) =>
                        setCashReceived(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      className="w-28 rounded border px-2 py-1 text-right text-sm"
                    />
                  </label>
                  {cashReceived !== "" && (
                    <div className="flex items-center justify-between text-sm font-medium text-teal-800">
                      <span>{t("sales.change_due")}</span>
                      <span className="tabular-nums">
                        {formatLkr(changeDue)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {payment === "credit" && data.customers.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  <Link href="/customers" className="underline">
                    {t("cust.add")}
                  </Link>{" "}
                  {t("sales.add_customer_first")}
                </p>
              )}

              {payment === "cheque" && (
                <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                  <input
                    placeholder={t("sales.cheque_no")}
                    value={chequeNo}
                    onChange={(e) => setChequeNo(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <select
                    value={chequeBank}
                    onChange={(e) => setChequeBank(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    {LK_BANKS.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={postDated}
                      onChange={(e) => setPostDated(e.target.checked)}
                    />
                    {t("sales.pdc")}
                  </label>
                </div>
              )}

              <button
                disabled={lines.length === 0}
                onClick={handleSale}
                className="mt-5 w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40"
              >
                {t("sales.complete")}
              </button>
            </div>
          </div>
        )}

        {data.sales.length > 0 && (
          <section className="mt-10">
            <h2 className="font-semibold text-slate-900">{t("sales.recent")}</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-600">
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
                      <td className="px-4 py-3">
                        {new Date(s.date).toLocaleString("en-LK")}
                      </td>
                      <td className="px-4 py-3">{s.customerName || "—"}</td>
                      <td className="px-4 py-3">
                        {paymentLabel(t, s.paymentMethod)}
                      </td>
                      <td className="px-4 py-3">{formatLkr(s.total)}</td>
                      <td className="px-4 py-3 text-teal-700">
                        {formatLkr(s.profit)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/bills/${s.id}`}
                          className="text-teal-700 hover:underline"
                        >
                          {t("sales.bill")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
