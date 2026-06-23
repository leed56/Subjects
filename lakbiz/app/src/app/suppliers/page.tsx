"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProPageShell,
  ProStatCard,
} from "@/components/ui/pro-shell";
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { buildLedger } from "@/lib/ledger";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Supplier } from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";
import { calcInputVat } from "@/lib/vat";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";

export default function SuppliersPage() {
  const {
    data,
    ready,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    createPurchase,
    recordSupplierPayment,
  } = useAppStore();
  const { t } = useLocale();
  const { canWrite, disabledHint } = useWriteAccess();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState("");
  const [purchasePayment, setPurchasePayment] = useState<PaymentMethod>("credit");
  const [purchaseLines, setPurchaseLines] = useState<Record<string, { qty: number; unitCost: number }>>({});
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState(LK_BANKS[0]);
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [postDated, setPostDated] = useState(false);
  const [purchaseInputVat, setPurchaseInputVat] = useState<number | "">("");

  const [paySupplierId, setPaySupplierId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");

  const purchaseTotal = useMemo(() => {
    if (!data) return 0;
    return Object.entries(purchaseLines).reduce((sum, [, line]) => {
      if (line.qty <= 0) return sum;
      return sum + line.qty * line.unitCost;
    }, 0);
  }, [purchaseLines, data]);

  const vatRegistered = data?.business.vatRegistered === true;
  const defaultInputVat = vatRegistered ? calcInputVat(purchaseTotal) : 0;
  const effectiveInputVat = purchaseInputVat === "" ? defaultInputVat : Number(purchaseInputVat);

  if (!ready || !data) {
    return (
      <ProPageShell>
        <SiteHeader />
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </ProPageShell>
    );
  }

  const totalPayable = data.suppliers.reduce((s, sup) => s + sup.payableBalance, 0);
  const payableSuppliers = data.suppliers.filter((s) => s.payableBalance > 0).length;
  const vatSuppliers = data.suppliers.filter((s) => s.vatNumber).length;
  const recentPurchaseValue = data.purchases.slice(0, 10).reduce((sum, p) => sum + p.total, 0);
  const query = search.trim().toLowerCase();
  const suppliers = query
    ? data.suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.phone ?? "").toLowerCase().includes(query) ||
          (s.contactPerson ?? "").toLowerCase().includes(query) ||
          (s.vatNumber ?? "").toLowerCase().includes(query),
      )
    : data.suppliers;
  const paySupplier = paySupplierId ? data.suppliers.find((s) => s.id === paySupplierId) : null;

  const resetSupplierForm = () => {
    setName("");
    setPhone("");
    setAddress("");
    setVatNumber("");
    setContactPerson("");
    setEditing(null);
  };

  const startEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setName(supplier.name);
    setPhone(supplier.phone ?? "");
    setAddress(supplier.address ?? "");
    setVatNumber(supplier.vatNumber ?? "");
    setContactPerson(supplier.contactPerson ?? "");
  };

  const saveSupplier = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = editing
      ? updateSupplier(editing.id, { name, phone, address, vatNumber, contactPerson })
      : addSupplier({ name, phone, address, vatNumber, contactPerson });
    if (!ok) {
      setMessage(t("common.save_failed"));
      setTimeout(() => setMessage(""), 2500);
      return;
    }
    resetSupplierForm();
    setMessage(t("common.saved"));
    setTimeout(() => setMessage(""), 2500);
  };

  const ledgerEntries = ledgerSupplier
    ? buildLedger(
        data.purchases
          .filter((p) => p.supplierId === ledgerSupplier.id && p.creditAmount > 0)
          .map((p) => ({ date: p.date, label: `GRN ${p.grnNo}`, amount: p.creditAmount })),
        data.supplierPayments
          .filter((p) => p.supplierId === ledgerSupplier.id)
          .map((p) => ({
            date: p.date,
            label: `${t("sup.pay_supplier")} (${paymentLabel(t, p.method)})`,
            amount: -p.amount,
          })),
      )
    : [];

  const setLine = (productId: string, qty: number, unitCost: number) => {
    setPurchaseLines((prev) => ({ ...prev, [productId]: { qty, unitCost } }));
  };

  const handlePurchase = () => {
    if (!purchaseSupplierId) {
      setMessage(t("sup.select_supplier"));
      return;
    }
    const lines = Object.entries(purchaseLines)
      .filter(([, l]) => l.qty > 0)
      .map(([productId, l]) => ({ productId, qty: l.qty, unitCost: l.unitCost }));
    if (lines.length === 0) {
      setMessage(t("sup.add_qty"));
      return;
    }
    const ok = createPurchase({
      supplierId: purchaseSupplierId,
      lines,
      paymentMethod: purchasePayment,
      inputVat: vatRegistered ? effectiveInputVat : 0,
      chequeNo: purchasePayment === "cheque" ? chequeNo : undefined,
      chequeBank: purchasePayment === "cheque" ? chequeBank : undefined,
      chequeDate: purchasePayment === "cheque" ? chequeDate : undefined,
      postDated: purchasePayment === "cheque" ? postDated : undefined,
    });
    if (ok) {
      setShowPurchase(false);
      setPurchaseLines({});
      setPurchaseInputVat("");
      setMessage(t("sup.saved"));
      setTimeout(() => setMessage(""), 3000);
    } else {
      setMessage(t("sup.failed"));
    }
  };

  const openPurchase = () => {
    setShowPurchase((v) => !v);
    if (!purchaseSupplierId && data.suppliers[0]) setPurchaseSupplierId(data.suppliers[0].id);
  };

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow="Supplier operations"
          title={t("sup.title")}
          description={`${t("sup.you_owe")} ${formatLkr(totalPayable)}`}
          actions={
            <>
              <ProButton href="/stock" variant="secondary">{t("nav.stock")}</ProButton>
              <button
                onClick={openPurchase}
                disabled={data.suppliers.length === 0 || data.products.length === 0}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("sup.record_purchase")}
              </button>
            </>
          }
        />

        <WriteDisabledHint className="mb-5" />

        {message && (
          <div className="mb-5 rounded-[1.25rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard label={t("nav.suppliers")} value={String(data.suppliers.length)} hint="Saved supplier profiles" icon="🏭" tone="teal" />
          <ProStatCard label={t("sup.you_owe_col")} value={formatLkr(totalPayable)} hint={`${payableSuppliers} suppliers payable`} icon="📥" tone="amber" />
          <ProStatCard label={t("sup.vat_number")} value={String(vatSuppliers)} hint="VAT-ready supplier records" icon="VAT" tone="blue" />
          <ProStatCard label={t("sup.recent_grn")} value={formatLkr(recentPurchaseValue)} hint="Latest 10 purchases" icon="🧾" tone="emerald" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <ProCard eyebrow={editing ? "Edit supplier" : "Create supplier"} title={editing ? t("sup.edit") : t("sup.add")}>
            <form onSubmit={saveSupplier}>
              <div className="grid gap-3 sm:grid-cols-2">
                <input required placeholder={t("sup.name")} value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                <input placeholder={t("common.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                <input placeholder={t("common.address")} value={address} onChange={(e) => setAddress(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100 sm:col-span-2" />
                <input placeholder={t("sup.contact_person")} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                <input placeholder={t("sup.vat_number")} value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="submit" disabled={!canWrite} title={!canWrite ? (disabledHint ?? undefined) : undefined} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {editing ? t("common.update") : t("sup.add")}
                </button>
                {editing && (
                  <button type="button" onClick={resetSupplierForm} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                    {t("common.cancel")}
                  </button>
                )}
              </div>
            </form>
          </ProCard>

          <ProCard title="Find suppliers" eyebrow="Search payables" action={<ProBadge tone={suppliers.length === data.suppliers.length ? "slate" : "teal"}>{suppliers.length} shown</ProBadge>}>
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by supplier, phone, contact person or VAT number..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pl-11 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
              />
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            </div>
            <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm font-semibold text-teal-900">
              {data.suppliers.length === 0 || data.products.length === 0
                ? "Add at least one supplier and one product before recording purchases."
                : t("sup.grn_hint")}
            </div>
          </ProCard>
        </section>

        {showPurchase && (
          <section className="mt-6">
            <ProCard eyebrow="Purchase entry" title={t("sup.purchase_grn")} action={<ProBadge tone="teal">{formatLkr(purchaseTotal + (vatRegistered ? effectiveInputVat : 0))}</ProBadge>}>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={purchaseSupplierId} onChange={(e) => setPurchaseSupplierId(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                  <option value="">{t("sup.select")}</option>
                  {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={purchasePayment} onChange={(e) => setPurchasePayment(e.target.value as PaymentMethod)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                  <option value="credit">{t("sup.credit_later")}</option>
                  <option value="cash">{t("sup.cash_paid")}</option>
                  <option value="bank_transfer">{t("pay.bank")}</option>
                  <option value="cheque">{t("sup.cheque_paid")}</option>
                </select>
              </div>

              {purchasePayment === "cheque" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <input placeholder={t("sales.cheque_no")} value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300" />
                  <select value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300">
                    {LK_BANKS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                  <input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300" />
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 sm:col-span-3">
                    <input type="checkbox" checked={postDated} onChange={(e) => setPostDated(e.target.checked)} />
                    {t("sales.pdc")}
                  </label>
                </div>
              )}

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {data.products.map((p) => {
                  const line = purchaseLines[p.id] ?? { qty: 0, unitCost: p.buyPrice };
                  return (
                    <div key={p.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">{p.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{formatLkr(p.buyPrice)}</p>
                        </div>
                        {line.qty > 0 && <ProBadge tone="teal">{formatLkr(line.qty * line.unitCost)}</ProBadge>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input type="number" min={0} placeholder={t("common.qty")} value={line.qty || ""} onChange={(e) => setLine(p.id, Number(e.target.value), line.unitCost)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-teal-300" />
                        <input type="number" min={0} placeholder={t("sup.unit_cost")} value={line.unitCost || ""} onChange={(e) => setLine(p.id, line.qty, Number(e.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-teal-300" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[1.25rem] bg-slate-950 p-4 text-white">
                <div className="flex justify-between text-sm font-semibold text-slate-300">
                  <span>{t("vat.subtotal")}</span>
                  <span className="font-mono">{formatLkr(purchaseTotal)}</span>
                </div>
                {vatRegistered && (
                  <label className="mt-3 block text-sm font-semibold text-slate-300">
                    {t("vat.input_vat")} (18%)
                    <input type="number" min={0} value={purchaseInputVat === "" ? defaultInputVat : purchaseInputVat} onChange={(e) => setPurchaseInputVat(e.target.value === "" ? "" : Number(e.target.value))} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm font-black text-white outline-none" />
                  </label>
                )}
                <div className="mt-3 flex justify-between text-lg font-black text-teal-300">
                  <span>{t("common.total")}</span>
                  <span className="font-mono">{formatLkr(purchaseTotal + (vatRegistered ? effectiveInputVat : 0))}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button onClick={handlePurchase} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">
                  {t("common.save")}
                </button>
                <button onClick={() => setShowPurchase(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                  {t("common.cancel")}
                </button>
              </div>
            </ProCard>
          </section>
        )}

        <section className="mt-6">
          {data.suppliers.length === 0 ? (
            <ProCard>
              <ProEmptyState title={t("sup.no_suppliers")} description="Add suppliers to track GRNs, payables and payment history." />
            </ProCard>
          ) : suppliers.length === 0 ? (
            <ProCard>
              <ProEmptyState title={t("sales.no_match")} description="Try searching by supplier, contact person or VAT number." />
            </ProCard>
          ) : (
            <ProCard title="Supplier list" action={<ProBadge tone="teal">{suppliers.length} suppliers</ProBadge>}>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t("common.supplier")}</th>
                      <th className="px-4 py-3">{t("common.phone")}</th>
                      <th className="px-4 py-3">{t("sup.you_owe_col")}</th>
                      <th className="px-4 py-3">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <SupplierRow
                        key={s.id}
                        supplier={s}
                        onPay={() => {
                          setPaySupplierId(s.id);
                          setPayAmount(s.payableBalance);
                        }}
                        onLedger={() => setLedgerSupplier(s)}
                        onEdit={() => startEdit(s)}
                        onDelete={() => {
                          if (confirm(`${t("common.confirm_delete")} ${s.name}?`)) deleteSupplier(s.id);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {suppliers.map((s) => (
                  <SupplierCard
                    key={s.id}
                    supplier={s}
                    onPay={() => {
                      setPaySupplierId(s.id);
                      setPayAmount(s.payableBalance);
                    }}
                    onLedger={() => setLedgerSupplier(s)}
                    onEdit={() => startEdit(s)}
                    onDelete={() => {
                      if (confirm(`${t("common.confirm_delete")} ${s.name}?`)) deleteSupplier(s.id);
                    }}
                  />
                ))}
              </div>
            </ProCard>
          )}
        </section>

        {data.purchases.length > 0 && (
          <section className="mt-6">
            <ProCard title={t("sup.recent_grn")} action={<ProBadge tone="slate">Latest 10</ProBadge>}>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">GRN</th>
                      <th className="px-4 py-3">{t("common.supplier")}</th>
                      <th className="px-4 py-3">{t("common.items")}</th>
                      <th className="px-4 py-3">{t("common.total")}</th>
                      <th className="px-4 py-3">{t("common.payment")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.purchases.slice(0, 10).map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-mono text-xs font-black text-slate-700">{p.grnNo}</td>
                        <td className="px-4 py-3 font-black text-slate-950">{p.supplierName}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{p.lines.map((l) => `${l.productName}×${l.qty}`).join(", ")}</td>
                        <td className="px-4 py-3 font-mono font-black text-slate-950">{formatLkr(p.total)}</td>
                        <td className="px-4 py-3"><ProBadge tone="slate">{paymentLabel(t, p.paymentMethod)}</ProBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 lg:hidden">
                {data.purchases.slice(0, 10).map((p) => (
                  <div key={p.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-black uppercase tracking-wide text-teal-700">{p.grnNo}</p>
                        <p className="mt-2 font-black text-slate-950">{p.supplierName}</p>
                      </div>
                      <ProBadge tone="slate">{paymentLabel(t, p.paymentMethod)}</ProBadge>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-500">{p.lines.map((l) => `${l.productName}×${l.qty}`).join(", ")}</p>
                    <p className="mt-3 font-mono text-lg font-black text-slate-950">{formatLkr(p.total)}</p>
                  </div>
                ))}
              </div>
            </ProCard>
          </section>
        )}

        {paySupplierId && paySupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-600">{t("sup.pay_supplier")}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{paySupplier.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{t("sup.you_owe_col")}: {formatLkr(paySupplier.payableBalance)}</p>
                </div>
                <button onClick={() => setPaySupplierId(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
              </div>
              <label className="mt-5 block text-sm font-black text-slate-700">
                {t("bills.amount")}
                <input type="number" min={1} value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value))} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
              </label>
              <label className="mt-4 block text-sm font-black text-slate-700">
                {t("common.payment")}
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                  {PAYMENT_OPTIONS.filter((m) => m !== "credit" && m !== "card").map((m) => <option key={m} value={m}>{paymentLabel(t, m)}</option>)}
                </select>
              </label>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => {
                    const ok = recordSupplierPayment(paySupplierId, payAmount, payMethod);
                    if (ok) {
                      setPaySupplierId(null);
                      setMessage(t("sup.pay_saved"));
                      setTimeout(() => setMessage(""), 2500);
                    } else {
                      setMessage(t("common.save_failed"));
                      setTimeout(() => setMessage(""), 2500);
                    }
                  }}
                  className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700"
                >
                  {t("common.save")}
                </button>
                <button onClick={() => setPaySupplierId(null)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {ledgerSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-600">{t("cust.ledger")}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{ledgerSupplier.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{t("sup.you_owe_col")}: {formatLkr(ledgerSupplier.payableBalance)}</p>
                </div>
                <button onClick={() => setLedgerSupplier(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
              </div>
              <div className="mt-5 flex-1 overflow-y-auto rounded-2xl border border-slate-200">
                {ledgerEntries.length === 0 ? (
                  <div className="p-6"><ProEmptyState title={t("cust.ledger_empty")} /></div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">{t("common.date")}</th>
                        <th className="px-4 py-3">{t("common.details")}</th>
                        <th className="px-4 py-3 text-right">{t("bills.amount")}</th>
                        <th className="px-4 py-3 text-right">{t("cust.balance")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerEntries.map((e, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-3 font-semibold text-slate-500">{new Date(e.date).toLocaleDateString("en-LK")}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700">{e.label}</td>
                          <td className={`px-4 py-3 text-right font-mono font-black ${e.amount < 0 ? "text-emerald-700" : "text-slate-800"}`}>{e.amount < 0 ? "−" : "+"}{formatLkr(Math.abs(e.amount))}</td>
                          <td className="px-4 py-3 text-right font-mono font-black text-slate-950">{formatLkr(e.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </ProMain>
    </ProPageShell>
  );
}

function SupplierRow({ supplier, onPay, onLedger, onEdit, onDelete }: { supplier: Supplier; onPay: () => void; onLedger: () => void; onEdit: () => void; onDelete: () => void }) {
  const { t } = useLocale();
  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <p className="font-black text-slate-950">{supplier.name}</p>
        {supplier.contactPerson && <p className="text-xs font-semibold text-slate-400">{supplier.contactPerson}</p>}
        {supplier.vatNumber && <p className="text-xs font-semibold text-slate-400">{t("sup.vat_number")}: {supplier.vatNumber}</p>}
      </td>
      <td className="px-4 py-3 font-semibold text-slate-600">{supplier.phone || "—"}</td>
      <td className="px-4 py-3 font-mono font-black text-amber-700">{formatLkr(supplier.payableBalance)}</td>
      <td className="px-4 py-3"><SupplierActions supplier={supplier} onPay={onPay} onLedger={onLedger} onEdit={onEdit} onDelete={onDelete} /></td>
    </tr>
  );
}

function SupplierCard({ supplier, onPay, onLedger, onEdit, onDelete }: { supplier: Supplier; onPay: () => void; onLedger: () => void; onEdit: () => void; onDelete: () => void }) {
  const { t } = useLocale();
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-slate-950">{supplier.name}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{supplier.phone || t("common.phone")}</p>
          {supplier.contactPerson && <p className="mt-1 text-xs font-semibold text-slate-400">{supplier.contactPerson}</p>}
        </div>
        {supplier.payableBalance > 0 ? <ProBadge tone="amber">Payable</ProBadge> : <ProBadge tone="emerald">Clear</ProBadge>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-white p-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{t("sup.you_owe_col")}</p>
          <p className="mt-1 font-mono text-sm font-black text-amber-700">{formatLkr(supplier.payableBalance)}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{t("sup.vat_number")}</p>
          <p className="mt-1 truncate text-sm font-black text-slate-900">{supplier.vatNumber || "—"}</p>
        </div>
      </div>
      <div className="mt-4"><SupplierActions supplier={supplier} onPay={onPay} onLedger={onLedger} onEdit={onEdit} onDelete={onDelete} mobile /></div>
    </article>
  );
}

function SupplierActions({ supplier, onPay, onLedger, onEdit, onDelete, mobile = false }: { supplier: Supplier; onPay: () => void; onLedger: () => void; onEdit: () => void; onDelete: () => void; mobile?: boolean }) {
  const { t } = useLocale();
  const buttonClass = mobile ? "rounded-2xl px-3 py-3 text-xs font-black" : "rounded-full px-3 py-1.5 text-xs font-black";
  return (
    <div className={mobile ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
      {supplier.payableBalance > 0 && <button onClick={onPay} className={`${buttonClass} bg-teal-50 text-teal-700 hover:bg-teal-100`}>{t("sup.pay_supplier")}</button>}
      <button onClick={onLedger} className={`${buttonClass} bg-slate-100 text-slate-700 hover:bg-slate-200`}>{t("cust.ledger")}</button>
      <button onClick={onEdit} className={`${buttonClass} bg-sky-50 text-sky-700 hover:bg-sky-100`}>{t("common.edit")}</button>
      <button onClick={onDelete} className={`${buttonClass} bg-rose-50 text-rose-700 hover:bg-rose-100`}>{t("common.delete")}</button>
    </div>
  );
}
