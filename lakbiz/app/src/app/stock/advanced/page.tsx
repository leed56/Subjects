"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { useLocale } from "@/lib/i18n/locale-provider";
import { inventoryModeLabel, inventoryTrackingPreset, type InventoryTrackingMode } from "@/lib/inventory-tracking";
import {
  createInventoryLot,
  createInventoryUnit,
  createProductVariant,
  fetchInventoryLots,
  fetchInventoryProfile,
  fetchInventoryUnits,
  fetchProductVariants,
  upsertInventoryProfile,
  type InventoryLot,
  type InventoryProfile,
  type InventoryUnit,
  type ProductVariant,
} from "@/lib/supabase/advanced-inventory-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)]";
const label = "text-xs font-semibold text-slate-600";
const input = "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const primary = "inline-flex h-10 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50";

function schemaMissing(error: string | null): boolean {
  if (!error) return false;
  const value = error.toLowerCase();
  return value.includes("does not exist") || value.includes("schema cache") || value.includes("could not find the table");
}

export default function AdvancedInventoryPage() {
  const { data, ready } = useAppStore();
  const { org, canSeeFinancials } = useSubscription();
  const { locale } = useLocale();
  const si = locale === "si";

  const [productId, setProductId] = useState("");
  const [profile, setProfile] = useState<InventoryProfile | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dbUpgradeNeeded, setDbUpgradeNeeded] = useState(false);

  const [variantLabel, setVariantLabel] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [variantBarcode, setVariantBarcode] = useState("");
  const [variantAxisA, setVariantAxisA] = useState("");
  const [variantAxisB, setVariantAxisB] = useState("");

  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [lotQty, setLotQty] = useState("1");
  const [lotCost, setLotCost] = useState("");
  const [lotVariantId, setLotVariantId] = useState("");

  const [serialNo, setSerialNo] = useState("");
  const [imei, setImei] = useState("");
  const [secondaryImei, setSecondaryImei] = useState("");
  const [unitBarcode, setUnitBarcode] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [unitVariantId, setUnitVariantId] = useState("");

  const preset = inventoryTrackingPreset(org.sector);
  const selected = data?.products.find((p) => p.id === productId) ?? null;
  const mode = profile?.trackingMode ?? preset.defaultMode;
  const usesVariants = mode === "variant" || mode === "variant_serial" || mode === "variant_lot";
  const usesLots = mode === "lot" || mode === "variant_lot";
  const usesSerial = mode === "serial" || mode === "variant_serial";

  useEffect(() => {
    if (!productId && data?.products.length) setProductId(data.products[0].id);
  }, [data?.products, productId]);

  async function refresh(id: string) {
    if (!id || !org.isAuthenticated || !org.id) return;
    setLoadingDetail(true);
    setMessage(null);
    const [profileResult, variantResult, lotResult, unitResult] = await Promise.all([
      fetchInventoryProfile(id),
      fetchProductVariants(id),
      fetchInventoryLots(id, canSeeFinancials),
      fetchInventoryUnits(id, canSeeFinancials),
    ]);
    const firstError = profileResult.error || variantResult.error || lotResult.error || unitResult.error;
    if (schemaMissing(firstError)) {
      setDbUpgradeNeeded(true);
      setProfile(null);
      setVariants([]);
      setLots([]);
      setUnits([]);
      setLoadingDetail(false);
      return;
    }
    setDbUpgradeNeeded(false);
    if (firstError) setMessage(firstError);
    setProfile(profileResult.data);
    setVariants(variantResult.data);
    setLots(lotResult.data);
    setUnits(unitResult.data);
    setLoadingDetail(false);
  }

  useEffect(() => {
    if (productId) void refresh(productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, org.id, org.isAuthenticated, canSeeFinancials]);

  const axisNames = useMemo(() => {
    const values = profile?.variantAxes?.length ? profile.variantAxes : preset.variantAxes;
    return [values[0] ?? "variant", values[1] ?? "option"];
  }, [profile?.variantAxes, preset.variantAxes]);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain><ProLoadingState label={si ? "පූරණය වෙමින්…" : "Loading inventory…"} /></ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated) {
    return (
      <AppShell>
        <ProMain>
          <PageHeader title={si ? "උසස් තොග පාලනය" : "Advanced inventory"} />
          <EmptyState title={si ? "Cloud shop account එකක් අවශ්‍යයි" : "A cloud shop account is required"} description={si ? "Batch, variant සහ IMEI/serial තොරතුරු ආරක්ෂිත cloud වාර්තා ලෙස පවත්වාගෙන යයි." : "Batch, variant and IMEI/serial identities are maintained as protected cloud records."} />
        </ProMain>
      </AppShell>
    );
  }

  async function saveProfile(nextMode: InventoryTrackingMode) {
    if (!selected || !org.id) return;
    setSaving(true);
    setMessage(null);
    const result = await upsertInventoryProfile({
      productId: selected.id,
      organizationId: org.id,
      trackingMode: nextMode,
      variantAxes: preset.variantAxes,
      fefoEnabled: nextMode === "lot" || nextMode === "variant_lot" ? preset.fefo : false,
      requireSerialOnSale: nextMode === "serial" || nextMode === "variant_serial",
      allowNegativeStock: false,
    });
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setProfile(result.data);
    await refresh(selected.id);
  }

  async function addVariant() {
    if (!selected || !org.id || !variantLabel.trim()) return;
    setSaving(true);
    setMessage(null);
    const attributes: Record<string, string> = {};
    if (variantAxisA.trim()) attributes[axisNames[0]] = variantAxisA.trim();
    if (variantAxisB.trim()) attributes[axisNames[1]] = variantAxisB.trim();
    const result = await createProductVariant(org.id, selected.id, {
      label: variantLabel.trim(),
      sku: variantSku.trim() || null,
      barcode: variantBarcode.trim() || null,
      attributes,
      stockQty: 0,
      reorderLevel: null,
      sellPriceOverride: null,
    });
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setVariantLabel("");
    setVariantSku("");
    setVariantBarcode("");
    setVariantAxisA("");
    setVariantAxisB("");
    await refresh(selected.id);
  }

  async function addLot() {
    if (!selected || !org.id || !batchNo.trim() || Number(lotQty) <= 0) return;
    setSaving(true);
    setMessage(null);
    const result = await createInventoryLot(org.id, {
      productId: selected.id,
      variantId: lotVariantId || null,
      batchNo: batchNo.trim(),
      expiryDate: expiryDate || null,
      qty: Number(lotQty),
      unitCost: canSeeFinancials && lotCost !== "" ? Number(lotCost) : undefined,
    }, canSeeFinancials);
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setBatchNo("");
    setExpiryDate("");
    setLotQty("1");
    setLotCost("");
    setLotVariantId("");
    await refresh(selected.id);
  }

  async function addUnit() {
    if (!selected || !org.id || !serialNo.trim() && !imei.trim() && !unitBarcode.trim()) return;
    setSaving(true);
    setMessage(null);
    const result = await createInventoryUnit(org.id, {
      productId: selected.id,
      variantId: unitVariantId || null,
      serialNo: serialNo.trim() || undefined,
      imei: imei.trim() || undefined,
      secondaryImei: secondaryImei.trim() || undefined,
      barcode: unitBarcode.trim() || undefined,
      warrantyExpiry: warrantyExpiry || null,
      unitCost: canSeeFinancials && unitCost !== "" ? Number(unitCost) : undefined,
    }, canSeeFinancials);
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setSerialNo("");
    setImei("");
    setSecondaryImei("");
    setUnitBarcode("");
    setWarrantyExpiry("");
    setUnitCost("");
    setUnitVariantId("");
    await refresh(selected.id);
  }

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={si ? "උසස් තොග පාලනය" : "Advanced inventory"}
          description={si ? "Batch, expiry, size/colour variants සහ IMEI/serial identity — ව්‍යාපාර වර්ගයට ගැළපෙන ලෙස." : "Batch, expiry, size/colour variants and IMEI/serial identity — adapted to your business type."}
          actions={<Link href="/stock" className={secondary}>{si ? "සාමාන්‍ය තොගයට" : "Back to stock"}</Link>}
        />

        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{si ? "ව්‍යාපාර තොග රීතිය" : "Sector inventory strategy"}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{inventoryModeLabel(preset.defaultMode, locale)}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{si ? preset.reasonSi : preset.reasonEn}</p>
              </div>
              <StatusBadge tone="info">{org.sector.replaceAll("_", " ")}</StatusBadge>
            </div>
          </div>
          <div className={card}>
            <label className={label}>{si ? "භාණ්ඩය තෝරන්න" : "Select product"}</label>
            <select className={input} value={productId} onChange={(e) => setProductId(e.target.value)}>
              {data.products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}
            </select>
          </div>
        </div>

        {data.products.length === 0 ? (
          <EmptyState title={si ? "පළමුව භාණ්ඩයක් එක් කරන්න" : "Add a product first"} description={si ? "උසස් තොග identity එකක් භාණ්ඩයකට සම්බන්ධ වේ." : "Advanced inventory identities are attached to a product."} action={<Link href="/stock" className={primary}>{si ? "භාණ්ඩයක් එක් කරන්න" : "Add product"}</Link>} />
        ) : dbUpgradeNeeded ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm font-semibold text-amber-950">{si ? "Advanced inventory database upgrade එක තවම live database එකට යොදා නැත." : "The advanced-inventory database upgrade has not been applied to the live database yet."}</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">{si ? "මෙය UI දෝෂයක් නොවේ. Migration apply කළ පසු මෙම screen එක ස්වයංක්‍රීයව batch / IMEI / variant data පෙන්වයි." : "This is not a UI failure. Once the migration is applied, this workspace automatically becomes active for batch, IMEI and variant records."}</p>
          </div>
        ) : loadingDetail ? (
          <div className={card}><p className="text-sm text-slate-500">{si ? "තොරතුරු පූරණය වෙමින්…" : "Loading tracking details…"}</p></div>
        ) : selected ? (
          <div className="space-y-5">
            {message && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</div>}

            <section className={card}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{selected.category}</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{selected.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{si ? "දැනට භාවිත කරන tracking ආකාරය" : "Current tracking mode"}: <span className="font-semibold text-slate-800">{inventoryModeLabel(mode, locale)}</span></p>
                </div>
                <div className="min-w-[230px]">
                  <label className={label}>{si ? "Tracking ආකාරය" : "Tracking mode"}</label>
                  <select className={input} value={mode} disabled={saving} onChange={(e) => void saveProfile(e.target.value as InventoryTrackingMode)}>
                    {preset.allowedModes.map((value) => <option key={value} value={value}>{inventoryModeLabel(value, locale)}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{si ? "Variants" : "Variants"}</p><p className="mt-1 text-xl font-semibold text-slate-950">{variants.length}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{si ? "Batches" : "Batches"}</p><p className="mt-1 text-xl font-semibold text-slate-950">{lots.filter((lot) => lot.qtyOnHand > 0).length}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{si ? "Serialized units" : "Serialized units"}</p><p className="mt-1 text-xl font-semibold text-slate-950">{units.filter((unit) => unit.status === "available").length}</p></div>
              </div>
            </section>

            {usesVariants && (
              <section className={card}>
                <div className="flex items-end justify-between gap-3">
                  <div><h3 className="text-base font-semibold text-slate-950">{si ? "ප්‍රභේද / Variants" : "Variants"}</h3><p className="mt-1 text-sm text-slate-500">{si ? "ප්‍රමාණ, වර්ණ, storage වැනි විකල්ප වෙන වෙනම හඳුනාගන්න." : "Keep size, colour, storage or other options as separate stock identities."}</p></div>
                  <StatusBadge tone="neutral">{axisNames.join(" + ")}</StatusBadge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className={label}>{si ? "පෙන්වන නම" : "Variant label"}<input className={input} value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)} placeholder={org.sector === "footwear" ? "Black · EU 42" : "256GB · Black"} /></label>
                  <label className={label}>{axisNames[0]}<input className={input} value={variantAxisA} onChange={(e) => setVariantAxisA(e.target.value)} /></label>
                  <label className={label}>{axisNames[1]}<input className={input} value={variantAxisB} onChange={(e) => setVariantAxisB(e.target.value)} /></label>
                  <label className={label}>SKU<input className={input} value={variantSku} onChange={(e) => setVariantSku(e.target.value)} /></label>
                  <label className={label}>Barcode<input className={input} value={variantBarcode} onChange={(e) => setVariantBarcode(e.target.value)} /></label>
                </div>
                <button type="button" className={`${primary} mt-4`} disabled={saving || !variantLabel.trim()} onClick={() => void addVariant()}>{si ? "Variant එක් කරන්න" : "Add variant"}</button>
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  {variants.length === 0 ? <p className="p-5 text-sm text-slate-500">{si ? "Variants තවම නැත." : "No variants yet."}</p> : variants.map((variant) => <div key={variant.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"><div><p className="text-sm font-semibold text-slate-900">{variant.label}</p><p className="mt-0.5 text-xs text-slate-500">{Object.entries(variant.attributes).map(([key, value]) => `${key}: ${value}`).join(" · ") || variant.sku || "—"}</p></div><StatusBadge tone={variant.active ? "positive" : "neutral"}>{variant.active ? (si ? "සක්‍රීය" : "Active") : (si ? "අක්‍රීය" : "Inactive")}</StatusBadge></div>)}
                </div>
              </section>
            )}

            {usesLots && (
              <section className={card}>
                <div><h3 className="text-base font-semibold text-slate-950">{si ? "Batch / expiry තොග" : "Batch / expiry stock"}</h3><p className="mt-1 text-sm text-slate-500">{si ? "එකම ඖෂධයේ batches සහ expiry dates වෙන වෙනම තබා FEFO සඳහා සූදානම් කරන්න." : "Keep each batch and expiry separately so pharmacy FEFO allocation can use the right stock."}</p></div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {usesVariants && <label className={label}>{si ? "Variant" : "Variant"}<select className={input} value={lotVariantId} onChange={(e) => setLotVariantId(e.target.value)}><option value="">{si ? "ප්‍රධාන භාණ්ඩය" : "Base product"}</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</select></label>}
                  <label className={label}>{si ? "Batch / lot අංකය" : "Batch / lot no."}<input className={input} value={batchNo} onChange={(e) => setBatchNo(e.target.value)} /></label>
                  <label className={label}>{si ? "කල් ඉකුත් දිනය" : "Expiry date"}<input type="date" className={input} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></label>
                  <label className={label}>{si ? "ප්‍රමාණය" : "Quantity"}<input type="number" min="0.001" step="0.001" className={input} value={lotQty} onChange={(e) => setLotQty(e.target.value)} /></label>
                  {canSeeFinancials && <label className={label}>{si ? "ඒකක අභ්‍යන්තර පිරිවැය (LKR)" : "Internal unit cost (LKR)"}<input type="number" min="0" className={input} value={lotCost} onChange={(e) => setLotCost(e.target.value)} /></label>}
                </div>
                <button type="button" className={`${primary} mt-4`} disabled={saving || !batchNo.trim() || Number(lotQty) <= 0} onClick={() => void addLot()}>{si ? "Batch එක එක් කරන්න" : "Add batch"}</button>
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  {lots.length === 0 ? <p className="p-5 text-sm text-slate-500">{si ? "Batch වාර්තා තවම නැත." : "No batch records yet."}</p> : lots.map((lot) => <div key={lot.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="text-sm font-semibold text-slate-900">{lot.batchNo}</p><p className="mt-0.5 text-xs text-slate-500">{lot.expiryDate ? `${si ? "Expiry" : "Expiry"}: ${lot.expiryDate}` : (si ? "Expiry නැත" : "No expiry set")}</p></div><div className="text-right"><p className="text-sm font-semibold text-slate-900">{lot.qtyOnHand}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">{si ? "තිබෙන තොගය" : "on hand"}</p></div><StatusBadge tone={lot.status === "available" ? "positive" : lot.status === "expired" || lot.status === "recalled" ? "danger" : "warning"}>{lot.status}</StatusBadge></div>)}
                </div>
              </section>
            )}

            {usesSerial && (
              <section className={card}>
                <div><h3 className="text-base font-semibold text-slate-950">{si ? "IMEI / serial ඒකක" : "IMEI / serial units"}</h3><p className="mt-1 text-sm text-slate-500">{si ? "එක් එක් භෞතික උපාංගය වෙනම identity එකක් ලෙස සටහන් කරන්න." : "Record each physical device as its own identity for warranty, sale and return traceability."}</p></div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {usesVariants && <label className={label}>Variant<select className={input} value={unitVariantId} onChange={(e) => setUnitVariantId(e.target.value)}><option value="">{si ? "ප්‍රධාන භාණ්ඩය" : "Base product"}</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</select></label>}
                  <label className={label}>IMEI<input className={input} value={imei} onChange={(e) => setImei(e.target.value)} /></label>
                  <label className={label}>{si ? "දෙවන IMEI" : "Secondary IMEI"}<input className={input} value={secondaryImei} onChange={(e) => setSecondaryImei(e.target.value)} /></label>
                  <label className={label}>{si ? "Serial අංකය" : "Serial number"}<input className={input} value={serialNo} onChange={(e) => setSerialNo(e.target.value)} /></label>
                  <label className={label}>Barcode<input className={input} value={unitBarcode} onChange={(e) => setUnitBarcode(e.target.value)} /></label>
                  <label className={label}>{si ? "වගකීම් අවසන් දිනය" : "Warranty expiry"}<input type="date" className={input} value={warrantyExpiry} onChange={(e) => setWarrantyExpiry(e.target.value)} /></label>
                  {canSeeFinancials && <label className={label}>{si ? "අභ්‍යන්තර ඒකක පිරිවැය (LKR)" : "Internal unit cost (LKR)"}<input type="number" min="0" className={input} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></label>}
                </div>
                <button type="button" className={`${primary} mt-4`} disabled={saving || !imei.trim() && !serialNo.trim() && !unitBarcode.trim()} onClick={() => void addUnit()}>{si ? "Serialized unit එක් කරන්න" : "Add serialized unit"}</button>
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  {units.length === 0 ? <p className="p-5 text-sm text-slate-500">{si ? "Serialized units තවම නැත." : "No serialized units yet."}</p> : units.map((unit) => <div key={unit.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-mono text-sm font-semibold text-slate-900">{unit.imei || unit.serialNo || unit.barcode}</p><p className="mt-0.5 text-xs text-slate-500">{unit.imei && unit.serialNo ? `Serial ${unit.serialNo}` : unit.warrantyExpiry ? `${si ? "Warranty" : "Warranty"}: ${unit.warrantyExpiry}` : "—"}</p></div><StatusBadge tone={unit.status === "available" ? "positive" : unit.status === "sold" ? "neutral" : "warning"}>{unit.status}</StatusBadge></div>)}
                </div>
              </section>
            )}

            {mode === "simple" && (
              <section className={card}>
                <h3 className="text-base font-semibold text-slate-950">{si ? "සරල තොග පාලනය" : "Simple stock control"}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{si ? "මෙම භාණ්ඩය දැනට LakBiz හි සාමාන්‍ය quantity + stock movement ක්‍රමය භාවිතා කරයි. අවශ්‍ය ව්‍යාපාරවලට ඉහළ tracking mode එකක් තෝරාගත හැක." : "This product currently uses LakBiz's standard quantity + stock-movement workflow. Switch to an allowed advanced mode only when the physical stock needs lot, variant or serial identity."}</p>
              </section>
            )}

            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
              {si ? "සුරක්ෂිත rollout: advanced identity layer එක additive ය. POS/GRN allocation integration සම්පූර්ණ වන තුරු existing Stock quantity එක double-update නොකරයි." : "Safe rollout: the advanced identity layer is additive. It does not double-update the existing Stock quantity while POS/GRN allocation integration is being completed."}
            </div>
          </div>
        ) : null}
      </ProMain>
    </AppShell>
  );
}
