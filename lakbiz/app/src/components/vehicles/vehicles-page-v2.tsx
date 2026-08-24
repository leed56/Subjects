"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import {
  ActionMenu,
  Button,
  EmptyState,
  FilterBar,
  MetricCard,
  PageHeader,
  SearchInput,
  StatusBadge,
} from "@/components/ui/primitives";
import { ConfirmDialog, Dialog, Drawer, DrawerFooter } from "@/components/ui/overlay";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { AlertTriangleIcon, CostingIcon, ReportsIcon, VehiclesIcon } from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { useAppStore } from "@/lib/store/use-app-store";
import type { VehicleInput, VehicleRecord, VehicleStatus } from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import {
  CAR_MAKES,
  daysInStock,
  FINANCE_PARTNERS,
  VEHICLE_STATUSES,
  vehicleTotalCost,
} from "@/lib/vehicles";

type VehicleFilter = VehicleStatus | "all" | "aging";

const fieldClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";
const secondaryLink =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950";

function statusTone(status: VehicleStatus): "neutral" | "positive" | "warning" | "info" {
  if (status === "sold") return "positive";
  if (status === "for_sale") return "info";
  if (status === "reconditioning") return "warning";
  return "neutral";
}

export default function VehiclesPageV2() {
  const {
    data,
    ready,
    saveVehicleToCloud,
    updateVehicleToCloud,
    sellVehicleToCloud,
    deleteVehicleToCloud,
  } = useAppStore();
  const { t } = useLocale();
  const { canWrite, disabledHint } = useWriteAccess();
  const { canSeeFinancials } = useSubscription();

  const [filter, setFilter] = useState<VehicleFilter>("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [vehicleDrawerOpen, setVehicleDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleRecord | null>(null);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [updatingVehicleId, setUpdatingVehicleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VehicleRecord | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState(false);
  const [sellTarget, setSellTarget] = useState<VehicleRecord | null>(null);
  const [savingSale, setSavingSale] = useState(false);

  const [make, setMake] = useState(CAR_MAKES[0]);
  const [model, setModel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() - 3);
  const [chassisNo, setChassisNo] = useState("");
  const [engineNo, setEngineNo] = useState("");
  const [regNo, setRegNo] = useState("");
  const [color, setColor] = useState("");
  const [fuel, setFuel] = useState<VehicleRecord["fuel"]>("petrol");
  const [transmission, setTransmission] = useState<VehicleRecord["transmission"]>("auto");
  const [mileageKm, setMileageKm] = useState(0);
  const [condition, setCondition] = useState("Reconditioned");
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [reconditionCost, setReconditionCost] = useState(0);
  const [askPrice, setAskPrice] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [status, setStatus] = useState<VehicleStatus>("for_sale");
  const [notes, setNotes] = useState("");

  const [sellPrice, setSellPrice] = useState(0);
  const [sellCustomerId, setSellCustomerId] = useState("");
  const [sellCustomerName, setSellCustomerName] = useState("");
  const [sellPayment, setSellPayment] = useState<PaymentMethod>("cash");
  const [financePartner, setFinancePartner] = useState(FINANCE_PARTNERS[0]);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const statusLabel = (value: VehicleFilter) => {
    if (value === "all") return t("veh.all");
    if (value === "aging") return t("veh.aging");
    if (value === "for_sale") return t("veh.for_sale");
    if (value === "reconditioning") return t("veh.reconditioning");
    if (value === "incoming") return t("veh.incoming");
    return t("veh.sold");
  };

  const resetVehicleForm = () => {
    setEditing(null);
    setMake(CAR_MAKES[0]);
    setModel("");
    setYear(new Date().getFullYear() - 3);
    setChassisNo("");
    setEngineNo("");
    setRegNo("");
    setColor("");
    setFuel("petrol");
    setTransmission("auto");
    setMileageKm(0);
    setCondition("Reconditioned");
    setPurchasePrice(0);
    setReconditionCost(0);
    setAskPrice(0);
    setMinPrice(0);
    setStatus("for_sale");
    setNotes("");
  };

  const openCreate = () => {
    resetVehicleForm();
    setVehicleDrawerOpen(true);
  };

  const openEdit = (vehicle: VehicleRecord) => {
    setEditing(vehicle);
    setMake(vehicle.make);
    setModel(vehicle.model);
    setYear(vehicle.year);
    setChassisNo(vehicle.chassisNo);
    setEngineNo(vehicle.engineNo ?? "");
    setRegNo(vehicle.regNo ?? "");
    setColor(vehicle.color ?? "");
    setFuel(vehicle.fuel);
    setTransmission(vehicle.transmission);
    setMileageKm(vehicle.mileageKm);
    setCondition(vehicle.condition);
    setPurchasePrice(vehicle.purchasePrice);
    setReconditionCost(vehicle.reconditionCost);
    setAskPrice(vehicle.askPrice);
    setMinPrice(vehicle.minPrice ?? 0);
    setStatus(vehicle.status === "sold" ? "for_sale" : vehicle.status);
    setNotes(vehicle.notes ?? "");
    setVehicleDrawerOpen(true);
  };

  const closeVehicleDrawer = () => {
    if (savingVehicle) return;
    setVehicleDrawerOpen(false);
    resetVehicleForm();
  };

  const forSale = data.vehicles.filter((vehicle) => vehicle.status === "for_sale");
  const incoming = data.vehicles.filter((vehicle) => vehicle.status === "incoming");
  const reconditioning = data.vehicles.filter((vehicle) => vehicle.status === "reconditioning");
  const sold = data.vehicles.filter((vehicle) => vehicle.status === "sold");
  const agingCount = forSale.filter((vehicle) => daysInStock(vehicle.dateAdded) >= 60).length;
  const stockCost = forSale.reduce(
    (sum, vehicle) => sum + vehicleTotalCost(vehicle.purchasePrice, vehicle.reconditionCost),
    0,
  );
  const potentialProfit = forSale.reduce(
    (sum, vehicle) =>
      sum + (vehicle.askPrice - vehicleTotalCost(vehicle.purchasePrice, vehicle.reconditionCost)),
    0,
  );

  const needle = query.trim().toLowerCase();
  const filteredVehicles = data.vehicles.filter((vehicle) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "aging"
          ? vehicle.status === "for_sale" && daysInStock(vehicle.dateAdded) >= 60
          : vehicle.status === filter;
    if (!matchesFilter) return false;
    if (!needle) return true;
    return [
      vehicle.stockId,
      vehicle.make,
      vehicle.model,
      String(vehicle.year),
      vehicle.chassisNo,
      vehicle.engineNo ?? "",
      vehicle.regNo ?? "",
      vehicle.color ?? "",
      vehicle.customerName ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  const saveVehicle = async () => {
    if (!model.trim() || !chassisNo.trim() || savingVehicle || !canWrite) {
      if (!model.trim() || !chassisNo.trim()) setMessage(t("veh.model_required"));
      return;
    }

    setSavingVehicle(true);
    setMessage("");

    const operationalInput = {
      make,
      model: model.trim(),
      year,
      chassisNo: chassisNo.trim(),
      engineNo: engineNo.trim(),
      regNo: regNo.trim(),
      color: color.trim(),
      fuel,
      transmission,
      mileageKm,
      condition: condition.trim(),
      askPrice,
      status,
      notes: notes.trim(),
    };

    let result: { ok: boolean; error?: string };
    if (editing && !canSeeFinancials) {
      result = await updateVehicleToCloud(editing.id, operationalInput);
    } else {
      const input: VehicleInput = {
        ...operationalInput,
        purchasePrice: canSeeFinancials ? purchasePrice : 0,
        reconditionCost: canSeeFinancials ? reconditionCost : 0,
        minPrice: canSeeFinancials && minPrice ? minPrice : undefined,
      };
      result = await saveVehicleToCloud(input, editing?.id);
    }

    setSavingVehicle(false);
    if (!result.ok) {
      setMessage(
        result.error === "Duplicate chassis number"
          ? t("veh.duplicate_chassis")
          : result.error ?? t("common.save_failed"),
      );
      return;
    }

    setMessage(editing ? t("veh.updated") : t("veh.added"));
    setVehicleDrawerOpen(false);
    resetVehicleForm();
  };

  const openSell = (vehicle: VehicleRecord) => {
    setSellTarget(vehicle);
    setSellPrice(vehicle.askPrice);
    setSellCustomerId("");
    setSellCustomerName("");
    setSellPayment("cash");
    setFinancePartner(FINANCE_PARTNERS[0]);
  };

  const confirmSale = async () => {
    if (!sellTarget || savingSale || !canWrite) return;
    if (sellPayment === "credit" && !sellCustomerId) {
      setMessage(t("veh.credit_need"));
      setSellTarget(null);
      return;
    }
    setSavingSale(true);
    setMessage("");
    const result = await sellVehicleToCloud({
      vehicleId: sellTarget.id,
      sellPrice,
      customerId: sellCustomerId || undefined,
      customerName: sellCustomerName.trim() || undefined,
      paymentMethod: sellPayment,
      financePartner: financePartner === "Cash only" ? undefined : financePartner,
    });
    setSavingSale(false);
    if (!result.ok) {
      setMessage(result.error ?? t("common.save_failed"));
      return;
    }
    setMessage(t("veh.sold_msg"));
    setSellTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletingVehicle || !canWrite) return;
    setDeletingVehicle(true);
    setMessage("");
    const result = await deleteVehicleToCloud(deleteTarget.id);
    setDeletingVehicle(false);
    if (!result.ok) {
      setMessage(result.error ?? t("common.save_failed"));
      return;
    }
    setDeleteTarget(null);
  };

  const listForSale = async (vehicle: VehicleRecord) => {
    if (updatingVehicleId || !canWrite) return;
    setUpdatingVehicleId(vehicle.id);
    setMessage("");
    const result = await updateVehicleToCloud(vehicle.id, { status: "for_sale" });
    setUpdatingVehicleId(null);
    if (!result.ok) setMessage(result.error ?? t("common.save_failed"));
  };

  const columns: DataTableColumn<VehicleRecord>[] = [
    {
      key: "vehicle",
      header: t("nav.vehicles"),
      render: (vehicle) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-xs font-semibold text-teal-700">{vehicle.stockId}</span>
            <StatusBadge tone={statusTone(vehicle.status)}>{statusLabel(vehicle.status)}</StatusBadge>
          </div>
          <p className="mt-1 truncate font-semibold text-slate-950">
            {vehicle.make} {vehicle.model} {vehicle.year}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">
            {vehicle.chassisNo}{vehicle.regNo ? ` · ${vehicle.regNo}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "details",
      header: t("veh.condition"),
      hideOnMobile: true,
      render: (vehicle) => (
        <div>
          <p className="text-sm text-slate-700">{vehicle.mileageKm.toLocaleString()} km</p>
          <p className="mt-1 text-xs capitalize text-slate-500">
            {vehicle.fuel} · {vehicle.transmission} · {vehicle.condition}
          </p>
        </div>
      ),
    },
    {
      key: "price",
      header: t("veh.ask"),
      align: "right",
      render: (vehicle) => (
        <div className="text-right">
          <p className="font-mono font-semibold tabular-nums text-slate-950">
            {formatLkr(vehicle.status === "sold" ? vehicle.soldPrice ?? 0 : vehicle.askPrice)}
          </p>
          {vehicle.status !== "sold" && (
            <p className="mt-1 text-xs text-slate-500">{daysInStock(vehicle.dateAdded)} {t("veh.days_stock")}</p>
          )}
        </div>
      ),
    },
    ...(canSeeFinancials
      ? ([
          {
            key: "cost",
            header: t("common.cost"),
            align: "right" as const,
            hideOnMobile: true,
            render: (vehicle: VehicleRecord) => (
              <span className="font-mono text-sm tabular-nums text-slate-600">
                {formatLkr(vehicleTotalCost(vehicle.purchasePrice, vehicle.reconditionCost))}
              </span>
            ),
          },
          {
            key: "profit",
            header: t("common.profit"),
            align: "right" as const,
            hideOnMobile: true,
            render: (vehicle: VehicleRecord) => {
              const cost = vehicleTotalCost(vehicle.purchasePrice, vehicle.reconditionCost);
              const price = vehicle.status === "sold" ? vehicle.soldPrice ?? 0 : vehicle.askPrice;
              return (
                <span className={`font-mono text-sm font-semibold tabular-nums ${price - cost < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {formatLkr(price - cost)}
                </span>
              );
            },
          },
        ] as DataTableColumn<VehicleRecord>[])
      : []),
    {
      key: "actions",
      header: "",
      align: "right",
      render: (vehicle) => {
        if (vehicle.status === "sold") return <span className="text-xs text-slate-400">—</span>;
        return (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <ActionMenu
              label={`${vehicle.stockId} actions`}
              items={[
                {
                  label: t("common.edit"),
                  onSelect: () => openEdit(vehicle),
                  disabled: !canWrite,
                },
                ...(vehicle.status !== "for_sale"
                  ? [{
                      label: updatingVehicleId === vehicle.id ? t("common.saving") : t("veh.list_sale"),
                      onSelect: () => void listForSale(vehicle),
                      disabled: !canWrite || updatingVehicleId === vehicle.id,
                    }]
                  : [{
                      label: t("veh.sell"),
                      onSelect: () => openSell(vehicle),
                      disabled: !canWrite,
                    }]),
                {
                  label: t("common.delete"),
                  onSelect: () => setDeleteTarget(vehicle),
                  tone: "danger" as const,
                  disabled: !canWrite,
                },
              ]}
            />
          </div>
        );
      },
    },
  ];

  const currentCost = vehicleTotalCost(purchasePrice, reconditionCost);
  const currentProfit = askPrice - currentCost;

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("veh.title")}
          description={`${forSale.length} ${t("veh.for_sale_count")} · ${t("veh.subtitle")}`}
          actions={
            <>
              <Link href="/customers" className={secondaryLink}>{t("nav.customers")}</Link>
              <Button variant="primary" onClick={openCreate} disabled={!canWrite} title={!canWrite ? disabledHint ?? undefined : undefined}>
                {t("veh.add")}
              </Button>
            </>
          }
        />

        <WriteDisabledHint className="mb-5" />

        {message && (
          <div role="status" className="mb-5 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900">
            {message}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t("veh.for_sale")} value={String(forSale.length)} hint={t("veh.for_sale_count")} icon={<VehiclesIcon className="h-4.5 w-4.5" />} />
          {canSeeFinancials ? (
            <>
              <MetricCard label={t("common.cost")} value={formatLkr(stockCost)} hint="Current showroom stock" icon={<CostingIcon className="h-4.5 w-4.5" />} />
              <MetricCard label={t("common.profit")} value={formatLkr(potentialProfit)} hint="Potential at asking price" icon={<ReportsIcon className="h-4.5 w-4.5" />} tone={potentialProfit < 0 ? "danger" : "positive"} />
            </>
          ) : (
            <>
              <MetricCard label={t("veh.incoming")} value={String(incoming.length)} icon={<VehiclesIcon className="h-4.5 w-4.5" />} />
              <MetricCard label={t("veh.reconditioning")} value={String(reconditioning.length)} icon={<VehiclesIcon className="h-4.5 w-4.5" />} />
            </>
          )}
          <MetricCard label={t("veh.aging")} value={String(agingCount)} hint="60+ days in yard" icon={<AlertTriangleIcon className="h-4.5 w-4.5" />} tone={agingCount ? "warning" : "default"} />
        </section>

        <section className="mt-6">
          <FilterBar>
            <SearchInput value={query} onChange={setQuery} placeholder={`${t("nav.vehicles")}…`} className="min-w-[15rem] flex-1" />
            <select value={filter} onChange={(event) => setFilter(event.target.value as VehicleFilter)} className={`${fieldClass} w-auto min-w-[10rem]`} aria-label="Vehicle status">
              {(["all", "for_sale", "reconditioning", "incoming", "sold", "aging"] as const).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
            </select>
            <span className="px-1 text-xs font-medium text-slate-500">{filteredVehicles.length} shown</span>
          </FilterBar>

          <DataTable rows={filteredVehicles} columns={columns} emptyState={<EmptyState title={t("veh.no_vehicles")} description={t("veh.no_vehicles_hint")} icon={<VehiclesIcon className="h-5 w-5" />} action={canWrite && data.vehicles.length === 0 ? <Button variant="primary" onClick={openCreate}>{t("veh.add")}</Button> : undefined} />} />
        </section>

        {sold.length > 0 && canSeeFinancials && <p className="mt-4 text-right text-xs font-medium text-slate-500">{t("veh.sold")}: {sold.length}</p>}

        <Drawer open={vehicleDrawerOpen} onClose={closeVehicleDrawer} title={editing ? `${t("common.edit")} ${editing.stockId}` : t("veh.add_yard")} description={editing ? `${editing.make} ${editing.model} · ${editing.chassisNo}` : t("veh.subtitle")} size="lg" footer={<DrawerFooter onCancel={closeVehicleDrawer} cancelLabel={t("common.cancel")} primaryLabel={editing ? t("common.update") : t("veh.add")} onPrimary={() => void saveVehicle()} primaryDisabled={!canWrite || savingVehicle} primaryLoading={savingVehicle} />}>
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-slate-950">Vehicle identity</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label><span className={labelClass}>Make</span><select value={make} onChange={(e) => setMake(e.target.value)} className={fieldClass}>{CAR_MAKES.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span className={labelClass}>{t("veh.model")}</span><input required value={model} onChange={(e) => setModel(e.target.value)} className={fieldClass} /></label>
                <label><span className={labelClass}>{t("veh.year")}</span><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={fieldClass} /></label>
                <label><span className={labelClass}>{t("veh.chassis")}</span><input required value={chassisNo} onChange={(e) => setChassisNo(e.target.value)} className={`${fieldClass} font-mono`} /></label>
                <label><span className={labelClass}>{t("veh.engine_no")}</span><input value={engineNo} onChange={(e) => setEngineNo(e.target.value)} className={fieldClass} /></label>
                <label><span className={labelClass}>{t("veh.reg_no")}</span><input value={regNo} onChange={(e) => setRegNo(e.target.value)} className={fieldClass} /></label>
                <label><span className={labelClass}>{t("veh.color")}</span><input value={color} onChange={(e) => setColor(e.target.value)} className={fieldClass} /></label>
                <label><span className={labelClass}>{t("veh.condition")}</span><input value={condition} onChange={(e) => setCondition(e.target.value)} className={fieldClass} /></label>
              </div>
            </section>

            <section className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-950">Operational details</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label><span className={labelClass}>Fuel</span><select value={fuel} onChange={(e) => setFuel(e.target.value as VehicleRecord["fuel"])} className={fieldClass}><option value="petrol">{t("veh.petrol")}</option><option value="diesel">{t("veh.diesel")}</option><option value="hybrid">{t("veh.hybrid")}</option><option value="electric">{t("veh.electric")}</option></select></label>
                <label><span className={labelClass}>Transmission</span><select value={transmission} onChange={(e) => setTransmission(e.target.value as VehicleRecord["transmission"])} className={fieldClass}><option value="auto">{t("veh.auto")}</option><option value="manual">{t("veh.manual")}</option></select></label>
                <label><span className={labelClass}>{t("veh.mileage")}</span><input type="number" value={mileageKm || ""} onChange={(e) => setMileageKm(Number(e.target.value))} className={fieldClass} /></label>
                <label><span className={labelClass}>Status</span><select value={status} onChange={(e) => setStatus(e.target.value as VehicleStatus)} className={fieldClass}>{VEHICLE_STATUSES.filter((item) => item.value !== "sold").map((item) => <option key={item.value} value={item.value}>{statusLabel(item.value as VehicleStatus)}</option>)}</select></label>
                <label className="sm:col-span-2"><span className={labelClass}>{t("jobs.job_notes")}</span><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} /></label>
              </div>
            </section>

            <section className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-950">Pricing</h3>
              <div className={`mt-3 grid gap-4 ${canSeeFinancials ? "sm:grid-cols-2" : ""}`}>
                {canSeeFinancials && <><label><span className={labelClass}>{t("veh.purchase")}</span><input type="number" value={purchasePrice || ""} onChange={(e) => setPurchasePrice(Number(e.target.value))} className={fieldClass} /></label><label><span className={labelClass}>{t("veh.recondition")}</span><input type="number" value={reconditionCost || ""} onChange={(e) => setReconditionCost(Number(e.target.value))} className={fieldClass} /></label><label><span className={labelClass}>{t("veh.min_price")}</span><input type="number" value={minPrice || ""} onChange={(e) => setMinPrice(Number(e.target.value))} className={fieldClass} /></label></>}
                <label><span className={labelClass}>{t("veh.ask_price")}</span><input type="number" value={askPrice || ""} onChange={(e) => setAskPrice(Number(e.target.value))} className={fieldClass} /></label>
              </div>
              {canSeeFinancials && <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("veh.total_cost")}</p><p className="mt-1 font-mono text-lg font-semibold text-slate-950">{formatLkr(currentCost)}</p></div><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("veh.est_profit")}</p><p className={`mt-1 font-mono text-lg font-semibold ${currentProfit < 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatLkr(currentProfit)}</p></div></div>}
            </section>
          </div>
        </Drawer>

        <Dialog open={Boolean(sellTarget)} onClose={() => !savingSale && setSellTarget(null)} title={sellTarget ? `${t("veh.sell")} · ${sellTarget.make} ${sellTarget.model}` : t("veh.sell")} description={sellTarget ? `${sellTarget.stockId} · ${sellTarget.chassisNo}` : undefined} size="md" footer={<><Button variant="secondary" onClick={() => setSellTarget(null)} disabled={savingSale}>{t("common.cancel")}</Button><Button variant="primary" onClick={() => void confirmSale()} disabled={!canWrite || savingSale}>{savingSale ? t("common.saving") : t("veh.confirm_sale")}</Button></>}>
          {sellTarget && <div className="space-y-4"><label><span className={labelClass}>{t("veh.sell_price")}</span><input type="number" value={sellPrice || ""} onChange={(e) => setSellPrice(Number(e.target.value))} className={fieldClass} /></label><label><span className={labelClass}>{t("common.customer")}</span><select value={sellCustomerId} onChange={(e) => setSellCustomerId(e.target.value)} className={fieldClass}><option value="">{t("jobs.customer_opt")}</option>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>{!sellCustomerId && <label><span className={labelClass}>{t("veh.buyer_name")}</span><input value={sellCustomerName} onChange={(e) => setSellCustomerName(e.target.value)} className={fieldClass} /></label>}<label><span className={labelClass}>Payment</span><select value={sellPayment} onChange={(e) => setSellPayment(e.target.value as PaymentMethod)} className={fieldClass}>{PAYMENT_OPTIONS.map((method) => <option key={method} value={method}>{paymentLabel(t, method)}</option>)}</select></label><label><span className={labelClass}>{t("veh.finance")}</span><select value={financePartner} onChange={(e) => setFinancePartner(e.target.value)} className={fieldClass}>{FINANCE_PARTNERS.map((partner) => <option key={partner}>{partner}</option>)}</select></label>{canSeeFinancials && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("common.profit")}</p><p className="mt-1 font-mono text-xl font-semibold text-emerald-700">{formatLkr(sellPrice - vehicleTotalCost(sellTarget.purchasePrice, sellTarget.reconditionCost))}</p></div>}</div>}
        </Dialog>

        <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => !deletingVehicle && setDeleteTarget(null)} title={t("common.confirm_delete")} description={deleteTarget ? `${deleteTarget.stockId} · ${deleteTarget.make} ${deleteTarget.model}` : undefined} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} tone="danger" loading={deletingVehicle} onConfirm={() => void confirmDelete()} />
      </ProMain>
    </AppShell>
  );
}
