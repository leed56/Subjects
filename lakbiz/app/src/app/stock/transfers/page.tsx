"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProPageHeader } from "@/components/ui/pro-shell";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import { validateInventoryTransfer } from "@/lib/inventory-transfer";
import { createStockLocation, inspectInventoryProduct, inventoryOperation, loadInventoryLocations, type InventoryLocationSnapshot, type ReconciliationRow } from "@/lib/supabase/inventory-location-client";

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const field = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50";
const button = "min-h-11 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50";

export default function InventoryTransfersPage() {
  const { org, orgRole, isReadOnly, can } = useSubscription();
  const { data } = useAppStore();
  const [snapshotState, setSnapshot] = useState<InventoryLocationSnapshot | null>(null);
  const snapshot = snapshotState?.organizationId === org.id ? snapshotState : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState("");
  const [destination, setDestination] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [locationName, setLocationName] = useState("");
  const [productId, setProductId] = useState("");
  const [report, setReport] = useState<ReconciliationRow[] | null>(null);
  const [page, setPage] = useState(0);
  const lock = useRef(false);
  const generation = useRef({ value: 0 });
  const authorized = ["owner","manager","data_entry"].includes(orgRole);
  const writable = authorized && !isReadOnly && can("write") && Boolean(org.id && org.isAuthenticated);
  const balance = snapshot?.balances.find(row => `b:${row.id}` === identity);
  const unit = snapshot?.units.find(row => `u:${row.id}` === identity);
  const origin = balance?.location_id ?? unit?.location_id ?? "";
  const productName = (id: string) => data?.products.find(p => p.id === id)?.name ?? id;
  const locationLabel = (id: string) => snapshot?.locations.find(row => row.id === id)?.name ?? id;

  const refresh = useCallback(async () => {
    const request = ++generation.current.value;
    if (!org.id || !org.isAuthenticated || !authorized) { setSnapshot(null); setLoading(false); return; }
    setLoading(true);
    try { const next = await loadInventoryLocations(org.id); if (request === generation.current.value) { setSnapshot(next); setError(""); } }
    catch (failure) { if (request === generation.current.value) { setSnapshot(null); setError(failure instanceof Error ? failure.message : "Inventory could not be loaded."); } }
    finally { if (request === generation.current.value) setLoading(false); }
  }, [org.id, org.isAuthenticated, authorized]);
  useEffect(() => { const requests = generation.current; setIdentity(""); setDestination(""); setReport(null); setProductId(""); setMessage(""); setReason(""); setPage(0); void refresh(); return () => { requests.value++; }; }, [refresh]);

  async function run(operation: () => Promise<void>, success: string, mutation = true) {
    if (lock.current || (mutation && !writable)) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await operation(); setMessage(success); if (mutation) { setReport(null); await refresh(); } }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The operation failed. Your input has been kept for retry."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function createDraft() {
    if (!org.id || (!balance && !unit)) throw new Error("Choose a stock identity first.");
    const line = { productId: balance?.product_id ?? unit!.product_id, variantId: balance?.variant_id ?? unit?.variant_id, lotId: balance?.lot_id ?? unit?.lot_id, unitId: unit?.id, qty: unit ? 1 : Number(qty) };
    const problem = validateInventoryTransfer({ fromLocationId: origin, toLocationId: destination, lines: [line] });
    if (problem) throw new Error(problem);
    await inventoryOperation("create_inventory_transfer_draft", { p_organization_id: org.id, p_transfer_id: crypto.randomUUID(), p_from_location_id: origin, p_to_location_id: destination, p_lines: [{ product_id: line.productId, variant_id: line.variantId, lot_id: line.lotId, unit_id: line.unitId, qty: line.qty }], p_note: reason });
  }
  const missingSchema = /schema cache|does not exist|could not find/i.test(error);
  return <AppShell><ProMain>
    <ProPageHeader eyebrow="Inventory custody" title="Locations & transfers" description="Track physical stock, protect holds and receive transfers against exact identities." actions={<Link className={secondary} href="/stock">Back to stock</Link>} />
    {!authorized ? <section className={card}><h2 className="font-bold">Stock operator access required</h2><p className="mt-2 text-sm text-slate-600">An owner, manager or data-entry role can open this workspace.</p></section> : <>
      {error && <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p className="font-bold">{missingSchema ? "Inventory upgrade required" : "Inventory operation could not finish"}</p><p className="mt-1 break-words">{missingSchema ? "The location and transfer database upgrade has not been installed. Your existing stock screens remain available." : error}</p><button className={`${secondary} mt-3`} disabled={busy || loading} onClick={() => void refresh()}>Retry loading</button></div>}
      {message && <p role="status" className="mb-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{message}</p>}
      {loading && <p role="status" className={`${card} mb-5`}>Loading inventory custody…</p>}
      {!org.id && !loading && <p className={card}>Connect an authenticated organization to review physical stock.</p>}
      {snapshot && <>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">{[["Locations",snapshot.locations.length],["Open transfers",snapshot.transfers.filter(t => !["received","cancelled"].includes(t.status)).length],["Active holds",snapshot.reservations.filter(r => r.status === "active").length]].map(([label,value]) => <section key={String(label)} className={card}><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></section>)}</div>
        {!snapshot.enabled && <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Stock movement is awaiting rollout certification. Locations and transfer drafts can be prepared; dispatch and new holds remain unavailable.</p>}
        {!writable && <p className="mb-5 text-sm text-amber-900">This organization is read-only. Stock changes are unavailable.</p>}
        {orgRole === "owner" && !snapshot.enabled && <section className={`${card} mb-5`}><h2 className="font-bold">Opening custody review</h2><p className="mt-2 text-sm text-slate-600">After checking the physical stock, assign missing opening identities to the main location. Existing balances and branch quantities are preserved. Inspect each product afterward to resolve any remaining differences.</p><label className="mt-3 block text-sm font-semibold">Verified opening-stock reason<input className={field} value={reason} disabled={busy || !writable} onChange={event=>setReason(event.target.value)} /></label><button className={`${secondary} mt-3`} disabled={busy || !writable} onClick={()=>void run(()=>inventoryOperation("initialize_inventory_opening_custody",{p_organization_id:org.id,p_reason:reason}),"Missing opening custody prepared. Inspect product differences before activation.")}>Prepare missing opening custody</button></section>}
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <section className={card}><h2 className="text-lg font-bold">Move or reserve stock</h2><fieldset disabled={busy || !writable} className="mt-4 space-y-4">
            <label className="block text-sm font-semibold">Source stock<select className={field} value={identity} onChange={e => {setIdentity(e.target.value);setQty("1");}}><option value="">Choose stock at a location</option>{snapshot.balances.map(row => <option key={row.id} value={`b:${row.id}`}>{productName(row.product_id)} · {locationLabel(row.location_id)} · {Number(row.qty_on_hand)-Number(row.qty_reserved)} available{row.lot_id ? ` · lot ${row.lot_id.slice(0,8)}` : row.variant_id ? ` · variant ${row.variant_id.slice(0,8)}` : ""}</option>)}{snapshot.units.filter(row => row.status === "available" && row.custody_status === "available" && row.location_id).map(row => <option key={row.id} value={`u:${row.id}`}>{productName(row.product_id)} · {row.serial_no ?? row.imei ?? row.id} · {locationLabel(row.location_id!)}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Quantity<input className={field} type="number" min="0.001" step="0.001" disabled={Boolean(unit)} value={unit ? "1" : qty} onChange={e => setQty(e.target.value)} /></label><label className="block text-sm font-semibold">Destination<select className={field} value={destination} onChange={e => setDestination(e.target.value)}><option value="">Choose a destination</option>{snapshot.locations.filter(row => row.active && row.id !== origin).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div>
            <label className="block text-sm font-semibold">Reason / notes<input className={field} value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></label>
            <div className="flex flex-wrap gap-2"><button className={button} onClick={() => void run(createDraft,"Transfer draft created. Review the route before dispatch.")}>Create transfer draft</button><button className={secondary} disabled={!snapshot.enabled} onClick={() => void run(async () => { if (!balance && !unit) throw new Error("Choose stock to reserve."); await inventoryOperation("reserve_inventory_stock",{p_organization_id:org.id,p_reservation_id:crypto.randomUUID(),p_qty:unit?1:Number(qty),p_reason:reason,p_balance_id:balance?.id??null,p_unit_id:unit?.id??null}); },"Stock reserved.")}>Reserve stock</button></div>
            {orgRole === "owner" && balance && snapshot.locations.find(l => l.id === balance.location_id)?.is_default && <button className={secondary} onClick={() => void run(async () => { if (!report?.some(row => row.product_id === balance.product_id)) throw new Error("Inspect this product in Reconciliation before repairing its balance."); await inventoryOperation("reconcile_default_inventory_balance",{p_balance_id:balance.id,p_expected_qty:Number(balance.qty_on_hand),p_reason:reason}); },"Default custody reconciled. The before/after quantities and reason were recorded.")}>Reconcile selected default balance</button>}
          </fieldset></section>
          <section className={card}><h2 className="text-lg font-bold">Stock locations</h2><ul className="mt-3 divide-y divide-slate-100">{snapshot.locations.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-semibold">{row.name} · {row.code}</span><span className="text-teal-800">{row.is_default?"Main location":row.active?"Active":"Inactive"}</span></li>)}</ul><form className="mt-4 border-t border-slate-100 pt-4" onSubmit={e => {e.preventDefault();void run(async () => {if (!org.id || !code.trim() || !locationName.trim()) throw new Error("Enter a location code and name.");await createStockLocation(org.id,code,locationName);setCode("");setLocationName("");},"Stock location added.");}}><fieldset disabled={busy || !writable}><label className="block text-sm font-semibold">Location code<input className={field} required maxLength={30} value={code} onChange={e => setCode(e.target.value)} /></label><label className="mt-3 block text-sm font-semibold">Location name<input className={field} required maxLength={100} value={locationName} onChange={e => setLocationName(e.target.value)} /></label><button className={`${button} mt-3`}>Add location</button></fieldset></form></section>
        </div>
        <section className={`${card} mt-5`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Transfer ledger</h2><button className={secondary} disabled={busy || loading} onClick={() => void refresh()}>Refresh</button></div>{snapshot.transfers.length===0 && <p className="py-5 text-sm text-slate-500">No transfers yet. Choose source stock and a destination to begin.</p>}<ul className="mt-3 divide-y divide-slate-100">{snapshot.transfers.slice(page*10,page*10+10).map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{row.transfer_no}</p><p className="mt-1 text-sm text-slate-600">{locationLabel(row.from_location_id)} → {locationLabel(row.to_location_id)}</p><p className="mt-1 text-xs font-semibold uppercase text-teal-800">{row.status.replaceAll("_"," ")}</p></div><div className="flex flex-wrap gap-2">{(row.status==="draft"?[["dispatch_inventory_transfer","Dispatch"],["cancel_inventory_transfer","Cancel draft"]]:row.status==="dispatched"?[["mark_inventory_transfer_in_transit","Confirm in transit"]]:row.status==="in_transit"?[["receive_inventory_transfer","Receive at destination"]]:[]).map(([rpc,label]) => <button className={secondary} key={rpc} disabled={busy||!writable||(!snapshot.enabled&&rpc!=="cancel_inventory_transfer")} onClick={() => void run(() => inventoryOperation(rpc,{p_transfer_id:row.id}),`${row.transfer_no}: ${label} completed.`)}>{label}</button>)}</div></li>)}</ul><div className="mt-4 flex items-center justify-end gap-3 text-sm"><button className={secondary} disabled={page===0||busy} onClick={() => setPage(p=>p-1)}>Previous</button><span>Page {page+1} of {Math.max(1,Math.ceil(snapshot.transfers.length/10))}</span><button className={secondary} disabled={(page+1)*10>=snapshot.transfers.length||busy} onClick={() => setPage(p=>p+1)}>Next</button></div></section>
        <section className={`${card} mt-5`}><h2 className="text-lg font-bold">Active stock holds</h2><ul className="mt-3 divide-y divide-slate-100">{snapshot.reservations.filter(r=>r.status==="active").map(row=><li className="flex flex-wrap items-center justify-between gap-3 py-3" key={row.id}><p className="text-sm">{row.reason} · <strong>{row.qty}</strong> held</p><button className={secondary} disabled={busy||!writable} onClick={()=>void run(()=>inventoryOperation("release_inventory_reservation",{p_reservation_id:row.id}),"Reservation released.")}>Release hold</button></li>)}</ul>{!snapshot.reservations.some(r=>r.status==="active")&&<p className="mt-3 text-sm text-slate-500">No active stock holds.</p>}</section>
        <section className={`${card} mt-5`}><h2 className="text-lg font-bold">Reconciliation</h2><p className="mt-1 text-sm text-slate-600">Compare source quantities with locations and stock in transit. Inspecting does not change stock.</p><div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-semibold">Product<select className={field} value={productId} onChange={e=>{setProductId(e.target.value);setReport(null);}}><option value="">Choose a product</option>{data?.products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className={secondary} disabled={busy||!productId} onClick={()=>void run(async()=>{if(org.id)setReport(await inspectInventoryProduct(org.id,productId));},"Reconciliation review refreshed.",false)}>Inspect product</button></div>{report&&<ul className="mt-4 divide-y divide-slate-100">{report.map((row,index)=><li key={index} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-semibold">{row.identity_kind.replaceAll("_"," ")}{row.lot_id?` · ${row.lot_id.slice(0,8)}`:row.unit_id?` · ${row.unit_id.slice(0,8)}`:""}</span><span className={Number(row.difference)?"font-bold text-rose-700":"text-teal-800"}>Source {row.source_qty} · Located {row.located_qty} · Transit {row.transit_qty} · Difference {row.difference}</span></li>)}</ul>}</section>
      </>}
    </>}
  </ProMain></AppShell>;
}
