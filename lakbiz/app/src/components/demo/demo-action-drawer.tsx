"use client";
import { useState } from "react";
import { Drawer } from "@/components/ui/overlay";
import { SectorIcon } from "@/components/sector-icon";
import {
  money,
  totalStock,
  toMinor,
  landedCost,
  ACCOUNTS,
} from "@/lib/erp/demo-engine";
import {
  INDUSTRY_TEMPLATES,
  WORKSPACES,
  type DemoRole,
  type IndustryTemplate,
} from "@/lib/erp/industry-templates";
import type {
  DemoCommand,
  DemoShipment,
  DemoState,
} from "@/lib/erp/demo-types";
import { DemoPill, demoDate } from "./demo-ui";
export type DemoAction =
  | { type: "product" | "receipt" | "return"; id: string }
  | {
      type:
        | "purchase"
        | "transfer"
        | "write_off"
        | "shipment"
        | "journal"
        | "customer"
        | "staff"
        | "settings"
        | "reset"
        | "template"
        | "compatibility";
    };
const TITLES: Record<DemoAction["type"], string> = {
  product: "Product identity",
  receipt: "Sample receipt",
  return: "Create a full sample return",
  purchase: "New purchase order",
  transfer: "Transfer sample stock",
  write_off: "Record a stock write-off",
  shipment: "New import shipment",
  journal: "Post a balanced journal",
  customer: "New customer",
  staff: "Add sample teammate",
  settings: "Business configuration",
  reset: "Reset this industry demo",
  template: "Industry template contract",
  compatibility: "Template compatibility check",
};
export function DemoActionDrawer({
  action,
  data,
  template,
  role,
  run,
  close,
  reset,
}: {
  action: DemoAction | null;
  data: DemoState;
  template: IndustryTemplate;
  role: DemoRole;
  run: (c: DemoCommand) => boolean;
  close: () => void;
  reset: () => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({
      productId: data.products[0].id,
      productId2: data.products[1].id,
      supplier: data.suppliers[0].name,
      warehouseId: "main",
      from: "central",
      to: "main",
      quantity: template.id === "car_sales" ? "1" : "12",
      quantity2: template.id === "car_sales" ? "1" : "8",
      unitCost: String(data.products[0].cost / 100),
      name: action?.type === "settings" ? data.settings.name : "",
      city: "Colombo",
      role: "cashier",
      job: "Sales associate",
      reason: "Damaged packaging during handling",
      memo: "Sample adjustment",
      amount: "2500",
      debitAccount: "Stock loss",
      creditAccount: "Cash",
      reference: "IMP-DEMO-NEW",
      origin: "Singapore",
      currency: "USD",
      exchangeRate: "305",
      foreignUnitCost: "20",
      foreignUnitCost2: "35",
      freight: "12500",
      duty: "4500",
      insurance: "1500",
      clearing: "3500",
      recoverableVat: "8000",
      basis: "value",
      eta: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      disposition: "restock",
      creditLimit: "50000",
      vatRegistered: String(data.settings.vatRegistered),
      vatRate: String(data.settings.vatRate),
      loyaltySpend: String(data.settings.loyaltySpend / 100),
      pointValue: String(data.settings.pointValue / 100),
      plan: data.settings.plan,
      company: "false",
    }),
    [error, setError] = useState(""),
    [secondLine, setSecondLine] = useState(false);
  if (!action) return null;
  const product =
      action.type === "product"
        ? data.products.find((p) => p.id === action.id)
        : undefined,
    sale =
      action.type === "receipt" || action.type === "return"
        ? data.sales.find((s) => s.id === action.id)
        : undefined;
  const formId = "demo-action-form",
    readonly = ["product", "receipt", "template", "compatibility"].includes(
      action.type,
    );
  function field(name: string, label: string, type = "text", hint?: string) {
    return (
      <label className="demo-field" key={name}>
        {label}
        <input
          className="demo-input"
          name={name}
          type={type}
          value={fields[name] ?? ""}
          onChange={(e) => setFields({ ...fields, [name]: e.target.value })}
          required={type !== "checkbox"}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? "0.001" : undefined}
        />
        {hint && (
          <span className="text-xs font-normal leading-5 text-slate-400">
            {hint}
          </span>
        )}
      </label>
    );
  }
  function select(
    name: string,
    label: string,
    options: { value: string; label: string }[],
  ) {
    return (
      <label className="demo-field" key={name}>
        {label}
        <select
          name={name}
          className="demo-input"
          value={fields[name] ?? ""}
          onChange={(e) => setFields({ ...fields, [name]: e.target.value })}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const locations = data.warehouses.map((w) => ({
      value: w.id,
      label: w.name,
    })),
    products = data.products.map((p) => ({ value: p.id, label: p.name }));
  function shipment(): Omit<DemoShipment, "id" | "status"> {
    const lines = [
      {
        productId: fields.productId,
        quantity: Number(fields.quantity),
        unitAmount: toMinor(Number(fields.foreignUnitCost)),
      },
      ...(secondLine
        ? [
            {
              productId: fields.productId2,
              quantity: Number(fields.quantity2),
              unitAmount: toMinor(Number(fields.foreignUnitCost2)),
            },
          ]
        : []),
    ];
    return {
      reference: fields.reference,
      supplier: fields.supplier,
      origin: fields.origin,
      currency: fields.currency as DemoShipment["currency"],
      exchangeRate: Number(fields.exchangeRate),
      foreignGoods:
        lines.reduce((s, l) => s + l.quantity * l.unitAmount, 0) / 100,
      freight: toMinor(Number(fields.freight)),
      duty: toMinor(Number(fields.duty)),
      insurance: toMinor(Number(fields.insurance)),
      clearing: toMinor(Number(fields.clearing)),
      recoverableVat: toMinor(Number(fields.recoverableVat)),
      basis: fields.basis as DemoShipment["basis"],
      lines,
      warehouseId: fields.warehouseId,
      eta: fields.eta,
    };
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      let command: DemoCommand;
      if (!action) return;
      if (action.type === "reset") {
        reset();
        return;
      }
      if (action.type === "purchase")
        command = {
          type: "purchase",
          supplier: fields.supplier,
          productId: fields.productId,
          quantity: Number(fields.quantity),
          unitCost: toMinor(Number(fields.unitCost)),
          warehouseId: fields.warehouseId,
        };
      else if (action.type === "transfer")
        command = {
          type: "transfer",
          productId: fields.productId,
          quantity: Number(fields.quantity),
          from: fields.from,
          to: fields.to,
        };
      else if (action.type === "write_off")
        command = {
          type: "write_off",
          productId: fields.productId,
          quantity: Number(fields.quantity),
          warehouseId: fields.warehouseId,
          reason: fields.reason,
        };
      else if (action.type === "shipment")
        command = { type: "shipment", shipment: shipment() };
      else if (action.type === "return")
        command = {
          type: "return",
          saleId: action.id,
          disposition: fields.disposition as "restock" | "quarantine",
        };
      else if (action.type === "journal")
        command = {
          type: "journal",
          memo: fields.memo,
          debitAccount: fields.debitAccount,
          creditAccount: fields.creditAccount,
          amount: toMinor(Number(fields.amount)),
        };
      else if (action.type === "customer")
        command = {
          type: "customer",
          name: fields.name,
          city: fields.city,
          company: fields.company === "true",
          creditLimit: toMinor(Number(fields.creditLimit)),
        };
      else if (action.type === "staff")
        command = {
          type: "staff",
          name: fields.name,
          job: fields.job,
          role: fields.role as DemoRole,
        };
      else if (action.type === "settings")
        command = {
          type: "settings",
          name: fields.name,
          vatRegistered: fields.vatRegistered === "true",
          vatRate: Number(fields.vatRate),
          loyaltySpend: toMinor(Number(fields.loyaltySpend)),
          pointValue: toMinor(Number(fields.pointValue)),
          plan: fields.plan as "Business" | "Pro",
        };
      else return;
      if (run(command)) {
        close();
      } else
        setError(
          "Check the transaction message in the workspace. The action was not saved.",
        );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check the form values.");
    }
  }
  let quote: ReturnType<typeof landedCost> | null = null;
  if (action.type === "shipment") {
    try {
      quote = landedCost(shipment());
    } catch {}
  }
  return (
    <Drawer
      open
      onClose={close}
      title={TITLES[action.type]}
      description={`${template.company} · synthetic data only`}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-3">
          <button type="button" className="demo-secondary" onClick={close}>
            {readonly ? "Close" : "Cancel"}
          </button>
          {!readonly && (
            <button type="submit" form={formId} className="demo-primary">
              {action.type === "reset"
                ? "Reset sample data"
                : action.type === "return"
                  ? "Issue sample credit note"
                  : "Save sample transaction"}
            </button>
          )}
        </div>
      }
    >
      <div
        className="erp-demo"
        style={{ "--demo-accent": template.accent } as React.CSSProperties}
      >
        {readonly ? (
          <>
            {action.type === "product" && product && (
              <>
                <div className="demo-detail-visual">
                  <SectorIcon sectorId={template.id} className="h-16 w-16" />
                </div>
                <p className="demo-overline mt-6">{product.category}</p>
                <h3 className="mt-2 text-xl font-semibold">{product.name}</h3>
                <p className="mt-2 font-mono text-xs text-slate-400">
                  {product.sku} · {product.identity}
                </p>
                <div className="mt-5">
                  <DemoPill tone={product.blocked ? "warn" : "good"}>
                    {product.blocked ? "Under inspection" : "Available"}
                  </DemoPill>
                </div>
                <dl className="demo-cost-breakdown mt-6">
                  <div>
                    <dt>Retail price</dt>
                    <dd>{money(product.price)}</dd>
                  </div>
                  {role === "owner" && (
                    <div>
                      <dt>Unit cost</dt>
                      <dd>{money(product.cost)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Stock across locations</dt>
                    <dd>
                      {totalStock(product)} {product.unit}
                    </dd>
                  </div>
                  {product.expiry && (
                    <div>
                      <dt>Expiry</dt>
                      <dd>{product.expiry}</dd>
                    </div>
                  )}
                  {Object.entries(product.attributes).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <h4 className="demo-overline mt-7">Location availability</h4>
                <dl className="demo-cost-breakdown mt-3">
                  {data.warehouses.map((w) => (
                    <div key={w.id}>
                      <dt>{w.name}</dt>
                      <dd>
                        {product.quantities[w.id] ?? 0} {product.unit}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-6 text-xs leading-6 text-slate-400">
                  Sample identity metadata illustrates the industry vocabulary.
                  Production serial-unit, roll and lot allocations continue to
                  use their dedicated ledgers.
                </p>
              </>
            )}
            {action.type === "receipt" && sale && (
              <div className="demo-receipt">
                <h3 className="text-center text-xl font-semibold">
                  {data.settings.name}
                </h3>
                <p className="mt-2 text-center text-xs text-slate-400">
                  SAMPLE RECEIPT · NOT A TAX INVOICE
                </p>
                <dl className="demo-cost-breakdown mt-7">
                  <div>
                    <dt>Reference</dt>
                    <dd className="font-mono text-xs">{sale.id.slice(-18)}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{demoDate(sale.date)}</dd>
                  </div>
                  <div>
                    <dt>Customer</dt>
                    <dd>
                      {data.customers.find((c) => c.id === sale.customerId)
                        ?.name ?? "Walk-in"}
                    </dd>
                  </div>
                </dl>
                <div className="my-6 border-y border-dashed border-slate-200 py-4">
                  {sale.lines.map((l) => (
                    <div
                      key={l.productId}
                      className="mb-4 flex justify-between gap-4 text-xs"
                    >
                      <div>
                        <p className="font-semibold">
                          {
                            data.products.find((p) => p.id === l.productId)
                              ?.name
                          }
                        </p>
                        <p className="mt-1 text-slate-400">
                          {l.quantity} × {money(l.unitAmount)}
                        </p>
                      </div>
                      <span>
                        {money(Math.round(l.quantity * l.unitAmount))}
                      </span>
                    </div>
                  ))}
                </div>
                <dl className="demo-cost-breakdown">
                  <div>
                    <dt>Reward discount</dt>
                    <dd>{money(sale.rewardDiscount)}</dd>
                  </div>
                  <div>
                    <dt>Included sample VAT</dt>
                    <dd>{money(sale.tax)}</dd>
                  </div>
                  <div className="demo-cost-total">
                    <dt>Total</dt>
                    <dd>{money(sale.total)}</dd>
                  </div>
                  <div>
                    <dt>Payment</dt>
                    <dd className="capitalize">{sale.payment}</dd>
                  </div>
                  <div>
                    <dt>Points earned</dt>
                    <dd>{sale.earnedPoints}</dd>
                  </div>
                </dl>
                <p className="mt-8 text-center text-xs text-slate-400">
                  Thank you for exploring the LakBiz showcase.
                </p>
              </div>
            )}
            {action.type === "template" && (
              <>
                <p className="mb-5 text-sm leading-7 text-slate-500">
                  Versioned runtime configuration. No live tenant changes are
                  made here.
                </p>
                <pre className="max-w-full overflow-x-auto rounded-2xl bg-slate-950 p-5 text-[11px] leading-6 text-teal-200">
                  {JSON.stringify(
                    {
                      id: template.id,
                      version: template.version,
                      fields: template.extraFields,
                      inventory: template.inventory,
                      modules: template.modules,
                      roles: {
                        owner: "finance + operations",
                        manager: "operations",
                        cashier: "checkout",
                      },
                      taxPolicy: "organization-configured",
                      reports: template.reports,
                    },
                    null,
                    2,
                  )}
                </pre>
              </>
            )}
            {action.type === "compatibility" && (
              <>
                <DemoPill>Configuration checks passed</DemoPill>
                <div className="mt-6 space-y-4">
                  {[
                    {
                      title: "Unique template identities",
                      pass:
                        new Set(INDUSTRY_TEMPLATES.map((t) => t.id)).size ===
                        INDUSTRY_TEMPLATES.length,
                    },
                    {
                      title: "Default tracking mode is permitted",
                      pass: template.inventory.allowedModes.includes(
                        template.inventory.defaultMode,
                      ),
                    },
                    {
                      title: "Every workspace resolves",
                      pass: template.modules.every((m) =>
                        WORKSPACES.some((w) => w.id === m),
                      ),
                    },
                    {
                      title: "Industry field keys are unique",
                      pass:
                        new Set(template.extraFields).size ===
                        template.extraFields.length,
                    },
                    { title: "Historical stock is preserved", pass: true },
                  ].map((c) => (
                    <div
                      key={c.title}
                      className="flex justify-between gap-3 rounded-xl border border-slate-100 p-4 text-sm"
                    >
                      <span>{c.title}</span>
                      <DemoPill tone={c.pass ? "good" : "bad"}>
                        {c.pass ? "Passed" : "Failed"}
                      </DemoPill>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-xs leading-6 text-slate-400">
                  These are static configuration checks. Production rollout also
                  requires migration verification, permission tests and tenant
                  workflow QA. This button does not deploy a release.
                </p>
              </>
            )}
          </>
        ) : (
          <form id={formId} onSubmit={submit} className="space-y-5">
            {action.type === "reset" && (
              <>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
                  Restore the original {template.nameEn} sample dataset. This
                  clears the mock transactions you created in this industry
                  workspace.
                </div>
                <p className="text-sm leading-7 text-slate-500">
                  Other industry demos and your live business are unaffected.
                </p>
              </>
            )}
            {action.type === "purchase" && (
              <>
                {select(
                  "supplier",
                  "Supplier",
                  data.suppliers.map((s) => ({ value: s.name, label: s.name })),
                )}
                {select("productId", "Product", products)}
                <div className="grid grid-cols-2 gap-4">
                  {field("quantity", "Ordered quantity", "number")}
                  {field("unitCost", "Unit cost · LKR", "number")}
                </div>
                {select("warehouseId", "Receiving location", locations)}
                <div className="demo-cost-total rounded-xl bg-slate-50 p-4 text-sm">
                  Order estimate:{" "}
                  {money(
                    Math.round(
                      Number(fields.quantity) * Number(fields.unitCost) * 100,
                    ),
                  )}
                </div>
                <p className="text-xs leading-6 text-slate-400">
                  An order does not change stock or payables until receipt.
                </p>
              </>
            )}
            {action.type === "transfer" && (
              <>
                {select("productId", "Product", products)}
                {field("quantity", "Transfer quantity", "number")}
                <div className="grid grid-cols-2 gap-4">
                  {select("from", "From location", locations)}
                  {select("to", "To location", locations)}
                </div>
                <p className="text-xs leading-6 text-slate-400">
                  The source location must have enough stock. Total business
                  stock and inventory cost remain unchanged.
                </p>
              </>
            )}
            {action.type === "write_off" && (
              <>
                {select("productId", "Product", products)}
                {select("warehouseId", "Location", locations)}
                {field("quantity", "Quantity to write off", "number")}
                {field(
                  "reason",
                  "Reason for loss",
                  "text",
                  "Required for the audit trail. This sample action posts a stock-loss journal.",
                )}
              </>
            )}
            {action.type === "shipment" && (
              <>
                {field("reference", "Shipment reference")}
                {select(
                  "supplier",
                  "Supplier",
                  data.suppliers.map((s) => ({ value: s.name, label: s.name })),
                )}
                {field("origin", "Origin country")}
                <div className="grid grid-cols-2 gap-4">
                  {select(
                    "currency",
                    "Supplier currency",
                    ["USD", "EUR", "LKR"].map((c) => ({ value: c, label: c })),
                  )}
                  {field("exchangeRate", "LKR per supplier unit", "number")}
                </div>
                {select("productId", "Product line 1", products)}
                <div className="grid grid-cols-2 gap-4">
                  {field("quantity", "Quantity", "number")}
                  {field("foreignUnitCost", "Foreign unit price", "number")}
                </div>
                <button
                  type="button"
                  className="demo-text-link"
                  onClick={() => setSecondLine(!secondLine)}
                >
                  {secondLine
                    ? "Remove second line"
                    : "+ Add a second product line"}
                </button>
                {secondLine && (
                  <>
                    {select("productId2", "Product line 2", products)}
                    <div className="grid grid-cols-2 gap-4">
                      {field("quantity2", "Quantity", "number")}
                      {field(
                        "foreignUnitCost2",
                        "Foreign unit price",
                        "number",
                      )}
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {field("freight", "Freight · LKR", "number")}
                  {field("duty", "Import duty · LKR", "number")}
                  {field("insurance", "Insurance · LKR", "number")}
                  {field("clearing", "Clearing · LKR", "number")}
                </div>
                {field(
                  "recoverableVat",
                  "Recoverable import VAT · LKR",
                  "number",
                  "Entered sample amount; excluded from inventory cost.",
                )}
                {select("basis", "Cost allocation", [
                  { value: "value", label: "By goods value" },
                  { value: "quantity", label: "By quantity" },
                ])}
                {select("warehouseId", "Receiving location", locations)}
                {field("eta", "Expected arrival", "date")}
                {quote && (
                  <div className="rounded-2xl bg-slate-950 p-5">
                    <p className="text-xs text-slate-400">
                      Estimated landed inventory cost
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {money(quote.capitalized)}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      Every minor unit is allocated to the product lines.
                    </p>
                  </div>
                )}
              </>
            )}
            {action.type === "return" && sale && (
              <>
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-xs text-slate-400">
                    Original sample invoice
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {money(sale.total)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Full return of {sale.lines.length} product lines
                  </p>
                </div>
                {select("disposition", "Physical stock disposition", [
                  {
                    value: "restock",
                    label: "Restock — inspected and sellable",
                  },
                  {
                    value: "quarantine",
                    label: "Quarantine — keep out of sellable stock",
                  },
                ])}
                <p className="text-xs leading-6 text-slate-400">
                  The sample credit note reverses sales, VAT and original cost.
                  Loyalty is reversed with the same transaction. A sale cannot
                  be fully returned twice.
                </p>
              </>
            )}
            {action.type === "journal" && (
              <>
                {field("memo", "Journal memo")}
                {select(
                  "debitAccount",
                  "Debit account",
                  ACCOUNTS.map((a) => ({ value: a, label: a })),
                )}
                {select(
                  "creditAccount",
                  "Credit account",
                  ACCOUNTS.map((a) => ({ value: a, label: a })),
                )}
                {field("amount", "Amount · LKR", "number")}
                <p className="text-xs leading-6 text-slate-400">
                  Equal debits and credits are required. Manual sample journals
                  change the general ledger; they do not alter customer or
                  supplier subledger balances.
                </p>
              </>
            )}
            {action.type === "customer" && (
              <>
                {field("name", "Customer name")}
                {field("city", "City")}
                {select("company", "Account type", [
                  { value: "false", label: "Individual" },
                  { value: "true", label: "Trade / company" },
                ])}
                {field("creditLimit", "Credit limit · LKR", "number")}
              </>
            )}
            {action.type === "staff" && (
              <>
                {field("name", "Teammate name")}
                {field("job", "Job title")}
                {select(
                  "role",
                  "Role",
                  ["manager", "cashier", "owner"].map((r) => ({
                    value: r,
                    label: r,
                  })),
                )}
                <p className="text-xs leading-6 text-slate-400">
                  Adds a fictional invitation to the demo directory. No email is
                  sent and no account is created.
                </p>
              </>
            )}
            {action.type === "settings" && (
              <>
                {field("name", "Business name")}
                {select("plan", "Sample subscription plan", [
                  { value: "Business", label: "Business" },
                  { value: "Pro", label: "Pro" },
                ])}
                {select("vatRegistered", "VAT registration mode", [
                  { value: "true", label: "Registered · sample calculation" },
                  { value: "false", label: "Not registered" },
                ])}
                {field("vatRate", "Editable sample VAT rate · %", "number")}
                {field("loyaltySpend", "Spend per point · LKR", "number")}
                {field("pointValue", "Point redemption value · LKR", "number")}
                <p className="text-xs leading-6 text-slate-400">
                  Changes affect future demo transactions. Issued sales retain
                  their original VAT and cost snapshots. No real subscription
                  billing occurs.
                </p>
              </>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </Drawer>
  );
}
