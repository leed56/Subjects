"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
} from "@/components/ui/pro-shell";
import {
  Button,
  MetricCard,
  PageHeader,
  SearchInput,
  Tabs,
} from "@/components/ui/primitives";
import { SuppliersIcon, InboxIcon, BillsIcon, VatIcon } from "@/components/ui/icons";
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { buildLedger } from "@/lib/ledger";
import { useAppStore } from "@/lib/store/use-app-store";
import type { PurchaseOrder, Supplier } from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";
import { calcInputVat } from "@/lib/vat";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";

type SupplierSection = "directory" | "orders" | "receipts";

export default function SuppliersPage() {
  const {
    data,
    ready,
    saveSupplierToCloud,
    deleteSupplierToCloud,
    createPurchaseToCloud,
    createPurchaseOrderToCloud,
    receivePurchaseOrderToCloud,
    cancelPurchaseOrderToCloud,
    recordSupplierPaymentToCloud,
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
  const [activeSection, setActiveSection] = useState<SupplierSection>("directory");
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const [showPo, setShowPo] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poJobId, setPoJobId] = useState("");
  const [poLines, setPoLines] = useState<Record<string, { qty: number; unitCost: number }>>({});
  const [savingPo, setSavingPo] = useState(false);
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});
  const [savingReceive, setSavingReceive] = useState(false);
  const [cancellingPoId, setCancellingPoId] = useState<string | null>(null);

  const purchaseTotal = useMemo(() => {
    if (!data) return 0;
    return Object.entries(purchaseLines).reduce((sum, [, line]) => {
      if (line.qty <= 0) return sum;
      return sum + line.qty * line.unitCost;
    }, 0);
  }, [purchaseLines, data]);

  const poExpectedTotal = useMemo(() => {
    return Object.entries(poLines).reduce((sum, [, line]) => {
      if (line.qty <= 0) return sum;
      return sum + line.qty * line.unitCost;
    }, 0);
  }, [poLines]);

  const vatRegistered = data?.business.vatRegistered === true;
  const defaultInputVat = vatRegistered ? calcInputVat(purchaseTotal) : 0;
  const effectiveInputVat = purchaseInputVat === "" ? defaultInputVat : Number(purchaseInputVat);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
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

  const saveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || savingSupplier) return;
    setSavingSupplier(true);
    setMessage("");
    const result = await saveSupplierToCloud(
      { name, phone, address, vatNumber, contactPerson },
      editing?.id,
    );
    setSavingSupplier(false);
    if (!result.ok) {
      setMessage(result.error ?? t("common.save_failed"));
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    resetSupplierForm();
    setMessage(editing ? t("sup.updated") : t("sup.added"));
    setTimeout(() => setMessage(""), 2500);
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (deletingId) return;
    if (!confirm(`${t("common.confirm_delete")} ${supplier.name}?`)) return;
    setDeletingId(supplier.id);
    const result = await deleteSupplierToCloud(supplier.id);
    setDeletingId(null);
    if (!result.ok) {
      setMessage(result.error ?? t("common.save_failed"));
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    if (editing?.id === supplier.id) resetSupplierForm();
    setMessage(t("sup.deleted"));
    setTimeout(() => setMessage(""), 2500);
  };

  const handlePurchase = async () => {
    if (savingPurchase) return;
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
    setSavingPurchase(true);
    setMessage("");
    const result = await createPurchaseToCloud({
      supplierId: purchaseSupplierId,
      lines,
      paymentMethod: purchasePayment,
      inputVat: vatRegistered ? effectiveInputVat : 0,
      chequeNo: purchasePayment === "cheque" ? chequeNo : undefined,
      chequeBank: purchasePayment === "cheque" ? chequeBank : undefined,
      chequeDate: purchasePayment === "cheque" ? chequeDate : undefined,
      postDated: purchasePayment === "cheque" ? postDated : undefined,
    });
    setSavingPurchase(false);
    if (!result.ok) {
      setMessage(result.error ?? t("sup.failed"));
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    setShowPurchase(false);
    setPurchaseLines({});
    setPurchaseInputVat("");
    setMessage(t("sup.saved"));
    setTimeout(() => setMessage(""), 3000);
  };

  const handleSupplierPayment = async () => {
    if (!paySupplierId || savingPayment || payAmount <= 0) return;
    setSavingPayment(true);
    setMessage("");
    const result = await recordSupplierPaymentToCloud(
      paySupplierId,
      payAmount,
      payMethod,
    );
    setSavingPayment(false);
    if (!result.ok) {
      setMessage(result.error ?? t("common.save_failed"));
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    setPaySupplierId(null);
    setMessage(t("sup.pay_saved"));
    setTimeout(() => setMessage(""), 2500);
  };

  const handleCreatePo = async () => {
    if (savingPo) return;
    if (!poSupplierId) {
      setMessage(t("sup.select_supplier"));
      return;
    }
    const lines = Object.entries(poLines)
      .filter(([, l]) => l.qty > 0)
      .map(([productId, l]) => ({ productId, qty: l.qty, unitCost: l.unitCost }));
    if (lines.length === 0) {
      setMessage(t("sup.add_qty"));
      return;
    }
    setSavingPo(true);
    setMessage("");
    const result = await createPurchaseOrderToCloud({
      supplierId: poSupplierId,
      lines,
      relatedJobId: poJobId || undefined,
    });
    setSavingPo(false);
    if (!result.ok) {
      setMessage(result.error ?? t("sup.po_failed"));
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    setShowPo(false);
    setPoLines({});
    setPoJobId("");
    setMessage(t("sup.po_saved"));
    setTimeout(() => setMessage(""), 3000);
  };

  const openReceive = (po: PurchaseOrder) => {
    setReceivingPo(po);
    setReceiveQty({});
  };

  const handleReceivePo = async () => {
    if (!receivingPo || savingReceive) return;
    const lines = Object.entries(receiveQty)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qtyReceived]) => ({ productId, qtyReceived }));
    if (lines.length === 0) {
      setMessage(t("sup.add_qty"));
      return;
    }
    setSavingReceive(true);
    setMessage("");
    const result = await receivePurchaseOrderToCloud(receivingPo.id, lines);
    setSavingReceive(false);
    if (!result.ok) {
      setMessage(result.error ?? t("sup.po_receive_failed"));
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    setReceivingPo(null);
    setReceiveQty({});
    setMessage(t("sup.po_receive_saved"));
    setTimeout(() => setMessage(""), 3000);
  };

  const handleCancelPo = async (po: PurchaseOrder) => {
    if (cancellingPoId) return;
    if (!confirm(t("sup.po_cancel_confirm"))) return;
    setCancellingPoId(po.id);
    const result = await cancelPurchaseOrderToCloud(po.id);
    setCancellingPoId(null);
    if (!result.ok) {
      setMessage(result.error ?? t("common.save_failed"));
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    setMessage(t("sup.po_cancelled"));
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

  const openPurchase = () => {
    setShowPurchase(true);
    setShowPo(false);
    setActiveSection("receipts");
    if (!purchaseSupplierId && data.suppliers[0]) setPurchaseSupplierId(data.suppliers[0].id);
  };

  const setPoLine = (productId: string, qty: number, unitCost: number) => {
    setPoLines((prev) => ({ ...prev, [productId]: { qty, unitCost } }));
  };

  const openPo = () => {
    setShowPo(true);
    setShowPurchase(false);
    setActiveSection("orders");
    if (!poSupplierId && data.suppliers[0]) setPoSupplierId(data.suppliers[0].id);
  };

  const setReceiveLineQty = (productId: string, qty: number) => {
    setReceiveQty((prev) => ({ ...prev, [productId]: qty }));
  };

  const poStatusTone = (status: PurchaseOrder["status"]): "slate" | "amber" | "emerald" | "teal" => {
    if (status === "received") return "emerald";
    if (status === "partial") return "teal";
    if (status === "cancelled") return "slate";
    return "amber";
  };

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("sup.title")}
          description="Manage supplier relationships, purchase orders, goods receipts and payables from one operational workspace."
          actions={
            <>
              <ProButton href="/stock" variant="secondary">{t("nav.stock")}</ProButton>
              <Button
                onClick={openPo}
                disabled={data.suppliers.length === 0 || data.products.length === 0}
                variant="secondary"
              >
                {t("sup.new_po")}
              </Button>
              <Button
                onClick={openPurchase}
                disabled={data.suppliers.length === 0 || data.products.length === 0}
                variant="primary"
              >
                {t("sup.record_purchase")}
              </Button>
            </>
          }
          metrics={
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={t("nav.suppliers")} value={String(data.suppliers.length)} hint="Active supplier profiles" icon={<SuppliersIcon className="h-5 w-5" />} />
              <MetricCard label={t("sup.you_owe_col")} value={formatLkr(totalPayable)} hint={`${payableSuppliers} suppliers payable`} icon={<InboxIcon className="h-5 w-5" />} tone={totalPayable > 0 ? "warning" : "positive"} />
              <MetricCard label={t("sup.vat_number")} value={String(vatSuppliers)} hint="VAT-ready records" icon={<VatIcon className="h-5 w-5" />} />
              <MetricCard label={t("sup.recent_grn")} value={formatLkr(recentPurchaseValue)} hint="Latest 10 receipts" icon={<BillsIcon className="h-5 w-5" />} tone="positive" />
            </section>
          }
        />

        <WriteDisabledHint className="mb-5" />

        {message && (
          <div className="mb-5 rounded-[1.25rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 shadow-sm">
            {message}
          </div>
        )}

        <div className="mb-6">
          <Tabs
            value={activeSection}
            onChange={(value) => setActiveSection(value as SupplierSection)}
            tabs={[
              { value: "directory", label: `${t("nav.suppliers")} (${data.suppliers.length})` },
              { value: "orders", label: `${t("sup.po_title")} (${data.purchaseOrders.length})` },
              { value: "receipts", label: `${t("sup.recent_grn")} (${data.purchases.length})` },
            ]}
          />
        </div>

        {activeSection === "directory" && <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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
                <button type="submit" disabled={!canWrite || savingSupplier} title={!canWrite ? (disabledHint ?? undefined) : undefined} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {savingSupplier ? t("common.saving") : editing ? t("common.update") : t("sup.add")}
                </button>
                {editing && (
                  <button type="button" onClick={resetSupplierForm} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    {t("common.cancel")}
                  </button>
                )}
              </div>
            </form>
          </ProCard>

          <ProCard title="Find suppliers" eyebrow="Search payables" action={<ProBadge tone={suppliers.length === data.suppliers.length ? "slate" : "teal"}>{suppliers.length} shown</ProBadge>}>
            <div>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by supplier, phone, contact person or VAT number..."
              />
            </div>
            <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm font-semibold text-teal-900">
              {data.suppliers.length === 0 || data.products.length === 0
                ? "Add at least one supplier and one product before recording purchases."
                : t("sup.grn_hint")}
            </div>
          </ProCard>
        </section>}

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
                          <p className="truncate text-sm font-bold text-slate-950">{p.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{formatLkr(p.buyPrice)}</p>
                        </div>
                        {line.qty > 0 && <ProBadge tone="teal">{formatLkr(line.qty * line.unitCost)}</ProBadge>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input type="number" min={0} placeholder={t("common.qty")} value={line.qty || ""} onChange={(e) => setLine(p.id, Number(e.target.value), line.unitCost)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-teal-300" />
                        <input type="number" min={0} placeholder={t("sup.unit_cost")} value={line.unitCost || ""} onChange={(e) => setLine(p.id, line.qty, Number(e.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-teal-300" />
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
                    <input type="number" min={0} value={purchaseInputVat === "" ? defaultInputVat : purchaseInputVat} onChange={(e) => setPurchaseInputVat(e.target.value === "" ? "" : Number(e.target.value))} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm font-bold text-white outline-none" />
                  </label>
                )}
                <div className="mt-3 flex justify-between text-lg font-bold text-teal-300">
                  <span>{t("common.total")}</span>
                  <span className="font-mono">{formatLkr(purchaseTotal + (vatRegistered ? effectiveInputVat : 0))}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button onClick={() => void handlePurchase()} disabled={savingPurchase} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {savingPurchase ? t("common.saving") : t("common.save")}
                </button>
                <button onClick={() => setShowPurchase(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  {t("common.cancel")}
                </button>
              </div>
            </ProCard>
          </section>
        )}

        {showPo && (
          <section className="mt-6">
            <ProCard eyebrow="Purchase order" title={t("sup.po_create_title")} action={<ProBadge tone="teal">{formatLkr(poExpectedTotal)}</ProBadge>}>
              <p className="mb-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-3 text-xs font-semibold text-teal-900">{t("sup.po_hint")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                  <option value="">{t("sup.select")}</option>
                  {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {data.acJobs.length > 0 && (
                  <select value={poJobId} onChange={(e) => setPoJobId(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                    <option value="">{t("sup.po_no_job")}</option>
                    {data.acJobs.map((j) => <option key={j.id} value={j.id}>{j.jobNo} — {j.customerName}</option>)}
                  </select>
                )}
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {data.products.map((p) => {
                  const line = poLines[p.id] ?? { qty: 0, unitCost: p.buyPrice };
                  return (
                    <div key={p.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-950">{p.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{formatLkr(p.buyPrice)}</p>
                        </div>
                        {line.qty > 0 && <ProBadge tone="teal">{formatLkr(line.qty * line.unitCost)}</ProBadge>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input type="number" min={0} placeholder={t("common.qty")} value={line.qty || ""} onChange={(e) => setPoLine(p.id, Number(e.target.value), line.unitCost)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-teal-300" />
                        <input type="number" min={0} placeholder={t("sup.unit_cost")} value={line.unitCost || ""} onChange={(e) => setPoLine(p.id, line.qty, Number(e.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-teal-300" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[1.25rem] bg-slate-950 p-4 text-white">
                <div className="flex justify-between text-lg font-bold text-teal-300">
                  <span>{t("sup.po_expected")}</span>
                  <span className="font-mono">{formatLkr(poExpectedTotal)}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button onClick={() => void handleCreatePo()} disabled={savingPo} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {savingPo ? t("common.saving") : t("common.save")}
                </button>
                <button onClick={() => setShowPo(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  {t("common.cancel")}
                </button>
              </div>
            </ProCard>
          </section>
        )}

        {activeSection === "directory" && <section className="mt-6">
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
                  <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
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
                        onDelete={() => void handleDeleteSupplier(s)}
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
                    onDelete={() => void handleDeleteSupplier(s)}
                  />
                ))}
              </div>
            </ProCard>
          )}
        </section>}

        {activeSection === "receipts" && data.purchases.length > 0 && (
          <section className="mt-6">
            <ProCard title={t("sup.recent_grn")} action={<ProBadge tone="slate">Latest 10</ProBadge>}>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
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
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{p.grnNo}</td>
                        <td className="px-4 py-3 font-bold text-slate-950">{p.supplierName}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{p.lines.map((l) => `${l.productName}×${l.qty}`).join(", ")}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-950">{formatLkr(p.total)}</td>
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
                        <p className="font-mono text-xs font-bold uppercase tracking-wide text-teal-700">{p.grnNo}</p>
                        <p className="mt-2 font-bold text-slate-950">{p.supplierName}</p>
                      </div>
                      <ProBadge tone="slate">{paymentLabel(t, p.paymentMethod)}</ProBadge>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-500">{p.lines.map((l) => `${l.productName}×${l.qty}`).join(", ")}</p>
                    <p className="mt-3 font-mono text-lg font-bold text-slate-950">{formatLkr(p.total)}</p>
                  </div>
                ))}
              </div>
            </ProCard>
          </section>
        )}

        {activeSection === "orders" && data.purchaseOrders.length > 0 && (
          <section className="mt-6">
            <ProCard title={t("sup.po_title")} action={<ProBadge tone="teal">{data.purchaseOrders.length}</ProBadge>}>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">PO</th>
                      <th className="px-4 py-3">{t("common.supplier")}</th>
                      <th className="px-4 py-3">{t("common.items")}</th>
                      <th className="px-4 py-3">{t("sup.po_expected")}</th>
                      <th className="px-4 py-3">{t("common.status")}</th>
                      <th className="px-4 py-3">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.purchaseOrders.map((po) => {
                      const canReceive = po.status === "pending" || po.status === "partial";
                      const canCancel = po.status !== "cancelled" && po.status !== "received" && po.lines.every((l) => l.qtyReceived === 0);
                      return (
                        <tr key={po.id} className="border-b last:border-0">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{po.poNo}</td>
                          <td className="px-4 py-3 font-bold text-slate-950">{po.supplierName}</td>
                          <td className="px-4 py-3 font-semibold text-slate-600">{po.lines.map((l) => `${l.productName} (${l.qtyReceived}/${l.qtyOrdered})`).join(", ")}</td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-950">{formatLkr(po.expectedTotal)}</td>
                          <td className="px-4 py-3"><ProBadge tone={poStatusTone(po.status)}>{t(`sup.po_status_${po.status}`)}</ProBadge></td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {canReceive && (
                                <button onClick={() => openReceive(po)} className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100">
                                  {t("sup.po_receive_action")}
                                </button>
                              )}
                              {canCancel && (
                                <button onClick={() => void handleCancelPo(po)} disabled={cancellingPoId === po.id} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                                  {t("sup.po_cancel_action")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 lg:hidden">
                {data.purchaseOrders.map((po) => {
                  const canReceive = po.status === "pending" || po.status === "partial";
                  const canCancel = po.status !== "cancelled" && po.status !== "received" && po.lines.every((l) => l.qtyReceived === 0);
                  return (
                    <div key={po.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-bold uppercase tracking-wide text-teal-700">{po.poNo}</p>
                          <p className="mt-2 font-bold text-slate-950">{po.supplierName}</p>
                        </div>
                        <ProBadge tone={poStatusTone(po.status)}>{t(`sup.po_status_${po.status}`)}</ProBadge>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-slate-500">{po.lines.map((l) => `${l.productName} (${l.qtyReceived}/${l.qtyOrdered})`).join(", ")}</p>
                      <p className="mt-3 font-mono text-lg font-bold text-slate-950">{formatLkr(po.expectedTotal)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canReceive && (
                          <button onClick={() => openReceive(po)} className="rounded-2xl bg-teal-50 px-3 py-3 text-xs font-bold text-teal-700 hover:bg-teal-100">
                            {t("sup.po_receive_action")}
                          </button>
                        )}
                        {canCancel && (
                          <button onClick={() => void handleCancelPo(po)} disabled={cancellingPoId === po.id} className="rounded-2xl bg-rose-50 px-3 py-3 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                            {t("sup.po_cancel_action")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ProCard>
          </section>
        )}

        {paySupplierId && paySupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-white/80 bg-white p-5 shadow-sm shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">{t("sup.pay_supplier")}</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">{paySupplier.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{t("sup.you_owe_col")}: {formatLkr(paySupplier.payableBalance)}</p>
                </div>
                <button onClick={() => setPaySupplierId(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
              </div>
              <label className="mt-5 block text-sm font-bold text-slate-700">
                {t("bills.amount")}
                <input type="number" min={1} value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value))} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
              </label>
              <label className="mt-4 block text-sm font-bold text-slate-700">
                {t("common.payment")}
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                  {PAYMENT_OPTIONS.filter((m) => m !== "credit" && m !== "card").map((m) => <option key={m} value={m}>{paymentLabel(t, m)}</option>)}
                </select>
              </label>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => void handleSupplierPayment()}
                  disabled={savingPayment || payAmount <= 0}
                  className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingPayment ? t("common.saving") : t("common.save")}
                </button>
                <button onClick={() => setPaySupplierId(null)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {receivingPo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-white/80 bg-white p-5 shadow-sm shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">{t("sup.po_receive_title")}</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">{receivingPo.poNo}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{receivingPo.supplierName}</p>
                </div>
                <button onClick={() => setReceivingPo(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
              </div>
              <p className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-3 text-xs font-semibold text-teal-900">{t("sup.po_receive_hint")}</p>
              <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                {receivingPo.lines.map((line) => {
                  const outstanding = Math.max(0, line.qtyOrdered - line.qtyReceived);
                  if (outstanding <= 0) return null;
                  return (
                    <div key={line.productId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-bold text-slate-950">{line.productName}</p>
                        <p className="text-xs font-semibold text-slate-500">{t("sup.po_qty_received")}: {line.qtyReceived}/{line.qtyOrdered}</p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={outstanding}
                        placeholder={t("common.qty")}
                        value={receiveQty[line.productId] || ""}
                        onChange={(e) => setReceiveLineQty(line.productId, Math.min(outstanding, Math.max(0, Number(e.target.value))))}
                        className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-teal-300"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => void handleReceivePo()}
                  disabled={savingReceive}
                  className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingReceive ? t("common.saving") : t("common.save")}
                </button>
                <button onClick={() => setReceivingPo(null)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {ledgerSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-white/80 bg-white p-5 shadow-sm shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">{t("cust.ledger")}</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">{ledgerSupplier.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{t("sup.you_owe_col")}: {formatLkr(ledgerSupplier.payableBalance)}</p>
                </div>
                <button onClick={() => setLedgerSupplier(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
              </div>
              <div className="mt-5 flex-1 overflow-y-auto rounded-2xl border border-slate-200">
                {ledgerEntries.length === 0 ? (
                  <div className="p-6"><ProEmptyState title={t("cust.ledger_empty")} /></div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
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
                          <td className={`px-4 py-3 text-right font-mono font-bold ${e.amount < 0 ? "text-emerald-700" : "text-slate-800"}`}>{e.amount < 0 ? "−" : "+"}{formatLkr(Math.abs(e.amount))}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{formatLkr(e.balance)}</td>
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
    </AppShell>
  );
}

function SupplierRow({ supplier, onPay, onLedger, onEdit, onDelete }: { supplier: Supplier; onPay: () => void; onLedger: () => void; onEdit: () => void; onDelete: () => void }) {
  const { t } = useLocale();
  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <p className="font-bold text-slate-950">{supplier.name}</p>
        {supplier.contactPerson && <p className="text-xs font-semibold text-slate-400">{supplier.contactPerson}</p>}
        {supplier.vatNumber && <p className="text-xs font-semibold text-slate-400">{t("sup.vat_number")}: {supplier.vatNumber}</p>}
      </td>
      <td className="px-4 py-3 font-semibold text-slate-600">{supplier.phone || "—"}</td>
      <td className="px-4 py-3 font-mono font-bold text-amber-700">{formatLkr(supplier.payableBalance)}</td>
      <td className="px-4 py-3"><SupplierActions supplier={supplier} onPay={onPay} onLedger={onLedger} onEdit={onEdit} onDelete={onDelete} /></td>
    </tr>
  );
}

function SupplierCard({ supplier, onPay, onLedger, onEdit, onDelete }: { supplier: Supplier; onPay: () => void; onLedger: () => void; onEdit: () => void; onDelete: () => void }) {
  const { t } = useLocale();
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-slate-950">{supplier.name}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{supplier.phone || t("common.phone")}</p>
          {supplier.contactPerson && <p className="mt-1 text-xs font-semibold text-slate-400">{supplier.contactPerson}</p>}
        </div>
        {supplier.payableBalance > 0 ? <ProBadge tone="amber">Payable</ProBadge> : <ProBadge tone="emerald">Clear</ProBadge>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-white p-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("sup.you_owe_col")}</p>
          <p className="mt-1 font-mono text-sm font-bold text-amber-700">{formatLkr(supplier.payableBalance)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("sup.vat_number")}</p>
          <p className="mt-1 truncate text-sm font-bold text-slate-900">{supplier.vatNumber || "—"}</p>
        </div>
      </div>
      <div className="mt-4"><SupplierActions supplier={supplier} onPay={onPay} onLedger={onLedger} onEdit={onEdit} onDelete={onDelete} mobile /></div>
    </article>
  );
}

function SupplierActions({ supplier, onPay, onLedger, onEdit, onDelete, mobile = false }: { supplier: Supplier; onPay: () => void; onLedger: () => void; onEdit: () => void; onDelete: () => void; mobile?: boolean }) {
  const { t } = useLocale();
  const buttonClass = mobile ? "rounded-2xl px-3 py-3 text-xs font-bold" : "rounded-full px-3 py-1.5 text-xs font-bold";
  return (
    <div className={mobile ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
      {supplier.payableBalance > 0 && <button onClick={onPay} className={`${buttonClass} bg-teal-50 text-teal-700 hover:bg-teal-100`}>{t("sup.pay_supplier")}</button>}
      <button onClick={onLedger} className={`${buttonClass} bg-slate-100 text-slate-700 hover:bg-slate-200`}>{t("cust.ledger")}</button>
      <button onClick={onEdit} className={`${buttonClass} bg-sky-50 text-sky-700 hover:bg-sky-100`}>{t("common.edit")}</button>
      <button onClick={onDelete} className={`${buttonClass} bg-rose-50 text-rose-700 hover:bg-rose-100`}>{t("common.delete")}</button>
    </div>
  );
}
