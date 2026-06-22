"use client";

import { useMemo, useState } from "react";
import type { Product, SectorId } from "@/lib/types";
import { sectors, defaultCategoryForSector, categoriesForSector, sectorById } from "@/lib/sectors";
import {
  customFieldsFromProduct,
  emptyCustomFieldsForSector,
  sectorFormFields,
} from "@/lib/sector-fields";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { ProductInput } from "@/lib/store/types";

const units = ["pcs", "kg", "m", "box", "unit", "set"];

type FormState = ProductInput & {
  sectorCustom: Record<string, string>;
};

const emptyForm = (sectorId: SectorId = "grocery"): FormState => ({
  name: "",
  sku: "",
  category: defaultCategoryForSector(sectorId),
  sectorId,
  buyPrice: 0,
  sellPrice: 0,
  stockQty: 0,
  reorderLevel: 5,
  unit: "pcs",
  sectorCustom: Object.fromEntries(
    Object.entries(emptyCustomFieldsForSector(sectorId)).map(([k, v]) => [
      k,
      String(v),
    ]),
  ),
});

interface ProductFormProps {
  initial?: Product;
  defaultSectorId?: SectorId;
  /** When set (provisioned shop), sector template and categories are fixed to this shop type. */
  lockedSectorId?: SectorId;
  onSubmit: (input: ProductInput) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function ProductForm({
  initial,
  defaultSectorId = "grocery",
  lockedSectorId,
  onSubmit,
  onCancel,
  submitLabel,
}: ProductFormProps) {
  const { t, locale } = useLocale();
  const shopSectorId = lockedSectorId ?? defaultSectorId;
  const [form, setForm] = useState<FormState>(() => {
    if (initial) {
      const sectorId = lockedSectorId ?? initial.sectorId;
      return {
        name: initial.name,
        sku: initial.sku ?? "",
        category: categoriesForSector(sectorId).includes(initial.category)
          ? initial.category
          : defaultCategoryForSector(sectorId),
        sectorId,
        buyPrice: initial.buyPrice,
        sellPrice: initial.sellPrice,
        stockQty: initial.stockQty,
        reorderLevel: initial.reorderLevel ?? 5,
        unit: String(initial.customFields.unit ?? "pcs"),
        sectorCustom: customFieldsFromProduct({
          ...initial,
          sectorId,
        }),
      };
    }
    return emptyForm(shopSectorId);
  });

  const categories = useMemo(
    () => categoriesForSector(lockedSectorId ?? form.sectorId),
    [lockedSectorId, form.sectorId],
  );

  const lockedSector = lockedSectorId ? sectorById(lockedSectorId) : undefined;

  const sectorFields = useMemo(
    () => sectorFormFields(form.sectorId),
    [form.sectorId],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setSectorField = (key: string, value: string) =>
    setForm((f) => ({
      ...f,
      sectorCustom: { ...f.sectorCustom, [key]: value },
    }));

  const handleSectorChange = (sectorId: SectorId) => {
    if (lockedSectorId) return;
    setForm((f) => ({
      ...f,
      sectorId,
      category: defaultCategoryForSector(sectorId),
      sectorCustom: Object.fromEntries(
        Object.entries(emptyCustomFieldsForSector(sectorId)).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const sectorId = lockedSectorId ?? form.sectorId;
    const { sectorCustom, ...rest } = form;
    onSubmit({
      ...rest,
      sectorId,
      category: categoriesForSector(sectorId).includes(rest.category)
        ? rest.category
        : defaultCategoryForSector(sectorId),
      customFields: sectorCustom,
    });
    if (!initial) setForm(emptyForm(shopSectorId));
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
          {lockedSectorId && lockedSector ? (
            <div className="mt-1 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800">
              <span className="mr-2">{lockedSector.icon}</span>
              {locale === "si" ? lockedSector.nameSi : lockedSector.nameEn}
            </div>
          ) : (
            <select
              value={form.sectorId}
              onChange={(e) => handleSectorChange(e.target.value as SectorId)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameSi} / {s.nameEn}
                </option>
              ))}
            </select>
          )}
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

      {sectorFields.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <h3 className="mb-3 text-sm font-medium text-slate-700">
            {t("stock.sector_fields")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {sectorFields.map((field) => (
              <label key={field.key} className="block">
                <span className="text-sm text-slate-600">
                  {locale === "si" ? field.labelSi : field.labelEn}
                </span>
                <input
                  type={field.type === "number" ? "number" : field.type}
                  min={field.type === "number" ? 0 : undefined}
                  value={form.sectorCustom[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) => setSectorField(field.key, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      )}

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
