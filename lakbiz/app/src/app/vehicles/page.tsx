"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { formatLkr } from "@/lib/format";
import { useAppStore } from "@/lib/store/use-app-store";
import type { VehicleRecord } from "@/lib/store/types";
import type { VehicleStatus } from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";
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
    addVehicle,
    updateVehicle,
    sellVehicle,
    deleteVehicle,
  } = useAppStore();

  const [showForm, setShowForm] = useState(true);
  const [editing, setEditing] = useState<VehicleRecord | null>(null);
  const [filter, setFilter] = useState<VehicleStatus | "all" | "aging">("all");
  const [message, setMessage] = useState("");

  const [make, setMake] = useState(CAR_MAKES[0]);
  const [model, setModel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() - 3);
  const [chassisNo, setChassisNo] = useState("");
  const [engineNo, setEngineNo] = useState("");
  const [regNo, setRegNo] = useState("");
  const [color, setColor] = useState("");
  const [fuel, setFuel] = useState<VehicleRecord["fuel"]>("petrol");
  const [transmission, setTransmission] =
    useState<VehicleRecord["transmission"]>("auto");
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
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">Loading...</main>
      </div>
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

  const vehicles = data.vehicles.filter((v) => {
    if (filter === "all") return true;
    if (filter === "aging") {
      return v.status === "for_sale" && daysInStock(v.dateAdded) >= 60;
    }
    return v.status === filter;
  });

  const forSale = data.vehicles.filter((v) => v.status === "for_sale");

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vehicles</h1>
            <p className="text-slate-600">
              මෝටර් රථ — {forSale.length} for sale · per-vehicle profit tracking
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm((v) => !v);
            }}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
          >
            {showForm ? "Hide form" : "+ Add vehicle"}
          </button>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {message}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!model.trim() || !chassisNo.trim()) {
                setMessage("Model and chassis number required.");
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
              if (editing) {
                updateVehicle(editing.id, input);
                setMessage("Vehicle updated.");
                resetForm();
                setShowForm(false);
              } else {
                const ok = addVehicle(input);
                if (ok) {
                  setMessage("Vehicle added.");
                  resetForm();
                  setShowForm(false);
                } else {
                  setMessage("Chassis number already in stock.");
                }
              }
              setTimeout(() => setMessage(""), 3000);
            }}
            className="mb-8 rounded-xl border bg-white p-5"
          >
            <h2 className="font-semibold">
              {editing ? `Edit ${editing.stockId}` : "Add vehicle to yard"}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <select
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {CAR_MAKES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <input
                required
                placeholder="Model *"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Chassis no. *"
                value={chassisNo}
                onChange={(e) => setChassisNo(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm font-mono"
              />
              <input
                placeholder="Engine no."
                value={engineNo}
                onChange={(e) => setEngineNo(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="Reg no."
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="Color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={fuel}
                onChange={(e) =>
                  setFuel(e.target.value as VehicleRecord["fuel"])
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="hybrid">Hybrid</option>
                <option value="electric">Electric</option>
              </select>
              <select
                value={transmission}
                onChange={(e) =>
                  setTransmission(
                    e.target.value as VehicleRecord["transmission"],
                  )
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
              </select>
              <input
                type="number"
                placeholder="Mileage (km)"
                value={mileageKm || ""}
                onChange={(e) => setMileageKm(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="Condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Purchase price (LKR)"
                value={purchasePrice || ""}
                onChange={(e) => setPurchasePrice(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Recondition cost (LKR)"
                value={reconditionCost || ""}
                onChange={(e) => setReconditionCost(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Ask price (LKR)"
                value={askPrice || ""}
                onChange={(e) => setAskPrice(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Min price (owner only)"
                value={minPrice || ""}
                onChange={(e) => setMinPrice(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {VEHICLE_STATUSES.filter((s) => s.value !== "sold").map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Total cost:{" "}
              <strong>
                {formatLkr(vehicleTotalCost(purchasePrice, reconditionCost))}
              </strong>
              {askPrice > 0 && (
                <>
                  {" "}
                  · Est. profit at ask:{" "}
                  <strong className="text-teal-700">
                    {formatLkr(
                      askPrice -
                        vehicleTotalCost(purchasePrice, reconditionCost),
                    )}
                  </strong>
                </>
              )}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
              >
                {editing ? "Update" : "Add vehicle"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "for_sale", "reconditioning", "incoming", "sold", "aging"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs capitalize ${
                  filter === f ? "bg-teal-700 text-white" : "bg-white border"
                }`}
              >
                {f === "aging" ? "60+ days" : f.replace("_", " ")}
              </button>
            ),
          )}
        </div>

        {vehicles.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">
            No vehicles in this view. Add imported or reconditioned stock above.
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((v) => {
              const days = daysInStock(v.dateAdded);
              const aging = agingLabel(days);
              const cost = vehicleTotalCost(
                v.purchasePrice,
                v.reconditionCost,
              );
              const profit =
                v.status === "sold" && v.soldPrice != null
                  ? v.soldPrice - cost
                  : v.askPrice - cost;

              return (
                <div
                  key={v.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-slate-400">
                        {v.stockId} · {v.chassisNo}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {v.make} {v.model} {v.year}
                      </p>
                      <p className="text-sm text-slate-500">
                        {v.mileageKm.toLocaleString()} km · {v.fuel} ·{" "}
                        {v.transmission}
                        {v.regNo && ` · ${v.regNo}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">
                        {v.status.replace("_", " ")}
                      </span>
                      {aging && v.status === "for_sale" && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          {aging} in yard
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <span>Cost: {formatLkr(cost)}</span>
                    {v.status === "sold" ? (
                      <>
                        <span>Sold: {formatLkr(v.soldPrice ?? 0)}</span>
                        <span className="font-semibold text-teal-700">
                          Profit: {formatLkr(profit)}
                        </span>
                        {v.customerName && (
                          <span>Buyer: {v.customerName}</span>
                        )}
                        {v.financePartner && (
                          <span>Finance: {v.financePartner}</span>
                        )}
                      </>
                    ) : (
                      <span>Ask: {formatLkr(v.askPrice)}</span>
                    )}
                    {v.status !== "sold" && (
                      <span className="text-slate-400">{days} days in stock</span>
                    )}
                  </div>
                  {v.status !== "sold" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => loadVehicle(v)}
                        className="text-sm text-teal-700 hover:underline"
                      >
                        Edit
                      </button>
                      {v.status !== "for_sale" && (
                        <button
                          onClick={() =>
                            updateVehicle(v.id, { status: "for_sale" })
                          }
                          className="text-sm text-teal-700 hover:underline"
                        >
                          → List for sale
                        </button>
                      )}
                      {v.status === "for_sale" && (
                        <button
                          onClick={() => {
                            setSellId(v.id);
                            setSellPrice(v.askPrice);
                          }}
                          className="text-sm font-medium text-teal-700 hover:underline"
                        >
                          Sell vehicle
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${v.stockId}?`)) {
                            deleteVehicle(v.id);
                          }
                        }}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sellId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5">
              <h3 className="font-semibold">Sell vehicle</h3>
              <div className="mt-3 space-y-3">
                <input
                  type="number"
                  placeholder="Sell price (LKR) *"
                  value={sellPrice || ""}
                  onChange={(e) => setSellPrice(Number(e.target.value))}
                  className="w-full rounded-lg border px-3 py-2"
                />
                <select
                  value={sellCustomerId}
                  onChange={(e) => setSellCustomerId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Customer (optional)</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {!sellCustomerId && (
                  <input
                    placeholder="Buyer name"
                    value={sellCustomerName}
                    onChange={(e) => setSellCustomerName(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                )}
                <select
                  value={sellPayment}
                  onChange={(e) =>
                    setSellPayment(e.target.value as PaymentMethod)
                  }
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="credit">Credit</option>
                </select>
                <select
                  value={financePartner}
                  onChange={(e) => setFinancePartner(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  {FINANCE_PARTNERS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (sellPayment === "credit" && !sellCustomerId) {
                      setMessage("Select customer for credit sale.");
                      setSellId(null);
                      return;
                    }
                    const ok = sellVehicle({
                      vehicleId: sellId,
                      sellPrice,
                      customerId: sellCustomerId || undefined,
                      customerName: sellCustomerName || undefined,
                      paymentMethod: sellPayment,
                      financePartner:
                        financePartner === "Cash only"
                          ? undefined
                          : financePartner,
                    });
                    if (ok) {
                      setMessage("Vehicle sold. Profit recorded.");
                      setSellId(null);
                    }
                  }}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
                >
                  Confirm sale
                </button>
                <button
                  onClick={() => setSellId(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
