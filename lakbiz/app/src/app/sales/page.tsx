"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { useAppStore } from "@/lib/store/use-app-store";
import type { PaymentMethod } from "@/lib/types";

export default function SalesPage() {
  const { data, ready, createSale } = useAppStore();
  const { t } = useLocale();
  const [cart, setCart] = useState<Record<string, number>>({});
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
        return { product: p, qty };
      });
  }, [cart, data]);

  const total = lines.reduce((s, l) => s + l.product.sellPrice * l.qty, 0);

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">{t("common.loading")}</main>
      </div>
    );
  }

  const setQty = (id: string, qty: number) => {
    setCart((c) => ({ ...c, [id]: Math.max(0, qty) }));
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
      lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
      payment,
      {
        customerId: customerId || undefined,
        customerName: walkInName || undefined,
        chequeNo: payment === "cheque" ? chequeNo : undefined,
        chequeBank: payment === "cheque" ? chequeBank : undefined,
        chequeDate: payment === "cheque" ? chequeDate : undefined,
        postDated: payment === "cheque" ? postDated : undefined,
      },
    );

    if (saleId) {
      setCart({});
      setWalkInName("");
      setChequeNo("");
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
              {inStock.map((p) => {
                const unit = String(p.customFields.unit ?? "pcs");
                const qty = cart[p.id] ?? 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-sm text-slate-500">
                        {p.stockQty} {unit} {t("sales.left")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(p.id, qty - 1)}
                        className="h-8 w-8 rounded border text-lg"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-medium">{qty}</span>
                      <button
                        onClick={() =>
                          setQty(p.id, Math.min(p.stockQty, qty + 1))
                        }
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
              <h2 className="font-semibold text-slate-900">{t("sales.bill_summary")}</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {lines.length === 0 && <li>{t("sales.no_selected")}</li>}
                {lines.map((l) => (
                  <li key={l.product.id} className="flex justify-between">
                    <span>
                      {l.product.name} × {l.qty}
                    </span>
                    <span>{formatLkr(l.product.sellPrice * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t pt-3 text-lg font-bold text-slate-900">
                {t("common.total")}: {formatLkr(total)}
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
