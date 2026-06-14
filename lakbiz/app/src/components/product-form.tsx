"use client";

import { useState } from "react";
import type { Product, SectorId } from "@/lib/types";
import { sectors } from "@/lib/sectors";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { ProductInput } from "@/lib/store/types";

const categories = [
  "Grocery",
  "Electronics",
  "Electricals",
  "Spare Parts",
  "Air Conditioning",
  "Other",
];

const units = ["pcs", "kg", "m", "box", "unit", "set"];

const emptyForm = (): ProductInput => ({
  name: "",
  sku: "",
  category: "Grocery",
  sectorId: "grocery",
  buyPrice: 0,
  sellPrice: 0,
  stockQty: 0,
  reorderLevel: 5,
  unit: "pcs",
});

interface ProductFormProps {
  initial?: Product;
  onSubmit: (input: ProductInput) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function ProductForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: ProductFormProps) {
  const { t } = useLocale();
  const [form, setForm] = useState<ProductInput>(() =>
    initial
      ? {
          name: initial.name,
          sku: initial.sku ?? "",
          category: initial.category,
          sectorId: initial.sectorId,
          buyPrice: initial.buyPrice,
          sellPrice: initial.sellPrice,
          stockQty: initial.stockQty,
          reorderLevel: initial.reorderLevel ?? 5,
          unit: String(initial.customFields.unit ?? "pcs"),
        }
      : emptyForm(),
  );

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
    if (!initial) setForm(emptyForm());
  };

  const saveLabel = submitLabel ?? t("stock.save_item");

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 font-semibold text-slate-900">
        {initial ? t("stock.edit_item") : t("stock.add_new")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm text-slate-600">{t("stock.item_name")}</span>
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">{t("stock.sku")}</span>
          <input
            value={form.sku}
            onChange={(e) => set("sku", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">{t("stock.category")}</span>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">{t("stock.sector")}</span>
          <select
            value={form.sectorId}
            onChange={(e) => set("sectorId", e.target.value as SectorId)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameSi} / {s.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">{t("stock.unit")}</span>
          <select
            value={form.unit}
            onChange={(e) => set("unit", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">{t("stock.buy_price")}</span>
          <input
            type="number"
            min={0}
            value={form.buyPrice || ""}
            onChange={(e) => set("buyPrice", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">{t("stock.sell_price")}</span>
          <input
            type="number"
            min={0}
            value={form.sellPrice || ""}
            onChange={(e) => set("sellPrice", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">{t("stock.current_qty")}</span>
          <input
            type="number"
            min={0}
            value={form.stockQty || ""}
            onChange={(e) => set("stockQty", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">{t("stock.low_alert_at")}</span>
          <input
            type="number"
            min={0}
            value={form.reorderLevel ?? ""}
            onChange={(e) => set("reorderLevel", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {saveLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
