"use client";

import { useState } from "react";
import type { Product, SectorId } from "@/lib/types";
import { sectors } from "@/lib/sectors";
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
  submitLabel = "Save item",
}: ProductFormProps) {
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

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 font-semibold text-slate-900">
        {initial ? "Edit item" : "Add new item"}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm text-slate-600">Item name *</span>
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Daikin 18000 BTU, Rice 5kg"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">SKU / Code</span>
          <input
            value={form.sku}
            onChange={(e) => set("sku", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Category</span>
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
          <span className="text-sm text-slate-600">Sector template</span>
          <select
            value={form.sectorId}
            onChange={(e) => set("sectorId", e.target.value as SectorId)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Unit</span>
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
          <span className="text-sm text-slate-600">Buy price (LKR)</span>
          <input
            type="number"
            min={0}
            value={form.buyPrice || ""}
            onChange={(e) => set("buyPrice", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Sell price (LKR)</span>
          <input
            type="number"
            min={0}
            value={form.sellPrice || ""}
            onChange={(e) => set("sellPrice", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Current stock qty</span>
          <input
            type="number"
            min={0}
            value={form.stockQty || ""}
            onChange={(e) => set("stockQty", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Low stock alert at</span>
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
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
