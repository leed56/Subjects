"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProBadge, ProButton, ProCard, ProEmptyState, ProLoadingState, ProMain, ProPageHeader, ProStatCard } from "@/components/ui/pro-shell";
import { BillsIcon, SalesIcon, StockIcon } from "@/components/ui/icons";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { buildCheckoutTenders, type CheckoutTenderKind } from "@/lib/retail-tender-checkout";
import { validateSaleTenders } from "@/lib/sale-tender";
import { saveAppData } from "@/lib/store/storage";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { pullBusinessData } from "@/lib/supabase/business-sync";
import { fetchTextileReservations, type TextileReservation } from "@/lib/supabase/textile-cutting-client";
import { fetchTextileRolls, finalizeTextileSale, type TextileRollRecord, type TextileSaleAllocationDraft } from "@/lib/supabase/textile-roll-client";
import { textileUnitPrice, type TextileSaleChannel } from "@/lib/textile-pricing";

type CartLine = TextileSaleAllocationDraft & { id: string; productId: string; productName: string; rollNo: string; unit: "metre" | "yard"; priceSource: string };
const field = "text-xs font-semibold text-slate-600";
const input = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50";

function clientId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function productByIdSafe(products: Array<{ id: string; name: string }>, productId: string): string {
  return products.find((product) => product.id === productId)?.name ?? "Fabric";
}

