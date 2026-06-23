"use client";

import { useState } from "react";
import { ProductForm } from "@/components/product-form";
import { ExportActions } from "@/components/export/export-actions";
import { ProductConditionBadge } from "@/components/product-condition-badge";
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
import { formatLkr } from "@/lib/format";
import { exportStockCsv } from "@/lib/export";
import { useLocale } from "@/lib/i18n/locale-provider";
import { formatProductFieldBadge } from "@/lib/sector-fields";
import { useAppStore } from "@/lib/store/use-app-store";
import { getPlan } from "@/lib/subscription/plans";
import { useCanWrite } from "@/lib/subscription/use-can-write";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import type { Product, ProductCondition } from "@/lib/types";

type ConditionFilter = "all" | ProductCondition;

export default function StockPage() {
  const { data, ready, addProduct, updateProduct, deleteProduct, stockIn } = useAppStore();
  const { org, subscription, canSeeFinancials, can } = useSubscription();
  const canWrite = useCanWrite();
  const { t } = useLocale();
  const [editing, setEditing] = useState<Product | null>(null);
  const [stockInId, setStockInId] = useState<string | null>(null);
  const [stockInQty, setStockInQty] = useState(1);
  const [showForm, setShowForm] = useState(true);
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>("all");
  const [message, setMessage] = useState("");

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

  const query = search.trim().toLowerCase();
  const searched = query
    ? data.products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.sku ?? "").toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      )
    : data.products;
  const products =
    conditionFilter === "all"
      ? searched
      : searched.filter((p) => p.condition === conditionFilter);

  const newCount = data.products.filter((p) => p.condition === "new").length;
  const usedCount = data.products.filter((p) => p.condition === "used").length;

  const lowStock = data.products.filter(
    (p) => p.reorderLevel != null && p.stockQty <= p.reorderLevel,
  );
  const inventoryValue = data.products.reduce((sum, p) => sum + p.stockQty * p.buyPrice, 0);
  const sellValue = data.products.reduce((sum, p) => sum + p.stockQty * p.sellPrice, 0);
  const categories = new Set(data.products.map((p) => p.category).filter(Boolean)).size;
  const stockInProduct = stockInId ? data.products.find((p) => p.id === stockInId) : null;

  const openCreate = () => {
    setShowForm((v) => !v);
    setEditing(null);
  };

  const canExport = can("export");
  const stockExportLabels = {
    name: t("common.name"),
    sku: t("stock.sku"),
    category: t("stock.category"),
    condition: t("stock.condition"),
    qty: t("common.items"),
    sellPrice: t("stock.sell_price"),
    buyPrice: t("stock.buy_price"),
    reorderLevel: t("stock.reorder_level"),
  };

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow={t("stock.inventory_eyebrow")}
          title={t("stock.title")}
          description={`${products.length} ${t("common.items")} · ${t(org.isAuthenticated ? "common.saved_cloud" : "common.saved_browser")}`}
          actions={
            <>
              {canExport && (
                <ExportActions
                  compact
                  disabled={products.length === 0}
                  onExportCsv={() =>
                    exportStockCsv(data.business, products, {
                      includeBuyPrice: canSeeFinancials,
                      labels: stockExportLabels,
                      conditionLabel: (c) =>
                        t(c === "used" ? "stock.condition_used" : "stock.condition_new"),
                    })
                  }
                />
              )}
              <ProButton href="/sales" variant="secondary">{t("nav.sales")}</ProButton>
              <button
                type="button"
                disabled={!canWrite}
                onClick={openCreate}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {showForm && !editing ? t("common.hide_form") : t("stock.add_item")}
              </button>
            </>
          }
        />

        {message && (
          <div className="mb-5 rounded-[1.25rem] border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm">
            {message}
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-2">
          {(
            [
              { id: "all" as const, label: t("stock.filter_all"), count: data.products.length },
              { id: "new" as const, label: t("stock.condition_new"), count: newCount },
              { id: "used" as const, label: t("stock.condition_used"), count: usedCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setConditionFilter(tab.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                conditionFilter === tab.id
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-700/20"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-teal-200"
              }`}
            >
              {tab.label}
              <span className="ml-2 opacity-80">({tab.count})</span>
            </button>
          ))}
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard
            label={t("common.items")}
            value={String(data.products.length)}
            hint={`${categories} ${t("stock.category")}`}
            icon="📦"
            tone="teal"
          />
          <ProStatCard
            label={t("dash.low_stock")}
            value={String(lowStock.length)}
            hint={lowStock.length > 0 ? t("dash.low_stock_alert") : t("dash.all_good_stock")}
            icon="⚠️"
            tone={lowStock.length > 0 ? "amber" : "slate"}
          />
          {canSeeFinancials && (
          <ProStatCard
            label={t("stock.cost_value")}
            value={formatLkr(inventoryValue)}
            hint={t("stock.buy_price")}
            icon="🏷️"
            tone="blue"
          />
          )}
          <ProStatCard
            label={t("stock.sell_value")}
            value={formatLkr(sellValue)}
            hint={t("stock.sell_price")}
            icon="💸"
            tone="emerald"
          />
        </section>

        {(showForm && !editing) || editing ? (
          <section className="mt-6">
            <ProCard
              eyebrow={editing ? t("stock.edit_inventory_eyebrow") : t("stock.create_inventory_eyebrow")}
              title={editing ? editing.name : t("stock.add_item")}
              action={
                editing ? (
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"
                  >
                    {t("common.cancel")}
                  </button>
                ) : null
              }
            >
              {editing ? (
                <ProductForm
                  initial={editing}
                  lockedSectorId={org.isAuthenticated ? org.sector : undefined}
                  defaultSectorId={org.sector}
                  submitLabel={t("common.update")}
                  onCancel={() => setEditing(null)}
                  onSubmit={(input) => {
                    const ok = updateProduct(editing.id, input);
                    if (!ok) {
                      setMessage(t("common.save_failed"));
                      setTimeout(() => setMessage(""), 3000);
                      return;
                    }
                    setEditing(null);
                    setMessage("");
                  }}
                />
              ) : (
                <ProductForm
                  lockedSectorId={org.isAuthenticated ? org.sector : undefined}
                  defaultSectorId={org.sector}
                  onSubmit={(input) => {
                    const plan = getPlan(subscription.planId);
                    const atCap =
                      plan.maxProducts != null && data.products.length >= plan.maxProducts;
                    const ok = addProduct(input);
                    if (!ok) {
                      setMessage(t(atCap ? "stock.limit_reached" : "common.save_failed"));
                      setTimeout(() => setMessage(""), 4000);
                      return;
                    }
                    setShowForm(false);
                    setMessage("");
                  }}
                />
              )}
            </ProCard>
          </section>
        ) : null}

        {data.products.length > 0 && (
          <section className="mt-6">
            <ProCard
              title={t("stock.catalogue_title")}
              eyebrow={t("stock.catalogue_eyebrow")}
              action={<ProBadge tone={products.length === data.products.length ? "slate" : "teal"}>{products.length} shown</ProBadge>}
            >
              <div className="relative">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("stock.search_placeholder")}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pl-11 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100 sm:max-w-xl"
                />
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              </div>
            </ProCard>
          </section>
        )}

        <section className="mt-6">
          {data.products.length === 0 ? (
            <ProCard>
              <ProEmptyState
                title={t("stock.no_stock")}
                description={t("stock.no_stock_hint")}
                action={
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-teal-700/20"
                  >
                    {t("stock.add_item")}
                  </button>
                }
              />
            </ProCard>
          ) : products.length === 0 ? (
            <ProCard>
              <ProEmptyState title={t("sales.no_match")} description={t("stock.search_no_match_desc")} />
            </ProCard>
          ) : (
            <>
              <div className="grid gap-4 lg:hidden">
                {products.map((p) => (
                  <ProductMobileCard
                    key={p.id}
                    product={p}
                    showBuyPrice={canSeeFinancials}
                    onEdit={() => {
                      setEditing(p);
                      setShowForm(false);
                    }}
                    onStockIn={() => setStockInId(p.id)}
                    onDelete={() => {
                      if (confirm(`${t("common.confirm_delete")} ${p.name}?`)) deleteProduct(p.id);
                    }}
                  />
                ))}
              </div>

              <ProCard className="hidden lg:block">
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">{t("stock.item_name")}</th>
                        <th className="px-4 py-3">{t("stock.condition")}</th>
                        <th className="px-4 py-3">{t("stock.category")}</th>
                        <th className="px-4 py-3">{t("stock.title")}</th>
                        {canSeeFinancials && <th className="px-4 py-3">{t("stock.buy_price")}</th>}
                        <th className="px-4 py-3">{t("stock.sell_price")}</th>
                        <th className="px-4 py-3">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const unit = String(p.customFields.unit ?? "pcs");
                        const badge = formatProductFieldBadge(p);
                        const low = p.reorderLevel != null && p.stockQty <= p.reorderLevel;
                        return (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="px-4 py-3">
                              <p className="font-black text-slate-950">{p.name}</p>
                              {p.sku && <p className="text-xs font-semibold text-slate-400">{p.sku}</p>}
                              {badge && <span className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{badge}</span>}
                            </td>
                            <td className="px-4 py-3">
                              <ProductConditionBadge condition={p.condition} />
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-600">{p.category}</td>
                            <td className="px-4 py-3">
                              <span className={low ? "font-black text-amber-700" : "font-black text-slate-900"}>
                                {p.stockQty} {unit}
                              </span>
                              {low && <ProBadge tone="amber">{t("common.low")}</ProBadge>}
                            </td>
                            {canSeeFinancials && (
                              <td className="px-4 py-3 font-mono font-semibold">{formatLkr(p.buyPrice)}</td>
                            )}
                            <td className="px-4 py-3 font-mono font-black text-teal-700">{formatLkr(p.sellPrice)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => {
                                    setEditing(p);
                                    setShowForm(false);
                                  }}
                                  className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700 hover:bg-teal-100"
                                >
                                  {t("common.edit")}
                                </button>
                                <button
                                  onClick={() => setStockInId(p.id)}
                                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200"
                                >
                                  {t("stock.stock_in")}
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`${t("common.confirm_delete")} ${p.name}?`)) deleteProduct(p.id);
                                  }}
                                  className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
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
              </ProCard>
            </>
          )}
        </section>

        {stockInId && stockInProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-600">{t("stock.stock_in")}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{stockInProduct.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{t("stock.stock_in_hint")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStockInId(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Current stock</p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {stockInProduct.stockQty} {String(stockInProduct.customFields.unit ?? "pcs")}
                </p>
              </div>

              <label className="mt-5 block text-sm font-black text-slate-700">
                Quantity to add
                <input
                  type="number"
                  min={1}
                  value={stockInQty}
                  onChange={(e) => setStockInQty(Number(e.target.value))}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => {
                    stockIn(stockInId, stockInQty, "Purchase / GRN");
                    setStockInId(null);
                    setStockInQty(1);
                  }}
                  className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700"
                >
                  {t("stock.add_stock_btn")}
                </button>
                <button
                  onClick={() => setStockInId(null)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}
      </ProMain>
    </ProPageShell>
  );
}

function ProductMobileCard({
  product,
  onEdit,
  onStockIn,
  onDelete,
  showBuyPrice,
}: {
  product: Product;
  onEdit: () => void;
  onStockIn: () => void;
  onDelete: () => void;
  showBuyPrice: boolean;
}) {
  const { t } = useLocale();
  const unit = String(product.customFields.unit ?? "pcs");
  const badge = formatProductFieldBadge(product);
  const low = product.reorderLevel != null && product.stockQty <= product.reorderLevel;

  return (
    <article className={`rounded-[1.5rem] border bg-white p-4 shadow-lg shadow-slate-950/5 ring-1 ${low ? "border-amber-200 ring-amber-100" : "border-white ring-slate-200/60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-black text-slate-950">{product.name}</h2>
            <ProductConditionBadge condition={product.condition} />
            {low && <ProBadge tone="amber">{t("common.low")}</ProBadge>}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {product.sku ? `${product.sku} · ` : ""}{product.category || "General"}
          </p>
          {badge && <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{badge}</span>}
        </div>
        <div className="shrink-0 text-right">
          <p className={low ? "text-lg font-black text-amber-700" : "text-lg font-black text-slate-950"}>
            {product.stockQty} {unit}
          </p>
          <p className="text-xs font-bold text-slate-400">{t("stock.title")}</p>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 rounded-2xl bg-slate-50 p-3 ${showBuyPrice ? "grid-cols-2" : "grid-cols-1"}`}>
        {showBuyPrice && (
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{t("stock.buy_price")}</p>
          <p className="mt-1 font-mono text-sm font-black text-slate-900">{formatLkr(product.buyPrice)}</p>
        </div>
        )}
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{t("stock.sell_price")}</p>
          <p className="mt-1 font-mono text-sm font-black text-teal-700">{formatLkr(product.sellPrice)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button onClick={onEdit} className="rounded-2xl bg-teal-50 px-3 py-3 text-xs font-black text-teal-700">
          {t("common.edit")}
        </button>
        <button onClick={onStockIn} className="rounded-2xl bg-slate-100 px-3 py-3 text-xs font-black text-slate-700">
          {t("stock.stock_in")}
        </button>
        <button onClick={onDelete} className="rounded-2xl bg-rose-50 px-3 py-3 text-xs font-black text-rose-700">
          {t("common.delete")}
        </button>
      </div>
    </article>
  );
}
