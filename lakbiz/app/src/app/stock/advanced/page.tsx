"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PureVariantStockAssignment } from "@/components/stock/pure-variant-stock-assignment";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  inventoryModeLabel,
  inventoryTrackingPreset,
  type InventoryTrackingMode,
} from "@/lib/inventory-tracking";
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
import { resolveBlockedLot, blockedLotSchemaUnavailable, type BlockedLotAction } from "@/lib/supabase/blocked-lot-client";
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
  return (
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table") ||
    value.includes("adjust_product_variant_stock")
  );
}

function identityLabel(unit: InventoryUnit): string {
  return unit.imei || unit.serialNo || unit.barcode || unit.id.slice(0, 8);
}

export default function AdvancedInventoryPage() {
  const { data, ready } = useAppStore();
  const { org, canSeeFinancials, orgRole } = useSubscription();
  const { locale } = useLocale();
  const si = locale === "si";
  const canDisposeLots = orgRole === "owner" || orgRole === "manager";

  // The dashboard's expiry queue / "Blocked batches" links here with
  // ?product=<id> so an owner lands directly on the affected product
  // instead of having to hunt through the picker — this page otherwise
  // shows lots for one manually-selected product at a time.
  const searchParams = useSearchParams();
  const [productId, setProductId] = useState(() => searchParams.get("product") ?? "");
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

  // Blocked-batch disposition (dispose / return to supplier) — section 4.5
  // of the pharmacy dashboard audit. A quarantined/recalled/expired lot
  // used to have no next step here beyond the read-only status badge.
  const [disposeNotes, setDisposeNotes] = useState<Record<string, string>>({});
  const [disposeTarget, setDisposeTarget] = useState<{ lot: InventoryLot; action: BlockedLotAction } | null>(null);
  const [disposingLotId, setDisposingLotId] = useState<string | null>(null);

  const [serialNo, setSerialNo] = useState("");
  const [imei, setImei] = useState("");
  const [secondaryImei, setSecondaryImei] = useState("");
  const [unitBarcode, setUnitBarcode] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [unitVariantId, setUnitVariantId] = useState("");

  const preset = inventoryTrackingPreset(org.sector);
  const selected = data?.products.find((product) => product.id === productId) ?? null;
  const mode = profile?.trackingMode ?? preset.defaultMode;
  const usesVariants = ["variant", "variant_serial", "variant_lot"].includes(mode);
  const usesLots = mode === "lot" || mode === "variant_lot";
  const usesSerial = mode === "serial" || mode === "variant_serial";

  const axisNames = useMemo(() => {
    const values = profile?.variantAxes?.length ? profile.variantAxes : preset.variantAxes;
    return [values[0] ?? "variant", values[1] ?? "option"];
  }, [profile?.variantAxes, preset.variantAxes]);

  // Round 3 addendum — a product's saved mode can legitimately sit outside
  // the sector's current allowedModes (e.g. it predates pharmacy's
  // allowedModes narrowing to lot-only; inventory-tracking.ts's own
  // comment already documents that an existing product is never silently
  // converted). The <select> below is a controlled input bound to `mode`
  // — the same source the "Current tracking mode" label reads — but a
  // <select> can only visually show a value that has a matching <option>;
  // when `mode` wasn't in preset.allowedModes, the browser silently fell
  // back to whatever option rendered first, while the label (reading
  // `mode` directly, not the DOM) kept telling the truth. Always
  // including the real current mode as an option is what keeps the two
  // in sync, for this product and any other in the same situation.
  const selectableModes = preset.allowedModes.includes(mode) ? preset.allowedModes : [mode, ...preset.allowedModes];

  const availableLots = lots.filter(
    (lot) =>
      lot.status === "available" &&
      lot.qtyOnHand > 0 &&
      (!lot.expiryDate || lot.expiryDate >= new Date().toISOString().slice(0, 10)),
  );
  const availableUnits = units.filter((unit) => unit.status === "available");
  const identityOnHand =
    mode === "variant"
      ? variants.reduce((sum, variant) => sum + variant.stockQty, 0)
      : usesLots
        ? lots.reduce((sum, lot) => sum + lot.qtyOnHand, 0)
        : usesSerial
          ? units.filter((unit) => !["sold", "written_off"].includes(unit.status)).length
          : selected?.stockQty ?? 0;
  const unregisteredQty = Math.max(0, (selected?.stockQty ?? 0) - identityOnHand);

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
    const firstError =
      profileResult.error || variantResult.error || lotResult.error || unitResult.error;
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

  async function saveProfile(nextMode: InventoryTrackingMode) {
    if (!selected || !org.id) return;
    setSaving(true);
    setMessage(null);
    const result = await upsertInventoryProfile({
      productId: selected.id,
      organizationId: org.id,
      trackingMode: nextMode,
      variantAxes: preset.variantAxes,
      fefoEnabled:
        nextMode === "lot" || nextMode === "variant_lot" ? preset.fefo : false,
      requireSerialOnSale:
        nextMode === "serial" || nextMode === "variant_serial",
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
    const result = await createInventoryLot(
      org.id,
      {
        productId: selected.id,
        variantId: lotVariantId || null,
        batchNo: batchNo.trim(),
        expiryDate: expiryDate || null,
        qty: Number(lotQty),
        unitCost:
          canSeeFinancials && lotCost !== "" ? Number(lotCost) : undefined,
      },
      canSeeFinancials,
    );
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

  async function disposeLot() {
    if (!disposeTarget || !org.id || !selected) return;
    const { lot, action } = disposeTarget;
    setDisposingLotId(lot.id);
    setMessage(null);
    const result = await resolveBlockedLot(org.id, lot.id, action, disposeNotes[lot.id]);
    setDisposingLotId(null);
    setDisposeTarget(null);
    if (!result.ok) {
      setMessage(
        blockedLotSchemaUnavailable(result.error)
          ? (si ? "Batch disposition විශේෂාංගය තවම ලබාගත නොහැක." : "Batch disposition isn't available yet — the database migration hasn't been applied.")
          : result.error ?? (si ? "Batch disposition අසාර්ථකයි." : "Batch disposition failed."),
      );
      return;
    }
    setDisposeNotes((current) => {
      const next = { ...current };
      delete next[lot.id];
      return next;
    });
    await refresh(selected.id);
  }

  async function addUnit() {
    if (
      !selected ||
      !org.id ||
      (!serialNo.trim() && !imei.trim() && !unitBarcode.trim())
    ) return;
    setSaving(true);
    setMessage(null);
    const result = await createInventoryUnit(
      org.id,
      {
        productId: selected.id,
        variantId: unitVariantId || null,
        serialNo: serialNo.trim() || undefined,
        imei: imei.trim() || undefined,
        secondaryImei: secondaryImei.trim() || undefined,
        barcode: unitBarcode.trim() || undefined,
        warrantyExpiry: warrantyExpiry || null,
        unitCost:
          canSeeFinancials && unitCost !== "" ? Number(unitCost) : undefined,
      },
      canSeeFinancials,
    );
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

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={si ? "පූරණය වෙමින්…" : "Loading inventory…"} />
        </ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated) {
    return (
      <AppShell>
        <ProMain>
          <PageHeader title={si ? "උසස් තොග පාලනය" : "Inventory control"} />
          <EmptyState
            title={si ? "Cloud shop account එකක් අවශ්‍යයි" : "A cloud shop account is required"}
            description={si ? "Batch, variant සහ IMEI/serial තොරතුරු ආරක්ෂිත cloud වාර්තා ලෙස පවත්වාගෙන යයි." : "Batch, variant and IMEI/serial identities are maintained as protected cloud records."}
          />
        </ProMain>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={si ? "උසස් තොග පාලනය" : "Inventory control"}
          description={si ? "Batch, expiry, size/colour variants සහ IMEI/serial identity — ඔබේ ව්‍යාපාර වර්ගයට ගැළපෙන ලෙස." : "Batch, expiry, size/colour variants and IMEI/serial identity — adapted to your business type."}
          actions={<Link href="/stock" className={secondary}>{si ? "සාමාන්‍ය තොගයට" : "Back to stock"}</Link>}
        />

        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{si ? "ව්‍යාපාර තොග රීතිය" : "Sector inventory strategy"}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{inventoryModeLabel(preset.defaultMode, locale)}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{si ? preset.reasonSi : preset.reasonEn}</p>
              </div>
              <StatusBadge tone="info">{org.sector.replaceAll("_", " ")}</StatusBadge>
            </div>
          </section>

          <section className={card}>
            <label className={label}>{si ? "භාණ්ඩය තෝරන්න" : "Select product"}</label>
            <select className={input} value={productId} onChange={(event) => setProductId(event.target.value)}>
              {data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}{product.sku ? ` · ${product.sku}` : ""}
                </option>
              ))}
            </select>
          </section>
        </div>

        {data.products.length === 0 ? (
          <EmptyState
            title={si ? "පළමුව භාණ්ඩයක් එක් කරන්න" : "Add a product first"}
            description={si ? "Batch / variant / serial identity එකක් සාමාන්‍ය stock භාණ්ඩයකට සම්බන්ධ වේ." : "Batch, variant and serial identities attach to a normal stock product."}
            action={<Link href="/stock" className={primary}>{si ? "භාණ්ඩයක් එක් කරන්න" : "Add product"}</Link>}
          />
        ) : dbUpgradeNeeded ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm font-semibold text-amber-950">{si ? "Advanced inventory database upgrade එක තවම live database එකට යොදා නැත." : "The advanced-inventory database upgrade has not been applied to the live database yet."}</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">{si ? "Migration apply කළ පසු මෙම workspace එක batch / IMEI / variant data සමඟ ස්වයංක්‍රීයව සක්‍රීය වේ." : "Once the migration is applied, this workspace automatically activates batch, IMEI and variant records."}</p>
          </div>
        ) : loadingDetail ? (
          <div className={card}><p className="text-sm text-slate-500">{si ? "තොරතුරු පූරණය වෙමින්…" : "Loading tracking details…"}</p></div>
        ) : selected ? (
          <div className="space-y-5">
            {message && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{message}</div>}

            <section className={card}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{selected.category}</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{selected.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{si ? "දැනට භාවිත කරන tracking ආකාරය" : "Current tracking mode"}: <span className="font-semibold text-slate-800">{inventoryModeLabel(mode, locale)}</span></p>
                </div>
                <div className="min-w-[230px]">
                  <label className={label}>{si ? "Tracking ආකාරය" : "Tracking mode"}</label>
                  <select className={input} value={mode} disabled={saving} onChange={(event) => void saveProfile(event.target.value as InventoryTrackingMode)}>
                    {selectableModes.map((value) => (
                      <option key={value} value={value}>{inventoryModeLabel(value, locale)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-950 p-3 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{si ? "මුළු Stock quantity" : "Aggregate stock"}</p>
                  <p className="mt-1 text-xl font-semibold">{selected.stockQty}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{si ? "Identity මගින් හඳුනාගත්" : "Identity-covered"}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{identityOnHand}</p>
                </div>
                <div className={`rounded-xl p-3 ${unregisteredQty > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${unregisteredQty > 0 ? "text-amber-700" : "text-emerald-700"}`}>{si ? "තව හඳුනාගත යුතු" : "Still unassigned"}</p>
                  <p className={`mt-1 text-xl font-semibold ${unregisteredQty > 0 ? "text-amber-950" : "text-emerald-900"}`}>{unregisteredQty}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{usesLots ? (si ? "Valid batches" : "Valid batches") : usesSerial ? (si ? "Available units" : "Available units") : (si ? "Variants" : "Variants")}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{usesLots ? availableLots.length : usesSerial ? availableUnits.length : variants.length}</p>
                </div>
              </div>

              {mode !== "simple" && unregisteredQty > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  {si ? `Stock page එකේ ${selected.stockQty} units තිබේ. ඒවායින් ${unregisteredQty} තවම ${usesLots ? "batch" : usesSerial ? "IMEI/serial" : "variant"} identity එකකට වෙන් කර නැත.` : `${selected.stockQty} units exist in aggregate Stock. ${unregisteredQty} still need a ${usesLots ? "batch" : usesSerial ? "serial/IMEI" : "variant"} identity.`}
                </div>
              )}
            </section>

            {usesVariants && (
              <section className={card}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{si ? "ප්‍රභේද / Variants" : "Variants"}</h3>
                    <p className="mt-1 text-sm text-slate-500">{si ? "ප්‍රමාණ, වර්ණ, storage වැනි විකල්ප වෙන වෙනම හඳුනාගන්න." : "Keep size, colour, storage or other options as separate stock identities."}</p>
                  </div>
                  <StatusBadge tone="neutral">{axisNames.join(" + ")}</StatusBadge>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className={label}>{si ? "පෙන්වන නම" : "Variant label"}<input className={input} value={variantLabel} onChange={(event) => setVariantLabel(event.target.value)} placeholder={org.sector === "footwear" ? "Black · EU 42" : "256GB · Black"} /></label>
                  <label className={label}>{axisNames[0]}<input className={input} value={variantAxisA} onChange={(event) => setVariantAxisA(event.target.value)} /></label>
                  <label className={label}>{axisNames[1]}<input className={input} value={variantAxisB} onChange={(event) => setVariantAxisB(event.target.value)} /></label>
                  <label className={label}>SKU<input className={input} value={variantSku} onChange={(event) => setVariantSku(event.target.value)} /></label>
                  <label className={label}>Barcode<input className={input} value={variantBarcode} onChange={(event) => setVariantBarcode(event.target.value)} /></label>
                </div>
                <button type="button" className={`${primary} mt-4`} disabled={saving || !variantLabel.trim()} onClick={() => void addVariant()}>{si ? "Variant එක් කරන්න" : "Add variant"}</button>

                {mode === "variant" && org.id && (
                  <PureVariantStockAssignment
                    organizationId={org.id}
                    productId={selected.id}
                    productQty={selected.stockQty}
                    variants={variants}
                    disabled={saving}
                    onUpdated={() => refresh(selected.id)}
                  />
                )}

                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  {variants.length === 0 ? (
                    <p className="p-5 text-sm text-slate-500">{si ? "Variants තවම නැත." : "No variants yet."}</p>
                  ) : (
                    variants.map((variant) => {
                      const derivedQty = mode === "variant_lot"
                        ? lots.filter((lot) => lot.variantId === variant.id).reduce((sum, lot) => sum + lot.qtyOnHand, 0)
                        : mode === "variant_serial"
                          ? units.filter((unit) => unit.variantId === variant.id && unit.status === "available").length
                          : variant.stockQty;
                      return (
                        <div key={variant.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{variant.label}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{Object.entries(variant.attributes).map(([key, value]) => `${key}: ${value}`).join(" · ") || variant.sku || "—"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{derivedQty} {si ? "තිබේ" : "available"}</span>
                            <StatusBadge tone={variant.active ? "positive" : "neutral"}>{variant.active ? (si ? "සක්‍රීය" : "Active") : (si ? "අක්‍රීය" : "Inactive")}</StatusBadge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            {usesLots && (
              <section className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{si ? "Batch / expiry තොග" : "Batch / expiry stock"}</h3>
                    <p className="mt-1 text-sm text-slate-500">{si ? "එකම භාණ්ඩයේ batches සහ expiry dates වෙන වෙනම තබා POS එකට FEFO නිකුත් කිරීම සූදානම් කරන්න." : "Keep batches and expiry dates separately so POS can issue the earliest valid stock automatically by FEFO."}</p>
                  </div>
                  <Link href="/stock" className="text-xs font-semibold text-teal-700 hover:underline">{si ? "Stock in මුලින් කරන්න →" : "Stock in first →"}</Link>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {usesVariants && <label className={label}>Variant<select className={input} value={lotVariantId} onChange={(event) => setLotVariantId(event.target.value)}><option value="">{si ? "තෝරන්න" : "Select variant"}</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</select></label>}
                  <label className={label}>{si ? "Batch / lot අංකය" : "Batch / lot no."}<input className={input} value={batchNo} onChange={(event) => setBatchNo(event.target.value)} /></label>
                  <label className={label}>{si ? "කල් ඉකුත් දිනය" : "Expiry date"}<input type="date" className={input} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label>
                  <label className={label}>{si ? "ප්‍රමාණය" : "Quantity"}<input type="number" min="0.001" step="0.001" className={input} value={lotQty} onChange={(event) => setLotQty(event.target.value)} /></label>
                  {canSeeFinancials && <label className={label}>{si ? "ඒකක අභ්‍යන්තර පිරිවැය (LKR)" : "Internal unit cost (LKR)"}<input type="number" min="0" className={input} value={lotCost} onChange={(event) => setLotCost(event.target.value)} /></label>}
                </div>
                <button type="button" className={`${primary} mt-4`} disabled={saving || !batchNo.trim() || Number(lotQty) <= 0 || (usesVariants && !lotVariantId)} onClick={() => void addLot()}>{si ? "Batch එක ලියාපදිංචි කරන්න" : "Register batch"}</button>

                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  {lots.length === 0 ? (
                    <p className="p-5 text-sm text-slate-500">{si ? "Batch වාර්තා තවම නැත." : "No batch records yet."}</p>
                  ) : (
                    lots.map((lot) => {
                      // "Blocked" mirrors sector-command-center.tsx's own
                      // definition exactly (quarantine/recalled/expired-by-
                      // status-or-date) — see 20260825000001_blocked_lot_
                      // disposition.sql. Was a read-only badge with no next
                      // step; dispose/return-to-supplier now actually do
                      // something. No "release back to available" action —
                      // out of scope by design, see the migration's header.
                      const isBlocked =
                        lot.qtyOnHand > 0 &&
                        (lot.status === "quarantine" || lot.status === "expired" || lot.status === "recalled" ||
                          (lot.expiryDate != null && lot.expiryDate < new Date().toISOString().slice(0, 10)));
                      return (
                        <div key={lot.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{lot.batchNo}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{lot.expiryDate ? `Expiry: ${lot.expiryDate}` : (si ? "Expiry නැත" : "No expiry set")}</p>
                            </div>
                            <div className="text-right"><p className="text-sm font-semibold text-slate-900">{lot.qtyOnHand}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">{si ? "තිබෙන තොගය" : "on hand"}</p></div>
                            <StatusBadge tone={lot.status === "available" ? "positive" : lot.status === "expired" || lot.status === "recalled" ? "danger" : "warning"}>{lot.status}</StatusBadge>
                          </div>
                          {isBlocked && canDisposeLots && (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                              <input
                                type="text"
                                value={disposeNotes[lot.id] ?? ""}
                                onChange={(event) => setDisposeNotes((current) => ({ ...current, [lot.id]: event.target.value }))}
                                placeholder={si ? "සටහන (විකල්ප)" : "Note (optional)"}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-teal-400"
                              />
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={disposingLotId === lot.id}
                                  onClick={() => setDisposeTarget({ lot, action: "dispose" })}
                                  className="inline-flex h-9 items-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
                                >
                                  {si ? "විනාශ කරන්න (Dispose)" : "Dispose"}
                                </button>
                                <button
                                  type="button"
                                  disabled={disposingLotId === lot.id}
                                  onClick={() => setDisposeTarget({ lot, action: "return_to_supplier" })}
                                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {si ? "සැපයුම්කරුට ආපසු" : "Return to supplier"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            <ConfirmDialog
              open={disposeTarget != null}
              title={
                disposeTarget?.action === "dispose"
                  ? (si ? "Batch එක විනාශ කරන්නද?" : "Dispose of this batch?")
                  : (si ? "සැපයුම්කරුට ආපසු එවන්නද?" : "Return this batch to the supplier?")
              }
              description={
                disposeTarget
                  ? (si
                      ? `Batch ${disposeTarget.lot.batchNo} (${disposeTarget.lot.qtyOnHand} ඒකක) මෙය ආපසු හැරවිය නොහැක.`
                      : `Batch ${disposeTarget.lot.batchNo} (${disposeTarget.lot.qtyOnHand} units) — this cannot be undone. Stock is removed from this product's total immediately.`)
                  : undefined
              }
              confirmLabel={si ? "තහවුරු කරන්න" : "Confirm"}
              cancelLabel={si ? "අවලංගු කරන්න" : "Cancel"}
              tone={disposeTarget?.action === "dispose" ? "danger" : "default"}
              loading={disposingLotId != null}
              onConfirm={() => void disposeLot()}
              onClose={() => setDisposeTarget(null)}
            />

            {usesSerial && (
              <section className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{si ? "IMEI / serial ඒකක" : "IMEI / serial units"}</h3>
                    <p className="mt-1 text-sm text-slate-500">{si ? "එක් එක් භෞතික උපාංගය වෙනම identity එකක් ලෙස ලියාපදිංචි කර POS sale, warranty සහ return එකට සම්බන්ධ කරන්න." : "Register each physical device as its own identity so POS, warranty and returns can trace the exact unit."}</p>
                  </div>
                  <Link href="/stock" className="text-xs font-semibold text-teal-700 hover:underline">{si ? "Stock in මුලින් කරන්න →" : "Stock in first →"}</Link>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {usesVariants && <label className={label}>Variant<select className={input} value={unitVariantId} onChange={(event) => setUnitVariantId(event.target.value)}><option value="">{si ? "තෝරන්න" : "Select variant"}</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</select></label>}
                  <label className={label}>IMEI<input className={input} value={imei} onChange={(event) => setImei(event.target.value)} /></label>
                  <label className={label}>{si ? "දෙවන IMEI" : "Secondary IMEI"}<input className={input} value={secondaryImei} onChange={(event) => setSecondaryImei(event.target.value)} /></label>
                  <label className={label}>{si ? "Serial අංකය" : "Serial number"}<input className={input} value={serialNo} onChange={(event) => setSerialNo(event.target.value)} /></label>
                  <label className={label}>Barcode<input className={input} value={unitBarcode} onChange={(event) => setUnitBarcode(event.target.value)} /></label>
                  <label className={label}>{si ? "වගකීම් අවසන් දිනය" : "Warranty expiry"}<input type="date" className={input} value={warrantyExpiry} onChange={(event) => setWarrantyExpiry(event.target.value)} /></label>
                  {canSeeFinancials && <label className={label}>{si ? "අභ්‍යන්තර ඒකක පිරිවැය (LKR)" : "Internal unit cost (LKR)"}<input type="number" min="0" className={input} value={unitCost} onChange={(event) => setUnitCost(event.target.value)} /></label>}
                </div>
                <button type="button" className={`${primary} mt-4`} disabled={saving || (!imei.trim() && !serialNo.trim() && !unitBarcode.trim()) || (usesVariants && !unitVariantId)} onClick={() => void addUnit()}>{si ? "Serialized unit ලියාපදිංචි කරන්න" : "Register serialized unit"}</button>

                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  {units.length === 0 ? (
                    <p className="p-5 text-sm text-slate-500">{si ? "Serialized units තවම නැත." : "No serialized units yet."}</p>
                  ) : (
                    units.map((unit) => (
                      <div key={unit.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <p className="font-mono text-sm font-semibold text-slate-900">{identityLabel(unit)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{unit.imei && unit.serialNo ? `Serial ${unit.serialNo}` : unit.warrantyExpiry ? `Warranty: ${unit.warrantyExpiry}` : "—"}</p>
                        </div>
                        <StatusBadge tone={unit.status === "available" ? "positive" : unit.status === "sold" ? "neutral" : "warning"}>{unit.status}</StatusBadge>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {mode === "simple" && (
              <section className={card}>
                <h3 className="text-base font-semibold text-slate-950">{si ? "සරල තොග පාලනය" : "Simple stock control"}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{si ? "මෙම භාණ්ඩය දැනට LakBiz හි සාමාන්‍ය quantity + stock movement ක්‍රමය භාවිතා කරයි." : "This product currently uses LakBiz's standard quantity + stock-movement workflow. Use an advanced mode only when the physical stock needs lot, variant or serial identity."}</p>
              </section>
            )}

            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
              {si ? "Stock quantity එක මුල් ledger එකයි. මෙම workspace එක එම තොගයට batch / size-colour / IMEI identity ලබා දෙයි. POS එක දැන් එම exact identity එකම නිකුත් කරයි." : "Aggregate Stock quantity remains the primary ledger. This workspace assigns batch, size/colour or IMEI identity to that stock, and POS now issues the exact identity."}
            </div>
          </div>
        ) : null}
      </ProMain>
    </AppShell>
  );
}
