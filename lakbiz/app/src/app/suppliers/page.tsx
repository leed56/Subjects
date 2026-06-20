"use client";

import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { buildLedger } from "@/lib/ledger";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { calcInputVat } from "@/lib/vat";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Supplier } from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";

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

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [message, setMessage] = useState("");

  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState("");
  const [purchasePayment, setPurchasePayment] =
    useState<PaymentMethod>("credit");
  const [purchaseLines, setPurchaseLines] = useState<
    Record<string, { qty: number; unitCost: number }>
  >({});
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState(LK_BANKS[0]);
  const [chequeDate, setChequeDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [postDated, setPostDated] = useState(false);
  const [purchaseInputVat, setPurchaseInputVat] = useState<number | "">("");

  const [paySupplierId, setPaySupplierId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");

  const purchaseTotal = useMemo(() => {
    if (!data) return 0;
    return Object.entries(purchaseLines).reduce((sum, [productId, line]) => {
      if (line.qty <= 0) return sum;
      return sum + line.qty * line.unitCost;
    }, 0);
  }, [purchaseLines, data]);

  const vatRegistered = data?.business.vatRegistered === true;
  const defaultInputVat = vatRegistered ? calcInputVat(purchaseTotal) : 0;
  const effectiveInputVat =
    purchaseInputVat === "" ? defaultInputVat : Number(purchaseInputVat);

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">{t("common.loading")}</main>
      </div>
    );
  }

  const totalPayable = data.suppliers.reduce((s, sup) => s + sup.payableBalance, 0);

  const resetSupplierForm = () => {
    setName("");
    setPhone("");
    setAddress("");
    setVatNumber("");
    setContactPerson("");
    setEditing(null);
  };

  const ledgerEntries = ledgerSupplier
    ? buildLedger(
        data.purchases
          .filter(
            (p) => p.supplierId === ledgerSupplier.id && p.creditAmount > 0,
          )
          .map((p) => ({
            date: p.date,
            label: `GRN ${p.grnNo}`,
            amount: p.creditAmount,
          })),
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
    setPurchaseLines((prev) => ({
      ...prev,
      [productId]: { qty, unitCost },
    }));
  };

  const handlePurchase = () => {
    if (!purchaseSupplierId) {
      setMessage(t("sup.select_supplier"));
      return;
    }
    const lines = Object.entries(purchaseLines)
      .filter(([, l]) => l.qty > 0)
      .map(([productId, l]) => ({
        productId,
        qty: l.qty,
        unitCost: l.unitCost,
      }));
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

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("sup.title")}</h1>
            <p className="text-slate-600">
              {t("sup.you_owe")}{" "}
              <strong>{formatLkr(totalPayable)}</strong>
            </p>
          </div>
          <button
            onClick={() => {
              setShowPurchase((v) => !v);
              if (!purchaseSupplierId && data.suppliers[0]) {
                setPurchaseSupplierId(data.suppliers[0].id);
              }
            }}
            disabled={data.suppliers.length === 0 || data.products.length === 0}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {t("sup.record_purchase")}
          </button>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {message}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            if (editing) {
              updateSupplier(editing.id, {
                name,
                phone,
                address,
                vatNumber,
                contactPerson,
              });
              resetSupplierForm();
            } else {
              addSupplier({ name, phone, address, vatNumber, contactPerson });
              resetSupplierForm();
            }
          }}
          className="mb-8 rounded-xl border bg-white p-5"
        >
          <h2 className="font-semibold">
            {editing ? t("sup.edit") : t("sup.add")}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              required
              placeholder={t("sup.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              placeholder={t("common.phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              placeholder={t("common.address")}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              placeholder={t("sup.contact_person")}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              placeholder={t("sup.vat_number")}
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
            >
              {editing ? t("common.update") : t("sup.add")}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetSupplierForm}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                {t("common.cancel")}
              </button>
            )}
          </div>
        </form>

        {showPurchase && (
          <div className="mb-8 rounded-xl border border-teal-200 bg-white p-5">
            <h2 className="font-semibold">{t("sup.purchase_grn")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("sup.grn_hint")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                value={purchaseSupplierId}
                onChange={(e) => setPurchaseSupplierId(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">{t("sup.select")}</option>
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={purchasePayment}
                onChange={(e) =>
                  setPurchasePayment(e.target.value as PaymentMethod)
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="credit">{t("sup.credit_later")}</option>
                <option value="cash">{t("sup.cash_paid")}</option>
                <option value="bank_transfer">{t("pay.bank")}</option>
                <option value="cheque">{t("sup.cheque_paid")}</option>
              </select>
            </div>

            {purchasePayment === "cheque" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  placeholder={t("sales.cheque_no")}
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
                <select
                  value={chequeBank}
                  onChange={(e) => setChequeBank(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  {LK_BANKS.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="mt-4 space-y-2">
              {data.products.map((p) => {
                const line = purchaseLines[p.id] ?? {
                  qty: 0,
                  unitCost: p.buyPrice,
                };
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 text-sm"
                  >
                    <span className="font-medium">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        placeholder={t("common.qty")}
                        value={line.qty || ""}
                        onChange={(e) =>
                          setLine(p.id, Number(e.target.value), line.unitCost)
                        }
                        className="w-20 rounded border px-2 py-1"
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder={t("sup.unit_cost")}
                        value={line.unitCost || ""}
                        onChange={(e) =>
                          setLine(p.id, line.qty, Number(e.target.value))
                        }
                        className="w-28 rounded border px-2 py-1"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 font-semibold">
              {t("vat.subtotal")}: {formatLkr(purchaseTotal)}
            </p>
            {vatRegistered && (
              <label className="mt-3 block text-sm">
                {t("vat.input_vat")} (18%)
                <input
                  type="number"
                  min={0}
                  value={purchaseInputVat === "" ? defaultInputVat : purchaseInputVat}
                  onChange={(e) =>
                    setPurchaseInputVat(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            )}
            <p className="mt-2 text-lg font-bold">
              {t("common.total")}:{" "}
              {formatLkr(purchaseTotal + (vatRegistered ? effectiveInputVat : 0))}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handlePurchase}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
              >
                {t("common.save")}
              </button>
              <button
                onClick={() => setShowPurchase(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {data.suppliers.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">
            {t("sup.no_suppliers")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t("common.supplier")}</th>
                  <th className="px-4 py-3">{t("common.phone")}</th>
                  <th className="px-4 py-3">{t("sup.you_owe_col")}</th>
                  <th className="px-4 py-3">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {data.suppliers.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.name}</p>
                      {s.contactPerson && (
                        <p className="text-xs text-slate-400">
                          {s.contactPerson}
                        </p>
                      )}
                      {s.vatNumber && (
                        <p className="text-xs text-slate-400">
                          {t("sup.vat_number")}: {s.vatNumber}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">{s.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          s.payableBalance > 0
                            ? "font-semibold text-amber-700"
                            : "text-slate-500"
                        }
                      >
                        {formatLkr(s.payableBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {s.payableBalance > 0 && (
                          <button
                            onClick={() => {
                              setPaySupplierId(s.id);
                              setPayAmount(s.payableBalance);
                            }}
                            className="text-teal-700 hover:underline"
                          >
                            {t("sup.pay_supplier")}
                          </button>
                        )}
                        <button
                          onClick={() => setLedgerSupplier(s)}
                          className="text-teal-700 hover:underline"
                        >
                          {t("cust.ledger")}
                        </button>
                        <button
                          onClick={() => {
                            setEditing(s);
                            setName(s.name);
                            setPhone(s.phone ?? "");
                            setAddress(s.address ?? "");
                            setVatNumber(s.vatNumber ?? "");
                            setContactPerson(s.contactPerson ?? "");
                          }}
                          className="text-teal-700 hover:underline"
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`${t("common.confirm_delete")} ${s.name}?`))
                              deleteSupplier(s.id);
                          }}
                          className="text-red-600 hover:underline"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.purchases.length > 0 && (
          <section className="mt-10">
            <h2 className="font-semibold">{t("sup.recent_grn")}</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-600">
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
                      <td className="px-4 py-3 font-mono text-xs">{p.grnNo}</td>
                      <td className="px-4 py-3">{p.supplierName}</td>
                      <td className="px-4 py-3">
                        {p.lines.map((l) => `${l.productName}×${l.qty}`).join(", ")}
                      </td>
                      <td className="px-4 py-3">{formatLkr(p.total)}</td>
                      <td className="px-4 py-3">
                        {paymentLabel(t, p.paymentMethod)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {paySupplierId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5">
              <h3 className="font-semibold">{t("sup.pay_supplier")}</h3>
              <input
                type="number"
                min={1}
                value={payAmount || ""}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className="mt-3 w-full rounded-lg border px-3 py-2"
              />
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="mt-3 w-full rounded-lg border px-3 py-2"
              >
                {PAYMENT_OPTIONS.filter((m) => m !== "credit" && m !== "card").map(
                  (m) => (
                    <option key={m} value={m}>
                      {paymentLabel(t, m)}
                    </option>
                  ),
                )}
              </select>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    recordSupplierPayment(paySupplierId, payAmount, payMethod);
                    setPaySupplierId(null);
                    setMessage(t("sup.pay_saved"));
                  }}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
                >
                  {t("common.save")}
                </button>
                <button
                  onClick={() => setPaySupplierId(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {ledgerSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {t("cust.ledger")} — {ledgerSupplier.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {t("sup.you_owe_col")}: {formatLkr(ledgerSupplier.payableBalance)}
                  </p>
                </div>
                <button
                  onClick={() => setLedgerSupplier(null)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto">
                {ledgerEntries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    {t("cust.ledger_empty")}
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-slate-500">
                      <tr>
                        <th className="py-2">{t("common.date")}</th>
                        <th className="py-2">{t("common.details")}</th>
                        <th className="py-2 text-right">{t("bills.amount")}</th>
                        <th className="py-2 text-right">{t("cust.balance")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerEntries.map((e, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 text-slate-500">
                            {new Date(e.date).toLocaleDateString("en-LK")}
                          </td>
                          <td className="py-2">{e.label}</td>
                          <td
                            className={`py-2 text-right tabular-nums ${
                              e.amount < 0 ? "text-emerald-700" : "text-slate-800"
                            }`}
                          >
                            {e.amount < 0 ? "−" : "+"}
                            {formatLkr(Math.abs(e.amount))}
                          </td>
                          <td className="py-2 text-right font-medium tabular-nums">
                            {formatLkr(e.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
