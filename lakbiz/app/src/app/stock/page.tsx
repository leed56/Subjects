"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { ProductForm } from "@/components/product-form";
import { formatLkr } from "@/lib/format";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Product } from "@/lib/types";

export default function StockPage() {
  const { data, ready, addProduct, updateProduct, deleteProduct, stockIn } =
    useAppStore();
  const [editing, setEditing] = useState<Product | null>(null);
  const [stockInId, setStockInId] = useState<string | null>(null);
  const [stockInQty, setStockInQty] = useState(1);
  const [showForm, setShowForm] = useState(true);

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10 text-slate-600">
          Loading...
        </main>
      </div>
    );
  }

  const products = data.products;

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stock</h1>
            <p className="text-slate-600">
              තොග — {products.length} items · saved in your browser
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setEditing(null);
            }}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            {showForm ? "Hide form" : "+ Add item"}
          </button>
        </div>

        {showForm && !editing && (
          <div className="mb-8">
            <ProductForm
              onSubmit={(input) => {
                addProduct(input);
                setShowForm(false);
              }}
            />
          </div>
        )}

        {editing && (
          <div className="mb-8">
            <ProductForm
              initial={editing}
              submitLabel="Update item"
              onCancel={() => setEditing(null)}
              onSubmit={(input) => {
                updateProduct(editing.id, input);
                setEditing(null);
              }}
            />
          </div>
        )}

        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-medium text-slate-700">No stock yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Add your first item above — grocery, AC unit, spare part, anything.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Buy</th>
                  <th className="px-4 py-3">Sell</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const unit = String(p.customFields.unit ?? "pcs");
                  const low =
                    p.reorderLevel != null && p.stockQty <= p.reorderLevel;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{p.name}</p>
                        {p.sku && (
                          <p className="text-xs text-slate-400">{p.sku}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            low ? "font-semibold text-amber-700" : "text-slate-900"
                          }
                        >
                          {p.stockQty} {unit}
                        </span>
                        {low && (
                          <span className="ml-2 text-xs text-amber-600">
                            Low
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatLkr(p.buyPrice)}</td>
                      <td className="px-4 py-3">{formatLkr(p.sellPrice)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setEditing(p);
                              setShowForm(false);
                            }}
                            className="text-teal-700 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setStockInId(p.id)}
                            className="text-teal-700 hover:underline"
                          >
                            Stock in
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${p.name}?`)) {
                                deleteProduct(p.id);
                              }
                            }}
                            className="text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {stockInId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
              <h3 className="font-semibold text-slate-900">Stock in</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add quantity received from supplier
              </p>
              <input
                type="number"
                min={1}
                value={stockInQty}
                onChange={(e) => setStockInQty(Number(e.target.value))}
                className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    stockIn(stockInId, stockInQty, "Purchase / GRN");
                    setStockInId(null);
                    setStockInQty(1);
                  }}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
                >
                  Add stock
                </button>
                <button
                  onClick={() => setStockInId(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
