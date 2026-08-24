"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
} from "@/components/ui/pro-shell";
import { Button, MetricCard, PageHeader, SearchInput, Tabs } from "@/components/ui/primitives";
import { VehiclesIcon, CostingIcon, ReportsIcon, AlertTriangleIcon } from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { useAppStore } from "@/lib/store/use-app-store";
import type { VehicleRecord, VehicleStatus } from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import {
  agingLabel,
  CAR_MAKES,
  daysInStock,
  FINANCE_PARTNERS,
  VEHICLE_STATUSES,
  vehicleTotalCost,
} from "@/lib/vehicles";

export default function VehiclesPage() {
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

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VehicleRecord | null>(null);
  const [filter, setFilter] = useState<VehicleStatus | "all" | "aging">("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [updatingVehicleId, setUpdatingVehicleId] = useState<string | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
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

  const [sellId, setSellId] = useState<string | null>(null);
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

  const resetForm = () => {
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
    setEditing(null);
  };

  const loadVehicle = (v: VehicleRecord) => {
    setEditing(v);
    setMake(v.make);
    setModel(v.model);
    setYear(v.year);
    setChassisNo(v.chassisNo);
    setEngineNo(v.engineNo ?? "");
    setRegNo(v.regNo ?? "");
    setColor(v.color ?? "");
    setFuel(v.fuel);
    setTransmission(v.transmission);
    setMileageKm(v.mileageKm);
    setCondition(v.condition);
    setPurchasePrice(v.purchasePrice);
    setReconditionCost(v.reconditionCost);
    setAskPrice(v.askPrice);
    setMinPrice(v.minPrice ?? 0);
    setStatus(v.status === "sold" ? "for_sale" : v.status);
    setNotes(v.notes ?? "");
    setShowForm(true);
  };

  const vehicles = (() => {
    const query = search.trim().toLowerCase();
    return data.vehicles.filter((vehicle) => {
      const matchesStatus =
        filter === "all"
          ? true
          : filter === "aging"
            ? vehicle.status === "for_sale" && daysInStock(vehicle.dateAdded) >= 60
            : vehicle.status === filter;
      if (!matchesStatus) return false;
      if (!query) return true;
      return [
        vehicle.stockId,
        vehicle.make,
        vehicle.model,
        String(vehicle.year),
        vehicle.chassisNo,
        vehicle.engineNo,
        vehicle.regNo,
        vehicle.color,
      ].some((value) => (value ?? "").toLowerCase().includes(query));
    });
  })();

  const forSale = data.vehicles.filter((v) => v.status === "for_sale");
  const sold = data.vehicles.filter((v) => v.status === "sold");
  const agingCount = data.vehicles.filter((v) => v.status === "for_sale" && daysInStock(v.dateAdded) >= 60).length;
  const stockCost = forSale.reduce((sum, v) => sum + vehicleTotalCost(v.purchasePrice, v.reconditionCost), 0);
  const potentialProfit = forSale.reduce((sum, v) => sum + (v.askPrice - vehicleTotalCost(v.purchasePrice, v.reconditionCost)), 0);
  const soldProfit = sold.reduce((sum, v) => sum + ((v.soldPrice ?? 0) - vehicleTotalCost(v.purchasePrice, v.reconditionCost)), 0);
  const sellVehicleRecord = sellId ? data.vehicles.find((v) => v.id === sellId) : null;

  const vehStatusLabel = (s: VehicleStatus | "all" | "aging") => {
    if (s === "all") return t("veh.all");
    if (s === "aging") return t("veh.aging");
    if (s === "for_sale") return t("veh.for_sale");
    if (s === "reconditioning") return t("veh.reconditioning");
    if (s === "incoming") return t("veh.incoming");
    return t("veh.sold");
  };

  const currentCost = vehicleTotalCost(purchasePrice, reconditionCost);

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("veh.title")}
          description={`${forSale.length} ${t("veh.for_sale_count")} · ${t("veh.subtitle")}`}
          actions={
            <>
              <ProButton href="/customers" variant="secondary">{t("nav.customers")}</ProButton>
              {canSeeFinancials && <Button
                type="button"
                disabled={!canWrite}
                title={!canWrite ? (disabledHint ?? undefined) : undefined}
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                variant="primary"
              >
                {t("veh.add")}
              </Button>}
            </>
          }
          metrics={
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={t("veh.for_sale")} value={String(forSale.length)} hint={t("veh.for_sale_count")} icon={<VehiclesIcon className="h-5 w-5" />} />
              {canSeeFinancials ? (
                <>
                  <MetricCard label={t("common.cost")} value={formatLkr(stockCost)} hint="Current showroom stock" icon={<CostingIcon className="h-5 w-5" />} />
                  <MetricCard label={t("common.profit")} value={formatLkr(potentialProfit)} hint="Potential on asking price" icon={<ReportsIcon className="h-5 w-5" />} tone="positive" />
                </>
              ) : (
                <>
                  <MetricCard label={t("veh.incoming")} value={String(data.vehicles.filter((vehicle) => vehicle.status === "incoming").length)} hint="Awaiting yard arrival" icon={<VehiclesIcon className="h-5 w-5" />} />
                  <MetricCard label={t("veh.sold")} value={String(sold.length)} hint="Completed vehicle sales" icon={<ReportsIcon className="h-5 w-5" />} tone="positive" />
                </>
              )}
              <MetricCard label={t("veh.aging")} value={String(agingCount)} hint="60+ days in yard" icon={<AlertTriangleIcon className="h-5 w-5" />} tone={agingCount ? "warning" : "default"} />
            </section>
          }
        />

        <WriteDisabledHint className="mb-5" />

        {message && (
          <div className="mb-5 rounded-[1.25rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 shadow-sm">
            {message}
          </div>
        )}

        {showForm && canSeeFinancials && (
          <section className="mt-6">
            <ProCard
              eyebrow={editing ? "Edit vehicle" : "Add vehicle"}
              title={editing ? `${t("common.edit")} ${editing.stockId}` : t("veh.add_yard")}
              action={<ProBadge tone="teal">{formatLkr(currentCost)}</ProBadge>}
            >
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (savingVehicle) return;
                  if (!model.trim() || !chassisNo.trim()) {
                    setMessage(t("veh.model_required"));
                    return;
                  }
                  const input = {
                    make,
                    model,
                    year,
                    chassisNo,
                    engineNo,
                    regNo,
                    color,
                    fuel,
                    transmission,
                    mileageKm,
                    condition,
                    purchasePrice,
                    reconditionCost,
                    askPrice,
                    minPrice: minPrice || undefined,
                    status,
                    notes,
                  };
                  setSavingVehicle(true);
                  setMessage("");
                  const result = await saveVehicleToCloud(input, editing?.id);
                  setSavingVehicle(false);
                  if (!result.ok) {
                    setMessage(
                      result.error === "Duplicate chassis number"
                        ? t("veh.duplicate_chassis")
                        : result.error ?? t("common.save_failed"),
                    );
                    setTimeout(() => setMessage(""), 4000);
                    return;
                  }
                  setMessage(editing ? t("veh.updated") : t("veh.added"));
                  resetForm();
                  setShowForm(false);
                  setTimeout(() => setMessage(""), 3000);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <select value={make} onChange={(e) => setMake(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                    {CAR_MAKES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                  <input required placeholder={t("veh.model")} value={model} onChange={(e) => setModel(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input type="number" placeholder={t("veh.year")} value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input required placeholder={t("veh.chassis")} value={chassisNo} onChange={(e) => setChassisNo(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 font-mono text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("veh.engine_no")} value={engineNo} onChange={(e) => setEngineNo(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("veh.reg_no")} value={regNo} onChange={(e) => setRegNo(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <select value={fuel} onChange={(e) => setFuel(e.target.value as VehicleRecord["fuel"])} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                    <option value="petrol">{t("veh.petrol")}</option>
                    <option value="diesel">{t("veh.diesel")}</option>
                    <option value="hybrid">{t("veh.hybrid")}</option>
                    <option value="electric">{t("veh.electric")}</option>
                  </select>
                  <select value={transmission} onChange={(e) => setTransmission(e.target.value as VehicleRecord["transmission"])} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                    <option value="auto">{t("veh.auto")}</option>
                    <option value="manual">{t("veh.manual")}</option>
                  </select>
                  <input type="number" placeholder={t("veh.mileage")} value={mileageKm || ""} onChange={(e) => setMileageKm(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("veh.condition")} value={condition} onChange={(e) => setCondition(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <select value={status} onChange={(e) => setStatus(e.target.value as VehicleStatus)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                    {VEHICLE_STATUSES.filter((s) => s.value !== "sold").map((s) => <option key={s.value} value={s.value}>{vehStatusLabel(s.value as VehicleStatus)}</option>)}
                  </select>
                  <input type="number" placeholder={t("veh.purchase")} value={purchasePrice || ""} onChange={(e) => setPurchasePrice(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input type="number" placeholder={t("veh.recondition")} value={reconditionCost || ""} onChange={(e) => setReconditionCost(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input type="number" placeholder={t("veh.ask_price")} value={askPrice || ""} onChange={(e) => setAskPrice(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input type="number" placeholder={t("veh.min_price")} value={minPrice || ""} onChange={(e) => setMinPrice(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("jobs.job_notes")} value={notes} onChange={(e) => setNotes(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100 lg:col-span-2" />
                </div>

                <div className="mt-5 rounded-[1.25rem] bg-slate-950 p-4 text-white">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("veh.total_cost")}</p>
                      <p className="mt-1 font-mono text-xl font-bold text-white">{formatLkr(currentCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("veh.est_profit")}</p>
                      <p className="mt-1 font-mono text-xl font-bold text-teal-300">{formatLkr(askPrice - currentCost)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button type="submit" disabled={!canWrite || savingVehicle} title={!canWrite ? (disabledHint ?? undefined) : undefined} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {savingVehicle ? t("common.saving") : editing ? t("common.update") : t("veh.add")}
                  </button>
                  <button type="button" onClick={() => { resetForm(); setShowForm(false); }} disabled={savingVehicle} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      {t("common.cancel")}
                  </button>
                </div>
              </form>
            </ProCard>
          </section>
        )}

        <section className="mt-6 space-y-4">
          <Tabs
            value={filter}
            onChange={(value) => setFilter(value as VehicleStatus | "all" | "aging")}
            tabs={(["all", "for_sale", "reconditioning", "incoming", "sold", "aging"] as const).map((value) => ({ value, label: vehStatusLabel(value) }))}
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search stock ID, chassis, registration, make, model or year…"
          />
        </section>

        <section className="mt-6">
          {vehicles.length === 0 ? (
            <ProCard>
              <ProEmptyState
                title={t("veh.no_vehicles")}
                description={t("veh.no_vehicles_hint")}
                action={
                  data.vehicles.length === 0 && canWrite && canSeeFinancials ? (
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setShowForm(true);
                      }}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-700/20"
                    >
                      {t("veh.add")}
                    </button>
                  ) : undefined
                }
              />
            </ProCard>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {vehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  canSeeFinancials={canSeeFinancials}
                  canWrite={canWrite}
                  statusLabel={vehStatusLabel(v.status)}
                  onEdit={() => loadVehicle(v)}
                  onListForSale={async () => {
                    if (updatingVehicleId) return;
                    setUpdatingVehicleId(v.id);
                    setMessage("");
                    const result = await updateVehicleToCloud(v.id, { status: "for_sale" });
                    setUpdatingVehicleId(null);
                    if (!result.ok) {
                      setMessage(result.error ?? t("common.save_failed"));
                      setTimeout(() => setMessage(""), 4000);
                    }
                  }}
                  onSell={() => {
                    setSellId(v.id);
                    setSellPrice(v.askPrice);
                  }}
                  onDelete={async () => {
                    if (deletingVehicleId || !confirm(`${t("common.confirm_delete")} ${v.stockId}?`)) return;
                    setDeletingVehicleId(v.id);
                    setMessage("");
                    const result = await deleteVehicleToCloud(v.id);
                    setDeletingVehicleId(null);
                    if (!result.ok) {
                      setMessage(result.error ?? t("common.save_failed"));
                      setTimeout(() => setMessage(""), 4000);
                    }
                  }}
                  updating={updatingVehicleId === v.id}
                  deleting={deletingVehicleId === v.id}
                />
              ))}
            </div>
          )}
        </section>

        {canSeeFinancials && sold.length > 0 && (
          <section className="mt-6">
            <ProCard title={t("veh.sold")} action={<ProBadge tone="emerald">{formatLkr(soldProfit)}</ProBadge>}>
              <p className="text-sm font-semibold text-slate-600">Sold vehicle profit summary is included in the dashboard cards above.</p>
            </ProCard>
          </section>
        )}

        {sellId && sellVehicleRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/80 bg-white p-5 shadow-sm shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">{t("veh.sell")}</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">
                    {sellVehicleRecord.make} {sellVehicleRecord.model}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{sellVehicleRecord.stockId} · {sellVehicleRecord.chassisNo}</p>
                </div>
                <button onClick={() => setSellId(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
              </div>
              <div className="mt-5 space-y-3">
                <input type="number" placeholder={t("veh.sell_price")} value={sellPrice || ""} onChange={(e) => setSellPrice(Number(e.target.value))} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                <select value={sellCustomerId} onChange={(e) => setSellCustomerId(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                  <option value="">{t("jobs.customer_opt")}</option>
                  {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!sellCustomerId && <input placeholder={t("veh.buyer_name")} value={sellCustomerName} onChange={(e) => setSellCustomerName(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />}
                <select value={sellPayment} onChange={(e) => setSellPayment(e.target.value as PaymentMethod)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                  {PAYMENT_OPTIONS.map((m) => <option key={m} value={m}>{paymentLabel(t, m)}</option>)}
                </select>
                {sellPayment === "credit" && (
                  <select value={financePartner} onChange={(e) => setFinancePartner(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                    {FINANCE_PARTNERS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                )}
              </div>
              {canSeeFinancials && <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("common.profit")}</p>
                <p className="mt-1 font-mono text-2xl font-bold text-teal-300">
                  {formatLkr(sellPrice - vehicleTotalCost(sellVehicleRecord.purchasePrice, sellVehicleRecord.reconditionCost))}
                </p>
              </div>}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={async () => {
                    if (savingSale) return;
                    if (sellPayment === "credit" && !sellCustomerId) {
                      setMessage(t("veh.credit_need"));
                      setSellId(null);
                      return;
                    }
                    setSavingSale(true);
                    setMessage("");
                    const result = await sellVehicleToCloud({
                      vehicleId: sellId,
                      sellPrice,
                      customerId: sellCustomerId || undefined,
                      customerName: sellCustomerName || undefined,
                      paymentMethod: sellPayment,
                      financePartner: sellPayment === "credit" && financePartner !== "Cash only" ? financePartner : undefined,
                    });
                    setSavingSale(false);
                    if (!result.ok) {
                      setMessage(result.error ?? t("common.save_failed"));
                      setTimeout(() => setMessage(""), 4000);
                      return;
                    }
                    setMessage(t("veh.sold_msg"));
                    setSellId(null);
                    setTimeout(() => setMessage(""), 3000);
                  }}
                  disabled={savingSale}
                  className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingSale ? t("common.saving") : t("veh.confirm_sale")}
                </button>
                <button onClick={() => setSellId(null)} disabled={savingSale} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}
      </ProMain>
    </AppShell>
  );
}

function VehicleCard({
  vehicle,
  canSeeFinancials,
  canWrite,
  statusLabel,
  onEdit,
  onListForSale,
  onSell,
  onDelete,
  updating,
  deleting,
}: {
  vehicle: VehicleRecord;
  canSeeFinancials: boolean;
  canWrite: boolean;
  statusLabel: string;
  onEdit: () => void;
  onListForSale: () => void | Promise<void>;
  onSell: () => void;
  onDelete: () => void | Promise<void>;
  updating?: boolean;
  deleting?: boolean;
}) {
  const { t } = useLocale();
  const days = daysInStock(vehicle.dateAdded);
  const aging = agingLabel(days);
  const cost = vehicleTotalCost(vehicle.purchasePrice, vehicle.reconditionCost);
  const profit = vehicle.status === "sold" && vehicle.soldPrice != null ? vehicle.soldPrice - cost : vehicle.askPrice - cost;

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white bg-white shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60">
      <div className="bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold uppercase tracking-wide text-teal-300">{vehicle.stockId} · {vehicle.chassisNo}</p>
            <h2 className="mt-2 truncate text-xl font-bold tracking-tight">
              {vehicle.make} {vehicle.model} {vehicle.year}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              {vehicle.mileageKm.toLocaleString()} km · {vehicle.fuel} · {vehicle.transmission}{vehicle.regNo && ` · ${vehicle.regNo}`}
            </p>
          </div>
          <ProBadge tone={vehicle.status === "sold" ? "emerald" : vehicle.status === "for_sale" ? "teal" : "amber"}>{statusLabel}</ProBadge>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          {canSeeFinancials && <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("common.cost")}</p>
              <p className="mt-1 font-mono text-sm font-bold text-slate-950">{formatLkr(cost)}</p>
          </div>}
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{vehicle.status === "sold" ? t("veh.sold_price") : t("veh.ask")}</p>
            <p className="mt-1 font-mono text-sm font-bold text-teal-700">{formatLkr(vehicle.status === "sold" ? vehicle.soldPrice ?? 0 : vehicle.askPrice)}</p>
          </div>
          {canSeeFinancials && <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("common.profit")}</p>
            <p className="mt-1 font-mono text-sm font-bold text-emerald-700">{formatLkr(profit)}</p>
          </div>}
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("veh.days_stock")}</p>
            <p className="mt-1 font-mono text-sm font-bold text-slate-950">{vehicle.status === "sold" ? "—" : days}</p>
          </div>
        </div>

        {aging && vehicle.status === "for_sale" && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-800">
            {aging} {t("veh.in_yard")}
          </div>
        )}

        {(vehicle.customerName || vehicle.financePartner) && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            {vehicle.customerName && <p>{t("veh.buyer")}: {vehicle.customerName}</p>}
            {vehicle.financePartner && <p>{t("veh.finance")}: {vehicle.financePartner}</p>}
          </div>
        )}

        {vehicle.status !== "sold" && canWrite && (
          <div className="mt-4 flex flex-wrap gap-2">
            {canSeeFinancials && <button onClick={onEdit} className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100">{t("common.edit")}</button>}
            {canSeeFinancials && vehicle.status !== "for_sale" && (
              <button
                onClick={() => void onListForSale()}
                disabled={updating}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {updating ? t("common.saving") : t("veh.list_sale")}
              </button>
            )}
            {vehicle.status === "for_sale" && <button onClick={onSell} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">{t("veh.sell")}</button>}
            {canSeeFinancials && <button
              onClick={() => void onDelete()}
              disabled={deleting}
              className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              {deleting ? t("common.saving") : t("common.delete")}
            </button>}
          </div>
        )}
      </div>
    </article>
  );
}
