"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProEmptyState, ProLoadingState, ProMain, ProPageHeader } from "@/components/ui/pro-shell";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const money = (value: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
const field = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const numberValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export default function ImportsAndLandedCostPage() {
  const { data, ready } = useAppStore();
  const { orgRole, canSeeFinancials } = useSubscription();
  const [orderId, setOrderId] = useState("");
  const [basis, setBasis] = useState<"value" | "quantity">("value");
  const [costs, setCosts] = useState({ fx: "1", freight: "0", duty: "0", insurance: "0", clearing: "0", vat: "0" });
  const orders = useMemo(() => data?.purchaseOrders.filter((order) => order.status === "pending" || order.status === "partial") ?? [], [data?.purchaseOrders]);
  const order = orders.find((candidate) => candidate.id === orderId) ?? null;
  const result = useMemo(() => {
    if (!order) return null;
    const fx = numberValue(costs.fx) || 1;
    const charges = numberValue(costs.freight) + numberValue(costs.duty) + numberValue(costs.insurance) + numberValue(costs.clearing);
    const weights = order.lines.map((line) => basis === "quantity" ? line.qtyOrdered : line.qtyOrdered * line.unitCost * fx);
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    let allocated = 0;
    const lines = order.lines.map((line, index) => {
      const goods = line.qtyOrdered * line.unitCost * fx;
      const share = index === order.lines.length - 1 ? charges - allocated : weightTotal > 0 ? Math.round(charges * weights[index] / weightTotal * 100) / 100 : 0;
      allocated += share;
      return { ...line, goods, share, landedUnit: line.qtyOrdered > 0 ? (goods + share) / line.qtyOrdered : 0 };
    });
    const goods = lines.reduce((sum, line) => sum + line.goods, 0);
    const vat = numberValue(costs.vat);
    return { lines, goods, charges, vat, payable: goods + charges + vat };
  }, [basis, costs, order]);

  if (!ready || !data) return <AppShell><ProMain><ProLoadingState label="Loading import planning…" /></ProMain></AppShell>;
  if (orgRole !== "owner" || !canSeeFinancials) return <AppShell><ProMain><ProEmptyState title="Owner financial access required" description="Import values, landed costs and recoverable VAT are restricted to the business owner." action={<Link href="/stock" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Back to stock</Link>} /></ProMain></AppShell>;

  return (
    <AppShell>
      <ProMain>
        <ProPageHeader eyebrow="Inventory planning" title="Imports & landed cost" description="Model shipment charges against a real open purchase order before receipt. Recoverable VAT stays separate from inventory cost." actions={<Link href="/suppliers" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Purchase orders</Link>} />
        <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-900">
          <p className="font-bold">Planning worksheet</p>
          <p className="text-sky-800">This workspace calculates a shipment without posting stock or accounting entries. Transactional shipment saving and receiving activate with the general imports engine in Phase 3.</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <section className={card}>
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
          <section className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">Cost review</p><h2 className="mt-1 text-lg font-bold text-slate-950">True inventory cost</h2></div>{order && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{order.poNo}</span>}</div>
            {!result ? <ProEmptyState size="compact" title="Choose an open purchase order" description="Its real product lines will appear here for landed-cost allocation." /> : <>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Goods", result.goods], ["Capitalized", result.charges], ["VAT separate", result.vat], ["Payable", result.payable]].map(([label, value]) => <div key={String(label)}><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-950">{money(Number(value))}</p></div>)}</div>
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Goods</th><th className="px-4 py-3 text-right">Allocated</th><th className="px-4 py-3 text-right">Landed / unit</th></tr></thead><tbody className="divide-y divide-slate-100">{result.lines.map((line) => <tr key={line.productId}><td className="px-4 py-3 font-semibold text-slate-900">{line.productName}</td><td className="px-4 py-3 text-right text-slate-600">{line.qtyOrdered}</td><td className="px-4 py-3 text-right text-slate-600">{money(line.goods)}</td><td className="px-4 py-3 text-right text-slate-600">{money(line.share)}</td><td className="px-4 py-3 text-right font-bold text-slate-950">{money(line.landedUnit)}</td></tr>)}</tbody></table></div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Inventory basis: {money(result.goods + result.charges)}. Recoverable VAT is excluded. The final line absorbs cent-level residuals.</p>
            </>}
          </section>
        </div>
      </ProMain>
    </AppShell>
  );
}
