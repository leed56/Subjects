"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProEmptyState, ProLoadingState, ProMain, ProPageHeader } from "@/components/ui/pro-shell";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { allocateLandedCost } from "@/lib/landed-cost";
import { listShipments, type ShipmentListItem } from "@/lib/supabase/purchase-shipments";

const money = (value: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
const field = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";

export default function ImportsAndLandedCostPage() {
  const { data, ready } = useAppStore();
  const { org, orgRole, canSeeFinancials } = useSubscription();
  const [shipmentPage, setShipmentPage] = useState(0);
  const [shipmentResult, setShipmentResult] = useState<{ scope: string; items: ShipmentListItem[]; hasMore: boolean } | null>(null);
  const [shipmentError, setShipmentError] = useState("");
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [shipmentRefresh, setShipmentRefresh] = useState(0);
  useEffect(() => { setShipmentPage(0); setShipmentResult(null); setShipmentError(""); }, [org.id]);
  useEffect(() => {
    let active = true;
    if (!org.id || !org.isAuthenticated || orgRole !== "owner" || !canSeeFinancials) return;
    setShipmentLoading(true); setShipmentError("");
    void listShipments(org.id, shipmentPage).then(result => {
      if (active) setShipmentResult({ scope: `${org.id}:${shipmentPage}`, ...result });
    }).catch(() => {
      if (active) { setShipmentResult(null); setShipmentError("Shipment history is unavailable. Try again when your connection is restored or purchasing is enabled."); }
    }).finally(() => { if (active) setShipmentLoading(false); });
    return () => { active = false; };
  }, [org.id, org.isAuthenticated, orgRole, canSeeFinancials, shipmentPage, shipmentRefresh]);
  const shipments = shipmentResult?.scope === `${org.id}:${shipmentPage}` ? shipmentResult : null;
  const [orderId, setOrderId] = useState("");
  const [basis, setBasis] = useState<"value" | "quantity">("value");
  const [costs, setCosts] = useState({ fx: "1", freight: "0", duty: "0", insurance: "0", clearing: "0", vat: "0" });
  const orders = useMemo(() => data?.purchaseOrders.filter((order) => order.status === "pending" || order.status === "partial") ?? [], [data?.purchaseOrders]);
  const order = orders.find((candidate) => candidate.id === orderId) ?? null;
  const planning = useMemo(() => {
    if (!order) return { result: null, error: "" };
    try {
      if (Object.values(costs).some(value => !value.trim())) throw Error("Complete each shipment amount before reviewing costs.");
      const outstanding = order.lines.filter(line => line.qtyOrdered > line.qtyReceived).map(line => ({ ...line, qtyOrdered: line.qtyOrdered - line.qtyReceived }));
      const allocation = allocateLandedCost({ basis, exchangeRate: Number(costs.fx), charges: [costs.freight, costs.duty, costs.insurance, costs.clearing].map(Number), recoverableVat: Number(costs.vat), lines: outstanding.map(line => ({ id: line.productId, quantity: line.qtyOrdered, unitCost: line.unitCost })) });
      const byId = new Map(allocation.lines.map(line => [line.id, line]));
      const lines = outstanding.map(line => { const allocated = byId.get(line.productId)!; return { ...line, goods: allocated.goodsMinor / 100, share: allocated.allocatedMinor / 100, landedUnit: allocated.landedUnit }; });
      return { result: { lines, goods: allocation.goodsMinor / 100, charges: allocation.chargesMinor / 100, vat: allocation.vatMinor / 100, payable: allocation.payableMinor / 100 }, error: "" };
    } catch (failure) { return { result: null, error: failure instanceof Error ? failure.message : "Check the shipment inputs." }; }
  }, [basis, costs, order]);
  const result = planning.result;

  if (!ready || !data) return <AppShell><ProMain><ProLoadingState label="Loading import planning…" /></ProMain></AppShell>;
  if (orgRole !== "owner" || !canSeeFinancials) return <AppShell><ProMain><ProEmptyState title="Owner financial access required" description="Import values, landed costs and recoverable VAT are restricted to the business owner." action={<Link href="/stock" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Back to stock</Link>} /></ProMain></AppShell>;

  return (
    <AppShell>
      <ProMain>
        <ProPageHeader eyebrow="Inventory planning" title="Imports & landed cost" description="Model shipment charges against a real open purchase order before receipt. Recoverable VAT stays separate from inventory cost." actions={<Link href="/suppliers" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Purchase orders</Link>} />
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-teal-200 bg-[linear-gradient(135deg,#ecfdf8,#eff6ff)] px-5 py-4 text-sm leading-6 text-slate-700 shadow-sm">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-sm font-black text-white">✓</span>
          <div><p className="font-bold text-slate-950">Safe cost preview</p><p>This worksheet calculates the expected true cost without changing stock, supplier balances or accounting records.</p></div>
        </div>
        {planning.error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{planning.error}</p>}
        <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <section className={`${card} xl:self-start`}>
            <h2 className="text-base font-bold text-slate-950">Shipment inputs</h2>
            <label className="mt-4 block text-xs font-bold text-slate-600">Open purchase order
              <select className={field} value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">Select a purchase order</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.poNo} · {item.supplierName} · {money(item.expectedTotal)}</option>)}</select>
            </label>
            {orders.length === 0 && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">No open purchase order is available. Create one from Suppliers first.</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {([ ["fx", "Exchange rate"], ["freight", "Freight"], ["duty", "Import duty"], ["insurance", "Insurance"], ["clearing", "Port & clearing"], ["vat", "Recoverable VAT"] ] as const).map(([key, label]) => <label key={key} className="block text-xs font-bold text-slate-600">{label}<input type="number" min="0" step="0.01" inputMode="decimal" className={field} value={costs[key]} onChange={(event) => setCosts((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
            </div>
            <fieldset className="mt-4"><legend className="text-xs font-bold text-slate-600">Allocate charges by</legend><div className="mt-2 grid grid-cols-2 gap-2">{(["value", "quantity"] as const).map((option) => <button key={option} type="button" onClick={() => setBasis(option)} className={`min-h-10 rounded-xl border px-3 text-sm font-bold capitalize ${basis === option ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-600"}`}>{option}</button>)}</div></fieldset>
          </section>
          <section className={`${card} xl:self-start`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">Cost review</p><h2 className="mt-1 text-lg font-bold text-slate-950">True inventory cost</h2></div>{order && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{order.poNo}</span>}</div>
            {!result ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-9 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-sm ring-1 ring-slate-200">↗</span><h3 className="mt-4 text-base font-bold text-slate-950">Start with an open purchase order</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">Choose an order on the left to allocate freight, duty and clearing charges across its actual product lines.</p><Link href="/suppliers" className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:border-teal-300 hover:text-teal-800">Create or review orders →</Link></div> : <>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Goods", result.goods], ["Capitalized", result.charges], ["VAT separate", result.vat], ["Payable", result.payable]].map(([label, value]) => <div key={String(label)}><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-950">{money(Number(value))}</p></div>)}</div>
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Goods</th><th className="px-4 py-3 text-right">Allocated</th><th className="px-4 py-3 text-right">Landed / unit</th></tr></thead><tbody className="divide-y divide-slate-100">{result.lines.map((line) => <tr key={line.productId}><td className="px-4 py-3 font-semibold text-slate-900">{line.productName}</td><td className="px-4 py-3 text-right text-slate-600">{line.qtyOrdered}</td><td className="px-4 py-3 text-right text-slate-600">{money(line.goods)}</td><td className="px-4 py-3 text-right text-slate-600">{money(line.share)}</td><td className="px-4 py-3 text-right font-bold text-slate-950">{money(line.landedUnit)}</td></tr>)}</tbody></table></div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Inventory basis: {money(result.goods + result.charges)}. Recoverable VAT is excluded. Charges are allocated to outstanding quantities; cent residuals follow the largest proportional remainders.</p>
            </>}
          </section>
        </div>
        <section className={`${card} mt-5`} aria-labelledby="shipment-history-title">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">Purchasing</p><h2 id="shipment-history-title" className="mt-1 text-lg font-bold text-slate-950">Shipment history</h2><p className="mt-1 text-sm text-slate-500">Review the status of your purchase shipments.</p></div><div className="flex gap-2"><Link href="/stock/imports/shipments" className="inline-flex min-h-10 items-center rounded-xl bg-teal-700 px-4 text-sm font-bold text-white">Manage shipments</Link><button type="button" className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 disabled:opacity-50" disabled={shipmentLoading || !org.isAuthenticated} onClick={() => setShipmentRefresh(value => value + 1)}>Refresh</button></div></div>
          {!org.isAuthenticated ? <p className="mt-4 text-sm text-slate-500">Sign in to view shipment history.</p> : shipmentLoading ? <p className="mt-4 text-sm text-slate-500" role="status">Loading shipments…</p> : shipmentError ? <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="alert">{shipmentError}</p> : shipments?.items.length ? <><div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Purchase order</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Currency</th></tr></thead><tbody className="divide-y divide-slate-100">{shipments.items.map(item => <tr key={item.id}><td className="px-4 py-3 font-bold text-slate-900">{item.reference}</td><td className="px-4 py-3 text-slate-600">{data.purchaseOrders.find(po => po.id === item.purchase_order_id)?.poNo ?? "Purchase order"}</td><td className="px-4 py-3"><span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold capitalize text-teal-800">{item.status.replaceAll("_", " ")}</span></td><td className="px-4 py-3 text-slate-600">{item.currency}</td></tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between gap-3"><button type="button" disabled={shipmentPage === 0} onClick={() => setShipmentPage(page => page - 1)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold disabled:opacity-40">Previous</button><span className="text-xs font-semibold text-slate-500">Page {shipmentPage + 1}</span><button type="button" disabled={!shipments.hasMore} onClick={() => setShipmentPage(page => page + 1)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold disabled:opacity-40">Next</button></div></> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No shipments to show yet.</p>}
        </section>
      </ProMain>
    </AppShell>
  );
}
