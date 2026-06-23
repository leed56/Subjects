"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { ContactTypeBadge } from "@/components/contact-type-badge";
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
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { buildLedger } from "@/lib/ledger";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Customer } from "@/lib/store/types";
import type { ContactType, PaymentMethod } from "@/lib/types";
import { useCanWrite } from "@/lib/subscription/use-can-write";

type ContactFilter = "all" | ContactType;

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
  const canWrite = useCanWrite();

  const [name, setName] = useState("");
  const [contactType, setContactType] = useState<ContactType>("individual");
  const [contactPerson, setContactPerson] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState<number | "">("");
  const [typeFilter, setTypeFilter] = useState<ContactFilter>("all");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [payCustomerId, setPayCustomerId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

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

  const resetForm = () => {
    setName("");
    setContactType("individual");
    setContactPerson("");
    setVatNumber("");
    setPhone("");
    setAddress("");
    setCreditLimit("");
    setEditing(null);
  };

  const startEdit = (customer: Customer) => {
    setEditing(customer);
    setName(customer.name);
    setContactType(customer.contactType);
    setContactPerson(customer.contactPerson ?? "");
    setVatNumber(customer.vatNumber ?? "");
    setPhone(customer.phone ?? "");
    setAddress(customer.address ?? "");
    setCreditLimit(customer.creditLimit ?? "");
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const limit = creditLimit === "" ? undefined : Number(creditLimit);
    const payload = {
      name,
      contactType,
      contactPerson,
      vatNumber,
      phone,
      address,
      creditLimit: limit,
    };
    const ok = editing
      ? updateCustomer(editing.id, payload)
      : addCustomer(payload);
    if (!ok) {
      setMessage(t("common.save_failed"));
      setTimeout(() => setMessage(""), 2500);
      return;
    }
    resetForm();
    setMessage(editing ? t("cust.updated") : t("cust.added"));
    setTimeout(() => setMessage(""), 2500);
  };

  const totalCredit = data.customers.reduce((s, c) => s + c.creditBalance, 0);
  const overLimitCount = data.customers.filter(
    (c) => c.creditLimit != null && c.creditBalance > c.creditLimit,
  ).length;
  const payingCustomers = data.customers.filter((c) => c.creditBalance > 0).length;
  const recentPaymentsTotal = data.customerPayments
    .slice(0, 8)
    .reduce((sum, p) => sum + p.amount, 0);

  const individualCount = data.customers.filter((c) => c.contactType === "individual").length;
  const companyCount = data.customers.filter((c) => c.contactType === "company").length;

  const query = search.trim().toLowerCase();
  const typeFiltered =
    typeFilter === "all"
      ? data.customers
      : data.customers.filter((c) => c.contactType === typeFilter);
  const customers = query
    ? typeFiltered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.phone ?? "").toLowerCase().includes(query) ||
          (c.address ?? "").toLowerCase().includes(query) ||
          (c.contactPerson ?? "").toLowerCase().includes(query) ||
          (c.vatNumber ?? "").toLowerCase().includes(query),
      )
    : typeFiltered;

  const payCustomer = payCustomerId
    ? data.customers.find((c) => c.id === payCustomerId)
    : null;

  const ledgerEntries = ledgerCustomer
    ? buildLedger(
        data.sales
          .filter((s) => s.customerId === ledgerCustomer.id && s.creditAmount > 0)
          .map((s) => ({
            date: s.date,
            label: `${t("sales.bill")} ${s.billNo ?? s.id.slice(0, 8)}`,
            amount: s.creditAmount,
          })),
        data.customerPayments
          .filter((p) => p.customerId === ledgerCustomer.id)
          .map((p) => ({
            date: p.date,
            label: `${t("cust.record_payment")} (${paymentLabel(t, p.method)})`,
            amount: -p.amount,
          })),
      )
    : [];

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow="Customer CRM"
          title={t("cust.title")}
          description={`${t("cust.subtitle")} · ${t("cust.total_owed")} ${formatLkr(totalCredit)}`}
          actions={
            <>
              <ProButton href="/sales">{t("nav.sales")}</ProButton>
              <ProButton href="/bills" variant="secondary">{t("nav.bills")}</ProButton>
            </>
          }
        />

        {message && (
          <div className="mb-5 rounded-[1.25rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard label={t("nav.customers")} value={String(data.customers.length)} hint="Saved customer profiles" icon="👥" tone="teal" />
          <ProStatCard label={t("cust.credit_owed")} value={formatLkr(totalCredit)} hint={`${payingCustomers} customers with credit`} icon="🤝" tone="amber" />
          <ProStatCard label={t("cust.over_limit")} value={String(overLimitCount)} hint={overLimitCount ? "Needs attention" : "All within limits"} icon="⚠️" tone={overLimitCount ? "rose" : "slate"} />
          <ProStatCard label={t("cust.recent_payments")} value={formatLkr(recentPaymentsTotal)} hint="Latest 8 records" icon="💸" tone="emerald" />
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              { id: "all" as const, label: t("cust.filter_all"), count: data.customers.length },
              { id: "individual" as const, label: t("cust.type_individual"), count: individualCount },
              { id: "company" as const, label: t("cust.type_company"), count: companyCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                typeFilter === tab.id
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-700/20"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-teal-200"
              }`}
            >
              {tab.label}
              <span className="ml-2 opacity-80">({tab.count})</span>
            </button>
          ))}
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <ProCard eyebrow={editing ? "Edit customer" : "Create customer"} title={editing ? t("cust.edit") : t("cust.add")}>
            <form onSubmit={handleSave}>
              <div className="mb-3 flex flex-wrap gap-2">
                {(["individual", "company"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setContactType(type)}
                    className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                      contactType === type
                        ? "bg-teal-600 text-white shadow-lg shadow-teal-700/20"
                        : "border border-slate-200 bg-white text-slate-700 hover:border-teal-200"
                    }`}
                  >
                    {t(type === "company" ? "cust.type_company" : "cust.type_individual")}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  required
                  placeholder={
                    contactType === "company"
                      ? `${t("cust.company_name")} *`
                      : `${t("common.name")} *`
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100 sm:col-span-2"
                />
                {contactType === "company" && (
                  <>
                    <input
                      placeholder={t("cust.contact_person")}
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                    />
                    <input
                      placeholder={t("cust.vat_number")}
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                    />
                  </>
                )}
                <input
                  placeholder={t("common.phone")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                />
                <input
                  placeholder={t("common.address")}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100 sm:col-span-2"
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder={t("cust.credit_limit")}
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100 sm:col-span-2"
                />
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="submit" disabled={!canWrite} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {editing ? t("common.update") : t("cust.add")}
                </button>
                {editing && (
                  <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                    {t("common.cancel")}
                  </button>
                )}
              </div>
            </form>
          </ProCard>

          <ProCard title="Find customers" eyebrow="Search CRM" action={<ProBadge tone={customers.length === typeFiltered.length ? "slate" : "teal"}>{customers.length} shown</ProBadge>}>
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone or address..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pl-11 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-100"
              />
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            </div>
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-sm font-semibold text-amber-900">
              {t("cust.credit_hint")}
            </div>
          </ProCard>
        </section>

        <section className="mt-6">
          {data.customers.length === 0 ? (
            <ProCard>
              <ProEmptyState title={t("cust.no_customers")} description={t("cust.credit_hint")} />
            </ProCard>
          ) : customers.length === 0 ? (
            <ProCard>
              <ProEmptyState title={t("sales.no_match")} description="Try searching by customer name, phone, or address." />
            </ProCard>
          ) : (
            <ProCard title="Customer list" action={<ProBadge tone="teal">{customers.length} customers</ProBadge>}>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t("common.name")}</th>
                      <th className="px-4 py-3">{t("common.phone")}</th>
                      <th className="px-4 py-3">{t("cust.credit_owed")}</th>
                      <th className="px-4 py-3">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <CustomerRow
                        key={c.id}
                        customer={c}
                        business={data.business}
                        onPay={() => {
                          setPayCustomerId(c.id);
                          setPayAmount(c.creditBalance);
                        }}
                        onLedger={() => setLedgerCustomer(c)}
                        onEdit={() => startEdit(c)}
                        onDelete={() => {
                          if (confirm(`${t("cust.delete_confirm")} ${c.name}?`)) deleteCustomer(c.id);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {customers.map((c) => (
                  <CustomerCard
                    key={c.id}
                    customer={c}
                    business={data.business}
                    onPay={() => {
                      setPayCustomerId(c.id);
                      setPayAmount(c.creditBalance);
                    }}
                    onLedger={() => setLedgerCustomer(c)}
                    onEdit={() => startEdit(c)}
                    onDelete={() => {
                      if (confirm(`${t("cust.delete_confirm")} ${c.name}?`)) deleteCustomer(c.id);
                    }}
                  />
                ))}
              </div>
            </ProCard>
          )}
        </section>

        {data.customerPayments.length > 0 && (
          <section className="mt-6">
            <ProCard title={t("cust.recent_payments")} action={<ProBadge tone="slate">Latest 8</ProBadge>}>
              <div className="grid gap-3 md:grid-cols-2">
                {data.customerPayments.slice(0, 8).map((p) => (
                  <div key={p.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{p.customerName}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{paymentLabel(t, p.method)}</p>
                      </div>
                      <p className="font-mono text-sm font-black text-teal-700">{formatLkr(p.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ProCard>
          </section>
        )}

        {payCustomerId && payCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-600">{t("cust.record_payment")}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{payCustomer.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{t("cust.credit_owed")}: {formatLkr(payCustomer.creditBalance)}</p>
                </div>
                <button onClick={() => setPayCustomerId(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
              </div>

              <label className="mt-5 block text-sm font-black text-slate-700">
                {t("bills.amount")}
                <input
                  type="number"
                  min={1}
                  value={payAmount || ""}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <label className="mt-4 block text-sm font-black text-slate-700">
                {t("common.payment")}
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                >
                  {PAYMENT_OPTIONS.filter((m) => m !== "credit").map((m) => (
                    <option key={m} value={m}>{paymentLabel(t, m)}</option>
                  ))}
                </select>
              </label>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => {
                    const ok = recordCustomerPayment(payCustomerId, payAmount, payMethod);
                    if (ok) {
                      setMessage(t("cust.payment_saved"));
                      setPayCustomerId(null);
                    } else {
                      setMessage(t("common.save_failed"));
                      setTimeout(() => setMessage(""), 2500);
                    }
                  }}
                  className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700"
                >
                  {t("common.save")}
                </button>
                <button onClick={() => setPayCustomerId(null)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {ledgerCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-600">{t("cust.ledger")}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{ledgerCustomer.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{t("cust.credit_owed")}: {formatLkr(ledgerCustomer.creditBalance)}</p>
                </div>
                <button onClick={() => setLedgerCustomer(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
              </div>

              <div className="mt-5 flex-1 overflow-y-auto rounded-2xl border border-slate-200">
                {ledgerEntries.length === 0 ? (
                  <div className="p-6">
                    <ProEmptyState title={t("cust.ledger_empty")} />
                  </div>
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
                          <td className={`px-4 py-3 text-right font-mono font-black ${e.amount < 0 ? "text-emerald-700" : "text-slate-800"}`}>
                            {e.amount < 0 ? "−" : "+"}{formatLkr(Math.abs(e.amount))}
                          </td>
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

function CustomerRow({
  customer,
  business,
  onPay,
  onLedger,
  onEdit,
  onDelete,
}: {
  customer: Customer;
  business: NonNullable<ReturnType<typeof useAppStore>["data"]>["business"];
  onPay: () => void;
  onLedger: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const overLimit = customer.creditLimit != null && customer.creditBalance > customer.creditLimit;

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-slate-950">{customer.name}</p>
          <ContactTypeBadge type={customer.contactType} />
        </div>
        {customer.contactType === "company" && customer.contactPerson && (
          <p className="text-xs font-semibold text-slate-500">{customer.contactPerson}</p>
        )}
        {customer.vatNumber && (
          <p className="text-xs font-semibold text-slate-400">{t("cust.vat_number")}: {customer.vatNumber}</p>
        )}
        {customer.address && <p className="text-xs font-semibold text-slate-400">{customer.address}</p>}
      </td>
      <td className="px-4 py-3 font-semibold text-slate-600">{customer.phone || "—"}</td>
      <td className="px-4 py-3">
        <p className={customer.creditBalance > 0 ? "font-mono font-black text-amber-700" : "font-mono font-black text-slate-500"}>{formatLkr(customer.creditBalance)}</p>
        {customer.creditLimit != null && (
          <p className={overLimit ? "mt-1 text-xs font-black text-rose-600" : "mt-1 text-xs font-semibold text-slate-400"}>
            {t("cust.limit")}: {formatLkr(customer.creditLimit)}{overLimit && ` · ${t("cust.over_limit")}`}
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <CustomerActions customer={customer} business={business} onPay={onPay} onLedger={onLedger} onEdit={onEdit} onDelete={onDelete} />
      </td>
    </tr>
  );
}

function CustomerCard({
  customer,
  business,
  onPay,
  onLedger,
  onEdit,
  onDelete,
}: {
  customer: Customer;
  business: NonNullable<ReturnType<typeof useAppStore>["data"]>["business"];
  onPay: () => void;
  onLedger: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const overLimit = customer.creditLimit != null && customer.creditBalance > customer.creditLimit;

  return (
    <article className={`rounded-[1.5rem] border bg-slate-50 p-4 ring-1 ${overLimit ? "border-rose-200 ring-rose-100" : "border-slate-200 ring-slate-100"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-black text-slate-950">{customer.name}</h2>
            <ContactTypeBadge type={customer.contactType} />
          </div>
          {customer.contactType === "company" && customer.contactPerson && (
            <p className="mt-1 text-xs font-semibold text-slate-500">{customer.contactPerson}</p>
          )}
          <p className="mt-1 text-xs font-semibold text-slate-500">{customer.phone || t("common.phone")}</p>
          {customer.vatNumber && (
            <p className="mt-1 text-xs font-semibold text-slate-400">{t("cust.vat_number")}: {customer.vatNumber}</p>
          )}
          {customer.address && <p className="mt-1 text-xs font-semibold text-slate-400">{customer.address}</p>}
        </div>
        {overLimit ? <ProBadge tone="rose">{t("cust.over_limit")}</ProBadge> : customer.creditBalance > 0 ? <ProBadge tone="amber">Credit</ProBadge> : <ProBadge tone="emerald">Clear</ProBadge>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-white p-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{t("cust.credit_owed")}</p>
          <p className="mt-1 font-mono text-sm font-black text-amber-700">{formatLkr(customer.creditBalance)}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{t("cust.limit")}</p>
          <p className="mt-1 font-mono text-sm font-black text-slate-900">{customer.creditLimit != null ? formatLkr(customer.creditLimit) : "—"}</p>
        </div>
      </div>

      <div className="mt-4">
        <CustomerActions customer={customer} business={business} onPay={onPay} onLedger={onLedger} onEdit={onEdit} onDelete={onDelete} mobile />
      </div>
    </article>
  );
}

function CustomerActions({
  customer,
  business,
  onPay,
  onLedger,
  onEdit,
  onDelete,
  mobile = false,
}: {
  customer: Customer;
  business: NonNullable<ReturnType<typeof useAppStore>["data"]>["business"];
  onPay: () => void;
  onLedger: () => void;
  onEdit: () => void;
  onDelete: () => void;
  mobile?: boolean;
}) {
  const { t } = useLocale();
  const buttonClass = mobile
    ? "rounded-2xl px-3 py-3 text-xs font-black"
    : "rounded-full px-3 py-1.5 text-xs font-black";

  return (
    <div className={mobile ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
      {customer.phone && (
        <MessageSendButton
          phone={customer.phone}
          recipientName={customer.name}
          context={{
            type: "customer",
            customerName: customer.name,
            creditBalance: customer.creditBalance,
            business,
          }}
          contextId={customer.id}
        />
      )}
      {customer.creditBalance > 0 && (
        <button onClick={onPay} className={`${buttonClass} bg-teal-50 text-teal-700 hover:bg-teal-100`}>
          {t("cust.record_payment")}
        </button>
      )}
      <button onClick={onLedger} className={`${buttonClass} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
        {t("cust.ledger")}
      </button>
      <button onClick={onEdit} className={`${buttonClass} bg-sky-50 text-sky-700 hover:bg-sky-100`}>
        {t("common.edit")}
      </button>
      <button onClick={onDelete} className={`${buttonClass} bg-rose-50 text-rose-700 hover:bg-rose-100`}>
        {t("common.delete")}
      </button>
    </div>
  );
}
