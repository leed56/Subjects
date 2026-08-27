"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BulkWhatsAppComposer } from "@/components/messaging/bulk-whatsapp-composer";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { ContactTypeBadge } from "@/components/contact-type-badge";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, EmptyState, StatusBadge, SearchInput, FilterBar, Tabs, ActionMenu } from "@/components/ui/primitives";
import { Drawer, ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { FormField, TextInput, MoneyInput, SelectInput } from "@/components/ui/form";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { CustomersIcon, PlusIcon } from "@/components/ui/icons";
import { fetchCustomerAssets, type AcAsset } from "@/lib/supabase/ac-assets-client";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { buildLedger } from "@/lib/ledger";
import { wholesalePriceCount } from "@/lib/company-pricing";
import { contactTypeI18nKey } from "@/lib/contact-type";
import { exportCustomersCsv } from "@/lib/export";
import { recipientsWithPhone } from "@/lib/messaging/bulk-whatsapp";
import { useNotificationLogs } from "@/lib/messaging/use-notification-logs";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Customer } from "@/lib/store/types";
import type { ContactType, PaymentMethod, Product } from "@/lib/types";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { useSubscription } from "@/lib/subscription/subscription-provider";

type ContactFilter = "all" | ContactType;
type ProfileTab = "overview" | "invoices" | "payments" | "ledger" | "equipment" | "messages";

