"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Customer } from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";

export default function CustomersPage() {
  const {
    data,
    ready,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    recordCustomerPayment,
  } = useAppStore();
  const { t } = useLocale();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [payCustomerId, setPayCustomerId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [message, setMessage] = useState("");

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">{t("common.loading")}</main>
      </div>
    );
  }

  const resetForm = () => {
    setName("");
    setPhone("");
    setAddress("");
    setEditing(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing) {
      updateCustomer(editing.id, { name, phone, address });
      resetForm();
      setMessage(t("cust.updated"));
    } else {
      addCustomer({ name, phone, address });
      resetForm();
      setMessage(t("cust.added"));
    }
    setTimeout(() => setMessage(""), 2500);
  };

  const totalCredit = data.customers.reduce((s, c) => s + c.creditBalance, 0);

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{t("cust.title")}</h1>
          <p className="text-slate-600">
            {t("cust.subtitle")} · {t("cust.total_owed")}{" "}
            <strong>{formatLkr(totalCredit)}</strong>
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {message}
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold text-slate-900">
            {editing ? t("cust.edit") : t("cust.add")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <input
              required
              placeholder={`${t("common.name")} *`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder={t("common.phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder={t("common.address")}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
            >
              {editing ? t("common.update") : t("cust.add")}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                {t("common.cancel")}
              </button>
            )}
          </div>
        </form>

        {data.customers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            {t("cust.no_customers")}. {t("cust.credit_hint")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t("common.name")}</th>
                  <th className="px-4 py-3">{t("common.phone")}</th>
                  <th className="px-4 py-3">{t("cust.credit_owed")}</th>
                  <th className="px-4 py-3">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.name}</p>
                      {c.address && (
                        <p className="text-xs text-slate-400">{c.address}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">{c.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          c.creditBalance > 0
                            ? "font-semibold text-amber-700"
                            : "text-slate-500"
                        }
                      >
                        {formatLkr(c.creditBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {c.phone && (
                          <MessageSendButton
                            phone={c.phone}
                            recipientName={c.name}
                            context={{
                              type: "customer",
                              customerName: c.name,
                              creditBalance: c.creditBalance,
                              business: data.business,
                            }}
                            contextId={c.id}
                          />
                        )}
                        {c.creditBalance > 0 && (
                          <button
                            onClick={() => {
                              setPayCustomerId(c.id);
                              setPayAmount(c.creditBalance);
                            }}
                            className="text-teal-700 hover:underline"
                          >
                            {t("cust.record_payment")}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditing(c);
                            setName(c.name);
                            setPhone(c.phone ?? "");
                            setAddress(c.address ?? "");
                          }}
                          className="text-teal-700 hover:underline"
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`${t("cust.delete_confirm")} ${c.name}?`))
                              deleteCustomer(c.id);
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

        {data.customerPayments.length > 0 && (
          <section className="mt-10">
            <h2 className="font-semibold text-slate-900">{t("cust.recent_payments")}</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {data.customerPayments.slice(0, 8).map((p) => (
                <li key={p.id}>
                  • {p.customerName} — {formatLkr(p.amount)} (
                  {paymentLabel(t, p.method)})
                </li>
              ))}
            </ul>
          </section>
        )}

        {payCustomerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5">
              <h3 className="font-semibold">{t("cust.record_payment")}</h3>
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
                {PAYMENT_OPTIONS.filter((m) => m !== "credit").map((m) => (
                  <option key={m} value={m}>
                    {paymentLabel(t, m)}
                  </option>
                ))}
              </select>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    const ok = recordCustomerPayment(
                      payCustomerId,
                      payAmount,
                      payMethod,
                    );
                    if (ok) {
                      setMessage(t("cust.payment_saved"));
                      setPayCustomerId(null);
                    }
                  }}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
                >
                  {t("common.save")}
                </button>
                <button
                  onClick={() => setPayCustomerId(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
