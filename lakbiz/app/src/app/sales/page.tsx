"use client";

import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { formatLkr } from "@/lib/format";
import { useAppStore } from "@/lib/store/use-app-store";
import type { PaymentMethod } from "@/lib/types";

export default function SalesPage() {
  const { data, ready, createSale } = useAppStore();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [customer, setCustomer] = useState("");
  const [message, setMessage] = useState("");

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
        <main className="mx-auto max-w-6xl px-4 py-10">Loading...</main>
      </div>
    );
  }

  const setQty = (id: string, qty: number) => {
    setCart((c) => ({ ...c, [id]: Math.max(0, qty) }));
  };

  const handleSale = () => {
    const ok = createSale(
      lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
      payment,
      customer,
    );
    if (ok) {
      setCart({});
      setCustomer("");
      setMessage("Sale saved. Stock updated.");
      setTimeout(() => setMessage(""), 3000);
    } else {
      setMessage("Could not complete sale — check stock quantities.");
    }
  };

  const inStock = data.products.filter((p) => p.stockQty > 0);

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">New sale</h1>
          <p className="text-slate-600">විකුණුම — bill customer, stock goes down</p>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {message}
          </div>
        )}

        {inStock.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-medium text-slate-700">No items in stock</p>
            <p className="mt-2 text-sm text-slate-500">
              Add items on the Stock page first.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
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
                        {formatLkr(p.sellPrice)} · {p.stockQty} {unit} left
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
              <h2 className="font-semibold text-slate-900">Bill summary</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {lines.length === 0 && <li>No items selected</li>}
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
                Total: {formatLkr(total)}
              </p>

              <label className="mt-4 block text-sm">
                Customer name (optional)
                <input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="mt-3 block text-sm">
                Payment
                <select
                  value={payment}
                  onChange={(e) => setPayment(e.target.value as PaymentMethod)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="card">Card</option>
                  <option value="cheque">Cheque</option>
                  <option value="credit">Credit (ණය)</option>
                </select>
              </label>

              <button
                disabled={lines.length === 0}
                onClick={handleSale}
                className="mt-5 w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40"
              >
                Complete sale
              </button>
            </div>
          </div>
        )}

        {data.sales.length > 0 && (
          <section className="mt-10">
            <h2 className="font-semibold text-slate-900">Recent sales</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Profit</th>
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
                        {s.lines.map((l) => l.productName).join(", ")}
                      </td>
                      <td className="px-4 py-3">{formatLkr(s.total)}</td>
                      <td className="px-4 py-3 text-teal-700">
                        {formatLkr(s.profit)}
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
