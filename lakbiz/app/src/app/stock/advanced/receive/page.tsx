"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  inventoryModeLabel,
  inventoryTrackingPreset,
  type InventoryTrackingMode,
} from "@/lib/inventory-tracking";
import {
  createInventoryLot,
  createInventoryUnit,
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
import { adjustProductVariantStock } from "@/lib/supabase/variant-stock-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)]";
const label = "text-xs font-semibold text-slate-600";
const input =
  "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const primary =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

function schemaMissing(error: string | null): boolean {
  if (!error) return false;
  const value = error.toLowerCase();
  return (
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table")
  );
}

function physicalCoverage(
  mode: InventoryTrackingMode,
  variants: ProductVariant[],
  lots: InventoryLot[],
  units: InventoryUnit[],
): number {
  if (mode === "variant") {
    return variants.reduce(
      (sum, variant) => sum + Math.max(0, variant.stockQty),
      0,
    );
  }
  if (mode === "lot" || mode === "variant_lot") {
    return lots.reduce((sum, lot) => sum + Math.max(0, lot.qtyOnHand), 0);
  }
  if (mode === "serial" || mode === "variant_serial") {
    return units.filter(
      (unit) => unit.status !== "sold" && unit.status !== "written_off",
    ).length;
  }
  return 0;
}

export default function ReceiveTrackedStockPage() {
  const { data, ready } = useAppStore();
  const { org, canSeeFinancials } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const { locale } = useLocale();
  const si = locale === "si";

  const [requestedProductId, setRequestedProductId] = useState("");
  const [productId, setProductId] = useState("");
  const [profile, setProfile] = useState<InventoryProfile | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dbUpgradeNeeded, setDbUpgradeNeeded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [variantId, setVariantId] = useState("");
  const [variantAssignQty, setVariantAssignQty] = useState("1");
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [batchQty, setBatchQty] = useState("1");
  const [supplierId, setSupplierId] = useState("");
  const [lotCost, setLotCost] = useState("");
  const [imei, setImei] = useState("");
  const [secondaryImei, setSecondaryImei] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [barcode, setBarcode] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [unitCost, setUnitCost] = useState("");

  const preset = inventoryTrackingPreset(org.sector);
  const selected = data?.products.find((product) => product.id === productId) ?? null;
  const mode = profile?.trackingMode ?? preset.defaultMode;
  const coverage = useMemo(
    () => physicalCoverage(mode, variants, lots, units),
    [mode, variants, lots, units],
  );
  const unassigned = selected ? Math.max(0, selected.stockQty - coverage) : 0;

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("product") ?? "";
    setRequestedProductId(requested);
  }, []);

  useEffect(() => {
    if (!data?.products.length) return;
    if (
      requestedProductId &&
      data.products.some((product) => product.id === requestedProductId)
    ) {
      setProductId(requestedProductId);
      return;
    }
    if (!productId) setProductId(data.products[0].id);
  }, [data?.products, productId, requestedProductId]);

  async function refresh(id: string) {
    if (!id || !org.id || !org.isAuthenticated) return;
    setLoadingDetail(true);
    setError(null);
    const [profileResult, variantResult, lotResult, unitResult] = await Promise.all([
      fetchInventoryProfile(id),
      fetchProductVariants(id),
      fetchInventoryLots(id, canSeeFinancials),
      fetchInventoryUnits(id, canSeeFinancials),
    ]);
    const firstError =
      profileResult.error ||
      variantResult.error ||
      lotResult.error ||
      unitResult.error;

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
    setProfile(profileResult.data);
    setVariants(variantResult.data);
    setLots(lotResult.data);
    setUnits(unitResult.data);
    setError(firstError);
    setLoadingDetail(false);
  }

  useEffect(() => {
    if (productId) void refresh(productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, org.id, org.isAuthenticated, canSeeFinancials]);

  useEffect(() => {
    setVariantId("");
    setVariantAssignQty("1");
    setBatchNo("");
    setExpiryDate("");
    setBatchQty("1");
    setSupplierId("");
    setLotCost("");
    setImei("");
    setSecondaryImei("");
    setSerialNo("");
    setBarcode("");
    setWarrantyExpiry("");
    setUnitCost("");
    setMessage(null);
    setError(null);
  }, [productId]);

  async function enableRecommendedTracking() {
    if (!selected || !org.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const nextMode = preset.defaultMode;
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
      setError(result.error);
      return;
    }
    setMessage(si ? "Tracking ක්‍රමය සක්‍රීය කරන ලදී." : "Tracking mode enabled.");
    await refresh(selected.id);
  }

  async function assignVariant() {
    if (!selected || !org.id || !variantId) return;
    const qty = Number(variantAssignQty);
    if (!Number.isFinite(qty) || qty <= 0 || qty > unassigned) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await adjustProductVariantStock(
      org.id,
      selected.id,
      variantId,
      qty,
      "Receiving identity assignment",
    );
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setVariantAssignQty("1");
    setMessage(
      si
        ? `${qty} variant තොගයට වෙන් කරන ලදී.`
        : `${qty} unit${qty === 1 ? "" : "s"} assigned to the selected variant.`,
    );
    await refresh(selected.id);
  }

  async function addBatch() {
    if (!selected || !org.id || !batchNo.trim()) return;
    const qty = Number(batchQty);
    if (!Number.isFinite(qty) || qty <= 0 || qty > unassigned) return;
    if (mode === "variant_lot" && !variantId) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    const supplier = supplierId
      ? data?.suppliers.find((row) => row.id === supplierId)
      : undefined;
    const savedBatchNo = batchNo.trim();
    const result = await createInventoryLot(
      org.id,
      {
        productId: selected.id,
        variantId: mode === "variant_lot" ? variantId : null,
        batchNo: savedBatchNo,
        expiryDate: expiryDate || null,
        supplierId: supplierId || null,
        qty,
        unitCost:
          canSeeFinancials && lotCost !== "" ? Number(lotCost) : undefined,
        notes: supplier
          ? `Received from ${supplier.name}`
          : "Receiving identity assignment",
      },
      canSeeFinancials,
    );
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setBatchNo("");
    setExpiryDate("");
    setBatchQty("1");
    setLotCost("");
    setMessage(
      si
        ? `${qty} batch identity ලෙස සටහන් කරන ලදී.`
        : `${qty} unit${qty === 1 ? "" : "s"} assigned to batch ${savedBatchNo}.`,
    );
    await refresh(selected.id);
  }

  async function addSerializedUnit() {
    if (!selected || !org.id) return;
    const exactIdentity = imei.trim() || serialNo.trim() || barcode.trim();
    if (!exactIdentity || unassigned < 1) return;
    if (mode === "variant_serial" && !variantId) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    const supplier = supplierId
      ? data?.suppliers.find((row) => row.id === supplierId)
      : undefined;
    const result = await createInventoryUnit(
      org.id,
      {
        productId: selected.id,
        variantId: mode === "variant_serial" ? variantId : null,
        imei: imei.trim() || undefined,
        secondaryImei: secondaryImei.trim() || undefined,
        serialNo: serialNo.trim() || undefined,
        barcode: barcode.trim() || undefined,
        warrantyExpiry: warrantyExpiry || null,
        unitCost:
          canSeeFinancials && unitCost !== "" ? Number(unitCost) : undefined,
        notes: supplier
          ? `Received from ${supplier.name}`
          : "Receiving identity assignment",
      },
      canSeeFinancials,
    );
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setImei("");
    setSecondaryImei("");
    setSerialNo("");
    setBarcode("");
    setWarrantyExpiry("");
    setUnitCost("");
    setMessage(
      si
        ? `${exactIdentity} stock identity එකට එක් කරන ලදී.`
        : `${exactIdentity} added to available serialized stock.`,
    );
    await refresh(selected.id);
  }

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState
            label={si ? "තොග තොරතුරු පූරණය වෙමින්…" : "Loading receiving workspace…"}
          />
        </ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated) {
    return (
      <AppShell>
        <ProMain>
          <EmptyState
            title={si ? "Cloud shop account එකක් අවශ්‍යයි" : "A cloud shop account is required"}
            description={
              si
                ? "Batch / IMEI / variant receiving cloud identity records ලෙස පවත්වාගෙන යයි."
                : "Tracked receiving is stored as protected cloud inventory identity records."
            }
          />
        </ProMain>
      </AppShell>
    );
  }

  const activeVariants = variants.filter((variant) => variant.active);
  const isLotMode = mode === "lot" || mode === "variant_lot";
  const isSerialMode = mode === "serial" || mode === "variant_serial";

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={si ? "ලැබුණු තොග හඳුනාගන්න" : "Receive tracked stock"}
          description={
            si
              ? "GRN / PO Receive / Stock In මගින් ලැබුණු quantity එක batch, variant හෝ IMEI/serial identity වලට වෙන් කරන්න. Stock quantity දෙවරක් වැඩි නොවේ."
              : "Assign quantity already received through GRN, PO Receive or Stock In to its exact batch, variant or IMEI/serial identity. Aggregate stock is never increased twice."
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/stock/advanced/queue" className={secondary}>
                {si ? "Receiving queue" : "Receiving queue"}
              </Link>
              <Link href="/stock/advanced" className={secondary}>
                {si ? "Inventory control" : "Inventory control"}
              </Link>
            </div>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className={card}>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">
              {si ? "Receiving principle" : "Receiving principle"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {si
                ? "Quantity එක පළමුව, identity එක දෙවනුව"
                : "Receive quantity first, assign identity second"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              {si
                ? "Supplier GRN, PO receive හෝ Stock In aggregate stock වැඩි කරයි. මෙම screen එක එම තොගය හඳුනාගන්නවා පමණයි."
                : "Supplier GRN, PO receiving or Stock In owns the aggregate quantity. This screen only identifies that already-received stock."
              }
            </p>
          </section>

          <section className={card}>
            <label className={label}>{si ? "භාණ්ඩය" : "Product"}</label>
            <select
              className={input}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              {data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}{product.sku ? ` · ${product.sku}` : ""}
                </option>
              ))}
            </select>
          </section>
        </div>

        {data.products.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title={si ? "පළමුව භාණ්ඩයක් එක් කරන්න" : "Add a product first"}
              description={
                si
                  ? "Tracked receiving සඳහා Stock product එකක් අවශ්‍යයි."
                  : "Tracked receiving attaches identities to an existing Stock product."
              }
              action={<Link href="/stock" className={primary}>{si ? "Stock වෙත" : "Go to Stock"}</Link>}
            />
          </div>
        ) : dbUpgradeNeeded ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">
              {si
                ? "Advanced inventory migrations තවම live database එකට apply කර නැත."
                : "The advanced-inventory migrations are not applied to the live database yet."}
            </p>
            <p className="mt-2 leading-6 text-amber-800">
              {si
                ? "Correct LakBiz Supabase project එකට migrations apply කළ පසු receiving workflow සක්‍රීය වේ."
                : "Apply the pending migrations to the correct LakBiz Supabase project before using tracked receiving."}
            </p>
          </div>
        ) : loadingDetail || !selected ? (
          <div className="mt-5">
            <ProLoadingState
              label={si ? "Tracking තොරතුරු පූරණය වෙමින්…" : "Loading tracking details…"}
            />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {message}
              </div>
            )}

            <section className={card}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {selected.category || (si ? "භාණ්ඩය" : "Product")}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    {selected.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tracking: <span className="font-semibold text-slate-800">{inventoryModeLabel(mode, locale)}</span>
                  </p>
                </div>
                <StatusBadge tone={unassigned > 0 ? "warning" : "positive"}>
                  {unassigned > 0
                    ? `${unassigned} ${si ? "identity අවශ්‍යයි" : "unassigned"}`
                    : si ? "සම්පූර්ණයි" : "Fully identified"}
                </StatusBadge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-950 p-4 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Aggregate stock</p>
                  <p className="mt-1 text-2xl font-semibold">{selected.stockQty}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Identity-covered</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{coverage}</p>
                </div>
                <div className={`rounded-xl p-4 ${unassigned > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${unassigned > 0 ? "text-amber-700" : "text-emerald-700"}`}>Still unassigned</p>
                  <p className={`mt-1 text-2xl font-semibold ${unassigned > 0 ? "text-amber-950" : "text-emerald-950"}`}>{unassigned}</p>
                </div>
              </div>
            </section>

            {!profile ? (
              <section className={card}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">
                      {si ? "Recommended tracking සක්‍රීය කරන්න" : "Enable recommended tracking"}
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                      {si ? preset.reasonSi : preset.reasonEn}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={primary}
                    disabled={!canWrite || saving}
                    title={!canWrite ? disabledHint ?? undefined : undefined}
                    onClick={() => void enableRecommendedTracking()}
                  >
                    {saving
                      ? si ? "සුරකිමින්…" : "Saving…"
                      : inventoryModeLabel(preset.defaultMode, locale)}
                  </button>
                </div>
              </section>
            ) : mode === "simple" ? (
              <section className={card}>
                <h3 className="text-base font-semibold text-slate-950">
                  {si
                    ? "මෙම භාණ්ඩයට identity assignment අවශ්‍ය නැත"
                    : "No identity assignment is required"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {si
                    ? "මෙය simple quantity tracking භාවිතා කරයි. GRN / Stock In quantity දැනටමත් POS සඳහා සූදානම්."
                    : "This product uses simple quantity tracking. Quantity received through GRN or Stock In is already ready for POS."}
                </p>
              </section>
            ) : unassigned <= 0 ? (
              <section className={card}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-emerald-950">
                      {si
                        ? "සියලුම on-hand stock හඳුනාගෙන ඇත"
                        : "All on-hand stock is identified"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {si
                        ? "තවත් identity එක් කිරීමට පෙර GRN, PO Receive හෝ Stock In කරන්න."
                        : "Receive more quantity through GRN, PO Receive or Stock In before adding another identity."}
                    </p>
                  </div>
                  <Link href="/suppliers" className={secondary}>Suppliers / GRN</Link>
                </div>
              </section>
            ) : mode === "variant" ? (
              <section className={card}>
                <h3 className="text-base font-semibold text-slate-950">
                  {si
                    ? "ලැබුණු තොගය size / colour variants වලට වෙන් කරන්න"
                    : "Assign received stock to size / colour variants"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {si
                    ? "Still-unassigned aggregate quantity එක පමණක් variants අතර වෙන් කළ හැක."
                    : "Only the still-unassigned aggregate quantity can be distributed across variants."}
                </p>

                {activeVariants.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">
                      {si ? "පළමුව variants සාදන්න." : "Create the product variants first."}
                    </p>
                    <Link
                      href="/stock/advanced"
                      className="mt-2 inline-block font-semibold text-teal-700 underline"
                    >
                      {si ? "Inventory control වෙත" : "Open Inventory control"}
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
                    <label className={label}>
                      Variant
                      <select
                        className={input}
                        value={variantId}
                        onChange={(event) => setVariantId(event.target.value)}
                      >
                        <option value="">{si ? "තෝරන්න" : "Select variant"}</option>
                        {activeVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.label} · {variant.stockQty} current
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={label}>
                      {si ? "වෙන් කරන quantity" : "Quantity to assign"}
                      <input
                        className={input}
                        type="number"
                        min="0.001"
                        step="0.001"
                        max={unassigned}
                        value={variantAssignQty}
                        onChange={(event) => setVariantAssignQty(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className={primary}
                      disabled={
                        !canWrite ||
                        saving ||
                        !variantId ||
                        Number(variantAssignQty) <= 0 ||
                        Number(variantAssignQty) > unassigned
                      }
                      title={!canWrite ? disabledHint ?? undefined : undefined}
                      onClick={() => void assignVariant()}
                    >
                      {si ? "වෙන් කරන්න" : "Assign stock"}
                    </button>
                  </div>
                )}
              </section>
            ) : isLotMode ? (
              <section className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">
                      {si ? "Batch / expiry identity එක් කරන්න" : "Add batch / expiry identity"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {si
                        ? "POS එක FEFO මගින් earliest valid expiry batch එක පළමුව නිකුත් කරයි."
                        : "POS uses FEFO and issues the earliest valid expiry batch first."}
                    </p>
                  </div>
                  <StatusBadge tone="warning">{unassigned} remaining</StatusBadge>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {mode === "variant_lot" && (
                    <label className={label}>
                      Variant
                      <select
                        className={input}
                        value={variantId}
                        onChange={(event) => setVariantId(event.target.value)}
                      >
                        <option value="">{si ? "තෝරන්න" : "Select variant"}</option>
                        {activeVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>{variant.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className={label}>
                    {si ? "Batch / lot අංකය" : "Batch / lot no."}
                    <input className={input} value={batchNo} onChange={(event) => setBatchNo(event.target.value)} />
                  </label>
                  <label className={label}>
                    Expiry date
                    <input className={input} type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
                  </label>
                  <label className={label}>
                    Quantity
                    <input className={input} type="number" min="0.001" step="0.001" max={unassigned} value={batchQty} onChange={(event) => setBatchQty(event.target.value)} />
                  </label>
                  <label className={label}>
                    Supplier
                    <select className={input} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                      <option value="">Optional</option>
                      {data.suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                  </label>
                  {canSeeFinancials && (
                    <label className={label}>
                      Internal unit cost (LKR)
                      <input className={input} type="number" min="0" value={lotCost} onChange={(event) => setLotCost(event.target.value)} />
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  className={`${primary} mt-4`}
                  disabled={
                    !canWrite ||
                    saving ||
                    !batchNo.trim() ||
                    Number(batchQty) <= 0 ||
                    Number(batchQty) > unassigned ||
                    (mode === "variant_lot" && !variantId)
                  }
                  title={!canWrite ? disabledHint ?? undefined : undefined}
                  onClick={() => void addBatch()}
                >
                  {saving ? (si ? "සුරකිමින්…" : "Saving…") : si ? "Batch identity එක් කරන්න" : "Add batch identity"}
                </button>
              </section>
            ) : isSerialMode ? (
              <section className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">
                      {si ? "IMEI / serial identity එක් කරන්න" : "Add IMEI / serial identity"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {si
                        ? "එක් physical device එකකට එක් identity වාර්තාවක්. POS sale එකේදී exact unit එක තෝරාගනී."
                        : "Add one record per physical device. POS requires the exact unit during checkout."}
                    </p>
                  </div>
                  <StatusBadge tone="warning">{unassigned} devices remaining</StatusBadge>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {mode === "variant_serial" && (
                    <label className={label}>
                      Variant
                      <select
                        className={input}
                        value={variantId}
                        onChange={(event) => setVariantId(event.target.value)}
                      >
                        <option value="">{si ? "තෝරන්න" : "Select variant"}</option>
                        {activeVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>{variant.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className={label}>IMEI<input className={input} value={imei} onChange={(event) => setImei(event.target.value)} /></label>
                  <label className={label}>Secondary IMEI<input className={input} value={secondaryImei} onChange={(event) => setSecondaryImei(event.target.value)} /></label>
                  <label className={label}>Serial number<input className={input} value={serialNo} onChange={(event) => setSerialNo(event.target.value)} /></label>
                  <label className={label}>Barcode<input className={input} value={barcode} onChange={(event) => setBarcode(event.target.value)} /></label>
                  <label className={label}>Warranty expiry<input className={input} type="date" value={warrantyExpiry} onChange={(event) => setWarrantyExpiry(event.target.value)} /></label>
                  <label className={label}>
                    Supplier
                    <select className={input} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                      <option value="">Optional</option>
                      {data.suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                  </label>
                  {canSeeFinancials && (
                    <label className={label}>Internal unit cost (LKR)<input className={input} type="number" min="0" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} /></label>
                  )}
                </div>

                <button
                  type="button"
                  className={`${primary} mt-4`}
                  disabled={
                    !canWrite ||
                    saving ||
                    unassigned < 1 ||
                    (!imei.trim() && !serialNo.trim() && !barcode.trim()) ||
                    (mode === "variant_serial" && !variantId)
                  }
                  title={!canWrite ? disabledHint ?? undefined : undefined}
                  onClick={() => void addSerializedUnit()}
                >
                  {saving ? (si ? "සුරකිමින්…" : "Saving…") : si ? "Device identity එක් කරන්න" : "Add device identity"}
                </button>
              </section>
            ) : null}
          </div>
        )}
      </ProMain>
    </AppShell>
  );
}
