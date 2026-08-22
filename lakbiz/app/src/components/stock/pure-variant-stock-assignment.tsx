"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { adjustProductVariantStock } from "@/lib/supabase/variant-stock-client";
import type { ProductVariant } from "@/lib/supabase/advanced-inventory-client";

type Props = {
  organizationId: string;
  productId: string;
  productQty: number;
  variants: ProductVariant[];
  disabled?: boolean;
  onUpdated: () => Promise<void> | void;
};

export function PureVariantStockAssignment({
  organizationId,
  productId,
  productQty,
  variants,
  disabled = false,
  onUpdated,
}: Props) {
  const { locale } = useLocale();
  const si = locale === "si";
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("1");
  const [direction, setDirection] = useState<"assign" | "unassign">("assign");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const assignedTotal = useMemo(
    () => variants.reduce((sum, variant) => sum + variant.stockQty, 0),
    [variants],
  );
  const unassigned = Math.max(0, productQty - assignedTotal);
  const selected = variants.find((variant) => variant.id === variantId);
  const requested = Number(qty) || 0;
  const max = direction === "assign" ? unassigned : selected?.stockQty ?? 0;
  const valid = Boolean(selected) && requested > 0 && requested <= max;

  async function submit() {
    if (!selected || !valid || saving) return;
    setSaving(true);
    setMessage(null);
    const delta = direction === "assign" ? requested : -requested;
    const result = await adjustProductVariantStock(
      organizationId,
      productId,
      selected.id,
      delta,
      direction === "assign" ? "Assign aggregate stock to variant" : "Return variant stock to unassigned pool",
    );
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setQty("1");
    setMessage(
      si
        ? `Variant තොගය යාවත්කාලීන විය. වෙන් නොකළ තොගය ${result.data?.unassignedQty ?? 0}.`
        : `Variant stock updated. ${result.data?.unassignedQty ?? 0} aggregate units remain unassigned.`,
    );
    await onUpdated();
  }

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            {si ? "පවතින තොගය variants වලට වෙන් කරන්න" : "Assign existing stock to variants"}
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            {si
              ? "මෙය මුළු product stock එක වැඩි නොකරයි. Stock page එකේ දැනට තිබෙන quantity එක size / colour වැනි variants අතර බෙදයි."
              : "This does not increase total product stock. It distributes the quantity already recorded on the Stock page across size/colour variants."}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-lg bg-white px-2.5 py-1.5 font-semibold text-slate-600 ring-1 ring-slate-200">
            {si ? "වෙන් කළ" : "Assigned"} {assignedTotal}
          </span>
          <span className={`rounded-lg px-2.5 py-1.5 font-semibold ring-1 ${unassigned > 0 ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
            {si ? "වෙන් නොකළ" : "Unassigned"} {unassigned}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px_140px_auto] sm:items-end">
        <label className="text-xs font-semibold text-slate-600">
          Variant
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            disabled={disabled || saving}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">{si ? "තෝරන්න" : "Select variant"}</option>
            {variants.filter((variant) => variant.active).map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label} · {variant.stockQty}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-slate-600">
          {si ? "ක්‍රියාව" : "Action"}
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value as "assign" | "unassign")}
            disabled={disabled || saving}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          >
            <option value="assign">{si ? "වෙන් කරන්න" : "Assign"}</option>
            <option value="unassign">{si ? "ආපසු වෙන් නොකළට" : "Unassign"}</option>
          </select>
        </label>

        <label className="text-xs font-semibold text-slate-600">
          {si ? "ප්‍රමාණය" : "Quantity"}
          <input
            type="number"
            min="0.001"
            max={max || undefined}
            step="0.001"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            disabled={disabled || saving}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
        </label>

        <button
          type="button"
          disabled={disabled || saving || !valid}
          onClick={() => void submit()}
          className="h-10 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (si ? "සුරකිමින්…" : "Saving…") : (si ? "යාවත්කාලීන කරන්න" : "Update")}
        </button>
      </div>

      {selected && requested > max && (
        <p className="mt-2 text-xs font-semibold text-rose-700">
          {direction === "assign"
            ? (si ? `වෙන් නොකළ තොගය ${unassigned} පමණි.` : `Only ${unassigned} aggregate units are still unassigned.`)
            : (si ? `මෙම variant එකේ ${selected.stockQty} පමණි.` : `This variant currently has ${selected.stockQty}.`)}
        </p>
      )}
      {message && <p className="mt-2 text-xs font-semibold text-teal-700">{message}</p>}
    </div>
  );
}
