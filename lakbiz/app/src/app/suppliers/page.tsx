"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { Dialog, Drawer, DrawerFooter } from "@/components/ui/overlay";
import {
  ActionMenu,
  AlertRow,
  Button,
  EmptyState,
  MetricCard,
  PageHeader,
  SearchInput,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { BillsIcon, InboxIcon, SuppliersIcon } from "@/components/ui/icons";
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { buildLedger } from "@/lib/ledger";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Purchase, PurchaseOrder, Supplier } from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";
import { calcInputVat } from "@/lib/vat";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";

type SupplierSection = "suppliers" | "orders" | "purchases";

type LedgerRow = {
  id: string;
  date: string;
  label: string;
  amount: number;
  balance: number;
};

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

  const [activeSection, setActiveSection] = useState<SupplierSection>("suppliers");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [showSupplierDrawer, setShowSupplierDrawer] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState("");
  const [purchasePayment, setPurchasePayment] = useState<PaymentMethod>("credit");
  const [purchaseLines, setPurchaseLines] = useState<
    Record<string, { qty: number; unitCost: number }>
  >({});
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState(LK_BANKS[0]);
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [postDated, setPostDated] = useState(false);
  const [purchaseInputVat, setPurchaseInputVat] = useState<number | "">("");
  const [savingPurchase, setSavingPurchase] = useState(false);

  const [showPo, setShowPo] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poJobId, setPoJobId] = useState("");
  const [poLines, setPoLines] = useState<Record<string, { qty: number; unitCost: number }>>({});
  const [poSearch, setPoSearch] = useState("");
  const [savingPo, setSavingPo] = useState(false);
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});
  const [savingReceive, setSavingReceive] = useState(false);
  const [cancellingPoId, setCancellingPoId] = useState<string | null>(null);

  const [paySupplierId, setPaySupplierId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [savingPayment, setSavingPayment] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);

  const purchaseTotal = useMemo(
    () =>
      Object.values(purchaseLines).reduce(
        (sum, line) => sum + (line.qty > 0 ? line.qty * line.unitCost : 0),
        0,
      ),
    [purchaseLines],
  );

  const poExpectedTotal = useMemo(
    () =>
      Object.values(poLines).reduce(
        (sum, line) => sum + (line.qty > 0 ? line.qty * line.unitCost : 0),
        0,
      ),
    [poLines],
  );

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

  const totalPayable = data.suppliers.reduce((sum, supplier) => sum + supplier.payableBalance, 0);
  const openOrders = data.purchaseOrders.filter(
    (order) => order.status === "pending" || order.status === "partial",
  ).length;

  const supplierQuery = search.trim().toLowerCase();
  const suppliers = supplierQuery
    ? data.suppliers.filter(
        (supplier) =>
          supplier.name.toLowerCase().includes(supplierQuery) ||
          (supplier.phone ?? "").toLowerCase().includes(supplierQuery) ||
          (supplier.contactPerson ?? "").toLowerCase().includes(supplierQuery) ||
          (supplier.vatNumber ?? "").toLowerCase().includes(supplierQuery),
      )
    : data.suppliers;

  const purchaseProductQuery = purchaseSearch.trim().toLowerCase();
  const purchaseProducts = purchaseProductQuery
    ? data.products.filter(
        (product) =>
          product.name.toLowerCase().includes(purchaseProductQuery) ||
          (product.sku ?? "").toLowerCase().includes(purchaseProductQuery),
      )
    : data.products;

  const poProductQuery = poSearch.trim().toLowerCase();
  const poProducts = poProductQuery
    ? data.products.filter(
        (product) =>
          product.name.toLowerCase().includes(poProductQuery) ||
          (product.sku ?? "").toLowerCase().includes(poProductQuery),
      )
    : data.products;

  const paySupplier = paySupplierId
    ? data.suppliers.find((supplier) => supplier.id === paySupplierId)
    : null;

  const ledgerEntries: LedgerRow[] = ledgerSupplier
    ? buildLedger(
        data.purchases
          .filter(
            (purchase) =>
              purchase.supplierId === ledgerSupplier.id && purchase.creditAmount > 0,
          )
          .map((purchase) => ({
            date: purchase.date,
            label: `GRN ${purchase.grnNo}`,
            amount: purchase.creditAmount,
          })),
        data.supplierPayments
          .filter((payment) => payment.supplierId === ledgerSupplier.id)
          .map((payment) => ({
            date: payment.date,
            label: `${t("sup.pay_supplier")} (${paymentLabel(t, payment.method)})`,
            amount: -payment.amount,
          })),
      ).map((entry, index) => ({
        id: `${entry.date}-${index}`,
        ...entry,
      }))
    : [];

  const resetSupplierForm = () => {
    setName("");
    setPhone("");
    setAddress("");
    setVatNumber("");
    setContactPerson("");
    setEditing(null);
  };

  const closeSupplierDrawer = () => {
    setShowSupplierDrawer(false);
    resetSupplierForm();
  };

  const openSupplierCreate = () => {
    if (!canWrite) return;
    resetSupplierForm();
    setShowSupplierDrawer(true);
  };

  const startEdit = (supplier: Supplier) => {
    if (!canWrite) return;
    setEditing(supplier);
    setName(supplier.name);
    setPhone(supplier.phone ?? "");
    setAddress(supplier.address ?? "");
    setVatNumber(supplier.vatNumber ?? "");
    setContactPerson(supplier.contactPerson ?? "");
    setShowSupplierDrawer(true);
  };

  const saveSupplier = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || savingSupplier) return;
    const wasEditing = Boolean(editing);
    setSavingSupplier(true);
    setMessage("");
    const result = await saveSupplierToCloud(
      { name, phone, address, vatNumber, contactPerson },
      editing?.id,
    );
    setSavingSupplier(false);
    if (!result.ok) {
      setMessage(result.error ?? t("common.save_failed"));
      return;
    }
    closeSupplierDrawer();
    setActiveSection("suppliers");
    setMessage(wasEditing ? t("sup.updated") : t("sup.added"));
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (deletingId || !canWrite) return;
    if (!confirm(`${t("common.confirm_delete")} ${supplier.name}?`)) return;
    setDeletingId(supplier.id);
    setMessage("");
    const result = await deleteSupplierToCloud(supplier.id);
    setDeletingId(null);
    if (!result.ok) {
      setMessage(result.error ?? t("common.save_failed"));
      return;
    }
    setMessage(t("sup.deleted"));
  };

  const setLine = (productId: string, qty: number, unitCost: number) => {
    setPurchaseLines((previous) => ({
      ...previous,
      [productId]: { qty, unitCost },
    }));
  };

  const setPoLine = (productId: string, qty: number, unitCost: number) => {
    setPoLines((previous) => ({
      ...previous,
      [productId]: { qty, unitCost },
    }));
  };

  const openPurchase = () => {
    if (!canWrite || data.suppliers.length === 0 || data.products.length === 0) return;
    if (!purchaseSupplierId && data.suppliers[0]) {
      setPurchaseSupplierId(data.suppliers[0].id);
    }
    setPurchaseSearch("");
    setShowPurchase(true);
  };

  const handlePurchase = async () => {
    if (savingPurchase) return;
    if (!purchaseSupplierId) {
      setMessage(t("sup.select_supplier"));
      return;
    }
    const lines = Object.entries(purchaseLines)
      .filter(([, line]) => line.qty > 0)
      .map(([productId, line]) => ({
        productId,
        qty: line.qty,
        unitCost: line.unitCost,
      }));
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
      return;
    }

    setShowPurchase(false);
    setPurchaseLines({});
    setPurchaseInputVat("");
    setChequeNo("");
    setPostDated(false);
    setActiveSection("purchases");
    setMessage(t("sup.saved"));
  };

  const openPo = () => {
    if (!canWrite || data.suppliers.length === 0 || data.products.length === 0) return;
    if (!poSupplierId && data.suppliers[0]) {
      setPoSupplierId(data.suppliers[0].id);
    }
    setPoSearch("");
    setShowPo(true);
  };

  const handleCreatePo = async () => {
    if (savingPo) return;
    if (!poSupplierId) {
      setMessage(t("sup.select_supplier"));
      return;
    }
    const lines = Object.entries(poLines)
      .filter(([, line]) => line.qty > 0)
      .map(([productId, line]) => ({
        productId,
        qty: line.qty,
        unitCost: line.unitCost,
      }));
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
      return;
    }

    setShowPo(false);
    setPoLines({});
    setPoJobId("");
    setActiveSection("orders");
    setMessage(t("sup.po_saved"));
  };

  const openReceive = (order: PurchaseOrder) => {
    if (!canWrite) return;
    setReceivingPo(order);
    setReceiveQty({});
  };

  const setReceiveLineQty = (productId: string, qty: number) => {
    setReceiveQty((previous) => ({ ...previous, [productId]: qty }));
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
      return;
    }

    setReceivingPo(null);
    setReceiveQty({});
    setActiveSection("orders");
    setMessage(t("sup.po_receive_saved"));
  };

  const handleCancelPo = async (order: PurchaseOrder) => {
    if (cancellingPoId || !canWrite) return;
    if (!confirm(t("sup.po_cancel_confirm"))) return;

    setCancellingPoId(order.id);
    setMessage("");
    const result = await cancelPurchaseOrderToCloud(order.id);
    setCancellingPoId(null);

    if (!result.ok) {
      setMessage(result.error ?? t("common.save_failed"));
      return;
    }

    setMessage(t("sup.po_cancelled"));
  };

  const openSupplierPayment = (supplier: Supplier) => {
    if (!canWrite || supplier.payableBalance <= 0) return;
    setPaySupplierId(supplier.id);
    setPayAmount(supplier.payableBalance);
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
      return;
    }

    setPaySupplierId(null);
    setActiveSection("suppliers");
    setMessage(t("sup.pay_saved"));
  };

  const poStatusTone = (
    status: PurchaseOrder["status"],
  ): "neutral" | "warning" | "info" | "positive" => {
    if (status === "received") return "positive";
    if (status === "partial") return "info";
    if (status === "cancelled") return "neutral";
    return "warning";
  };

  const supplierColumns: DataTableColumn<Supplier>[] = [
    {
      key: "supplier",
      header: t("common.supplier"),
      render: (supplier) => (
        <div className="min-w-0">
          <p className="font-semibold text-slate-950">{supplier.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {supplier.contactPerson || supplier.phone || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "phone",
      header: t("common.phone"),
      render: (supplier) => <span className="text-slate-600">{supplier.phone || "—"}</span>,
      hideOnMobile: true,
    },
    {
      key: "vat",
      header: t("sup.vat_number"),
      render: (supplier) => (
        <span className="font-mono text-xs text-slate-600">{supplier.vatNumber || "—"}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: "payable",
      header: t("sup.you_owe_col"),
      align: "right",
      render: (supplier) => (
        <span
          className={`font-mono font-semibold tabular-nums ${
            supplier.payableBalance > 0 ? "text-amber-700" : "text-slate-500"
          }`}
        >
          {formatLkr(supplier.payableBalance)}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (supplier) => (
        <ActionMenu
          label={t("common.actions")}
          items={[
            ...(supplier.payableBalance > 0
              ? [
                  {
                    label: t("sup.pay_supplier"),
                    onSelect: () => openSupplierPayment(supplier),
                    disabled: !canWrite,
                  },
                ]
              : []),
            {
              label: t("cust.ledger"),
              onSelect: () => setLedgerSupplier(supplier),
            },
            {
              label: t("common.edit"),
              onSelect: () => startEdit(supplier),
              disabled: !canWrite,
            },
            {
              label:
                deletingId === supplier.id ? t("common.saving") : t("common.delete"),
              onSelect: () => void handleDeleteSupplier(supplier),
              tone: "danger" as const,
              disabled: !canWrite || Boolean(deletingId),
            },
          ]}
        />
      ),
    },
  ];

  const orderColumns: DataTableColumn<PurchaseOrder>[] = [
    {
      key: "order",
      header: "PO",
      render: (order) => (
        <div>
          <p className="font-mono text-xs font-semibold text-slate-950">{order.poNo}</p>
          <p className="mt-1 text-xs text-slate-500">{order.supplierName}</p>
        </div>
      ),
    },
    {
      key: "items",
      header: t("common.items"),
      render: (order) => (
        <span className="line-clamp-2 text-slate-600">
          {order.lines
            .map(
              (line) =>
                `${line.productName} (${line.qtyReceived}/${line.qtyOrdered})`,
            )
            .join(", ")}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "expected",
      header: t("sup.po_expected"),
      align: "right",
      render: (order) => (
        <span className="font-mono font-semibold tabular-nums text-slate-950">
          {formatLkr(order.expectedTotal)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      render: (order) => (
        <StatusBadge tone={poStatusTone(order.status)}>
          {t(`sup.po_status_${order.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (order) => {
        const canReceive = order.status === "pending" || order.status === "partial";
        const canCancel =
          order.status !== "cancelled" &&
          order.status !== "received" &&
          order.lines.every((line) => line.qtyReceived === 0);

        if (!canReceive && !canCancel) return null;

        return (
          <ActionMenu
            label={t("common.actions")}
            items={[
              ...(canReceive
                ? [
                    {
                      label: t("sup.po_receive_action"),
                      onSelect: () => openReceive(order),
                      disabled: !canWrite,
                    },
                  ]
                : []),
              ...(canCancel
                ? [
                    {
                      label:
                        cancellingPoId === order.id
                          ? t("common.saving")
                          : t("sup.po_cancel_action"),
                      onSelect: () => void handleCancelPo(order),
                      tone: "danger" as const,
                      disabled: !canWrite || Boolean(cancellingPoId),
                    },
                  ]
                : []),
            ]}
          />
        );
      },
    },
  ];

  const purchaseColumns: DataTableColumn<Purchase>[] = [
    {
      key: "grn",
      header: "GRN",
      render: (purchase) => (
        <div>
          <p className="font-mono text-xs font-semibold text-slate-950">{purchase.grnNo}</p>
          <p className="mt-1 text-xs text-slate-500">{purchase.supplierName}</p>
        </div>
      ),
    },
    {
      key: "items",
      header: t("common.items"),
      render: (purchase) => (
        <span className="line-clamp-2 text-slate-600">
          {purchase.lines
            .map((line) => `${line.productName} × ${line.qty}`)
            .join(", ")}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "total",
      header: t("common.total"),
      align: "right",
      render: (purchase) => (
        <span className="font-mono font-semibold tabular-nums text-slate-950">
          {formatLkr(purchase.total)}
        </span>
      ),
    },
    {
      key: "payment",
      header: t("common.payment"),
      render: (purchase) => (
        <StatusBadge>{paymentLabel(t, purchase.paymentMethod)}</StatusBadge>
      ),
    },
  ];

  const ledgerColumns: DataTableColumn<LedgerRow>[] = [
    {
      key: "details",
      header: t("common.details"),
      render: (entry) => (
        <div>
          <p className="font-medium text-slate-950">{entry.label}</p>
          <p className="mt-1 text-xs text-slate-500">
            {new Date(entry.date).toLocaleDateString("en-LK")}
          </p>
        </div>
      ),
    },
    {
      key: "amount",
      header: t("bills.amount"),
      align: "right",
      render: (entry) => (
        <span
          className={`font-mono font-semibold tabular-nums ${
            entry.amount < 0 ? "text-emerald-700" : "text-slate-800"
          }`}
        >
          {entry.amount < 0 ? "−" : "+"}
          {formatLkr(Math.abs(entry.amount))}
        </span>
      ),
    },
    {
      key: "balance",
      header: t("cust.balance"),
      align: "right",
      render: (entry) => (
        <span className="font-mono font-semibold tabular-nums text-slate-950">
          {formatLkr(entry.balance)}
        </span>
      ),
    },
  ];

  const inputClass =
    "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";

  const purchaseGrandTotal = purchaseTotal + (vatRegistered ? effectiveInputVat : 0);

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("sup.title")}
          description={`${t("sup.you_owe")} ${formatLkr(totalPayable)}`}
          actions={
            <>
              <Button
                variant="secondary"
                onClick={openSupplierCreate}
                disabled={!canWrite}
                title={!canWrite ? (disabledHint ?? undefined) : undefined}
              >
                {t("sup.add")}
              </Button>
              <Button
                variant="primary"
                onClick={openPurchase}
                disabled={!canWrite || data.suppliers.length === 0 || data.products.length === 0}
                title={!canWrite ? (disabledHint ?? undefined) : undefined}
              >
                {t("sup.record_purchase")}
              </Button>
              <ActionMenu
                label={t("common.actions")}
                items={[
                  {
                    label: t("sup.new_po"),
                    onSelect: openPo,
                    disabled:
                      !canWrite ||
                      data.suppliers.length === 0 ||
                      data.products.length === 0,
                  },
                ]}
              />
            </>
          }
          metrics={
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label={t("nav.suppliers")}
                value={String(data.suppliers.length)}
                icon={<SuppliersIcon className="h-4.5 w-4.5" />}
              />
              <MetricCard
                label={t("sup.you_owe_col")}
                value={formatLkr(totalPayable)}
                icon={<InboxIcon className="h-4.5 w-4.5" />}
                tone={totalPayable > 0 ? "warning" : "default"}
              />
              <MetricCard
                label={t("sup.po_title")}
                value={String(openOrders)}
                icon={<BillsIcon className="h-4.5 w-4.5" />}
                tone={openOrders > 0 ? "warning" : "default"}
              />
            </div>
          }
        />

        <WriteDisabledHint className="mb-5" />

        {message && (
          <div className="mb-5">
            <AlertRow tone="info">{message}</AlertRow>
          </div>
        )}

        {(data.suppliers.length === 0 || data.products.length === 0) && (
          <div className="mb-5">
            <AlertRow tone="warning">
              {data.suppliers.length === 0 ? t("sup.no_suppliers") : t("sup.grn_hint")}
            </AlertRow>
          </div>
        )}

        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={activeSection}
            onChange={(value) => setActiveSection(value as SupplierSection)}
            tabs={[
              { value: "suppliers", label: t("nav.suppliers") },
              { value: "orders", label: t("sup.po_title") },
              { value: "purchases", label: t("sup.recent_grn") },
            ]}
          />

          {activeSection === "suppliers" && data.suppliers.length > 0 && (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={`${t("common.supplier")} / ${t("common.phone")} / ${t("sup.vat_number")}`}
              className="w-full lg:w-80"
            />
          )}
        </div>

        {activeSection === "suppliers" && (
          <DataTable
            columns={supplierColumns}
            rows={suppliers}
            emptyState={
              data.suppliers.length === 0 ? (
                <EmptyState
                  icon={<SuppliersIcon className="h-5 w-5" />}
                  title={t("sup.no_suppliers")}
                  action={
                    canWrite ? (
                      <Button variant="primary" onClick={openSupplierCreate}>
                        {t("sup.add")}
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <EmptyState title={t("sales.no_match")} />
              )
            }
          />
        )}

        {activeSection === "orders" && (
          <DataTable
            columns={orderColumns}
            rows={data.purchaseOrders}
            emptyState={
              <EmptyState
                icon={<BillsIcon className="h-5 w-5" />}
                title={t("sup.po_no_orders")}
                action={
                  canWrite && data.suppliers.length > 0 && data.products.length > 0 ? (
                    <Button variant="primary" onClick={openPo}>
                      {t("sup.new_po")}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}

        {activeSection === "purchases" && (
          <DataTable
            columns={purchaseColumns}
            rows={data.purchases.slice(0, 50)}
            emptyState={
              <EmptyState
                icon={<InboxIcon className="h-5 w-5" />}
                title={t("sup.recent_grn")}
                description={t("sup.grn_hint")}
                action={
                  canWrite && data.suppliers.length > 0 && data.products.length > 0 ? (
                    <Button variant="primary" onClick={openPurchase}>
                      {t("sup.record_purchase")}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}

        <Drawer
          open={showSupplierDrawer}
          onClose={closeSupplierDrawer}
          title={editing ? t("sup.edit") : t("sup.add")}
          description={editing?.name ?? t("nav.suppliers")}
          size="md"
          footer={
            <DrawerFooter
              onCancel={closeSupplierDrawer}
              cancelLabel={t("common.cancel")}
              primaryLabel={
                savingSupplier
                  ? t("common.saving")
                  : editing
                    ? t("common.update")
                    : t("sup.add")
              }
              primaryType="submit"
              primaryForm="supplier-form"
              primaryDisabled={!canWrite || savingSupplier || !name.trim()}
              primaryLoading={savingSupplier}
            />
          }
        >
          <form id="supplier-form" onSubmit={saveSupplier} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              {t("sup.name")}
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={`${inputClass} mt-2`}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                {t("common.phone")}
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                {t("sup.contact_person")}
                <input
                  value={contactPerson}
                  onChange={(event) => setContactPerson(event.target.value)}
                  className={`${inputClass} mt-2`}
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              {t("common.address")}
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className={`${inputClass} mt-2`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("sup.vat_number")}
              <input
                value={vatNumber}
                onChange={(event) => setVatNumber(event.target.value)}
                className={`${inputClass} mt-2`}
              />
            </label>
          </form>
        </Drawer>

        <Drawer
          open={showPurchase}
          onClose={() => setShowPurchase(false)}
          title={t("sup.purchase_grn")}
          description={t("sup.grn_hint")}
          size="xl"
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="secondary" onClick={() => setShowPurchase(false)}>
                {t("common.cancel")}
              </Button>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-500">{t("common.total")}</p>
                  <p className="font-mono text-base font-bold tabular-nums text-slate-950">
                    {formatLkr(purchaseGrandTotal)}
                  </p>
                </div>
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => void handlePurchase()}
                  loading={savingPurchase}
                  disabled={savingPurchase}
                >
                  {t("common.save")}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                {t("common.supplier")}
                <select
                  value={purchaseSupplierId}
                  onChange={(event) => setPurchaseSupplierId(event.target.value)}
                  className={`${inputClass} mt-2`}
                >
                  <option value="">{t("sup.select")}</option>
                  {data.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                {t("common.payment")}
                <select
                  value={purchasePayment}
                  onChange={(event) =>
                    setPurchasePayment(event.target.value as PaymentMethod)
                  }
                  className={`${inputClass} mt-2`}
                >
                  <option value="credit">{t("sup.credit_later")}</option>
                  <option value="cash">{t("sup.cash_paid")}</option>
                  <option value="bank_transfer">{t("pay.bank")}</option>
                  <option value="cheque">{t("sup.cheque_paid")}</option>
                </select>
              </label>
            </div>

            {purchasePayment === "cheque" && (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                <input
                  placeholder={t("sales.cheque_no")}
                  value={chequeNo}
                  onChange={(event) => setChequeNo(event.target.value)}
                  className={inputClass}
                />
                <select
                  value={chequeBank}
                  onChange={(event) => setChequeBank(event.target.value)}
                  className={inputClass}
                >
                  {LK_BANKS.map((bank) => (
                    <option key={bank}>{bank}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={chequeDate}
                  onChange={(event) => setChequeDate(event.target.value)}
                  className={inputClass}
                />
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-3">
                  <input
                    type="checkbox"
                    checked={postDated}
                    onChange={(event) => setPostDated(event.target.checked)}
                  />
                  {t("sales.pdc")}
                </label>
              </div>
            )}

            <SearchInput
              value={purchaseSearch}
              onChange={setPurchaseSearch}
              placeholder={t("sales.search_placeholder")}
            />

            <ProductLineList
              products={purchaseProducts}
              lines={purchaseLines}
              onChange={setLine}
              qtyLabel={t("common.qty")}
              costLabel={t("sup.unit_cost")}
              noMatchLabel={t("sales.no_match")}
              itemLabel={t("common.items")}
              totalLabel={t("common.total")}
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>{t("vat.subtotal")}</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatLkr(purchaseTotal)}
                </span>
              </div>
              {vatRegistered && (
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  {t("vat.input_vat")} (18%)
                  <input
                    type="number"
                    min={0}
                    value={purchaseInputVat === "" ? defaultInputVat : purchaseInputVat}
                    onChange={(event) =>
                      setPurchaseInputVat(
                        event.target.value === "" ? "" : Number(event.target.value),
                      )
                    }
                    className={`${inputClass} mt-2`}
                  />
                </label>
              )}
            </div>
          </div>
        </Drawer>

        <Drawer
          open={showPo}
          onClose={() => setShowPo(false)}
          title={t("sup.po_create_title")}
          description={t("sup.po_hint")}
          size="xl"
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="secondary" onClick={() => setShowPo(false)}>
                {t("common.cancel")}
              </Button>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-500">{t("sup.po_expected")}</p>
                  <p className="font-mono text-base font-bold tabular-nums text-slate-950">
                    {formatLkr(poExpectedTotal)}
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => void handleCreatePo()}
                  loading={savingPo}
                  disabled={savingPo}
                >
                  {t("common.save")}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            <AlertRow tone="info">{t("sup.po_hint")}</AlertRow>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                {t("common.supplier")}
                <select
                  value={poSupplierId}
                  onChange={(event) => setPoSupplierId(event.target.value)}
                  className={`${inputClass} mt-2`}
                >
                  <option value="">{t("sup.select")}</option>
                  {data.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              {data.acJobs.length > 0 && (
                <label className="block text-sm font-medium text-slate-700">
                  {t("sup.po_no_job")}
                  <select
                    value={poJobId}
                    onChange={(event) => setPoJobId(event.target.value)}
                    className={`${inputClass} mt-2`}
                  >
                    <option value="">{t("sup.po_no_job")}</option>
                    {data.acJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.jobNo} — {job.customerName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <SearchInput
              value={poSearch}
              onChange={setPoSearch}
              placeholder={t("sales.search_placeholder")}
            />

            <ProductLineList
              products={poProducts}
              lines={poLines}
              onChange={setPoLine}
              qtyLabel={t("common.qty")}
              costLabel={t("sup.unit_cost")}
              noMatchLabel={t("sales.no_match")}
              itemLabel={t("common.items")}
              totalLabel={t("common.total")}
            />
          </div>
        </Drawer>

        <Dialog
          open={Boolean(paySupplier)}
          onClose={() => setPaySupplierId(null)}
          title={paySupplier?.name ?? ""}
          description={
            paySupplier
              ? `${t("sup.you_owe_col")}: ${formatLkr(paySupplier.payableBalance)}`
              : undefined
          }
          size="md"
          footer={
            <DrawerFooter
              onCancel={() => setPaySupplierId(null)}
              cancelLabel={t("common.cancel")}
              primaryLabel={savingPayment ? t("common.saving") : t("common.save")}
              primaryDisabled={savingPayment || payAmount <= 0}
              primaryLoading={savingPayment}
              onPrimary={() => void handleSupplierPayment()}
            />
          }
        >
          <div className="grid gap-4">
            <label className="block text-sm font-medium text-slate-700">
              {t("bills.amount")}
              <input
                type="number"
                min={1}
                value={payAmount || ""}
                onChange={(event) => setPayAmount(Number(event.target.value))}
                className={`${inputClass} mt-2`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("common.payment")}
              <select
                value={payMethod}
                onChange={(event) => setPayMethod(event.target.value as PaymentMethod)}
                className={`${inputClass} mt-2`}
              >
                {PAYMENT_OPTIONS.filter(
                  (method) => method !== "credit" && method !== "card",
                ).map((method) => (
                  <option key={method} value={method}>
                    {paymentLabel(t, method)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Dialog>

        <Drawer
          open={Boolean(receivingPo)}
          onClose={() => setReceivingPo(null)}
          title={receivingPo?.poNo ?? t("sup.po_receive_title")}
          description={receivingPo?.supplierName}
          size="lg"
          footer={
            <DrawerFooter
              onCancel={() => setReceivingPo(null)}
              cancelLabel={t("common.cancel")}
              primaryLabel={savingReceive ? t("common.saving") : t("common.save")}
              primaryDisabled={savingReceive}
              primaryLoading={savingReceive}
              onPrimary={() => void handleReceivePo()}
            />
          }
        >
          {receivingPo && (
            <div className="space-y-4">
              <AlertRow tone="info">{t("sup.po_receive_hint")}</AlertRow>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {receivingPo.lines.map((line) => {
                  const outstanding = Math.max(0, line.qtyOrdered - line.qtyReceived);
                  if (outstanding <= 0) return null;
                  return (
                    <div
                      key={line.productId}
                      className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_120px]"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-950">{line.productName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {t("sup.po_qty_received")}: {line.qtyReceived}/{line.qtyOrdered}
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={outstanding}
                        placeholder={t("common.qty")}
                        value={receiveQty[line.productId] || ""}
                        onChange={(event) =>
                          setReceiveLineQty(
                            line.productId,
                            Math.min(
                              outstanding,
                              Math.max(0, Number(event.target.value)),
                            ),
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Drawer>

        <Drawer
          open={Boolean(ledgerSupplier)}
          onClose={() => setLedgerSupplier(null)}
          title={ledgerSupplier?.name ?? t("cust.ledger")}
          description={
            ledgerSupplier
              ? `${t("sup.you_owe_col")}: ${formatLkr(ledgerSupplier.payableBalance)}`
              : undefined
          }
          size="lg"
        >
          <DataTable
            columns={ledgerColumns}
            rows={ledgerEntries}
            emptyState={<EmptyState size="compact" title={t("cust.ledger_empty")} />}
          />
        </Drawer>
      </ProMain>
    </AppShell>
  );
}

function ProductLineList({
  products,
  lines,
  onChange,
  qtyLabel,
  costLabel,
  noMatchLabel,
  itemLabel,
  totalLabel,
}: {
  products: Array<{
    id: string;
    name: string;
    sku?: string;
    buyPrice: number;
  }>;
  lines: Record<string, { qty: number; unitCost: number }>;
  onChange: (productId: string, qty: number, unitCost: number) => void;
  qtyLabel: string;
  costLabel: string;
  noMatchLabel: string;
  itemLabel: string;
  totalLabel: string;
}) {
  if (products.length === 0) {
    return <EmptyState size="compact" title={noMatchLabel} />;
  }

  const fieldClass =
    "min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-950 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="hidden grid-cols-[minmax(0,1fr)_100px_130px_120px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid">
        <span>{itemLabel}</span>
        <span>{qtyLabel}</span>
        <span>{costLabel}</span>
        <span className="text-right">{totalLabel}</span>
      </div>
      <div className="max-h-[48vh] divide-y divide-slate-100 overflow-y-auto">
        {products.map((product) => {
          const line = lines[product.id] ?? { qty: 0, unitCost: product.buyPrice };
          return (
            <div
              key={product.id}
              className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_100px_130px_120px] sm:items-center"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-950">{product.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {product.sku || formatLkr(product.buyPrice)}
                </p>
              </div>
              <label className="block sm:contents">
                <span className="mb-1 block text-xs font-medium text-slate-400 sm:hidden">
                  {qtyLabel}
                </span>
                <input
                  type="number"
                  min={0}
                  value={line.qty || ""}
                  onChange={(event) =>
                    onChange(product.id, Number(event.target.value), line.unitCost)
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block sm:contents">
                <span className="mb-1 block text-xs font-medium text-slate-400 sm:hidden">
                  {costLabel}
                </span>
                <input
                  type="number"
                  min={0}
                  value={line.unitCost || ""}
                  onChange={(event) =>
                    onChange(product.id, line.qty, Number(event.target.value))
                  }
                  className={fieldClass}
                />
              </label>
              <p className="text-right font-mono text-sm font-semibold tabular-nums text-slate-700">
                {line.qty > 0 ? formatLkr(line.qty * line.unitCost) : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
