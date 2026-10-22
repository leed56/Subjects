"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import type { InventoryTrackingMode } from "@/lib/inventory-tracking";
import {
  inventorySelectionReadiness,
  type SaleInventorySelection,
} from "@/lib/inventory-sale-allocation";
import {
  fetchSaleInventoryOptions,
  type SaleInventoryOptions,
} from "@/lib/supabase/sale-inventory-client";

export type AdvancedSaleLineState = {
  mode: InventoryTrackingMode;
  selection: SaleInventorySelection;
  ready: boolean;
  loading: boolean;
  degraded: boolean;
  error: string | null;
};

type Props = {
  productId: string;
  qty: number;
  value?: SaleInventorySelection;
  onChange: (next: AdvancedSaleLineState) => void;
};

function identityLabel(unit: SaleInventoryOptions["units"][number]): string {
  return unit.imei || unit.serialNo || unit.barcode || unit.id.slice(0, 8);
}

function schemaUnavailable(error: string | null): boolean {
  if (!error) return false;
  const value = error.toLowerCase();
  return (
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table") ||
    value.includes("allocate_sale_inventory")
  );
}

function prescriptionFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

export function AdvancedSaleSelector({ productId, qty, value, onChange }: Props) {
  const { locale } = useLocale();
  const { data } = useAppStore();
  const si = locale === "si";
  const [options, setOptions] = useState<SaleInventoryOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [prescriptionVerified, setPrescriptionVerified] = useState(false);
  const selection = value ?? {};
  const product = data?.products.find((row) => row.id === productId);
  const prescriptionRequired = prescriptionFlag(product?.customFields.requiresPrescription);

  useEffect(() => {
    setPrescriptionVerified(false);
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchSaleInventoryOptions(productId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setOptions(result.data);
      } else {
        setOptions(result.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const mode = options?.profile?.trackingMode ?? "simple";
  const needsVariant = ["variant", "variant_lot", "variant_serial"].includes(mode);
  const needsUnits = ["serial", "variant_serial"].includes(mode);

  const variantAvailability = useMemo(() => {
    const byVariant = new Map<string, number>();
    if (!options) return byVariant;

    if (mode === "variant") {
      for (const variant of options.variants) {
        byVariant.set(variant.id, variant.stockQty);
      }
      return byVariant;
    }

    if (mode === "variant_lot") {
      for (const lot of options.lots) {
        if (!lot.variantId) continue;
        byVariant.set(
          lot.variantId,
          (byVariant.get(lot.variantId) ?? 0) + lot.qtyOnHand,
        );
      }
      return byVariant;
    }

    if (mode === "variant_serial") {
      for (const unit of options.units) {
        if (!unit.variantId) continue;
        byVariant.set(unit.variantId, (byVariant.get(unit.variantId) ?? 0) + 1);
      }
    }

    return byVariant;
  }, [options, mode]);

  const selectedVariant = selection.variantId
    ? options?.variants.find((variant) => variant.id === selection.variantId)
    : undefined;
  const selectedVariantAvailable = selection.variantId
    ? variantAvailability.get(selection.variantId) ?? 0
    : 0;

  const visibleUnits = useMemo(() => {
    if (!options) return [];
    if (mode !== "variant_serial" || !selection.variantId) return options.units;
    return options.units.filter((unit) => unit.variantId === selection.variantId);
  }, [options, mode, selection.variantId]);
  const visibleLots = useMemo(() => {
    if (!options) return [];
    if (mode !== "variant_lot" || !selection.variantId) return options.lots;
    return options.lots.filter((lot) => lot.variantId === selection.variantId);
  }, [options, mode, selection.variantId]);
  const lotAvailable = visibleLots.reduce((sum, lot) => sum + lot.qtyOnHand, 0);
  const readiness = inventorySelectionReadiness(mode, qty, selection);
  const lotReady = !["lot", "variant_lot"].includes(mode) || lotAvailable >= qty;
  const variantReady =
    !needsVariant ||
    (Boolean(selection.variantId) && selectedVariantAvailable >= qty);
  const degraded = schemaUnavailable(error);
  const inventoryReady = degraded || (readiness.complete && lotReady && variantReady && !error);
  const ready = inventoryReady && (!prescriptionRequired || prescriptionVerified);

  useEffect(() => {
    onChange({
      mode,
      selection,
      ready: loading ? false : ready,
      loading,
      degraded,
      error: degraded ? null : error,
    });
    // `onChange` is intentionally excluded: parent setters are stable in the
    // Sales page and including the callback would cause a report loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selection.variantId, selection.unitIds?.join("|"), ready, loading, degraded, error]);

  if (loading) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-500">
        {si ? "Batch / serial තොගය පරීක්ෂා කරමින්…" : "Checking batch / serial availability…"}
      </div>
    );
  }

  if (degraded) {
    return (
      <div className="mt-3 space-y-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
          <span className="font-bold">{si ? "Advanced tracking තවම database එකට සක්‍රීය කර නැත." : "Advanced tracking is not active on the live database yet."}</span>{" "}
          {si ? "මෙම විකිණීම සාමාන්‍ය stock quantity මත දිගටම සිදුවේ." : "This sale will continue on the existing aggregate stock quantity."}
        </div>
        {prescriptionRequired && (
          <PrescriptionCheck si={si} checked={prescriptionVerified} onChange={setPrescriptionVerified} />
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-800">
        {si ? "Inventory identity පරීක්ෂාව අසාර්ථකයි: " : "Inventory identity check failed: "}{error}
      </div>
    );
  }

  if (mode === "simple") {
    return prescriptionRequired ? (
      <PrescriptionCheck si={si} checked={prescriptionVerified} onChange={setPrescriptionVerified} />
    ) : null;
  }

  const nextLot = visibleLots.find((lot) => lot.qtyOnHand > 0);

  const updateSelection = (next: SaleInventorySelection) => {
    onChange({
      mode,
      selection: next,
      ready: false,
      loading: false,
      degraded: false,
      error: null,
    });
  };

  return (
    <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
            {si ? "නිශ්චිත තොග හඳුනාගැනීම" : "Exact inventory identity"}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-700">
            {mode === "lot" || mode === "variant_lot"
              ? si ? "FEFO — ඉක්මනින් කල් ඉකුත් වන batch එක පළමුව" : "FEFO — earliest valid expiry is issued first"
              : mode === "serial" || mode === "variant_serial"
                ? si ? "IMEI / serial එක තෝරන්න" : "Select the physical IMEI / serial"
                : si ? "නිවැරදි variant එක තෝරන්න" : "Select the exact variant"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
          {ready ? (si ? "සූදානම්" : "Ready") : (si ? "තේරීම අවශ්‍යයි" : "Action needed")}
        </span>
      </div>

      {prescriptionRequired && (
        <PrescriptionCheck si={si} checked={prescriptionVerified} onChange={setPrescriptionVerified} compact />
      )}

      {needsVariant && (
        <label className="mt-3 block text-xs font-semibold text-slate-700">
          {si ? "Variant" : "Variant"}
          <select
            value={selection.variantId ?? ""}
            onChange={(event) => updateSelection({ variantId: event.target.value || null, unitIds: [] })}
            className="mt-1.5 h-10 w-full rounded-lg border border-teal-100 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">{si ? "තෝරන්න" : "Select variant"}</option>
            {options?.variants.map((variant) => {
              const available = variantAvailability.get(variant.id) ?? 0;
              return (
                <option key={variant.id} value={variant.id} disabled={available < qty}>
                  {variant.label} · {available} {si ? "තිබේ" : "available"}
                </option>
              );
            })}
          </select>
        </label>
      )}

      {needsVariant && selectedVariant && selectedVariantAvailable < qty && (
        <p className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
          {si ? "මෙම variant එකට ප්‍රමාණවත් available identity stock නැත." : "This variant does not have enough available identity stock."}
        </p>
      )}

      {(mode === "lot" || mode === "variant_lot") && (
        <div className="mt-3 rounded-lg border border-teal-100 bg-white px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-600">{si ? "විකිණීමට සුදුසු batch stock" : "Valid batch stock"}</span>
            <span className={`font-bold ${lotAvailable >= qty ? "text-emerald-700" : "text-rose-700"}`}>{lotAvailable}</span>
          </div>
          {nextLot && (
            <p className="mt-1 text-[11px] text-slate-500">
              {si ? "පළමුව නිකුත් වේ" : "Next FEFO batch"}: <span className="font-semibold text-slate-700">{nextLot.batchNo}</span>
              {nextLot.expiryDate ? ` · ${si ? "කල් ඉකුත්" : "exp"} ${nextLot.expiryDate}` : ""}
            </p>
          )}
          {needsVariant && !selectedVariant && (
            <p className="mt-1 text-[11px] font-semibold text-amber-700">{si ? "Batch availability බැලීමට variant එක තෝරන්න." : "Select a variant to check its batch availability."}</p>
          )}
          {needsVariant && selectedVariant && lotAvailable < qty && (
            <p className="mt-1 text-[11px] font-semibold text-rose-700">{si ? "මෙම variant එකට ප්‍රමාණවත් valid batch stock නැත." : "This variant does not have enough valid batch stock."}</p>
          )}
        </div>
      )}

      {needsUnits && (!needsVariant || selection.variantId) && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">{si ? "IMEI / serial තෝරන්න" : "Select IMEI / serial"}</p>
            <span className="text-[11px] font-bold text-slate-500">{selection.unitIds?.length ?? 0}/{qty}</span>
          </div>
          {visibleUnits.length === 0 ? (
            <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
              {si ? "විකිණීමට available serial/IMEI unit නැත." : "No available serialized unit is recorded for this selection."}
            </p>
          ) : (
            <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
              {visibleUnits.map((unit) => {
                const checked = selection.unitIds?.includes(unit.id) ?? false;
                const atLimit = !checked && (selection.unitIds?.length ?? 0) >= qty;
                return (
                  <label key={unit.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs transition ${checked ? "border-teal-200 bg-white text-teal-900" : "border-slate-200 bg-white/80 text-slate-700"}`}>
                    <span className="min-w-0 truncate font-semibold">{identityLabel(unit)}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={atLimit}
                      onChange={(event) => {
                        const current = selection.unitIds ?? [];
                        const unitIds = event.target.checked
                          ? [...current, unit.id]
                          : current.filter((id) => id !== unit.id);
                        updateSelection({ ...selection, unitIds });
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!ready && readiness.reason && !needsUnits && (
        <p className="mt-2 text-[11px] font-semibold text-amber-800">{readiness.reason}</p>
      )}
    </div>
  );
}

function PrescriptionCheck({
  si,
  checked,
  onChange,
  compact = false,
}: {
  si: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label className={`${compact ? "mt-3" : "mt-3"} flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
      />
      <span className="min-w-0">
        <span className="block text-xs font-bold">
          {si ? "වෛද්‍ය වට්ටෝරුව අවශ්‍යයි" : "Prescription required"}
        </span>
        <span className="mt-0.5 block text-[11px] leading-4 text-amber-800">
          {checked
            ? (si ? "විකිණීමට පෙර වට්ටෝරුව පරීක්ෂා කළ බව තහවුරු කර ඇත." : "Prescription verification confirmed for this checkout.")
            : (si ? "Checkout කිරීමට පෙර වලංගු වට්ටෝරුව පරීක්ෂා කර මෙම කොටුව සලකුණු කරන්න." : "Verify the applicable prescription before checkout, then confirm here.")}
        </span>
      </span>
    </label>
  );
}
