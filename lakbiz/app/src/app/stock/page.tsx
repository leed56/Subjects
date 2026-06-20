"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { ProductForm } from "@/components/product-form";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import { formatProductFieldBadge } from "@/lib/sector-fields";
import type { Product } from "@/lib/types";

export default function StockPage() {
  const { data, ready, addProduct, updateProduct, deleteProduct, stockIn } =
    useAppStore();
  const { org } = useSubscription();
  const { t } = useLocale();
  const [editing, setEditing] = useState<Product | null>(null);
  const [stockInId, setStockInId] = useState<string | null>(null);
  const [stockInQty, setStockInQty] = useState(1);
  const [showForm, setShowForm] = useState(true);
  const [search, setSearch] = useState("");

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10 text-slate-600">
          {t("common.loading")}
        </main>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const products = query
    ? data.products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.sku ?? "").toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      )
    : data.products;

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("stock.title")}</h1>
            <p className="text-slate-600">
              {products.length} {t("common.items")} · {t("common.saved_browser")}
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setEditing(null);
            }}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            {showForm ? t("common.hide_form") : t("stock.add_item")}
          </button>
        </div>

        {showForm && !editing && (
          <div className="mb-8">
            <ProductForm
              defaultSectorId={org.sector}
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
              submitLabel={t("common.update")}
              onCancel={() => setEditing(null)}
              onSubmit={(input) => {
                updateProduct(editing.id, input);
                setEditing(null);
              }}
            />
          </div>
        )}

        {data.products.length > 0 && (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("stock.search_placeholder")}
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-sm"
          />
        )}

        {data.products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-medium text-slate-700">{t("stock.no_stock")}</p>
            <p className="mt-2 text-sm text-slate-500">{t("stock.no_stock_hint")}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            {t("sales.no_match")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t("stock.item_name")}</th>
                  <th className="px-4 py-3">{t("stock.category")}</th>
                  <th className="px-4 py-3">{t("stock.title")}</th>
                  <th className="px-4 py-3">{t("stock.buy_price")}</th>
                  <th className="px-4 py-3">{t("stock.sell_price")}</th>
                  <th className="px-4 py-3">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const unit = String(p.customFields.unit ?? "pcs");
                  const badge = formatProductFieldBadge(p);
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
                        {badge && (
                          <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {badge}
                          </span>
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
                            {t("common.low")}
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
                            {t("common.edit")}
                          </button>
                          <button
                            onClick={() => setStockInId(p.id)}
                            className="text-teal-700 hover:underline"
                          >
                            {t("stock.stock_in")}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`${t("common.confirm_delete")} ${p.name}?`)) {
                                deleteProduct(p.id);
                              }
                            }}
                            className="text-red-600 hover:underline"
                          >
                            {t("common.delete")}
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
              <h3 className="font-semibold text-slate-900">{t("stock.stock_in_title")}</h3>
              <p className="mt-1 text-sm text-slate-500">{t("stock.stock_in_hint")}</p>
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
                  {t("stock.add_stock_btn")}
                </button>
                <button
                  onClick={() => setStockInId(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
