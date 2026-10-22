"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui/primitives";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  adjustTextileRollMeasurement,
  createTextileRoll,
  fetchTextileRollMovements,
  fetchTextileRolls,
  type TextileRollMovement,
  type TextileRollRecord,
} from "@/lib/supabase/textile-roll-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { summarizeTextileRollBalances, validateTextileMeasurementAdjustment } from "@/lib/textile-roll-domain";
import type { TextileLengthUnit } from "@/lib/types";

const label = "text-xs font-semibold text-slate-600";
const input = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50";
let rollReceiveRequestInFlight = false;

function isMissingSchema(error: string | null): boolean {
  const value = error?.toLowerCase() ?? "";
  return value.includes("textile_rolls") && (value.includes("schema cache") || value.includes("does not exist") || value.includes("could not find"));
}

function statusTone(status: TextileRollRecord["status"]): "positive" | "warning" | "danger" | "neutral" {
  if (status === "unopened" || status === "opened") return "positive";
  if (status === "reserved") return "warning";
  if (status === "quarantined" || status === "returned") return "danger";
  return "neutral";
}

type ReceiveForm = {
  productId: string;
  supplierId: string;
  rollNo: string;
  barcode: string;
  supplierLot: string;
  dyeLot: string;
  shade: string;
  width: string;
  widthUnit: "inch" | "centimetre";
  lengthUnit: TextileLengthUnit;
  receivedLength: string;
  damagedLength: string;
  weightKg: string;
  grade: string;
  rackLocation: string;
  sourceReference: string;
  receivedAt: string;
  notes: string;
  unitCost: string;
  landedUnitCost: string;
};

type ReceiveStep = 1 | 2 | 3 | 4 | 5;

const receiveSteps: { id: ReceiveStep; title: string; description: string }[] = [
  { id: 1, title: "Fabric & supplier", description: "Choose what arrived." },
  { id: 2, title: "Roll identity", description: "Record the roll and exact measure." },
  { id: 3, title: "Quality & location", description: "Keep dye lots and custody clear." },
  { id: 4, title: "Purchase details", description: "Add the source and owner-only cost." },
  { id: 5, title: "Review & receive", description: "Check the record before saving." },
];

function emptyReceiveForm(productId = ""): ReceiveForm {
  return {
    productId,
    supplierId: "",
    rollNo: "",
    barcode: "",
    supplierLot: "",
    dyeLot: "",
    shade: "",
    width: "",
    widthUnit: "inch",
    lengthUnit: "metre",
    receivedLength: "",
    damagedLength: "0",
    weightKg: "",
    grade: "",
    rackLocation: "",
    sourceReference: "",
    receivedAt: new Date().toISOString().slice(0, 10),
    notes: "",
    unitCost: "",
    landedUnitCost: "",
  };
}

