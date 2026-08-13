"use client";

import { useState } from "react";
import { ProductForm } from "@/components/product-form";
import { ExportActions } from "@/components/export/export-actions";
import { ProductConditionBadge } from "@/components/product-condition-badge";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, EmptyState, StatusBadge, SearchInput, FilterBar, ActionMenu } from "@/components/ui/primitives";
import { Drawer, Dialog, ConfirmDialog } from "@/components/ui/overlay";
import { FormField, TextInput } from "@/components/ui/form";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { StockIcon, PlusIcon } from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
import { exportStockCsv } from "@/lib/export";
import { useLocale } from "@/lib/i18n/locale-provider";
import { formatProductFieldBadge } from "@/lib/sector-fields";
import { useAppStore } from "@/lib/store/use-app-store";
import { getLowStockProducts } from "@/lib/store/actions";
import { getPlan } from "@/lib/subscription/plans";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import type { Product, ProductCondition } from "@/lib/types";

type ConditionFilter = "all" | ProductCondition;

export default function StockPage() {
  const {
    data,
    ready,
    saveProductToCloud,
    deleteProductToCloud,
    stockInToCloud,
    stockOutToCloud,
    writeOffStockToCloud,
    returnStockToSupplierToCloud,
  } = useAppStore();
  const { org, subscription, canSeeFinancials, can } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const { t } = useLocale();
  const { toast } = useToast();

  // Create/edit drawer — form only exists in the DOM while open.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // Stock in / out dialogs
  const [stockInId, setStockInId] = useState<string | null>(null);
  const [stockInQty, setStockInQty] = useState("1");
  const [savingStockIn, setSavingStockIn] = useState(false);
  const [stockOutId, setStockOutId] = useState<string | null>(null);
  const [stockOutQty, setStockOutQty] = useState("1");
  const [stockOutNote, setStockOutNote] = useState("");
  const [savingStockOut, setSavingStockOut] = useState(false);

  // Write-off / return-to-supplier dialogs (HVAC platform Phase 3 —
  // distinct stock-movement kinds from a manual Stock Out, kept in the
  // overflow menu since they're rarer than Stock In/Out).
  const [writeOffId, setWriteOffId] = useState<string | null>(null);
  const [writeOffQty, setWriteOffQty] = useState("1");
  const [writeOffNote, setWriteOffNote] = useState("");
  const [savingWriteOff, setSavingWriteOff] = useState(false);

  const [returnId, setReturnId] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState("1");
  const [returnSupplierId, setReturnSupplierId] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [savingReturn, setSavingReturn] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>("all");
  // Discontinued items default to hidden — matches getLowStockProducts/the
  // sale picker, which already ignore inactive items — with an explicit
  // toggle to review/reactivate them instead of losing them silently.
  const [showInactive, setShowInactive] = useState(false);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
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
  const byCondition = conditionFilter === "all" ? searched : searched.filter((p) => p.condition === conditionFilter);
  const products = showInactive ? byCondition : byCondition.filter((p) => p.active);

  const newCount = data.products.filter((p) => p.condition === "new").length;
  const usedCount = data.products.filter((p) => p.condition === "used").length;
  const inactiveCount = data.products.filter((p) => !p.active).length;
  const lowStock = getLowStockProducts(data.products);
  const inventoryValue = data.products.reduce((sum, p) => sum + p.stockQty * p.buyPrice, 0);
  const sellValue = data.products.reduce((sum, p) => sum + p.stockQty * p.sellPrice, 0);
  const stockInProduct = stockInId ? data.products.find((p) => p.id === stockInId) : null;
  const stockOutProduct = stockOutId ? data.products.find((p) => p.id === stockOutId) : null;
  const stockInQtyNumber = Number(stockInQty) || 0;
  const stockOutQtyNumber = Number(stockOutQty) || 0;
  const writeOffProduct = writeOffId ? data.products.find((p) => p.id === writeOffId) : null;
  const writeOffQtyNumber = Number(writeOffQty) || 0;
  const returnProduct = returnId ? data.products.find((p) => p.id === returnId) : null;
  const returnQtyNumber = Number(returnQty) || 0;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (product: Product) => {
    setEditing(product);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletingProductId) return;
    setDeletingProductId(deleteTarget.id);
    const result = await deleteProductToCloud(deleteTarget.id);
    setDeletingProductId(null);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    if (editing?.id === deleteTarget.id) setFormOpen(false);
    if (stockInId === deleteTarget.id) setStockInId(null);
    if (stockOutId === deleteTarget.id) setStockOutId(null);
    toast({ tone: "success", title: t("common.delete"), description: deleteTarget.name });
    setDeleteTarget(null);
  };

  const openStockIn = (productId: string) => {
    setStockInId(productId);
    setStockInQty("1");
  };

  const handleStockIn = async () => {
    if (!stockInId || savingStockIn || stockInQtyNumber <= 0) return;
    setSavingStockIn(true);
    const result = await stockInToCloud(stockInId, stockInQtyNumber, "Purchase / GRN");
    setSavingStockIn(false);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    setStockInId(null);
    toast({ tone: "success", title: t("stock.updated") });
  };

  const openStockOut = (productId: string) => {
    setStockOutId(productId);
    setStockOutQty("1");
    setStockOutNote("");
  };

  const handleStockOut = async () => {
    if (!stockOutId || !stockOutProduct || savingStockOut || stockOutQtyNumber < 1) return;
    if (stockOutQtyNumber > stockOutProduct.stockQty) {
      toast({ tone: "error", title: t("stock.out_qty_exceeds") });
      return;
    }
    setSavingStockOut(true);
    const note = stockOutNote.trim() || t("stock.stock_out");
    const result = await stockOutToCloud(stockOutId, stockOutQtyNumber, note);
    setSavingStockOut(false);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    setStockOutId(null);
    toast({ tone: "success", title: t("stock.updated") });
  };

  const openWriteOff = (productId: string) => {
    setWriteOffId(productId);
    setWriteOffQty("1");
    setWriteOffNote("");
  };

  const handleWriteOff = async () => {
    if (!writeOffId || !writeOffProduct || savingWriteOff || writeOffQtyNumber < 1) return;
    if (writeOffQtyNumber > writeOffProduct.stockQty) {
      toast({ tone: "error", title: t("stock.out_qty_exceeds") });
      return;
    }
    setSavingWriteOff(true);
    const result = await writeOffStockToCloud(writeOffId, writeOffQtyNumber, writeOffNote.trim() || undefined);
    setSavingWriteOff(false);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    setWriteOffId(null);
    toast({ tone: "success", title: t("stock.updated") });
  };

  const openReturn = (productId: string) => {
    setReturnId(productId);
    setReturnQty("1");
    setReturnSupplierId("");
    setReturnNote("");
  };

  const handleReturn = async () => {
    if (!returnId || !returnProduct || !returnSupplierId || savingReturn || returnQtyNumber < 1) return;
    if (returnQtyNumber > returnProduct.stockQty) {
      toast({ tone: "error", title: t("stock.out_qty_exceeds") });
      return;
    }
    setSavingReturn(true);
    const result = await returnStockToSupplierToCloud(returnId, returnQtyNumber, returnSupplierId, returnNote.trim() || undefined);
    setSavingReturn(false);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    setReturnId(null);
    toast({ tone: "success", title: t("stock.updated") });
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

  const columns: DataTableColumn<Product>[] = [
    {
      key: "name",
      header: t("stock.item_name"),
      render: (p) => {
        const badge = formatProductFieldBadge(p);
        return (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => openEdit(p)} className={`font-semibold hover:text-teal-700 hover:underline ${p.active ? "text-slate-900" : "text-slate-400"}`}>
                {p.name}
              </button>
              <ProductConditionBadge condition={p.condition} />
              {!p.active && <StatusBadge tone="neutral">{t("stock.inactive_badge")}</StatusBadge>}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {p.sku ? `${p.sku} · ` : ""}
              {p.category || "General"}
              {badge ? ` · ${badge}` : ""}
            </p>
          </div>
        );
      },
    },
    {
      key: "stock",
      header: t("stock.title"),
      align: "right",
      render: (p) => {
        const unit = String(p.customFields.unit ?? "pcs");
        const low = p.reorderLevel != null && p.stockQty <= p.reorderLevel;
        return (
          <div className="text-right">
            <p className={low ? "font-semibold text-amber-700" : "font-semibold text-slate-900"}>
              {p.stockQty} {unit}
            </p>
            {low && <StatusBadge tone="warning">{t("common.low")}</StatusBadge>}
          </div>
        );
      },
    },
    ...(canSeeFinancials
      ? [
          {
            key: "buy",
            header: t("stock.buy_price"),
            align: "right" as const,
            hideOnMobile: true,
            render: (p: Product) => formatLkr(p.buyPrice),
          },
        ]
      : []),
    {
      key: "sell",
      header: t("stock.sell_price"),
      align: "right",
      render: (p) => <span className="font-mono font-semibold text-teal-700">{formatLkr(p.sellPrice)}</span>,
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => openStockIn(p.id)} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
            {t("stock.stock_in")}
          </button>
          <button
            type="button"
            onClick={() => openStockOut(p.id)}
            disabled={p.stockQty <= 0}
            className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("stock.stock_out")}
          </button>
          <ActionMenu
            items={[
              { label: t("common.edit"), onSelect: () => openEdit(p) },
              ...(data.suppliers.length > 0
                ? [{ label: t("stock.return_to_supplier"), onSelect: () => openReturn(p.id), disabled: p.stockQty <= 0 }]
                : []),
              { label: t("stock.write_off"), onSelect: () => openWriteOff(p.id), disabled: p.stockQty <= 0 },
              { label: t("common.delete"), tone: "danger" as const, onSelect: () => setDeleteTarget(p) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <ProMain>
        <PageHeader
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
                      conditionLabel: (c) => t(c === "used" ? "stock.condition_used" : "stock.condition_new"),
                    })
                  }
                />
              )}
              <button
                type="button"
                disabled={!canWrite}
                title={!canWrite ? disabledHint ?? undefined : undefined}
                onClick={openCreate}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" />
                {t("stock.add_item")}
              </button>
            </>
          }
          metrics={
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={t("common.items")} value={String(data.products.length)} icon={<StockIcon className="h-4 w-4" />} />
              <MetricCard
                label={t("dash.low_stock")}
                value={String(lowStock.length)}
                hint={lowStock.length > 0 ? t("dash.low_stock_alert") : t("dash.all_good_stock")}
                tone={lowStock.length > 0 ? "warning" : "default"}
              />
              {canSeeFinancials && <MetricCard label={t("stock.cost_value")} value={formatLkr(inventoryValue)} hint={t("stock.buy_price")} />}
              <MetricCard label={t("stock.sell_value")} value={formatLkr(sellValue)} hint={t("stock.sell_price")} tone="positive" />
            </div>
          }
        />

        <WriteDisabledHint className="mb-4" />

        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={t("stock.search_placeholder")} className="min-w-[220px] flex-1" />
          <div className="flex gap-1.5">
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
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  conditionFilter === tab.id ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200"
                }`}
              >
                {tab.label} <span className="opacity-70">({tab.count})</span>
              </button>
            ))}
          </div>
          {inactiveCount > 0 && (
            <button
              type="button"
              onClick={() => setShowInactive((v) => !v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                showInactive ? "bg-slate-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200"
              }`}
            >
              {t("stock.filter_inactive")} <span className="opacity-70">({inactiveCount})</span>
            </button>
          )}
        </FilterBar>

        {data.products.length === 0 ? (
          <EmptyState
            icon={<StockIcon className="h-6 w-6" />}
            title={t("stock.no_stock")}
            description={t("stock.no_stock_hint")}
            action={
              <button type="button" onClick={openCreate} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                {t("stock.add_item")}
              </button>
            }
          />
        ) : (
          <DataTable columns={columns} rows={products} emptyState={<EmptyState title={t("sales.no_match")} description={t("stock.search_no_match_desc")} />} />
        )}

        {/* Create / edit drawer — always opens immediately. */}
        <Drawer
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? editing.name : t("stock.add_item")}
          description={editing ? t("stock.edit_inventory_eyebrow") : t("stock.create_inventory_eyebrow")}
        >
          {editing ? (
            <ProductForm
              initial={editing}
              lockedSectorId={org.isAuthenticated ? org.sector : undefined}
              defaultSectorId={org.sector}
              submitLabel={saving ? t("common.saving") : t("common.update")}
              onCancel={() => setFormOpen(false)}
              onSubmit={async (input) => {
                setSaving(true);
                const result = await saveProductToCloud(input, editing.id);
                setSaving(false);
                if (!result.ok) {
                  toast({ tone: "error", title: t("common.save_failed"), description: result.error });
                  return;
                }
                setFormOpen(false);
                toast({ tone: "success", title: t("stock.updated"), description: input.name });
              }}
            />
          ) : (
            <ProductForm
              lockedSectorId={org.isAuthenticated ? org.sector : undefined}
              defaultSectorId={org.sector}
              submitLabel={saving ? t("common.saving") : undefined}
              onCancel={() => setFormOpen(false)}
              onSubmit={async (input) => {
                const plan = getPlan(subscription.planId);
                const atCap = plan.maxProducts != null && data.products.length >= plan.maxProducts;
                if (atCap) {
                  toast({ tone: "error", title: t("stock.limit_reached") });
                  return;
                }
                setSaving(true);
                const result = await saveProductToCloud(input);
                setSaving(false);
                if (!result.ok) {
                  toast({ tone: "error", title: t("common.save_failed"), description: result.error });
                  return;
                }
                setFormOpen(false);
                toast({ tone: "success", title: t("stock.added"), description: input.name });
              }}
            />
          )}
        </Drawer>

        {/* Stock in */}
        <Dialog
          open={!!stockInId && !!stockInProduct}
          onClose={() => setStockInId(null)}
          title={t("stock.stock_in")}
          description={stockInProduct?.name}
          footer={
            <>
              <button type="button" onClick={() => setStockInId(null)} className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={savingStockIn || stockInQtyNumber <= 0}
                onClick={() => void handleStockIn()}
                className="rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {savingStockIn ? t("common.saving") : t("stock.add_stock_btn")}
              </button>
            </>
          }
        >
          {stockInProduct && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">{t("stock.current_qty")}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {stockInProduct.stockQty} {String(stockInProduct.customFields.unit ?? "pcs")}
                </p>
              </div>
              <FormField label={t("stock.stock_in")} required>
                <TextInput type="number" min={1} value={stockInQty} onChange={(e) => setStockInQty(e.target.value)} autoFocus />
              </FormField>
            </div>
          )}
        </Dialog>

        {/* Stock out */}
        <Dialog
          open={!!stockOutId && !!stockOutProduct}
          onClose={() => setStockOutId(null)}
          title={t("stock.stock_out")}
          description={stockOutProduct?.name}
          footer={
            <>
              <button type="button" onClick={() => setStockOutId(null)} className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={savingStockOut || !stockOutProduct || stockOutQtyNumber < 1 || stockOutProduct.stockQty <= 0}
                onClick={() => void handleStockOut()}
                className="rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {savingStockOut ? t("common.saving") : t("stock.remove_stock_btn")}
              </button>
            </>
          }
        >
          {stockOutProduct && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">{t("stock.current_qty")}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {stockOutProduct.stockQty} {String(stockOutProduct.customFields.unit ?? "pcs")}
                </p>
              </div>
              <FormField label={t("stock.stock_out")} required>
                <TextInput type="number" min={1} max={stockOutProduct.stockQty} value={stockOutQty} onChange={(e) => setStockOutQty(e.target.value)} autoFocus />
              </FormField>
              <FormField label={t("stock.out_note")}>
                <TextInput value={stockOutNote} onChange={(e) => setStockOutNote(e.target.value)} placeholder={t("stock.out_note_ph")} />
              </FormField>
            </div>
          )}
        </Dialog>

        {/* Write off (HVAC platform Phase 3) */}
        <Dialog
          open={!!writeOffId && !!writeOffProduct}
          onClose={() => setWriteOffId(null)}
          title={t("stock.write_off")}
          description={writeOffProduct?.name}
          footer={
            <>
              <button type="button" onClick={() => setWriteOffId(null)} className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={savingWriteOff || !writeOffProduct || writeOffQtyNumber < 1 || writeOffProduct.stockQty <= 0}
                onClick={() => void handleWriteOff()}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {savingWriteOff ? t("common.saving") : t("stock.write_off")}
              </button>
            </>
          }
        >
          {writeOffProduct && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">{t("stock.current_qty")}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {writeOffProduct.stockQty} {String(writeOffProduct.customFields.unit ?? "pcs")}
                </p>
              </div>
              <FormField label={t("stock.write_off")} required>
                <TextInput type="number" min={1} max={writeOffProduct.stockQty} value={writeOffQty} onChange={(e) => setWriteOffQty(e.target.value)} autoFocus />
              </FormField>
              <FormField label={t("stock.out_note")}>
                <TextInput value={writeOffNote} onChange={(e) => setWriteOffNote(e.target.value)} placeholder={t("stock.write_off_note_ph")} />
              </FormField>
            </div>
          )}
        </Dialog>

        {/* Return to supplier (HVAC platform Phase 3) */}
        <Dialog
          open={!!returnId && !!returnProduct}
          onClose={() => setReturnId(null)}
          title={t("stock.return_to_supplier")}
          description={returnProduct?.name}
          footer={
            <>
              <button type="button" onClick={() => setReturnId(null)} className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={savingReturn || !returnProduct || !returnSupplierId || returnQtyNumber < 1 || returnProduct.stockQty <= 0}
                onClick={() => void handleReturn()}
                className="rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {savingReturn ? t("common.saving") : t("stock.return_to_supplier")}
              </button>
            </>
          }
        >
          {returnProduct && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">{t("stock.current_qty")}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {returnProduct.stockQty} {String(returnProduct.customFields.unit ?? "pcs")}
                </p>
              </div>
              <FormField label={t("sup.title")} required>
                <select
                  value={returnSupplierId}
                  onChange={(e) => setReturnSupplierId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">{t("common.select")}</option>
                  {data.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label={t("stock.return_to_supplier")} required>
                <TextInput type="number" min={1} max={returnProduct.stockQty} value={returnQty} onChange={(e) => setReturnQty(e.target.value)} />
              </FormField>
              <FormField label={t("stock.out_note")}>
                <TextInput value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder={t("stock.out_note_ph")} />
              </FormField>
            </div>
          )}
        </Dialog>

        <ConfirmDialog
          open={!!deleteTarget}
          title={t("common.confirm_delete")}
          description={deleteTarget?.name}
          tone="danger"
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          loading={!!deletingProductId}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleteTarget(null)}
        />
      </ProMain>
    </AppShell>
  );
}
