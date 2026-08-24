"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [showReceive, setShowReceive] = useState(false);
  const [form, setForm] = useState<ReceiveForm>(() => emptyReceiveForm());
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

  async function receiveRoll(event: React.FormEvent) {
    event.preventDefault();
    if (!org.id || !canReceive) return;
    setSaving(true);
    setMessage(null);
    setError(null);
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
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage(result.warning ?? (si ? "Roll එක සාර්ථකව ලැබුණි." : "Physical roll received successfully."));
    setForm(emptyReceiveForm(form.productId));
    setShowReceive(false);
    await refresh();
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
            <button type="button" className={primary} onClick={() => setShowReceive((value) => !value)}>
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
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}
            {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

            {showReceive && (
              <Panel eyebrow="Physical receiving" title="Register one roll">
                <form onSubmit={receiveRoll} className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className={label}>Fabric product *<select required className={input} value={form.productId} onChange={(e) => setField("productId", e.target.value)}><option value="">Select fabric</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}</select></label>
                    <label className={label}>Roll number *<input required className={input} value={form.rollNo} onChange={(e) => setField("rollNo", e.target.value)} placeholder="RL-2026-001" /></label>
                    <label className={label}>Roll barcode<input className={input} value={form.barcode} onChange={(e) => setField("barcode", e.target.value)} /></label>
                    <label className={label}>Supplier<select className={input} value={form.supplierId} onChange={(e) => setField("supplierId", e.target.value)}><option value="">Not specified</option>{(data?.suppliers ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                    <label className={label}>Received length *<input required type="number" min="0.001" step="0.001" className={input} value={form.receivedLength} onChange={(e) => setField("receivedLength", e.target.value)} /></label>
                    <label className={label}>Length unit *<select className={input} value={form.lengthUnit} onChange={(e) => setField("lengthUnit", e.target.value as TextileLengthUnit)}><option value="metre">Metre</option><option value="yard">Yard</option></select></label>
                    <label className={label}>Width<input type="number" min="0" step="0.001" className={input} value={form.width} onChange={(e) => setField("width", e.target.value)} /></label>
                    <label className={label}>Width unit<select className={input} value={form.widthUnit} onChange={(e) => setField("widthUnit", e.target.value as ReceiveForm["widthUnit"])}><option value="inch">Inch</option><option value="centimetre">Centimetre</option></select></label>
                    <label className={label}>Dye lot<input className={input} value={form.dyeLot} onChange={(e) => setField("dyeLot", e.target.value)} /></label>
                    <label className={label}>Shade<input className={input} value={form.shade} onChange={(e) => setField("shade", e.target.value)} /></label>
                    <label className={label}>Supplier lot<input className={input} value={form.supplierLot} onChange={(e) => setField("supplierLot", e.target.value)} /></label>
                    <label className={label}>Rack / location<input className={input} value={form.rackLocation} onChange={(e) => setField("rackLocation", e.target.value)} placeholder="A-03-02" /></label>
                    <label className={label}>Damaged length<input type="number" min="0" step="0.001" className={input} value={form.damagedLength} onChange={(e) => setField("damagedLength", e.target.value)} /></label>
                    <label className={label}>Weight (kg)<input type="number" min="0" step="0.001" className={input} value={form.weightKg} onChange={(e) => setField("weightKg", e.target.value)} /></label>
                    <label className={label}>Grade<input className={input} value={form.grade} onChange={(e) => setField("grade", e.target.value)} placeholder="A / B / seconds" /></label>
                    <label className={label}>Received date<input type="date" className={input} value={form.receivedAt} onChange={(e) => setField("receivedAt", e.target.value)} /></label>
                    <label className={label}>GRN / PO / import reference<input className={input} value={form.sourceReference} onChange={(e) => setField("sourceReference", e.target.value)} /></label>
                    {canSeeFinancials && <label className={label}>Unit cost<input type="number" min="0" step="0.0001" className={input} value={form.unitCost} onChange={(e) => setField("unitCost", e.target.value)} /></label>}
                    {canSeeFinancials && <label className={label}>Landed unit cost<input type="number" min="0" step="0.0001" className={input} value={form.landedUnitCost} onChange={(e) => setField("landedUnitCost", e.target.value)} /></label>}
                    <label className={`${label} md:col-span-2`}>Notes<textarea className={`${input} min-h-24 resize-y`} value={form.notes} onChange={(e) => setField("notes", e.target.value)} /></label>
                  </div>
                  <div className="flex justify-end"><button type="submit" disabled={saving || !form.productId} className={primary}>{saving ? "Receiving…" : "Receive physical roll"}</button></div>
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