export default function CustomersPage() {
  const router = useRouter();
  const {
    data,
    ready,
    saveCustomerToCloud,
    deleteCustomerToCloud,
    recordCustomerPaymentToCloud,
    setCustomerProductPriceToCloud,
    removeCustomerProductPriceToCloud,
  } = useAppStore();
  const { t } = useLocale();
  const { canWrite, disabledHint } = useWriteAccess();
  const { can, org } = useSubscription();
  const { toast } = useToast();
  const notificationLogs = useNotificationLogs(org.id);

  // Create/edit drawer
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [contactType, setContactType] = useState<ContactType>("individual");
  const [contactPerson, setContactPerson] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);

  // Profile drawer
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>("overview");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Record payment dialog
  const [payCustomerId, setPayCustomerId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payBankAccountId, setPayBankAccountId] = useState("");
  const [payNote, setPayNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Wholesale pricing (company B2B — unchanged from prior implementation)
  const [pricingCustomer, setPricingCustomer] = useState<Customer | null>(null);
  const [priceSearch, setPriceSearch] = useState("");
  const [savingPriceProductId, setSavingPriceProductId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<ContactFilter>("all");
  // Global search (Cmd/Ctrl+K) links a customer result here with ?q=<name>
  // — same seeded-once-at-mount pattern as /stock's own ?q= handling.
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [bulkWaOpen, setBulkWaOpen] = useState(false);

  useEffect(() => {
    if (!payCustomerId || payBankAccountId || !data?.bankAccounts[0]) return;
    setPayBankAccountId(data.bankAccounts[0].id);
  }, [data?.bankAccounts, payBankAccountId, payCustomerId]);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
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

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const startEdit = (customer: Customer) => {
    setEditing(customer);
    setName(customer.name);
    setContactType(customer.contactType);
    setContactPerson(customer.contactPerson ?? "");
    setVatNumber(customer.vatNumber ?? "");
    setPhone(customer.phone ?? "");
    setAddress(customer.address ?? "");
    setCreditLimit(customer.creditLimit != null ? String(customer.creditLimit) : "");
    setFormOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    const limit = creditLimit === "" ? undefined : Number(creditLimit);
    const payload = { name, contactType, contactPerson, vatNumber, phone, address, creditLimit: limit };
    setSaving(true);
    const result = await saveCustomerToCloud(payload, editing?.id);
    setSaving(false);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    toast({ tone: "success", title: editing ? t("cust.updated") : t("cust.added"), description: name });
    setFormOpen(false);
    resetForm();
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    const result = await deleteCustomerToCloud(deleteTarget.id);
    setDeletingId(null);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    if (profileCustomer?.id === deleteTarget.id) setProfileCustomer(null);
    toast({ tone: "success", title: t("cust.deleted"), description: deleteTarget.name });
    setDeleteTarget(null);
  };

  const openProfile = (customer: Customer, tab: ProfileTab = "overview") => {
    setProfileCustomer(customer);
    setProfileTab(tab);
  };

  const totalCredit = data.customers.reduce((s, c) => s + c.creditBalance, 0);
  const bulkRecipients = recipientsWithPhone(data.customers);
  const overLimitCount = data.customers.filter(
    (c) => c.creditLimit != null && c.creditBalance > c.creditLimit,
  ).length;
  const payingCustomers = data.customers.filter((c) => c.creditBalance > 0).length;
  const recentPaymentsTotal = data.customerPayments.slice(0, 8).reduce((sum, p) => sum + p.amount, 0);
  const individualCount = data.customers.filter((c) => c.contactType === "individual").length;
  const companyCount = data.customers.filter((c) => c.contactType === "company").length;

  const query = search.trim().toLowerCase();
  const typeFiltered =
    typeFilter === "all" ? data.customers : data.customers.filter((c) => c.contactType === typeFilter);
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

  const canExport = can("export");
  const canBulkMessaging = can("bulk_messaging");
  const customerExportLabels = {
    name: t("common.name"),
    type: t("cust.contact_type"),
    contactPerson: t("cust.contact_person"),
    phone: t("common.phone"),
    address: t("common.address"),
    vatNumber: t("cust.vat_number"),
    creditBalance: t("cust.credit_owed"),
    creditLimit: t("cust.credit_limit"),
  };

  const payCustomer = payCustomerId ? data.customers.find((c) => c.id === payCustomerId) : null;
  const payAmountNumber = Number(payAmount) || 0;
  const hasCreditActivity = totalCredit > 0 || overLimitCount > 0 || recentPaymentsTotal > 0;

  const exportVisibleCustomers = () =>
    exportCustomersCsv(data.business, customers, {
      labels: customerExportLabels,
      typeLabel: (type) => t(contactTypeI18nKey(type)),
    });

  const columns: DataTableColumn<Customer>[] = [
    {
      key: "name",
      header: t("common.name"),
      render: (c) => (
        <div>
          <button
            type="button"
            onClick={() => openProfile(c)}
            className="flex flex-wrap items-center gap-2 text-left font-semibold text-slate-900 hover:text-teal-700 hover:underline"
          >
            {c.name}
            <ContactTypeBadge type={c.contactType} />
          </button>
          {c.contactType === "company" && c.contactPerson && (
            <p className="mt-0.5 text-xs text-slate-500">{c.contactPerson}</p>
          )}
        </div>
      ),
    },
    { key: "phone", header: t("common.phone"), render: (c) => c.phone || "—", hideOnMobile: true },
    { key: "type", header: t("cust.contact_type"), render: (c) => <ContactTypeBadge type={c.contactType} />, hideOnMobile: true },
    {
      key: "outstanding",
      header: t("cust.credit_owed"),
      align: "right",
      render: (c) => {
        const overLimit = c.creditLimit != null && c.creditBalance > c.creditLimit;
        return (
          <div>
            <p className={`font-mono font-semibold ${c.creditBalance > 0 ? "text-amber-700" : "text-slate-500"}`}>
              {formatLkr(c.creditBalance)}
            </p>
            {overLimit && <StatusBadge tone="danger">{t("cust.over_limit")}</StatusBadge>}
          </div>
        );
      },
    },
    {
      key: "limit",
      header: t("cust.credit_limit"),
      align: "right",
      hideOnMobile: true,
      render: (c) => (c.creditLimit != null ? formatLkr(c.creditLimit) : "—"),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          {c.phone && (
            <MessageSendButton
              phone={c.phone}
              recipientName={c.name}
              context={{ type: "customer", customerName: c.name, creditBalance: c.creditBalance, business: data.business }}
              contextId={c.id}
            />
          )}
          {c.creditBalance > 0 && (
            <button
              type="button"
              onClick={() => {
                setPayCustomerId(c.id);
                setPayAmount(String(c.creditBalance));
              }}
              className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
            >
              {t("cust.record_payment")}
            </button>
          )}
          <ActionMenu
            items={[
              { label: t("cust.ledger"), onSelect: () => openProfile(c, "ledger") },
              ...(c.contactType === "company"
                ? [
                    {
                      label: `${t("cust.wholesale_prices")}${
                        wholesalePriceCount(data.customerProductPrices, c.id) > 0
                          ? ` (${wholesalePriceCount(data.customerProductPrices, c.id)})`
                          : ""
                      }`,
                      onSelect: () => {
                        setPricingCustomer(c);
                        setPriceSearch("");
                      },
                    },
                  ]
                : []),
              { label: t("common.edit"), onSelect: () => startEdit(c) },
              { label: t("common.delete"), tone: "danger" as const, onSelect: () => setDeleteTarget(c) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("cust.title")}
          description={`${data.customers.length} ${t("cust.customers_count")}`}
          actions={
            <>
              <button
                type="button"
                onClick={openCreate}
                disabled={!canWrite}
                title={!canWrite ? disabledHint ?? undefined : undefined}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" />
                {t("cust.add")}
              </button>
              {data.customers.length > 0 && (
                <ActionMenu
                  label={t("common.actions")}
                  items={[
                    ...(canBulkMessaging
                      ? [{ label: t("msg.bulk_messages"), onSelect: () => setBulkWaOpen(true) }]
                      : [{ label: `${t("msg.bulk_messages")} · ${t("nav.plans")}`, onSelect: () => router.push("/settings/plans") }]),
                    ...(canExport
                      ? [{ label: t("export.csv"), onSelect: exportVisibleCustomers, disabled: customers.length === 0 }]
                      : []),
                  ]}
                />
              )}
            </>
          }
        />

        <WriteDisabledHint className="mb-4" />

        {data.customers.length === 0 ? (
          <EmptyState
            icon={<CustomersIcon className="h-6 w-6" />}
            title={t("cust.no_customers")}
            description={t("cust.credit_hint")}
            action={
              <button type="button" onClick={openCreate} className="min-h-11 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                {t("cust.add")}
              </button>
            }
          />
        ) : (
          <>
            <FilterBar>
              <SearchInput value={search} onChange={setSearch} placeholder={t("cust.search_placeholder")} className="min-w-[220px] flex-1" />
              <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto">
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
                    aria-pressed={typeFilter === tab.id}
                    className={`min-h-11 rounded-lg px-2 py-2 text-sm font-medium transition sm:px-3 ${
                      typeFilter === tab.id ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200"
                    }`}
                  >
                    {tab.label} <span className="opacity-70">({tab.count})</span>
                  </button>
                ))}
              </div>
            </FilterBar>

            <DataTable
              columns={columns}
              rows={customers}
              emptyState={
                <EmptyState
                  size="compact"
                  title={t("sales.no_match")}
                  description={t("cust.search_no_match_desc")}
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setTypeFilter("all");
                      }}
                      className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t("common.clear")}
                    </button>
                  }
                />
              }
            />

            {hasCreditActivity && (
              <section className="mt-5" aria-label={t("cust.credit_owed")}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MetricCard label={t("cust.credit_owed")} value={formatLkr(totalCredit)} hint={`${payingCustomers} customers with credit`} tone="warning" />
                  <MetricCard label={t("cust.over_limit")} value={String(overLimitCount)} hint={overLimitCount ? t("cust.needs_attention") : t("cust.within_limits")} tone={overLimitCount ? "danger" : "default"} />
                  <MetricCard className="col-span-2 sm:col-span-1" label={t("cust.recent_payments")} value={formatLkr(recentPaymentsTotal)} hint={t("cust.latest_records")} tone="positive" />
                </div>
              </section>
            )}
          </>
        )}

        <BulkWhatsAppComposer open={bulkWaOpen} onClose={() => setBulkWaOpen(false)} recipients={bulkRecipients} business={data.business} />

        {/* Create / edit drawer — always opens immediately, no scrolling to find it. */}
        <Drawer
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? t("cust.edit") : t("cust.add")}
          description={editing ? undefined : t("cust.crm_eyebrow")}
          footer={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                form="customer-form"
                disabled={!canWrite || saving}
                className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? t("common.saving") : editing ? t("common.update") : t("cust.add")}
              </button>
            </div>
          }
        >
          <form id="customer-form" onSubmit={handleSave} className="space-y-4">
            <div className="flex gap-2">
              {(["individual", "company"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setContactType(type)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    contactType === type ? "bg-teal-600 text-white" : "border border-slate-300 bg-white text-slate-600 hover:border-teal-300"
                  }`}
                >
                  {t(type === "company" ? "cust.type_company" : "cust.type_individual")}
                </button>
              ))}
            </div>

            <FormField label={contactType === "company" ? t("cust.company_name") : t("common.name")} required>
              <TextInput required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </FormField>

            {contactType === "company" && (
              <>
                <FormField label={t("cust.contact_person")}>
                  <TextInput value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                </FormField>
                <FormField label={t("cust.vat_number")}>
                  <TextInput value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
                </FormField>
              </>
            )}

            <FormField label={t("common.phone")}>
              <TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormField>
            <FormField label={t("common.address")}>
              <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
            </FormField>
            <FormField label={t("cust.credit_limit")} hint={t("cust.credit_hint")}>
              <MoneyInput value={creditLimit} onChange={setCreditLimit} />
            </FormField>
          </form>
        </Drawer>

        {/* Customer profile drawer */}
        {profileCustomer && (
          <CustomerProfileDrawer
            customer={data.customers.find((c) => c.id === profileCustomer.id) ?? profileCustomer}
            sales={data.sales.filter((s) => s.customerId === profileCustomer.id)}
            payments={data.customerPayments.filter((p) => p.customerId === profileCustomer.id)}
            messages={notificationLogs.filter((l) => l.contextId === profileCustomer.id)}
            tab={profileTab}
            onTabChange={setProfileTab}
            onClose={() => setProfileCustomer(null)}
            onEdit={() => {
              startEdit(profileCustomer);
            }}
            onRecordPayment={() => {
              setPayCustomerId(profileCustomer.id);
              setPayAmount(String(profileCustomer.creditBalance));
            }}
          />
        )}

        {/* Record payment */}
        <Dialog
          open={!!payCustomerId && !!payCustomer}
          onClose={() => setPayCustomerId(null)}
          title={t("cust.record_payment")}
          description={payCustomer ? `${payCustomer.name} · ${t("cust.credit_owed")} ${formatLkr(payCustomer.creditBalance)}` : undefined}
          footer={
            <>
              <button type="button" onClick={() => setPayCustomerId(null)} className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={
                  savingPayment ||
                  payAmountNumber <= 0 ||
                  (payCustomer != null && payAmountNumber > payCustomer.creditBalance) ||
                  ((payMethod === "bank_transfer" || payMethod === "card") && !payBankAccountId)
                }
                onClick={() =>
                  void (async () => {
                    if (!payCustomerId || !payCustomer || savingPayment || payAmountNumber <= 0) return;
                    if (payAmountNumber > payCustomer.creditBalance) {
                      toast({ tone: "error", title: t("common.save_failed"), description: t("cust.payment_exceeds_balance") });
                      return;
                    }
                    if ((payMethod === "bank_transfer" || payMethod === "card") && !payBankAccountId) {
                      toast({ tone: "error", title: t("common.save_failed"), description: t("cust.select_bank_account") });
                      return;
                    }
                    setSavingPayment(true);
                    const result = await recordCustomerPaymentToCloud(payCustomerId, payAmountNumber, payMethod, payNote, payBankAccountId || undefined);
                    setSavingPayment(false);
                    if (!result.ok) {
                      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
                      return;
                    }
                    setPayCustomerId(null);
                    setPayNote("");
                    toast({ tone: "success", title: t("cust.payment_saved") });
                  })()
                }
                className="rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {savingPayment ? t("common.saving") : t("common.save")}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <FormField label={t("bills.amount")} required>
              <MoneyInput value={payAmount} onChange={setPayAmount} />
            </FormField>
            {payCustomer && payAmountNumber > payCustomer.creditBalance && (
              <p className="-mt-2 text-sm font-medium text-rose-600">{t("cust.payment_exceeds_balance")}</p>
            )}
            <FormField label={t("common.payment")}>
              <SelectInput
                value={payMethod}
                onChange={(v) => setPayMethod(v as PaymentMethod)}
                options={PAYMENT_OPTIONS.filter((m) => m !== "credit").map((m) => ({ value: m, label: paymentLabel(t, m) }))}
              />
            </FormField>
            {(payMethod === "bank_transfer" || payMethod === "card") && (
              <FormField label={t("cust.receiving_account")} required>
                {data.bankAccounts.length > 0 ? (
                  <SelectInput
                    value={payBankAccountId}
                    onChange={setPayBankAccountId}
                    options={[
                      { value: "", label: t("cust.select_bank_account") },
                      ...data.bankAccounts.map((account) => ({ value: account.id, label: `${account.bankName} · ${account.accountNumber}` })),
                    ]}
                  />
                ) : (
                  <Link href="/banking" className="block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 underline">
                    {t("cust.add_bank_account")}
                  </Link>
                )}
              </FormField>
            )}
            <FormField label={t("cust.payment_note")}>
              <TextInput value={payNote} onChange={(event) => setPayNote(event.target.value)} />
            </FormField>
          </div>
        </Dialog>

        <ConfirmDialog
          open={!!deleteTarget}
          title={t("cust.delete_confirm")}
          description={deleteTarget?.name}
          tone="danger"
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          loading={!!deletingId}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleteTarget(null)}
        />

        {pricingCustomer && (
          <WholesalePricingModal
            customer={pricingCustomer}
            products={data.products}
            prices={data.customerProductPrices.filter((p) => p.customerId === pricingCustomer.id)}
            search={priceSearch}
            onSearchChange={setPriceSearch}
            canWrite={canWrite}
            onClose={() => setPricingCustomer(null)}
            savingProductId={savingPriceProductId}
            onSave={async (productId, price) => {
              setSavingPriceProductId(productId);
              const result = await setCustomerProductPriceToCloud(pricingCustomer.id, productId, price);
              setSavingPriceProductId(null);
              if (!result.ok) {
                toast({ tone: "error", title: t("common.save_failed"), description: result.error });
                return;
              }
              toast({ tone: "success", title: t("cust.wholesale_saved") });
            }}
            onClear={async (productId) => {
              setSavingPriceProductId(productId);
              const result = await removeCustomerProductPriceToCloud(pricingCustomer.id, productId);
              setSavingPriceProductId(null);
              if (!result.ok) {
                toast({ tone: "error", title: t("common.save_failed"), description: result.error });
              }
            }}
          />
        )}
      </ProMain>
    </AppShell>
  );
}


function CustomerProfileDrawer({
  customer,
  sales,
  payments,
  messages,
  tab,
  onTabChange,
  onClose,
  onEdit,
  onRecordPayment,
}: {
  customer: Customer;
  sales: NonNullable<ReturnType<typeof useAppStore>["data"]>["sales"];
  payments: NonNullable<ReturnType<typeof useAppStore>["data"]>["customerPayments"];
  messages: ReturnType<typeof useNotificationLogs>;
  tab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  onClose: () => void;
  onEdit: () => void;
  onRecordPayment: () => void;
}) {
  const { t } = useLocale();
  const overLimit = customer.creditLimit != null && customer.creditBalance > customer.creditLimit;

  const [equipment, setEquipment] = useState<AcAsset[] | null>(null);
  useEffect(() => {
    if (tab !== "equipment") return;
    let cancelled = false;
    void fetchCustomerAssets(customer.id).then((result) => {
      if (!cancelled) setEquipment(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [customer.id, tab]);

  const ledgerEntries = buildLedger(
    sales
      .filter((s) => s.creditAmount > 0)
      .map((s) => ({ date: s.date, label: `${t("sales.bill")} ${s.billNo ?? s.id.slice(0, 8)}`, amount: s.creditAmount })),
    payments.map((p) => ({ date: p.date, label: `${t("cust.record_payment")} (${paymentLabel(t, p.method)})`, amount: -p.amount })),
  );

  return (
    <Drawer open onClose={onClose} title={customer.name} description={customer.contactType === "company" ? customer.contactPerson : customer.phone} widthClassName="max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <ContactTypeBadge type={customer.contactType} />
        {customer.creditBalance > 0 && (
          <StatusBadge tone={overLimit ? "danger" : "warning"}>
            {formatLkr(customer.creditBalance)} {t("cust.credit_owed")}
          </StatusBadge>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={onEdit} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {t("common.edit")}
        </button>
        {customer.creditBalance > 0 && (
          <button type="button" onClick={onRecordPayment} className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700">
            {t("cust.record_payment")}
          </button>
        )}
      </div>

      <Tabs
        value={tab}
        onChange={(v) => onTabChange(v as ProfileTab)}
        tabs={[
          { value: "overview", label: t("cust.tab_overview") },
          { value: "invoices", label: `${t("nav.bills")} (${sales.length})` },
          { value: "payments", label: `${t("cust.recent_payments")} (${payments.length})` },
          { value: "ledger", label: t("cust.ledger") },
          { value: "equipment", label: t("assets.title") },
          { value: "messages", label: `${t("cust.tab_messages")} (${messages.length})` },
        ]}
      />

      <div className="mt-4">
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">{t("cust.credit_owed")}</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-900">{formatLkr(customer.creditBalance)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">{t("cust.limit")}</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-900">{customer.creditLimit != null ? formatLkr(customer.creditLimit) : "—"}</p>
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              {customer.phone && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t("common.phone")}</dt>
                  <dd className="text-slate-900">{customer.phone}</dd>
                </div>
              )}
              {customer.address && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t("common.address")}</dt>
                  <dd className="text-right text-slate-900">{customer.address}</dd>
                </div>
              )}
              {customer.vatNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t("cust.vat_number")}</dt>
                  <dd className="text-slate-900">{customer.vatNumber}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t("cust.total_sales")}</dt>
                <dd className="text-slate-900">{sales.length}</dd>
              </div>
              {sales.length > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t("cust.last_activity")}</dt>
                  <dd className="text-slate-900">{new Date(sales[0].date).toLocaleDateString("en-LK")}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {tab === "invoices" &&
          (sales.length === 0 ? (
            <EmptyState title={t("cust.no_invoices")} />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {sales.map((s) => (
                <li key={s.id}>
                  <Link href={`/bills/${s.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{s.billNo ?? s.id.slice(0, 8)}</p>
                      <p className="text-xs text-slate-500">{new Date(s.date).toLocaleDateString("en-LK")} · {paymentLabel(t, s.paymentMethod)}</p>
                    </div>
                    <p className="font-mono text-sm font-semibold text-slate-900">{formatLkr(s.total)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ))}

        {tab === "payments" &&
          (payments.length === 0 ? (
            <EmptyState title={t("cust.no_payments")} />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{paymentLabel(t, p.method)}</p>
                    <p className="text-xs text-slate-500">{new Date(p.date).toLocaleDateString("en-LK")}</p>
                  </div>
                  <p className="font-mono text-sm font-semibold text-emerald-700">{formatLkr(p.amount)}</p>
                </li>
              ))}
            </ul>
          ))}

        {tab === "ledger" &&
          (ledgerEntries.length === 0 ? (
            <EmptyState title={t("cust.ledger_empty")} />
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t("common.date")}</th>
                    <th className="px-3 py-2">{t("common.details")}</th>
                    <th className="px-3 py-2 text-right">{t("cust.balance")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerEntries.map((entry, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-slate-500">{new Date(entry.date).toLocaleDateString("en-LK")}</td>
                      <td className="px-3 py-2 text-slate-700">{entry.label}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{formatLkr(entry.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "equipment" &&
          (equipment === null ? (
            <ProLoadingState label={t("common.loading")} />
          ) : equipment.length === 0 ? (
            <EmptyState title={t("assets.no_assets")} description={t("assets.no_assets_hint")} />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {equipment.map((a) => (
                <li key={a.id} className="px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{[a.brand, a.model].filter(Boolean).join(" ") || t("assets.untitled")}</p>
                    <StatusBadge tone={a.status === "active" ? "positive" : "neutral"}>{t(`assets.status_${a.status}`)}</StatusBadge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {a.serialNo ?? "—"}
                    {a.nextServiceDate ? ` · ${t("assets.next_service")}: ${new Date(a.nextServiceDate).toLocaleDateString("en-LK")}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ))}

        {tab === "messages" &&
          (messages.length === 0 ? (
            <EmptyState title={t("cust.no_messages")} />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {messages.map((m) => (
                <li key={m.id} className="px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase text-slate-500">{m.templateId}</p>
                    <p className="text-xs text-slate-400">{new Date(m.sentAt).toLocaleString("en-LK")}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-700">{m.messageBody}</p>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </Drawer>
  );
}

function WholesalePricingModal({
  customer,
  products,
  prices,
  search,
  onSearchChange,
  canWrite,
  onClose,
  savingProductId,
  onSave,
  onClear,
}: {
  customer: Customer;
  products: Product[];
  prices: { productId: string; price: number }[];
  search: string;
  onSearchChange: (value: string) => void;
  canWrite: boolean;
  onClose: () => void;
  savingProductId: string | null;
  onSave: (productId: string, price: number) => Promise<void>;
  onClear: (productId: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const query = search.trim().toLowerCase();
  const filtered = query
    ? products.filter(
        (p) => p.name.toLowerCase().includes(query) || (p.sku ?? "").toLowerCase().includes(query) || p.category.toLowerCase().includes(query),
      )
    : products;

  return (
    <Drawer open onClose={onClose} title={t("cust.wholesale_prices")} description={`${customer.name} · ${t("cust.wholesale_hint")}`} widthClassName="max-w-xl">
      <SearchInput value={search} onChange={onSearchChange} placeholder={t("stock.search_placeholder")} className="mb-4" />
      {filtered.length === 0 ? (
        <EmptyState title={t("sales.no_match")} />
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-slate-200 bg-white text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="py-2">{t("common.name")}</th>
              <th className="py-2 text-right">{t("sales.retail_price")}</th>
              <th className="py-2 text-right">{t("cust.wholesale_price")}</th>
              <th className="py-2 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((product) => {
              const saved = prices.find((p) => p.productId === product.id);
              return (
                <WholesalePriceRow
                  key={`${product.id}-${saved?.price ?? "retail"}`}
                  product={product}
                  savedPrice={saved?.price}
                  canWrite={canWrite}
                  saving={savingProductId === product.id}
                  onSave={onSave}
                  onClear={onClear}
                />
              );
            })}
          </tbody>
        </table>
      )}
    </Drawer>
  );
}

function WholesalePriceRow({
  product,
  savedPrice,
  canWrite,
  saving,
  onSave,
  onClear,
}: {
  product: Product;
  savedPrice?: number;
  canWrite: boolean;
  saving?: boolean;
  onSave: (productId: string, price: number) => Promise<void>;
  onClear: (productId: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState(savedPrice ?? product.sellPrice);

  return (
    <tr>
      <td className="py-2.5">
        <p className="font-medium text-slate-900">{product.name}</p>
        <p className="text-xs text-slate-400">{product.category}</p>
      </td>
      <td className="py-2.5 text-right font-mono text-slate-500">{formatLkr(product.sellPrice)}</td>
      <td className="py-2.5 text-right">
        <input
          type="number"
          min={0}
          step="any"
          disabled={!canWrite}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-xs font-semibold text-slate-900 outline-none focus:border-teal-500 disabled:opacity-50"
        />
      </td>
      <td className="py-2.5 text-right">
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            disabled={!canWrite || saving}
            onClick={() => void onSave(product.id, draft)}
            className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
          {savedPrice != null && (
            <button
              type="button"
              disabled={!canWrite || saving}
              onClick={() => void onClear(product.id).then(() => setDraft(product.sellPrice))}
              className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
            >
              {t("cust.wholesale_clear")}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