export default function TextileRollsPage() {
  const { data, ready } = useAppStore();
  const { org, canSeeFinancials } = useSubscription();
  const { locale } = useLocale();
  const si = locale === "si";
  const [rolls, setRolls] = useState<TextileRollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schemaPending, setSchemaPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // "Receive roll" from Business Pulse links here with ?receive=1 so that
  // CTA actually opens the form instead of just landing on the list.
  const searchParams = useSearchParams();
  const [showReceive, setShowReceive] = useState(() => searchParams.get("receive") === "1");
  const [form, setForm] = useState<ReceiveForm>(() => emptyReceiveForm());
  const [receiveStep, setReceiveStep] = useState<ReceiveStep>(1);
  const [showMoreReceiveDetails, setShowMoreReceiveDetails] = useState(false);
  const rollNumberRef = useRef<HTMLInputElement>(null);
  const receiveLock = useRef(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustLength, setAdjustLength] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [movements, setMovements] = useState<TextileRollMovement[]>([]);

  const products = useMemo(
    () => (data?.products ?? []).filter((product) => product.active && product.sectorId === "textile"),
    [data?.products],
  );
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const supplierById = useMemo(() => new Map((data?.suppliers ?? []).map((supplier) => [supplier.id, supplier])), [data?.suppliers]);
  const canReceive = ["owner", "manager", "data_entry"].includes(org.role);
  const canAdjust = org.role === "owner" || org.role === "manager";

  async function refresh() {
    if (!org.id || org.sector !== "textile") {
      setRolls([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await fetchTextileRolls(org.id, canSeeFinancials);
    setLoading(false);
    if (isMissingSchema(result.error)) {
      setSchemaPending(true);
      return;
    }
    setSchemaPending(false);
    setError(result.error);
    setRolls(result.data);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id, org.sector, canSeeFinancials]);

  useEffect(() => {
    if (!form.productId && products[0]) {
      setForm((current) => ({ ...current, productId: products[0].id }));
    }
  }, [form.productId, products]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rolls;
    return rolls.filter((roll) => {
      const product = productById.get(roll.productId);
      return [roll.rollNo, roll.barcode, roll.dyeLot, roll.shade, roll.rackLocation, product?.name]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [query, rolls, productById]);

  const summary = summarizeTextileRollBalances(rolls);

  function setField<K extends keyof ReceiveForm>(key: K, value: ReceiveForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function receiveValidationError(step: ReceiveStep): string | null {
    if (step >= 1 && !form.productId) return "Choose the fabric that this physical roll belongs to.";
    if (step >= 2 && !form.rollNo.trim()) return "Enter the supplier roll number or your unique roll ID.";
    const length = Number(form.receivedLength);
    if (step >= 2 && (!Number.isFinite(length) || length <= 0)) return "Enter a received length greater than zero.";
    const damaged = Number(form.damagedLength || 0);
    if (step >= 3 && (!Number.isFinite(damaged) || damaged < 0 || damaged >= length)) return "Damaged length must be zero or less than the received length.";
    return null;
  }

  function openReceiving() {
    setError(null);
    setMessage(null);
    setReceiveStep(1);
    setShowMoreReceiveDetails(false);
    setShowReceive(true);
  }

  function closeReceiving() {
    setShowReceive(false);
    setError(null);
  }

  function moveReceiveStep(direction: "next" | "back") {
    const next = (receiveStep + (direction === "next" ? 1 : -1)) as ReceiveStep;
    if (direction === "next") {
      const validationError = receiveValidationError(receiveStep);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setError(null);
    setReceiveStep(next);
    if (next === 2) window.setTimeout(() => rollNumberRef.current?.focus(), 0);
  }

  async function receiveRoll() {
    if (!org.id || !canReceive || receiveLock.current || rollReceiveRequestInFlight) return;
    const validationError = receiveValidationError(5);
    if (validationError) {
      setError(validationError);
      return;
    }
    receiveLock.current = true;
    rollReceiveRequestInFlight = true;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const result = await createTextileRoll(
        org.id,
        {
          productId: form.productId,
          supplierId: form.supplierId || null,
          rollNo: form.rollNo,
          barcode: form.barcode,
          supplierLot: form.supplierLot,
          dyeLot: form.dyeLot,
          shade: form.shade,
          width: form.width === "" ? null : Number(form.width),
          widthUnit: form.widthUnit,
          lengthUnit: form.lengthUnit,
          receivedLength: Number(form.receivedLength),
          damagedLength: Number(form.damagedLength || 0),
          weightKg: form.weightKg === "" ? null : Number(form.weightKg),
          grade: form.grade,
          rackLocation: form.rackLocation,
          sourceReference: form.sourceReference,
          receivedAt: form.receivedAt,
          notes: form.notes,
          unitCost: canSeeFinancials && form.unitCost !== "" ? Number(form.unitCost) : undefined,
          landedUnitCost: canSeeFinancials && form.landedUnitCost !== "" ? Number(form.landedUnitCost) : null,
        },
        canSeeFinancials,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.warning ?? (si ? "Roll එක සාර්ථකව ලැබුණි." : "Physical roll received successfully."));
      setForm(emptyReceiveForm(form.productId));
      setReceiveStep(1);
      setShowMoreReceiveDetails(false);
      setShowReceive(false);
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not receive this roll. Your draft is still available to retry.");
    } finally {
      receiveLock.current = false;
      rollReceiveRequestInFlight = false;
      setSaving(false);
    }
  }

  async function saveAdjustment() {
    if (!adjustingId || !canAdjust || adjustLength === "" || !adjustReason.trim()) return;
    const roll = rolls.find((item) => item.id === adjustingId);
    if (!roll) return;
    const validationError = validateTextileMeasurementAdjustment({
      receivedLength: roll.receivedLength,
      damagedLength: roll.damagedLength,
      reservedLength: roll.reservedLength,
      newRemainingLength: Number(adjustLength),
      reason: adjustReason,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await adjustTextileRollMeasurement(adjustingId, Number(adjustLength), adjustReason);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage(si ? "මිනුම් වෙනස audit වාර්තාව සමඟ සුරකින ලදී." : "Measurement adjustment saved with an audit record.");
    setAdjustingId(null);
    setAdjustLength("");
    setAdjustReason("");
    await refresh();
  }

  async function toggleHistory(rollId: string) {
    if (historyId === rollId) {
      setHistoryId(null);
      setMovements([]);
      return;
    }
    setHistoryId(rollId);
    const result = await fetchTextileRollMovements(rollId);
    setError(result.error);
    setMovements(result.data);
  }

  if (!ready) return <AppShell><ProMain><ProLoadingState label="Loading fabric rolls…" /></ProMain></AppShell>;

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={si ? "රෙදි roll තොගය" : "Fabric rolls"}
          description={si ? "එක් එක් භෞතික roll එකේ dye lot, shade, මිනුම් ශේෂය සහ ස්ථානය පාලනය කරන්න." : "Control every physical roll by dye lot, shade, measured balance and warehouse location."}
          actions={org.sector === "textile" && canReceive ? (
            <button type="button" className={primary} onClick={showReceive ? closeReceiving : openReceiving}>
              {showReceive ? (si ? "වසන්න" : "Close receiving") : (si ? "+ Roll ලබාගන්න" : "+ Receive roll")}
            </button>
          ) : null}
          metrics={org.sector === "textile" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Active rolls" value={String(summary.activeRolls)} hint="Physical sellable identities" />
              <MetricCard label="Metre balance" value={summary.metreBalance.toFixed(3)} hint="No conversion mixed in" />
              <MetricCard label="Yard balance" value={summary.yardBalance.toFixed(3)} hint="No conversion mixed in" />
              <MetricCard label="Quarantined" value={String(summary.quarantinedRolls)} hint="Blocked from normal sale" tone={summary.quarantinedRolls ? "danger" : "positive"} />
            </div>
          ) : undefined}
        />

        {org.sector !== "textile" ? (
          <EmptyState title="Textile workspace only" description="Fabric-roll control is available only to businesses provisioned as Textile Wholesale & Retail." />
        ) : schemaPending ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">The Textile Phase 2 database migration is not applied yet.</p>
            <p className="mt-2 leading-6 text-amber-800">Apply the pending migration before receiving physical rolls.</p>
          </div>
        ) : loading ? (
          <ProLoadingState label={si ? "Roll තොගය පූරණය වෙමින්…" : "Loading physical roll stock…"} />
        ) : (
          <div className="space-y-5">
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}
            {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

            {showReceive && (
              <Panel eyebrow="Guided physical receiving" title="Receive one fabric roll">
                <p className="max-w-2xl text-sm leading-6 text-slate-600">Capture the roll in the same order it arrives at the counter. Required information is kept short; the rest stays available when you need it.</p>
                <ol aria-label="Receiving progress" className="mt-5 grid gap-2 sm:grid-cols-5">
                  {receiveSteps.map((step) => {
                    const active = step.id === receiveStep;
                    const complete = step.id < receiveStep;
                    return <li key={step.id}>
                      <button type="button" disabled={step.id > receiveStep} onClick={() => { setError(null); setReceiveStep(step.id); }} aria-current={active ? "step" : undefined} className={`min-h-16 w-full rounded-xl border px-3 py-2 text-left transition ${active ? "border-teal-500 bg-teal-50 text-teal-950" : complete ? "border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-emerald-300" : "border-slate-200 bg-slate-50 text-slate-400"} disabled:cursor-not-allowed`}>
                        <span className="flex items-center gap-2 text-xs font-bold"><span className={`inline-flex size-5 items-center justify-center rounded-full ${active ? "bg-teal-600 text-white" : complete ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>{complete ? "✓" : step.id}</span>{step.title}</span>
                        <span className="mt-1 block text-[11px] leading-4 opacity-75">{step.description}</span>
                      </button>
                    </li>;
                  })}
                </ol>

                <form onSubmit={(event) => event.preventDefault()} className="mt-6">
                  {receiveStep === 1 && <section aria-labelledby="receive-step-1" className="space-y-4"><div><h3 id="receive-step-1" className="text-base font-bold text-slate-950">1. Fabric and supplier</h3><p className="mt-1 text-sm text-slate-500">Choose the fabric first. The supplier is optional, but useful for later purchasing history.</p></div><div className="grid gap-4 md:grid-cols-2"><label className={label}>Fabric product *<select required className={input} value={form.productId} onChange={(e) => setField("productId", e.target.value)}><option value="">Select fabric</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}</select></label><label className={label}>Supplier<select className={input} value={form.supplierId} onChange={(e) => setField("supplierId", e.target.value)}><option value="">Not specified</option>{(data?.suppliers ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label></div></section>}

                  {receiveStep === 2 && <section aria-labelledby="receive-step-2" className="space-y-4"><div><h3 id="receive-step-2" className="text-base font-bold text-slate-950">2. Roll identity and measurement</h3><p className="mt-1 text-sm text-slate-500">The roll number and measured unit create its permanent physical identity. Metres and yards stay separate.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className={label}>Roll number *<input ref={rollNumberRef} required autoComplete="off" className={input} value={form.rollNo} onChange={(e) => setField("rollNo", e.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); moveReceiveStep("next"); } }} placeholder="RL-2026-001" /></label><label className={label}>Scan or enter barcode<input autoComplete="off" className={input} value={form.barcode} onChange={(e) => setField("barcode", e.target.value)} placeholder="Optional barcode" /></label><label className={label}>Received length *<input required type="number" min="0.001" step="0.001" inputMode="decimal" className={input} value={form.receivedLength} onChange={(e) => setField("receivedLength", e.target.value)} /></label><label className={label}>Length unit *<select className={input} value={form.lengthUnit} onChange={(e) => setField("lengthUnit", e.target.value as TextileLengthUnit)}><option value="metre">Metre</option><option value="yard">Yard</option></select></label><label className={label}>Width<input type="number" min="0" step="0.001" inputMode="decimal" className={input} value={form.width} onChange={(e) => setField("width", e.target.value)} /></label><label className={label}>Width unit<select className={input} value={form.widthUnit} onChange={(e) => setField("widthUnit", e.target.value as ReceiveForm["widthUnit"])}><option value="inch">Inch</option><option value="centimetre">Centimetre</option></select></label></div></section>}

                  {receiveStep === 3 && <section aria-labelledby="receive-step-3" className="space-y-4"><div><h3 id="receive-step-3" className="text-base font-bold text-slate-950">3. Quality and warehouse location</h3><p className="mt-1 text-sm text-slate-500">Record the dye lot and rack now so staff never mix a shade or lose the roll’s custody trail.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className={label}>Dye lot<input className={input} value={form.dyeLot} onChange={(e) => setField("dyeLot", e.target.value)} placeholder="DL-24-09" /></label><label className={label}>Shade<input className={input} value={form.shade} onChange={(e) => setField("shade", e.target.value)} placeholder="Royal blue" /></label><label className={label}>Rack / location<input className={input} value={form.rackLocation} onChange={(e) => setField("rackLocation", e.target.value)} placeholder="A-03-02" /></label><label className={label}>Condition / grade<input className={input} value={form.grade} onChange={(e) => setField("grade", e.target.value)} placeholder="A / B / seconds" /></label><label className={label}>Damaged length<input type="number" min="0" step="0.001" inputMode="decimal" className={input} value={form.damagedLength} onChange={(e) => setField("damagedLength", e.target.value)} /></label></div><button type="button" className="text-sm font-semibold text-teal-800 underline decoration-teal-300 underline-offset-4" aria-expanded={showMoreReceiveDetails} onClick={() => setShowMoreReceiveDetails((value) => !value)}>{showMoreReceiveDetails ? "Hide optional details" : "More details"}</button>{showMoreReceiveDetails && <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-3"><label className={label}>Supplier lot<input className={input} value={form.supplierLot} onChange={(e) => setField("supplierLot", e.target.value)} /></label><label className={label}>Weight (kg)<input type="number" min="0" step="0.001" inputMode="decimal" className={input} value={form.weightKg} onChange={(e) => setField("weightKg", e.target.value)} /></label><label className={`${label} xl:col-span-3`}>Receiving notes<textarea className={`${input} min-h-24 resize-y`} value={form.notes} onChange={(e) => setField("notes", e.target.value)} /></label></div>}</section>}

                  {receiveStep === 4 && <section aria-labelledby="receive-step-4" className="space-y-4"><div><h3 id="receive-step-4" className="text-base font-bold text-slate-950">4. Purchase and import details</h3><p className="mt-1 text-sm text-slate-500">Link the roll to the paperwork you have. Unknown cost stays unknown; it is never silently stored as zero.</p></div><div className="grid gap-4 md:grid-cols-2"><label className={label}>Received date<input type="date" className={input} value={form.receivedAt} onChange={(e) => setField("receivedAt", e.target.value)} /></label><label className={label}>GRN / PO / import reference<input className={input} value={form.sourceReference} onChange={(e) => setField("sourceReference", e.target.value)} placeholder="GRN-245 / shipment reference" /></label></div>{canSeeFinancials ? <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="font-semibold text-teal-950">Owner-only cost</h4><p className="text-xs text-teal-800">Leave blank when the supplier cost is not known.</p></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className={label}>Unit cost<input type="number" min="0" step="0.0001" inputMode="decimal" className={input} value={form.unitCost} onChange={(e) => setField("unitCost", e.target.value)} /></label><label className={label}>Landed unit cost<input type="number" min="0" step="0.0001" inputMode="decimal" className={input} value={form.landedUnitCost} onChange={(e) => setField("landedUnitCost", e.target.value)} /></label></div></div> : <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Cost is protected owner-only information. An owner can record it later without changing this roll’s identity or quantity.</div>}</section>}

                  {receiveStep === 5 && <section aria-labelledby="receive-step-5" className="space-y-4"><div><h3 id="receive-step-5" className="text-base font-bold text-slate-950">5. Review before receiving</h3><p className="mt-1 text-sm text-slate-500">This creates one immutable roll identity. Check the unit, length, dye information and location before saving.</p></div><div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fabric</p><p className="mt-1 text-sm font-semibold text-slate-950">{productById.get(form.productId)?.name ?? "Not selected"}</p><p className="mt-1 text-xs text-slate-500">{form.supplierId ? supplierById.get(form.supplierId)?.name ?? "Supplier" : "No supplier recorded"}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Identity</p><p className="mt-1 text-sm font-semibold text-slate-950">{form.rollNo || "Missing roll number"}</p><p className="mt-1 text-xs text-slate-500">{form.barcode || "No barcode recorded"}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Measured stock</p><p className="mt-1 text-sm font-semibold text-slate-950">{form.receivedLength || "0"} {form.lengthUnit === "metre" ? "metres" : "yards"}</p><p className="mt-1 text-xs text-slate-500">Damaged: {form.damagedLength || "0"}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Custody</p><p className="mt-1 text-sm font-semibold text-slate-950">{form.rackLocation || "No rack recorded"}</p><p className="mt-1 text-xs text-slate-500">{[form.dyeLot && `Dye ${form.dyeLot}`, form.shade && form.shade].filter(Boolean).join(" · ") || "No dye details recorded"}</p></div></div>{canSeeFinancials && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{form.unitCost === "" ? "Cost will remain unknown until an owner records it." : `Unit cost is recorded as LKR ${form.unitCost} per ${form.lengthUnit}.`}</p>}<p className="text-sm text-slate-500">If the save fails, this completed form stays here so you can correct the issue or retry without re-entering the roll.</p></section>}

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><div>{receiveStep > 1 && <button type="button" className={secondary} disabled={saving} onClick={() => moveReceiveStep("back")}>Back</button>}</div>{receiveStep < 5 ? <button type="button" className={primary} onClick={() => moveReceiveStep("next")}>Continue</button> : <button type="button" disabled={saving || !form.productId} className={primary} onClick={() => void receiveRoll()}>{saving ? "Receiving…" : "Receive physical roll"}</button>}</div>
                </form>
              </Panel>
            )}

            <Panel
              eyebrow="Roll ledger"
              title="Physical stock"
              action={<input aria-label="Search rolls" className="h-10 w-56 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-400" placeholder="Roll, barcode, dye lot…" value={query} onChange={(e) => setQuery(e.target.value)} />}
            >
              {products.length === 0 ? (
                <EmptyState title="Add a fabric product first" description="A physical roll must belong to an existing Textile catalogue product." />
              ) : filtered.length === 0 ? (
                <EmptyState title="No rolls found" description={query ? "No physical roll matches this search." : "Receive the first fabric roll to establish roll-level stock."} />
              ) : (
                <div className="space-y-3">
                  {filtered.map((roll) => {
                    const product = productById.get(roll.productId);
                    const isAdjusting = adjustingId === roll.id;
                    const showingHistory = historyId === roll.id;
                    return (
                      <article key={roll.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(110px,.55fr))_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{product?.name ?? "Unknown fabric"}</h3><StatusBadge tone={statusTone(roll.status)}>{roll.status}</StatusBadge></div>
                            <p className="mt-1 text-sm font-medium text-slate-600">Roll {roll.rollNo}{roll.barcode ? ` · ${roll.barcode}` : ""}</p>
                            <p className="mt-1 text-xs text-slate-500">{[roll.dyeLot && `Dye ${roll.dyeLot}`, roll.shade && `Shade ${roll.shade}`, roll.rackLocation && `Rack ${roll.rackLocation}`].filter(Boolean).join(" · ") || "No dye lot or location recorded"}</p>
                          </div>
                          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remaining</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{roll.remainingLength.toFixed(3)} <span className="text-xs text-slate-500">{roll.lengthUnit === "metre" ? "m" : "yd"}</span></p></div>
                          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Received</p><p className="mt-1 text-sm font-semibold text-slate-800">{roll.receivedLength.toFixed(3)} {roll.lengthUnit === "metre" ? "m" : "yd"}</p></div>
                          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Width / supplier</p><p className="mt-1 text-sm font-semibold text-slate-800">{roll.width == null ? "—" : `${roll.width} ${roll.widthUnit === "inch" ? "in" : "cm"}`}</p><p className="mt-0.5 text-xs text-slate-500">{roll.supplierId ? supplierById.get(roll.supplierId)?.name ?? "Supplier" : "No supplier"}</p></div>
                          <div className="flex flex-wrap gap-2 lg:justify-end"><button className={secondary} type="button" onClick={() => void toggleHistory(roll.id)}>History</button>{canAdjust && <button className={secondary} type="button" onClick={() => { setAdjustingId(isAdjusting ? null : roll.id); setAdjustLength(String(roll.remainingLength)); setAdjustReason(""); }}>Measure</button>}</div>
                        </div>
                        {canSeeFinancials && roll.unitCost != null && <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">Owner cost: LKR {roll.unitCost.toFixed(4)} / {roll.lengthUnit}{roll.landedUnitCost != null ? ` · Landed LKR ${roll.landedUnitCost.toFixed(4)}` : ""}</p>}
                        {isAdjusting && <div className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end"><label className={label}>Actual usable remaining<input type="number" min={roll.reservedLength} max={roll.receivedLength - roll.damagedLength} step="0.001" className={input} value={adjustLength} onChange={(e) => setAdjustLength(e.target.value)} /></label><label className={label}>Mandatory reason<input className={input} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Physical recount / supplier short roll…" /></label><button type="button" className={primary} disabled={saving || !adjustReason.trim()} onClick={() => void saveAdjustment()}>Save adjustment</button></div>}
                        {showingHistory && <div className="mt-4 rounded-xl bg-slate-50 p-4"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Audit movements</h4>{movements.length === 0 ? <p className="mt-2 text-sm text-slate-500">No movements found.</p> : <div className="mt-2 divide-y divide-slate-200">{movements.map((movement) => <div key={movement.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="font-medium text-slate-800">{movement.movementType.replaceAll("_", " ")} · {movement.reason ?? "No reason"}</span><span className="font-mono text-xs text-slate-600">{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta.toFixed(3)} → {movement.balanceAfter.toFixed(3)}</span></div>)}</div>}</div>}
                      </article>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        )}
      </ProMain>
    </AppShell>
  );
}
