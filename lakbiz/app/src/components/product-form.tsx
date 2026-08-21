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
import { SectorIcon } from "@/components/sector-icon";
import { useSubscription } from "@/lib/subscription/subscription-provider";
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
  condition: "new",
  buyPrice: 0,
  sellPrice: 0,
  stockQty: 0,
  reorderLevel: 5,
  unit: "pcs",
  active: true,
  notes: "",
  sectorCustom: Object.fromEntries(
    Object.entries(emptyCustomFieldsForSector(sectorId)).map(([k, v]) => [k, String(v)]),
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

const fieldLabel = "text-[13px] font-semibold text-slate-600";
const inputClass =
  "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.025)] outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const sectionClass =
  "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.04)]";

export function ProductForm({
  initial,
  defaultSectorId = "grocery",
  lockedSectorId,
  onSubmit,
  onCancel,
  submitLabel,
}: ProductFormProps) {
  const { t, locale } = useLocale();
  const { canSeeFinancials } = useSubscription();
  const isSinhala = locale === "si";
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
        condition: initial.condition ?? "new",
        buyPrice: initial.buyPrice,
        sellPrice: initial.sellPrice,
        stockQty: initial.stockQty,
        reorderLevel: initial.reorderLevel ?? 5,
        unit: String(initial.customFields.unit ?? "pcs"),
        active: initial.active,
        notes: initial.notes ?? "",
        sectorCustom: customFieldsFromProduct({ ...initial, sectorId }),
      };
    }
    return emptyForm(shopSectorId);
  });

  const categories = useMemo(
    () => categoriesForSector(lockedSectorId ?? form.sectorId),
    [lockedSectorId, form.sectorId],
  );
  const lockedSector = lockedSectorId ? sectorById(lockedSectorId) : undefined;
  const sectorFields = useMemo(() => sectorFormFields(form.sectorId), [form.sectorId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setSectorField = (key: string, value: string) =>
    setForm((f) => ({ ...f, sectorCustom: { ...f.sectorCustom, [key]: value } }));

  const handleSectorChange = (sectorId: SectorId) => {
    if (lockedSectorId) return;
    setForm((f) => ({
      ...f,
      sectorId,
      category: defaultCategoryForSector(sectorId),
      sectorCustom: Object.fromEntries(
        Object.entries(emptyCustomFieldsForSector(sectorId)).map(([k, v]) => [k, String(v)]),
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
  const basicsTitle = isSinhala ? "භාණ්ඩ මූලික තොරතුරු" : "Item details";
  const basicsHint = isSinhala
    ? "භාණ්ඩය හඳුනාගැනීමට අවශ්‍ය මූලික තොරතුරු."
    : "The core information your team uses to find and sell this item.";
  const inventoryTitle = isSinhala ? "තොග සහ මිල" : "Inventory & pricing";
  const inventoryHint = isSinhala
    ? "තොග ප්‍රමාණය, මිල සහ අඩු තොග සීමාව පාලනය කරන්න."
    : "Control quantity, pricing and the low-stock threshold in one place.";
  const sectorTitle = isSinhala ? "ව්‍යාපාර-විශේෂ තොරතුරු" : "Sector-specific details";
  const sectorHint = isSinhala
    ? "ඔබේ ව්‍යාපාර වර්ගයට පමණක් අදාළ අමතර තොරතුරු."
    : "Only the extra fields required by this business type.";

  return (
    <form data-product-form="true" onSubmit={handleSubmit} className="space-y-5 pb-24">
      <section className={sectionClass}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold tracking-[-0.015em] text-slate-950">{basicsTitle}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{basicsHint}</p>
          </div>
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700 ring-1 ring-inset ring-teal-100">
            {initial ? t("common.edit") : t("stock.add_new")}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={fieldLabel}>{t("stock.item_name")}</span>
            <input
              required
              autoFocus
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className={fieldLabel}>{t("stock.sku")}</span>
            <input value={form.sku} onChange={(e) => set("sku", e.target.value)} className={inputClass} />
          </label>

          <label className="block">
            <span className={fieldLabel}>{t("stock.category")}</span>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputClass}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>

          <div className="block">
            <span className={fieldLabel}>{t("stock.sector")}</span>
            {lockedSectorId && lockedSector ? (
              <div className="mt-1.5 flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-sm font-semibold text-slate-800">
                <span className="mr-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white text-teal-700 ring-1 ring-slate-200/80">
                  <SectorIcon sectorId={lockedSector.id} className="h-4 w-4" />
                </span>
                {isSinhala ? lockedSector.nameSi : lockedSector.nameEn}
              </div>
            ) : (
              <select value={form.sectorId} onChange={(e) => handleSectorChange(e.target.value as SectorId)} className={inputClass}>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.nameSi} / {s.nameEn}</option>
                ))}
              </select>
            )}
          </div>

          <label className="block">
            <span className={fieldLabel}>{t("stock.condition")}</span>
            <select
              value={form.condition ?? "new"}
              onChange={(e) => set("condition", e.target.value as ProductInput["condition"])}
              className={inputClass}
            >
              <option value="new">{t("stock.condition_new")}</option>
              <option value="used">{t("stock.condition_used")}</option>
            </select>
          </label>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-5">
          <h3 className="text-base font-semibold tracking-[-0.015em] text-slate-950">{inventoryTitle}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{inventoryHint}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={fieldLabel}>{t("stock.unit")}</span>
            <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className={inputClass}>
              {units.map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>

          {canSeeFinancials && (
            <label className="block">
              <span className={fieldLabel}>{t("stock.buy_price")}</span>
              <input
                type="number"
                min={0}
                value={form.buyPrice || ""}
                onChange={(e) => set("buyPrice", Number(e.target.value))}
                className={inputClass}
              />
            </label>
          )}

          <label className="block">
            <span className={fieldLabel}>{t("stock.sell_price")}</span>
            <input
              type="number"
              min={0}
              value={form.sellPrice || ""}
              onChange={(e) => set("sellPrice", Number(e.target.value))}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className={fieldLabel}>{t("stock.current_qty")}</span>
            <input
              type="number"
              min={0}
              value={form.stockQty || ""}
              onChange={(e) => set("stockQty", Number(e.target.value))}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className={fieldLabel}>{t("stock.low_alert_at")}</span>
            <input
              type="number"
              min={0}
              value={form.reorderLevel ?? ""}
              onChange={(e) => set("reorderLevel", Number(e.target.value))}
              className={inputClass}
            />
          </label>

          {initial && (
            <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-200 bg-slate-50/80 px-3.5">
              <input
                type="checkbox"
                checked={form.active ?? true}
                onChange={(e) => set("active", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-teal-600"
              />
              <span className="text-sm font-medium text-slate-700">{t("stock.active_item")}</span>
            </label>
          )}
        </div>
      </section>

      {sectorFields.length > 0 && (
        <section className={sectionClass}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold tracking-[-0.015em] text-slate-950">{sectorTitle}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{sectorHint}</p>
            </div>
            {lockedSector && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                {isSinhala ? lockedSector.nameSi : lockedSector.nameEn}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {sectorFields.map((field) =>
              field.type === "boolean" ? (
                <label key={field.key} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.sectorCustom[field.key] === "true"}
                    onChange={(e) => setSectorField(field.key, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                  />
                  <span className="text-sm font-medium text-slate-700">{isSinhala ? field.labelSi : field.labelEn}</span>
                </label>
              ) : (
                <label key={field.key} className="block">
                  <span className={fieldLabel}>{isSinhala ? field.labelSi : field.labelEn}</span>
                  <input
                    type={field.type === "number" ? "number" : field.type}
                    min={field.type === "number" ? 0 : undefined}
                    value={form.sectorCustom[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => setSectorField(field.key, e.target.value)}
                    className={inputClass}
                  />
                </label>
              ),
            )}
          </div>
        </section>
      )}

      <section className={sectionClass}>
        <label className="block">
          <span className={fieldLabel}>{t("stock.notes")}</span>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </label>
      </section>

      <div className="sticky bottom-[-1.25rem] z-20 -mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-slate-200/80 bg-white/96 px-5 py-4 shadow-[0_-12px_30px_rgba(15,23,42,0.055)] backdrop-blur-xl">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            {t("common.cancel")}
          </button>
        ) : <span />}
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(13,148,136,0.2)] transition hover:bg-teal-700 hover:shadow-[0_10px_24px_rgba(13,148,136,0.24)]"
        >
          {saveLabel}
        </button>
      </div>
    </form>
  );
}