export function TextileSalesPage() {
  const { data, ready } = useAppStore();
  const { org } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const [rolls, setRolls] = useState<TextileRollRecord[]>([]);
  const [reservations, setReservations] = useState<TextileReservation[]>([]);
  const [loadingRolls, setLoadingRolls] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [channel, setChannel] = useState<TextileSaleChannel>("retail");
  const [productId, setProductId] = useState("");
  const [rollId, setRollId] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fullRoll, setFullRoll] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<CheckoutTenderKind>("cash");
  const [split, setSplit] = useState(false);
  const [secondaryPayment, setSecondaryPayment] = useState<CheckoutTenderKind>("card");
  const [secondaryAmount, setSecondaryAmount] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState(LK_BANKS[0]);
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [postDated, setPostDated] = useState(false);
  const canOverride = org.role === "owner" || org.role === "manager";

  useEffect(() => {
    if (!org.id) return;
    let cancelled = false;
    setLoadingRolls(true);
    void Promise.all([fetchTextileRolls(org.id, false), fetchTextileReservations(org.id, true)]).then(([result, reservationResult]) => {
      if (cancelled) return;
      setLoadingRolls(false);
      if (result.error) setMessage(result.error);
      else if (reservationResult.error) setMessage(reservationResult.error);
      else { setRolls(result.data); setReservations(reservationResult.data); }
    });
    return () => { cancelled = true; };
  }, [org.id]);

  const products = useMemo(() => (data?.products ?? []).filter((p) => p.active && p.sectorId === "textile"), [data?.products]);
  const sellableRolls = rolls.filter((r) => !["quarantined", "returned", "exhausted"].includes(r.status) && r.remainingLength - r.reservedLength > 0 && (!productId || r.productId === productId));
  const selectedReservation = reservations.find((row) => row.id === reservationId);
  const selectedRoll = rolls.find((r) => r.id === rollId && (selectedReservation ? r.id === selectedReservation.rollId : sellableRolls.some((sellable) => sellable.id === r.id)));
  const selectedProduct = products.find((p) => p.id === (productId || selectedRoll?.productId));
  const available = selectedReservation?.quantity ?? (selectedRoll ? selectedRoll.remainingLength - selectedRoll.reservedLength : 0);
  const saleQty = fullRoll ? available : Number(quantity || 0);
  const priceResolution = selectedProduct && data ? textileUnitPrice({
    product: selectedProduct,
    quantity: saleQty,
    channel: fullRoll ? "wholesale" : channel,
    customerId: customerId || undefined,
    data,
    manualOverride: manualPrice === "" ? undefined : Number(manualPrice),
    canOverride,
  }) : null;

  useEffect(() => {
    if (!reservationId && productId && !sellableRolls.some((r) => r.id === rollId)) setRollId("");
  }, [productId, rollId, sellableRolls, reservationId]);

  const gross = cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discountValue = Math.min(Math.max(0, Number(discount) || 0), gross);
  const total = Math.round((gross - discountValue + Number.EPSILON) * 100) / 100;

  function addLine() {
    if (!selectedRoll || !selectedProduct || !priceResolution || saleQty <= 0) return setMessage("Select a roll and enter a valid measured quantity.");
    const already = cart.filter((line) => line.rollId === selectedRoll.id).reduce((sum, line) => sum + line.quantity, 0);
    if (saleQty + already > available) return setMessage(`Only ${available.toFixed(3)} ${selectedRoll.lengthUnit} is available on this roll.`);
    setCart((current) => [...current, {
      id: clientId("line"), rollId: selectedRoll.id, productId: selectedProduct.id,
      productName: selectedProduct.name, rollNo: selectedRoll.rollNo,
      quantity: saleQty, unitPrice: priceResolution.price,
      saleMode: fullRoll ? "full_roll" : channel === "wholesale" ? "wholesale_cut" : "retail_cut",
      unit: selectedRoll.lengthUnit, priceSource: priceResolution.source, reservationId: selectedReservation?.id,
    }]);
    setQuantity(""); setManualPrice(""); setFullRoll(false); setReservationId(""); setMessage("");
  }

  async function checkout() {
    if (!data || !org.id || !canWrite || cart.length === 0 || total <= 0) return;
    const saleId = clientId("sale");
    const plan = buildCheckoutTenders({
      saleTotal: total, primaryKind: payment, primaryId: `${saleId}-t1`, split,
      secondaryKind: secondaryPayment, secondaryAmount: Number(secondaryAmount || 0), secondaryId: `${saleId}-t2`,
      cheque: { chequeNo, chequeBank, chequeDate, postDated },
    });
    if (plan.error) return setMessage(plan.error);
    const errors = validateSaleTenders(plan.tenders, { saleTotal: total, hasCustomerAccount: Boolean(customerId) });
    if (errors.length) return setMessage(errors[0]);
    const customer = data.customers.find((row) => row.id === customerId);
    if (plan.creditTenderAmount > 0 && customer?.creditLimit != null && customer.creditBalance + plan.creditTenderAmount > customer.creditLimit) {
      return setMessage("Customer credit limit would be exceeded.");
    }
    setSaving(true); setMessage("");
    const result = await finalizeTextileSale(org.id, {
      saleId, customerId: customerId || undefined, customerName: customer?.name ?? walkInName,
      discount: discountValue,
      allocations: cart.map(({ rollId: id, quantity: qty, unitPrice, saleMode, reservationId: reserved }) => ({ rollId: id, quantity: qty, unitPrice, saleMode, reservationId: reserved })),
      tenders: plan.tenders,
    });
    if (!result.ok || !result.saleId) { setSaving(false); return setMessage(result.error ?? "Textile checkout failed."); }
    const fresh = await pullBusinessData(org.id, data.business).catch(() => null);
    if (fresh) saveAppData(fresh, org.id);
    sessionStorage.setItem("lakbiz-textile-sale-success", JSON.stringify({ billNo: result.billNo, saleId: result.saleId }));
    window.location.replace("/sales");
  }

  useEffect(() => {
    const raw = sessionStorage.getItem("lakbiz-textile-sale-success");
    if (!raw) return;
    sessionStorage.removeItem("lakbiz-textile-sale-success");
    const saved = JSON.parse(raw) as { billNo?: string; saleId?: string };
    setMessage(`Sale completed${saved.billNo ? ` · ${saved.billNo}` : ""}. Invoice, payment and physical rolls committed together.`);
  }, []);

  if (!ready || !data || loadingRolls) return <AppShell><ProMain><ProLoadingState label="Loading Textile POS…" /></ProMain></AppShell>;

  const chequeUsed = payment === "cheque" || (split && secondaryPayment === "cheque");
  return <AppShell><ProMain>
    <ProPageHeader eyebrow="Textile POS" title="Wholesale & retail fabric sale" description="Sell a complete roll or an exact measured cut. Invoice, payment and roll balance commit in one transaction." actions={<><ProBadge tone="emerald">Atomic roll checkout</ProBadge><ProButton href="/stock/rolls" variant="secondary">Fabric rolls</ProButton></>} />
    <WriteDisabledHint className="mb-5" />
    {message && <div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">{message}</div>}
    <div className="grid gap-4 sm:grid-cols-3"><ProStatCard label="Sale lines" value={String(cart.length)} hint="Physical roll allocations" icon={<SalesIcon className="h-5 w-5" />} tone="teal" /><ProStatCard label="Gross" value={formatLkr(gross)} hint={discountValue ? `Discount ${formatLkr(discountValue)}` : "Before discount"} icon={<BillsIcon className="h-5 w-5" />} tone="slate" /><ProStatCard label="Invoice total" value={formatLkr(total)} hint={split ? "Split payment" : payment.replaceAll("_", " ")} icon={<StockIcon className="h-5 w-5" />} tone="emerald" /></div>

    {rolls.length === 0 ? <div className="mt-6"><ProCard><ProEmptyState title="No physical rolls available" description="Receive fabric rolls before creating a measured Textile sale." action={<ProButton href="/stock/rolls">Receive roll</ProButton>} /></ProCard></div> :
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <div className="space-y-5">
        <ProCard title="Build sale line" eyebrow="Roll selection">
          <div className="mb-4 flex gap-2"><button type="button" className={`rounded-xl px-4 py-2 text-sm font-semibold ${channel === "retail" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setChannel("retail")}>Retail cut</button><button type="button" className={`rounded-xl px-4 py-2 text-sm font-semibold ${channel === "wholesale" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setChannel("wholesale")}>Wholesale</button></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={`${field} md:col-span-2`}>Reserved order (optional)<select className={input} value={reservationId} onChange={(e) => { const id=e.target.value; setReservationId(id); const reserved=reservations.find((r)=>r.id===id); if (reserved) { setRollId(reserved.rollId); setProductId(reserved.productId); setQuantity(String(reserved.quantity)); if (reserved.customerId) setCustomerId(reserved.customerId); else if (reserved.customerName) setWalkInName(reserved.customerName); } }}><option value="">New walk-in / unreserved sale</option>{reservations.map((r)=><option key={r.id} value={r.id}>{r.orderReference} · {productByIdSafe(products, r.productId)} · {r.quantity.toFixed(3)} {r.lengthUnit} · Dye {r.dyeLot || "unrecorded"}</option>)}</select></label>
            <label className={field}>Customer<select className={input} value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Walk-in customer</option>{data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.contactType === "company" ? " · Company" : ""}</option>)}</select></label>
            {!customerId && <label className={field}>Walk-in name<input className={input} value={walkInName} onChange={(e) => setWalkInName(e.target.value)} /></label>}
            <label className={field}>Fabric<select className={input} value={productId} onChange={(e) => { setProductId(e.target.value); setRollId(""); }}><option value="">All fabrics</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className={field}>Physical roll *<select disabled={Boolean(selectedReservation)} className={input} value={rollId} onChange={(e) => { const id = e.target.value; setRollId(id); const roll = rolls.find((r) => r.id === id); if (roll) setProductId(roll.productId); }}><option value="">Select roll</option>{(selectedReservation ? rolls.filter((r)=>r.id===selectedReservation.rollId) : sellableRolls).map((r) => <option key={r.id} value={r.id}>{r.rollNo} · {(selectedReservation ? selectedReservation.quantity : r.remainingLength-r.reservedLength).toFixed(3)} {r.lengthUnit === "metre" ? "m" : "yd"}{r.dyeLot ? ` · Dye ${r.dyeLot}` : ""}</option>)}</select></label>
            <label className={field}>Measured quantity<input disabled={fullRoll} type="number" min="0.001" max={available || undefined} step="0.001" className={input} value={fullRoll ? available.toFixed(3) : quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
            <label className={`${field} flex items-center gap-3 self-end rounded-xl border border-slate-200 p-3.5`}><input type="checkbox" disabled={Boolean(selectedRoll?.reservedLength)} checked={fullRoll} onChange={(e) => setFullRoll(e.target.checked)} /><span>{selectedRoll?.reservedLength ? "Reserved material prevents full-roll sale" : "Sell entire physical roll"}</span></label>
            {canOverride && <label className={field}>Manager price override<input type="number" min="0" step="0.01" className={input} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder={priceResolution ? String(priceResolution.price) : ""} /></label>}
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Applied unit price</p><p className="mt-1 text-xl font-bold text-slate-950">{formatLkr(priceResolution?.price ?? 0)}</p><p className="text-xs text-teal-700">{priceResolution?.source ?? "Select a roll"}</p></div>
          </div>
          <div className="mt-4 flex justify-end"><button type="button" className={primary} disabled={!selectedRoll || saleQty <= 0} onClick={addLine}>Add roll allocation</button></div>
        </ProCard>
        <ProCard title="Allocated rolls" eyebrow="Sale cart">
          {cart.length === 0 ? <p className="text-sm text-slate-500">No roll cuts added.</p> : <div className="divide-y divide-slate-100">{cart.map((line) => <div key={line.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-slate-900">{line.productName} · Roll {line.rollNo}</p><p className="text-xs text-slate-500">{line.saleMode.replaceAll("_", " ")} · {line.quantity.toFixed(3)} {line.unit} × {formatLkr(line.unitPrice)} · {line.priceSource}</p></div><div className="flex items-center gap-3"><span className="font-bold">{formatLkr(line.quantity*line.unitPrice)}</span><button className="text-sm font-semibold text-rose-600" onClick={() => setCart((rows) => rows.filter((r) => r.id !== line.id))}>Remove</button></div></div>)}</div>}
        </ProCard>
      </div>
      <ProCard title="Payment & checkout" eyebrow="Settlement">
        <div className="space-y-4">
          <label className={field}>Invoice discount<input type="number" min="0" max={gross} step="0.01" className={input} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></label>
          <label className={field}>Primary payment<select className={input} value={payment} onChange={(e) => setPayment(e.target.value as CheckoutTenderKind)}>{["cash","card","bank_transfer","cheque","credit"].map((p) => <option key={p} value={p}>{p.replaceAll("_", " ")}</option>)}</select></label>
          <label className={`${field} flex items-center gap-3 rounded-xl border border-slate-200 p-3.5`}><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /><span>Split payment</span></label>
          {split && <><label className={field}>Second payment<select className={input} value={secondaryPayment} onChange={(e) => setSecondaryPayment(e.target.value as CheckoutTenderKind)}>{["cash","card","bank_transfer","cheque","credit"].map((p) => <option key={p} value={p}>{p.replaceAll("_", " ")}</option>)}</select></label><label className={field}>Second amount<input type="number" min="0.01" max={total} step="0.01" className={input} value={secondaryAmount} onChange={(e) => setSecondaryAmount(e.target.value)} /></label></>}
          {chequeUsed && <div className="space-y-3 rounded-xl bg-slate-50 p-4"><label className={field}>Cheque number<input className={input} value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} /></label><label className={field}>Bank<select className={input} value={chequeBank} onChange={(e) => setChequeBank(e.target.value)}>{LK_BANKS.map((bank) => <option key={bank}>{bank}</option>)}</select></label><label className={field}>Cheque date<input type="date" className={input} value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={postDated} onChange={(e) => setPostDated(e.target.checked)} /> Post-dated cheque</label></div>}
          <div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs uppercase tracking-wider text-slate-400">Amount due</p><p className="mt-1 text-3xl font-bold">{formatLkr(total)}</p></div>
          <button type="button" title={!canWrite ? disabledHint ?? undefined : undefined} disabled={!canWrite || saving || cart.length === 0 || total <= 0} className={`${primary} w-full`} onClick={() => void checkout()}>{saving ? "Finalizing…" : "Finalize Textile sale"}</button>
          <p className="text-xs leading-5 text-slate-500">The invoice is created only if every selected roll can be deducted at checkout time.</p>
        </div>
      </ProCard>
    </div>}
    <div className="mt-5 text-sm text-slate-500">Need to review completed sales? <Link href="/bills" className="font-semibold text-teal-700">Open bills</Link>.</div>
  </ProMain></AppShell>;
}
