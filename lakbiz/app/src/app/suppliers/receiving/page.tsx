"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProPageHeader } from "@/components/ui/pro-shell";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { loadReceivingCatalogue, type ReceivingCatalogue } from "@/lib/supabase/purchase-receiving";
import type { PurchaseReceiptAllocation } from "@/lib/store/types";
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const field = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50";
const button = "min-h-11 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
export default function ExactPurchaseReceivingPage() {
 const {org,orgRole,isReadOnly,can}=useSubscription();
 const {data,receivePurchaseOrderToCloud,pendingPurchaseAction,retryPendingPurchaseOrderToCloud}=useAppStore();
 const [orderId,setOrderId]=useState("");const [lineId,setLineId]=useState("");const [catalogue,setCatalogue]=useState<ReceivingCatalogue|null>(null);
 const [quantity,setQuantity]=useState("1");const [variant,setVariant]=useState("");const [lot,setLot]=useState("new");const [batch,setBatch]=useState("");const [expiry,setExpiry]=useState("");const [serials,setSerials]=useState("");const [identifier,setIdentifier]=useState("serial");
 const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");const [attempt,setAttempt]=useState(0);
 const generation=useRef({value:0});const lock=useRef(false);const scope=`${org.id}:${orderId}:${lineId}`;const activeScope=useRef(scope);activeScope.current=scope;
 const owner=orgRole==="owner";const fabric=org.sector==="textile";
 const current=catalogue?.organizationId===org.id&&catalogue.orderId===orderId&&catalogue.lineId===(lineId||null)?catalogue:null;
 const line=current?.lines.find(row=>row.id===lineId);const serial=line?.tracking_mode.includes("serial");const batched=line?.tracking_mode.includes("lot");const variantTracked=line?.tracking_mode.startsWith("variant");
 const entries=serials.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);const qty=serial?entries.length:Number(quantity);const outstanding=line?Number(line.qty_ordered)-Number(line.qty_received):0;
 const writable=Boolean(owner&&org.isAuthenticated&&!isReadOnly&&can("write")&&current?.enabled&&!loading&&!fabric);
 useEffect(()=>{setOrderId("");setLineId("");setSerials("");setBatch("");setExpiry("");setMessage("");setError("");setCatalogue(null)},[org.id]);
 const refresh=useCallback(async()=>{const request=++generation.current.value;if(!org.id||!org.isAuthenticated||!owner||!orderId||fabric){setCatalogue(null);setLoading(false);return}setLoading(true);
  try{const value=await loadReceivingCatalogue(org.id,orderId,lineId||null);if(request===generation.current.value){setCatalogue(value);setError("")}}
  catch(failure){if(request===generation.current.value){setCatalogue(null);setError(failure instanceof Error?failure.message:"Receiving details could not load.")}}
  finally{if(request===generation.current.value)setLoading(false)}
 },[org.id,org.isAuthenticated,owner,orderId,lineId,fabric]);
 useEffect(()=>{const requests=generation.current;void refresh();return()=>{requests.value++}},[refresh,attempt]);
 function changeLine(value:string){setLineId(value);setVariant("");setLot("new");setBatch("");setExpiry("");setSerials("");setQuantity("1");setMessage("")}
 async function save(resume=false){if(lock.current||!owner||!org.id||(!resume&&(!line||!writable)))return;lock.current=true;const request=scope;setBusy(true);setError("");setMessage("");
  try{let result;if(resume)result=await retryPendingPurchaseOrderToCloud();else{
    if(!line||!Number.isFinite(qty)||qty<=0||qty>outstanding||Math.abs(qty*1000-Math.round(qty*1000))>0.000001)throw Error("Enter an available receipt quantity with at most three decimals.");
    if(variantTracked&&!variant)throw Error("Choose the exact variant.");
    if(serial&&(entries.length>500||new Set(entries).size!==entries.length))throw Error("Enter up to 500 different serials or IMEIs, one per line.");
    let allocations:PurchaseReceiptAllocation[]|undefined;
    if(serial)allocations=entries.map(value=>({qty:1,variantId:variant||undefined,...(identifier==="imei"?{imei:value}:{serialNo:value})}));
    else if(batched){if(lot==="new"&&!batch.trim())throw Error("Enter the new batch number.");allocations=[{qty,variantId:variant||undefined,...(lot==="new"?{batchNo:batch.trim(),expiryDate:expiry||undefined}:{lotId:lot})}]}
    else if(variantTracked)allocations=[{qty,variantId:variant}];
    result=await receivePurchaseOrderToCloud(orderId,[{productId:line.product_id,lineId:line.id,expectedReceived:Number(line.qty_received),qtyReceived:qty,allocations}]);
   }
   if(!result.ok)throw Error(result.error??"Receipt could not finish. Your draft has been kept.");
   if(activeScope.current===request){setMessage("Receipt confirmed. Stock, identities, custody and order progress were saved together.");setSerials("");setQuantity("1");setBatch("");setAttempt(value=>value+1)}
  }catch(failure){if(activeScope.current===request)setError(failure instanceof Error?failure.message:"Receiving failed.")}
  finally{lock.current=false;if(activeScope.current===request)setBusy(false)}
 }
 return <AppShell><ProMain><ProPageHeader eyebrow="Purchasing operations" title="Receive exact stock" description="Match a delivery to its purchase order and preserve every variant, batch or serialized unit." actions={<Link href="/suppliers" className="text-sm font-bold text-teal-800">Back to suppliers →</Link>}/>
 {!owner?<p className={card}>Owner purchasing access is required.</p>:fabric?<section className={card}><h2 className="font-bold">Wholesale fabric rolls</h2><p className="mt-2 text-sm text-slate-600">Receive measured fabric through the specialist roll workflow.</p><Link href="/stock/rolls" className={`${button} mt-4 inline-flex items-center`}>Open Fabric Rolls</Link></section>:<>
 {error&&<p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}{message&&<p role="status" className="mb-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">{message}</p>}
 {pendingPurchaseAction&&<section className={`${card} mb-5`}><h2 className="font-bold">A purchasing action needs confirmation</h2><button className={`${button} mt-3`} disabled={busy||isReadOnly||!can("write")} onClick={()=>void save(true)}>Check pending purchase action</button></section>}
 <form className="grid items-start gap-5 lg:grid-cols-2" onSubmit={event=>{event.preventDefault();void save()}}><section className={card}><h2 className="text-lg font-bold">Delivery source</h2><fieldset disabled={busy||pendingPurchaseAction||!org.isAuthenticated} className="mt-4 space-y-4">
 <label className="block text-sm font-semibold">Purchase order<select className={field} value={orderId} onChange={event=>{setOrderId(event.target.value);changeLine("")}}><option value="">Choose an open order</option>{data?.purchaseOrders.filter(po=>["pending","partial"].includes(po.status)).map(po=><option key={po.id} value={po.id}>{po.poNo} · {po.supplierName}</option>)}</select></label>
 <label className="block text-sm font-semibold">Order line<select className={field} value={lineId} disabled={loading||!current} onChange={event=>changeLine(event.target.value)}><option value="">Choose the delivered product</option>{current?.lines.filter(row=>Number(row.qty_ordered)>Number(row.qty_received)).map(row=><option key={row.id} value={row.id}>{row.product_name} · {Number(row.qty_ordered)-Number(row.qty_received)} outstanding</option>)}</select></label>
 </fieldset>{loading&&<p role="status" className="mt-4 text-sm">Loading receiving details…</p>}{current&&!current.enabled&&<p className="mt-4 text-sm text-amber-900">Receiving awaits the purchasing and inventory rollout.</p>}{orderId&&<button type="button" className="mt-3 min-h-11 text-sm font-semibold text-teal-800" disabled={loading||busy} onClick={()=>setAttempt(value=>value+1)}>Refresh order details</button>}</section>
 <section className={card}><h2 className="text-lg font-bold">Physical receiving</h2>{!line?<p className="mt-3 text-sm text-slate-500">Choose an order line to prepare its exact receipt.</p>:<fieldset disabled={!writable||busy||pendingPurchaseAction||outstanding<=0} className="mt-4 space-y-4"><p className="rounded-xl bg-slate-50 p-3 text-sm">{line.product_name} · {outstanding} outstanding · {line.tracking_mode.replaceAll("_"," ")}</p>
 {variantTracked&&<label className="block text-sm font-semibold">Variant<select required className={field} value={variant} onChange={event=>{setVariant(event.target.value);setLot("new")}}><option value="">Choose size / colour / specification</option>{current?.variants.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>}
 {serial?<><label className="block text-sm font-semibold">Identifier type<select className={field} value={identifier} onChange={event=>setIdentifier(event.target.value)}><option value="serial">Serial numbers</option><option value="imei">IMEI numbers</option></select></label><label className="block text-sm font-semibold">Received identities<textarea required rows={6} className={field} placeholder="One serial number or IMEI per line" value={serials} onChange={event=>setSerials(event.target.value)}/></label><p className="text-sm text-teal-800">{entries.length} physical units</p></>:<label className="block text-sm font-semibold">Received quantity<input required className={field} type="number" min="0.001" step="0.001" max={outstanding} value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>}
 {batched&&<><label className="block text-sm font-semibold">Batch<select className={field} value={lot} onChange={event=>setLot(event.target.value)}><option value="new">Receive a new batch</option>{current?.lots.filter(row=>(row.variant_id??"")===variant&&(!line.fefo_enabled||Boolean(row.expiry_date))).map(row=><option key={row.id} value={row.id}>{row.batch_no}{row.expiry_date?` · ${row.expiry_date}`:""}</option>)}</select></label>{lot==="new"&&<><label className="block text-sm font-semibold">New batch number<input required maxLength={200} className={field} value={batch} onChange={event=>setBatch(event.target.value)}/></label><label className="block text-sm font-semibold">Expiry date{line.fefo_enabled?" (required)":" (optional)"}<input required={line.fefo_enabled} type="date" className={field} value={expiry} onChange={event=>setExpiry(event.target.value)}/></label></>}</>}
 <button className={`${button} w-full`} type="submit">{busy?"Confirming receipt…":"Confirm exact receipt"}</button><p className="text-xs text-slate-500">Receive one order line per delivery confirmation. Separate partial receipts can use different variants or batches.</p>
 </fieldset>}</section></form></>}
 </ProMain></AppShell>;
}
