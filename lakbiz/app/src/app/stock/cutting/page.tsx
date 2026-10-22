"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProBadge, ProButton, ProCard, ProEmptyState, ProLoadingState, ProMain, ProPageHeader, ProStatCard } from "@/components/ui/pro-shell";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { completeTextileCutTask, expireTextileReservations, fetchTextileCutTasks, fetchTextileReservations, releaseTextileReservation, reserveTextileRoll, type TextileCutTask, type TextileReservation } from "@/lib/supabase/textile-cutting-client";
import { fetchTextileRolls, type TextileRollRecord } from "@/lib/supabase/textile-roll-client";
import { validateCutCompletion } from "@/lib/textile-cutting-domain";

const label = "text-xs font-semibold text-slate-600";
const input = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50";

export default function TextileCuttingPage() {
  const { data, ready } = useAppStore();
  const { org } = useSubscription();
  const { canWrite } = useWriteAccess();
  const [rolls, setRolls] = useState<TextileRollRecord[]>([]);
  const [reservations, setReservations] = useState<TextileReservation[]>([]);
  const [tasks, setTasks] = useState<TextileCutTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [orderReference, setOrderReference] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [rollId, setRollId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => { const d = new Date(Date.now() + 48 * 3600_000); return d.toISOString().slice(0, 16); });
  const [allowException, setAllowException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const [cutTaskId, setCutTaskId] = useState<string | null>(null);
  const [waste, setWaste] = useState("0");
  const [wasteReason, setWasteReason] = useState("");
  const canOperate = canWrite && ["owner", "manager", "data_entry"].includes(org.role);
  const canApprove = org.role === "owner" || org.role === "manager";

  const productById = useMemo(() => new Map((data?.products ?? []).map((p) => [p.id, p])), [data?.products]);
  const selectedRoll = rolls.find((roll) => roll.id === rollId);
  const activeReservations = reservations.filter((row) => row.status === "active" && new Date(row.expiresAt) > new Date());
  const pendingTasks = tasks.filter((task) => task.status === "pending");

  async function refresh() {
    if (!org.id || org.sector !== "textile") { setLoading(false); return; }
    setLoading(true);
    await expireTextileReservations(org.id);
    const [rollResult, reservationResult, taskResult] = await Promise.all([fetchTextileRolls(org.id, false), fetchTextileReservations(org.id), fetchTextileCutTasks(org.id)]);
    setLoading(false);
    const problem = rollResult.error || reservationResult.error || taskResult.error;
    if (problem) setError(problem); else setError("");
    setRolls(rollResult.data); setReservations(reservationResult.data); setTasks(taskResult.data);
  }
  useEffect(() => {
    void refresh();
    // The refresh function intentionally follows only the active organization boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id, org.sector]);

  async function reserve(event: React.FormEvent) {
    event.preventDefault();
    if (!org.id || !canOperate || !rollId) return;
    setSaving(true); setError(""); setMessage("");
    const customer = data?.customers.find((row) => row.id === customerId);
    const result = await reserveTextileRoll({ organizationId: org.id, orderReference, customerId: customerId || undefined, customerName: customer?.name ?? customerName, rollId, quantity: Number(quantity), expiresAt: new Date(expiresAt).toISOString(), allowDyeLotException: canApprove && allowException, exceptionReason });
    setSaving(false);
    if (result.error) return setError(result.error);
    setMessage(`Reserved ${Number(quantity).toFixed(3)} ${selectedRoll?.lengthUnit ?? ""} from roll ${selectedRoll?.rollNo}.`);
    setOrderReference(""); setQuantity(""); setExceptionReason(""); setAllowException(false); await refresh();
  }

  async function release(row: TextileReservation) {
    const reason = window.prompt(`Reason for releasing order ${row.orderReference}:`);
    if (!reason?.trim()) return;
    setSaving(true); const result = await releaseTextileReservation(row.id, reason); setSaving(false);
    if (result.error) setError(result.error); else { setMessage("Reservation released with an audit record."); await refresh(); }
  }

  async function complete(task: TextileCutTask) {
    const validation = validateCutCompletion(task.plannedQuantity, task.plannedQuantity, Number(waste), wasteReason);
    if (validation) return setError(validation);
    setSaving(true); setError("");
    const result = await completeTextileCutTask(task.id, task.plannedQuantity, Number(waste), wasteReason);
    setSaving(false);
    if (result.error) return setError(result.error);
    setMessage(`Cut confirmed for sale ${task.saleId}. Roll and waste evidence are locked in the ledger.`);
    setCutTaskId(null); setWaste("0"); setWasteReason(""); await refresh();
  }

  if (!ready || loading) return <AppShell><ProMain><ProLoadingState label="Loading cutting desk…" /></ProMain></AppShell>;
  if (org.sector !== "textile") return <AppShell><ProMain><ProEmptyState title="Textile workspace only" description="Cutting and roll reservations are available only for Textile businesses." /></ProMain></AppShell>;

  return <AppShell><ProMain>
    <ProPageHeader eyebrow="Textile operations" title="Cutting & reservations" description="Reserve exact roll quantities before sale, prevent silent dye-lot mixing, and confirm every customer cut with waste and remnant evidence." actions={<><ProBadge tone="emerald">Roll-safe workflow</ProBadge><ProButton href="/stock/rolls" variant="secondary">Fabric rolls</ProButton></>} />
    <WriteDisabledHint className="mb-5" />
    {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}
    {message && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><ProStatCard label="Pending cuts" value={String(pendingTasks.length)} hint="Paid cuts awaiting desk confirmation" tone="teal" /><ProStatCard label="Active reservations" value={String(activeReservations.length)} hint="Excluded from freely available stock" tone="amber" /><ProStatCard label="Remnants" value={String(rolls.filter((r) => r.isRemnant).length)} hint="Short usable roll balances" tone="rose" /></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <ProCard eyebrow="Customer order" title="Reserve physical fabric">
        <form onSubmit={reserve} className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Order / quotation reference *<input required className={input} value={orderReference} onChange={(e) => setOrderReference(e.target.value)} placeholder="ORD-1048" /></label>
          <label className={label}>Customer<select className={input} value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Walk-in / typed name</option>{(data?.customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          {!customerId && <label className={label}>Customer name<input className={input} value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></label>}
          <label className={label}>Scan / select roll *<select required className={input} value={rollId} onChange={(e) => setRollId(e.target.value)}><option value="">Select available roll</option>{rolls.filter((r) => !["quarantined","returned","exhausted"].includes(r.status) && r.remainingLength-r.reservedLength>0).map((r) => <option key={r.id} value={r.id}>{r.rollNo} · {productById.get(r.productId)?.name ?? "Fabric"} · {r.dyeLot || "No dye lot"} · {(r.remainingLength-r.reservedLength).toFixed(3)} {r.lengthUnit}</option>)}</select></label>
          <label className={label}>Reserve quantity *<input required type="number" min="0.001" max={selectedRoll ? selectedRoll.remainingLength-selectedRoll.reservedLength : undefined} step="0.001" className={input} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          <label className={label}>Expires *<input required type="datetime-local" className={input} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label>
          {canApprove && <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2"><input type="checkbox" checked={allowException} onChange={(e) => setAllowException(e.target.checked)} />Approve a different dye lot / shade for this order</label>}
          {canApprove && allowException && <label className={`${label} sm:col-span-2`}>Mandatory exception reason<input required className={input} value={exceptionReason} onChange={(e) => setExceptionReason(e.target.value)} /></label>}
          <div className="sm:col-span-2"><button className={primary} disabled={!canOperate || saving || !rollId}>{saving ? "Saving…" : "Reserve roll quantity"}</button></div>
        </form>
      </ProCard>
      <ProCard eyebrow="Paid orders" title="Cutting queue">
        {pendingTasks.length === 0 ? <ProEmptyState size="compact" title="Cutting desk is clear" description="Measured sales appear here automatically after atomic checkout." /> : <div className="space-y-3">{pendingTasks.map((task) => <article key={task.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">Roll {task.rollNo} · {productById.get(task.productId)?.name ?? "Fabric"}</p><p className="mt-1 text-xs text-slate-500">Sale {task.saleId}</p></div><div className="text-right"><p className="text-lg font-bold tabular-nums text-slate-950">{task.plannedQuantity.toFixed(3)} {task.lengthUnit}</p><button className={`${secondary} mt-2`} onClick={() => setCutTaskId(cutTaskId === task.id ? null : task.id)}>Confirm cut</button></div></div>{cutTaskId === task.id && <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-end"><label className={label}>Waste / damage<input type="number" min="0" step="0.001" className={input} value={waste} onChange={(e) => setWaste(e.target.value)} /></label><label className={label}>Waste reason<input required={Number(waste)>0} className={input} value={wasteReason} onChange={(e) => setWasteReason(e.target.value)} placeholder="Selvedge defect / damaged edge…" /></label><button className={primary} disabled={!canOperate || saving} onClick={() => void complete(task)}>Complete</button></div>}</article>)}</div>}
      </ProCard>
    </div>
    <div className="mt-5"><ProCard eyebrow="Allocation control" title="Active reservations">{activeReservations.length === 0 ? <ProEmptyState size="compact" title="No active reservations" description="Reserved fabric will remain unavailable to normal POS sales until consumed, released or expired." /> : <div className="divide-y divide-slate-100">{activeReservations.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-slate-900">{row.orderReference} · {productById.get(row.productId)?.name ?? "Fabric"}</p><p className="mt-1 text-xs text-slate-500">{row.quantity.toFixed(3)} {row.lengthUnit} · Dye {row.dyeLot || "unrecorded"} · Shade {row.shade || "unrecorded"} · expires {new Date(row.expiresAt).toLocaleString()}</p></div><button className={secondary} disabled={!canOperate || saving} onClick={() => void release(row)}>Release</button></div>)}</div>}</ProCard></div>
  </ProMain></AppShell>;
}
