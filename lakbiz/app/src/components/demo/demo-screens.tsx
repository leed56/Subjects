"use client";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/ui/table";
import { SectorIcon } from "@/components/sector-icon";
import {
  StockIcon,
  SalesIcon,
  BankingIcon,
  CustomersIcon,
  ShieldIcon,
  PlusIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import {
  INDUSTRY_TEMPLATES,
  WORKSPACES,
  type DemoRole,
  type IndustryTemplate,
  type WorkspaceId,
} from "@/lib/erp/industry-templates";
import {
  money,
  totalStock,
  landedCost,
  demoTrialBalance,
  businessDate,
} from "@/lib/erp/demo-engine";
import type { DemoCommand, DemoProduct, DemoState } from "@/lib/erp/demo-types";
import {
  DemoMetric,
  DemoSection,
  DemoPill,
  DemoEmpty,
  RevenueChart,
  demoDate,
  initials,
} from "./demo-ui";
import { ArrowMark } from "./demo-marks";
import type { DemoAction } from "./demo-action-drawer";
type Props = {
  workspace: WorkspaceId;
  data: DemoState;
  template: IndustryTemplate;
  role: DemoRole;
  search: string;
  run: (command: DemoCommand) => boolean;
  open: (action: DemoAction) => void;
};
const iconClass = "h-4 w-4";
export function DemoScreens(props: Props) {
  const { workspace } = props;
  if (workspace === "pos") return <DemoPos {...props} />;
  if (workspace === "overview") return <Overview {...props} />;
  if (workspace === "inventory") return <Inventory {...props} />;
  if (workspace === "purchases") return <Purchases {...props} />;
  if (workspace === "imports") return <Imports {...props} />;
  if (workspace === "warehouses") return <Warehouses {...props} />;
  if (workspace === "damage") return <Damage {...props} />;
  if (workspace === "returns") return <Returns {...props} />;
  if (workspace === "finance") return <Finance {...props} />;
  if (workspace === "customers" || workspace === "loyalty")
    return <Customers {...props} />;
  if (workspace === "staff") return <Staff {...props} />;
  if (workspace === "reports") return <Reports {...props} />;
  if (workspace === "pulse") return <Pulse {...props} />;
  if (workspace === "settings") return <Settings {...props} />;
  if (workspace === "templates") return <Templates {...props} />;
  return <Admin {...props} />;
}
function Action({
  children,
  onClick,
  secondary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={secondary ? "demo-secondary" : "demo-primary"}
    >
      {children}
    </button>
  );
}
function Stats({ children }: { children: React.ReactNode }) {
  return <div className="demo-stats-grid mb-7">{children}</div>;
}
function totals(data: DemoState) {
  const sales = data.sales.filter((s) => !s.returned);
  return {
    revenue: sales.reduce((s, x) => s + x.total, 0),
    profit: sales.reduce((s, x) => s + x.total - x.tax - x.cost, 0),
    tax: sales.reduce((s, x) => s + x.tax, 0),
    receivables: data.customers.reduce((s, c) => s + c.credit, 0),
    payables: data.suppliers.reduce((s, c) => s + c.payable, 0),
    stockValue: data.products.reduce((s, p) => s + totalStock(p) * p.cost, 0),
  };
}
function trend(data: DemoState) {
  const end = new Date(data.sales[0]?.date ?? data.journals[0].date);
  return Array.from({ length: 14 }, (_, i) => {
    const date = new Date(end.getTime() - (13 - i) * 86400000),
      key = businessDate(date);
    return {
      label: demoDate(date.toISOString()),
      value: data.sales
        .filter((s) => !s.returned && businessDate(new Date(s.date)) === key)
        .reduce((s, x) => s + x.total, 0),
    };
  });
}
function Overview({ data, template, role, open }: Props) {
  const t = totals(data),
    owner = role === "owner",
    active = data.sales.filter((s) => !s.returned);
  const today = businessDate(
      new Date(data.sales[0]?.date ?? data.journals[0].date),
    ),
    near = data.products.filter(
      (p) =>
        p.expiry &&
        p.expiry <=
          new Date(new Date(today).getTime() + 30 * 86400000)
            .toISOString()
            .slice(0, 10),
    );
  return (
    <>
      <section className="demo-overview-hero">
        <div>
          <span className="demo-pill demo-pill-good">
            Your business, connected
          </span>
          <h2 className="mt-5 max-w-xl text-3xl font-semibold leading-tight tracking-[-.035em] sm:text-4xl">
            A clear view.
            <br />A confident next move.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-400">
            {template.company} · {template.promise}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`${template.demoPath}/pos`} className="demo-primary">
              Start a sale
              <ArrowMark />
            </Link>
            <Link
              href={`${template.demoPath}/inventory`}
              className="demo-dark-secondary"
            >
              Explore inventory
            </Link>
          </div>
        </div>
        <div className="demo-hero-summary">
          <p className="demo-overline text-slate-500">
            Net sales · sample period
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-[-.04em] text-white">
            {money(t.revenue)}
          </p>
          <p className="mt-3 text-xs text-slate-400">
            {active.length} completed sales · 3 locations
          </p>
          <div className="mt-6 flex gap-6 border-t border-white/10 pt-5">
            <div>
              <p className="text-xl font-semibold text-white">
                {data.products.length}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Product lines</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-white">
                {data.customers.length}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Relationships</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-white">
                {data.shipments.filter((s) => s.status !== "received").length}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Inbound shipments
              </p>
            </div>
          </div>
        </div>
      </section>
      <Stats>
        <DemoMetric
          label="Sales"
          value={money(t.revenue)}
          hint="Net of full sample returns"
          icon={<SalesIcon className={iconClass} />}
          accent
        />
        <DemoMetric
          label={owner ? "Gross profit" : "Completed sales"}
          value={owner ? money(t.profit) : String(active.length)}
          hint={
            owner
              ? "Excluding output VAT; historical COGS"
              : "Across all sample locations"
          }
          icon={<BankingIcon className={iconClass} />}
        />
        <DemoMetric
          label={owner ? "Customer receivables" : "Customers"}
          value={owner ? money(t.receivables) : String(data.customers.length)}
          hint={
            owner
              ? "Balances from the connected credit ledger"
              : "Individuals and trade accounts"
          }
          icon={<CustomersIcon className={iconClass} />}
        />
        <DemoMetric
          label="Stock availability"
          value={
            String(
              data.products.filter((p) => !p.blocked && totalStock(p) > 0)
                .length,
            ) +
            " / " +
            data.products.length
          }
          hint="Sellable product lines"
          icon={<StockIcon className={iconClass} />}
        />
      </Stats>
      <div className="demo-two-column">
        <DemoSection
          title="The rhythm of your business"
          eyebrow="Sales performance"
          action={
            <Link
              href={`${template.demoPath}/reports`}
              className="demo-text-link"
            >
              View reports →
            </Link>
          }
        >
          <div className="mb-4 flex gap-7">
            <div>
              <p className="text-xs text-slate-400">Net revenue</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {money(t.revenue)}
              </p>
            </div>
            {owner && (
              <div>
                <p className="text-xs text-slate-400">Gross margin</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {t.revenue
                    ? ((t.profit / (t.revenue - t.tax)) * 100).toFixed(1)
                    : "0.0"}
                  %
                </p>
              </div>
            )}
          </div>
          <RevenueChart points={trend(data)} />
        </DemoSection>
        <DemoSection
          title="Needs a little attention"
          eyebrow="Operating signals"
        >
          <div className="space-y-3">
            {[
              {
                title: "Stock under inspection",
                n: data.products.filter((p) => p.blocked).length,
                text: "Held identities stay out of checkout",
                href: "inventory",
              },
              {
                title: "Upcoming expiry",
                n: near.length,
                text: "Review batches in the next 30 days",
                href: "inventory",
              },
              {
                title: "Orders waiting for receipt",
                n: data.purchases.filter((p) => p.status === "ordered").length,
                text: "Receive when goods arrive",
                href: "purchases",
              },
            ]
              .filter((a) => a.href !== "purchases" || owner)
              .map((a) => (
                <Link
                  key={a.title}
                  href={`${template.demoPath}/${a.href}`}
                  className="demo-attention-row"
                >
                  <span className="demo-attention-count">{a.n}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {a.text}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
          </div>
        </DemoSection>
      </div>
      <div className="demo-two-column mt-6">
        <DemoSection title="Latest activity" eyebrow="Connected operations">
          <div className="divide-y divide-slate-100">
            {data.audit.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-3">
                <span className="demo-icon-chip">
                  <StockIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize">
                    {a.action}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {demoDate(a.date)} · {a.actor}
                  </p>
                </div>
                <DemoPill>Recorded</DemoPill>
              </div>
            ))}
          </div>
        </DemoSection>
        <DemoSection
          title="Built around your industry"
          eyebrow={template.nameEn}
        >
          <div className="flex items-start gap-4">
            <div className="demo-industry-icon">
              <SectorIcon sectorId={template.id} className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">{template.promise}</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-500">
                {template.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => open({ type: "product", id: data.products[0].id })}
            className="demo-text-link mt-6"
          >
            Explore a sample product →
          </button>
        </DemoSection>
      </div>
    </>
  );
}

function Inventory({ data, template, role, search, open }: Props) {
  const [filter, setFilter] = useState("all");
  const products = data.products.filter(
    (p) =>
      `${p.name} ${p.sku} ${p.identity}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "held" && p.blocked) ||
        (filter === "low" && totalStock(p) <= p.reorder)),
  );
  return (
    <>
      <Stats>
        <DemoMetric
          label="Catalogue"
          value={String(data.products.length)}
          hint={`${template.inventory.defaultMode.replaceAll("_", " + ")} default tracking`}
          icon={<StockIcon className={iconClass} />}
          accent
        />
        <DemoMetric
          label="Locations"
          value={String(data.warehouses.length)}
          hint="Stock quantities partitioned by location"
        />
        <DemoMetric
          label="Held products"
          value={String(data.products.filter((p) => p.blocked).length)}
          hint="Blocked from sample checkout"
        />
        <DemoMetric
          label={role === "owner" ? "Inventory cost" : "Available lines"}
          value={
            role === "owner"
              ? money(totals(data).stockValue)
              : String(data.products.filter((p) => !p.blocked).length)
          }
          hint={
            role === "owner"
              ? "Weighted receipt costs across locations"
              : "Ready for the sales floor"
          }
        />
      </Stats>
      <div className="demo-toolbar">
        <div className="demo-tabs">
          {["all", "low", "held"].map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={filter === v}
              className={filter === v ? "demo-tab-active" : ""}
              onClick={() => setFilter(v)}
            >
              {v === "all"
                ? "All products"
                : v === "low"
                  ? "Reorder queue"
                  : "Under inspection"}
            </button>
          ))}
        </div>
        <Link
          href={`${template.demoPath}/warehouses`}
          className="demo-text-link"
        >
          Location stock →
        </Link>
      </div>
      <DataTable
        rows={products}
        onRowClick={(p) => open({ type: "product", id: p.id })}
        emptyState={
          <DemoEmpty
            title="No matching products"
            description="Try another search or stock filter."
          />
        }
        columns={[
          {
            key: "name",
            header: "Product",
            render: (p) => (
              <div className="flex items-center gap-3">
                <span className="demo-product-thumb">
                  <SectorIcon sectorId={template.id} className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold text-slate-800">
                    {p.name}
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {p.sku} · {p.category}
                  </span>
                </span>
              </div>
            ),
          },
          {
            key: "identity",
            header: "Identity",
            render: (p) => (
              <span className="font-mono text-xs">{p.identity}</span>
            ),
          },
          {
            key: "qty",
            header: "Available stock",
            align: "right",
            render: (p) => (
              <span className="font-semibold tabular-nums">
                {totalStock(p)}{" "}
                <span className="text-xs font-normal text-slate-400">
                  {p.unit}
                </span>
              </span>
            ),
          },
          {
            key: "price",
            header: "Retail price",
            align: "right",
            render: (p) => money(p.price),
          },
          ...(role === "owner"
            ? [
                {
                  key: "cost",
                  header: "Unit cost",
                  align: "right" as const,
                  render: (p: DemoProduct) => money(p.cost),
                },
              ]
            : []),
          {
            key: "state",
            header: "Status",
            render: (p) => (
              <DemoPill tone={p.blocked ? "warn" : "good"}>
                {p.blocked ? "Inspection hold" : "Available"}
              </DemoPill>
            ),
          },
        ]}
      />
      <DemoSection
        className="mt-6"
        title="Your product vocabulary"
        eyebrow="Industry configuration"
      >
        <div className="flex flex-wrap gap-2">
          {template.extraFields.map((f) => (
            <span
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500"
              key={f}
            >
              {f.replace(/([A-Z])/g, " $1")}
            </span>
          ))}
        </div>
        <p className="mt-4 text-xs leading-6 text-slate-400">
          {template.inventory.reasonEn}
        </p>
      </DemoSection>
    </>
  );
}

function Purchases({ data, search, open, run }: Props) {
  const list = data.purchases.filter((p) =>
    `${p.supplier} ${p.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Stats>
        <DemoMetric
          label="Open orders"
          value={String(
            data.purchases.filter((p) => p.status === "ordered").length,
          )}
          hint="Awaiting supplier delivery"
          accent
        />
        <DemoMetric
          label="Ordered value"
          value={money(
            data.purchases
              .filter((p) => p.status === "ordered")
              .reduce((s, p) => s + p.total, 0),
          )}
          hint="Commitments; not stock or a payable yet"
        />
        <DemoMetric
          label="Goods received"
          value={String(
            data.purchases.filter((p) => p.status === "received").length,
          )}
          hint="Posted once to stock and finance"
        />
        <DemoMetric
          label="Supplier payables"
          value={money(totals(data).payables)}
          hint="Opening balances plus receipts"
        />
      </Stats>
      <div className="demo-toolbar">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Purchase order register
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Create an order. Receive it when the goods arrive.
          </p>
        </div>
        <Action onClick={() => open({ type: "purchase" })}>
          <PlusIcon className={iconClass} />
          New purchase order
        </Action>
      </div>
      <DataTable
        rows={list}
        emptyState={
          <DemoEmpty
            title="No purchase orders"
            description="Create a sample order to begin the receiving workflow."
          />
        }
        columns={[
          {
            key: "id",
            header: "Order",
            render: (p) => (
              <span className="font-mono text-xs">{p.id.slice(-16)}</span>
            ),
          },
          {
            key: "supplier",
            header: "Supplier",
            render: (p) => <span className="font-medium">{p.supplier}</span>,
          },
          {
            key: "lines",
            header: "Items",
            render: (p) =>
              p.lines
                .map(
                  (l) =>
                    `${data.products.find((p) => p.id === l.productId)?.name} × ${l.quantity}`,
                )
                .join(", "),
          },
          {
            key: "total",
            header: "Value",
            align: "right",
            render: (p) => money(p.total),
          },
          {
            key: "status",
            header: "Stage",
            render: (p) => (
              <DemoPill tone={p.status === "ordered" ? "warn" : "good"}>
                {p.status === "ordered" ? "Awaiting receipt" : "Received"}
              </DemoPill>
            ),
          },
          {
            key: "actions",
            header: "Next step",
            render: (p) =>
              p.status === "ordered" ? (
                <button
                  type="button"
                  onClick={() => run({ type: "receive_purchase", id: p.id })}
                  className="demo-text-link"
                >
                  Receive goods →
                </button>
              ) : (
                <span className="text-xs text-slate-400">
                  Stock & journal posted
                </span>
              ),
          },
        ]}
      />
      <div className="demo-two-column mt-6">
        <DemoSection title="Supply partners" eyebrow="Supplier intelligence">
          <div className="divide-y divide-slate-100">
            {data.suppliers.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {s.origin} · {s.leadDays}-day lead time
                  </p>
                </div>
                <span className="text-sm tabular-nums">{money(s.payable)}</span>
              </div>
            ))}
          </div>
        </DemoSection>
        <DemoSection
          title="A clean receiving boundary"
          eyebrow="How this sample works"
        >
          <ol className="space-y-4">
            {[
              "Purchase order creates a commitment.",
              "Goods receipt adds warehouse quantities.",
              "The same receipt posts inventory and the supplier payable.",
              "Receiving the same order twice is rejected.",
            ].map((t, i) => (
              <li key={t} className="flex gap-3 text-sm text-slate-500">
                <span className="demo-step-number">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </DemoSection>
      </div>
    </>
  );
}

function Imports({ data, template, open, run }: Props) {
  return (
    <>
      <Stats>
        <DemoMetric
          label="Inbound shipments"
          value={String(
            data.shipments.filter((s) => s.status !== "received").length,
          )}
          hint="Draft, transit and customs stages"
          accent
        />
        <DemoMetric
          label="Capitalized cost"
          value={money(
            data.shipments.reduce((n, s) => n + landedCost(s).capitalized, 0),
          )}
          hint="Goods, freight, duty, insurance, clearing"
        />
        <DemoMetric
          label="Recoverable VAT"
          value={money(
            data.shipments.reduce((n, s) => n + s.recoverableVat, 0),
          )}
          hint="Separate from the inventory cost basis"
        />
        <DemoMetric
          label="Received shipments"
          value={String(
            data.shipments.filter((s) => s.status === "received").length,
          )}
          hint="Posted once to stock and the ledger"
        />
      </Stats>
      <div className="demo-toolbar">
        <div>
          <p className="text-sm font-semibold">Shipment workspace</p>
          <p className="mt-1 text-xs text-slate-400">
            Foreign currency in. A traceable cost per product out.
          </p>
        </div>
        <Action onClick={() => open({ type: "shipment" })}>
          <PlusIcon className={iconClass} />
          New shipment
        </Action>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {data.shipments.map((s) => {
          const c = landedCost(s);
          return (
            <DemoSection
              key={s.id}
              title={s.reference}
              eyebrow={`${s.origin} → Sri Lanka`}
              action={
                <DemoPill tone={s.status === "received" ? "good" : "warn"}>
                  {s.status.replaceAll("_", " ")}
                </DemoPill>
              }
            >
              <p className="text-sm text-slate-500">
                {s.supplier} · ETA {demoDate(s.eta)}
              </p>
              <div className="demo-stage-track">
                {["draft", "in_transit", "customs", "received"].map((stage) => (
                  <div
                    key={stage}
                    className={
                      ["draft", "in_transit", "customs", "received"].indexOf(
                        stage,
                      ) <=
                      ["draft", "in_transit", "customs", "received"].indexOf(
                        s.status,
                      )
                        ? "demo-stage-complete"
                        : ""
                    }
                  >
                    <span />
                    {stage.replaceAll("_", " ")}
                  </div>
                ))}
              </div>
              <dl className="demo-cost-breakdown">
                <div>
                  <dt>Supplier goods</dt>
                  <dd>
                    {s.currency} {s.foreignGoods.toLocaleString()} ×{" "}
                    {s.exchangeRate}
                  </dd>
                </div>
                <div>
                  <dt>LKR goods</dt>
                  <dd>{money(c.goods)}</dd>
                </div>
                <div>
                  <dt>Freight + duty</dt>
                  <dd>{money(s.freight + s.duty)}</dd>
                </div>
                <div>
                  <dt>Insurance + clearing</dt>
                  <dd>{money(s.insurance + s.clearing)}</dd>
                </div>
                <div className="demo-cost-total">
                  <dt>Landed inventory cost</dt>
                  <dd>{money(c.capitalized)}</dd>
                </div>
                <div>
                  <dt>Recoverable import VAT</dt>
                  <dd>{money(s.recoverableVat)}</dd>
                </div>
              </dl>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="demo-overline mb-3">Allocation by {s.basis}</p>
                {s.lines.map((l, i) => (
                  <div
                    key={l.productId}
                    className="mb-2 flex justify-between gap-3 text-xs"
                  >
                    <span className="text-slate-500">
                      {data.products.find((p) => p.id === l.productId)?.name} ×{" "}
                      {l.quantity}
                    </span>
                    <span className="font-medium">
                      {money(c.allocations[i])}
                    </span>
                  </div>
                ))}
              </div>
              {s.status !== "received" && (
                <button
                  type="button"
                  className="demo-primary mt-5 w-full"
                  onClick={() => run({ type: "advance_shipment", id: s.id })}
                >
                  {s.status === "draft"
                    ? "Mark as in transit"
                    : s.status === "in_transit"
                      ? "Move to customs"
                      : "Receive & post landed cost"}
                  <ArrowMark />
                </button>
              )}
            </DemoSection>
          );
        })}
      </div>
      <DemoSection
        title="One cost story across industries"
        eyebrow="Import-to-sale architecture"
        className="mt-6"
      >
        <p className="text-sm leading-7 text-slate-500">
          {template.id === "car_sales"
            ? "Vehicle acquisition combines landed cost and a dedicated reconditioning boundary."
            : template.id === "textile"
              ? "Fabric imports retain dye-lot and roll identities through measured sales."
              : "The shared import engine allocates shipment costs to product lines before receipt."}{" "}
          Sample rates are editable assumptions. Duty and recoverable VAT are
          entered amounts, not an automated customs or tax ruling.
        </p>
      </DemoSection>
    </>
  );
}

function Warehouses({ data, template, role, open }: Props) {
  return (
    <>
      <div className="demo-toolbar">
        <p className="text-sm text-slate-500">
          One stock ledger, partitioned across three sample locations.
        </p>
        {role !== "cashier" && (
          <Action onClick={() => open({ type: "transfer" })}>
            <PlusIcon className={iconClass} />
            Transfer stock
          </Action>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {data.warehouses.map((w) => (
          <DemoSection
            key={w.id}
            title={w.name}
            eyebrow={w.city}
            action={<DemoPill>Operating</DemoPill>}
          >
            <div className="demo-location-map" aria-hidden>
              <div className="demo-map-ring" />
              <div className="demo-map-ring demo-map-ring-small" />
              <span className="demo-map-pin">
                <StockIcon className="h-5 w-5" />
              </span>
              <span className="demo-map-label">{w.city}</span>
            </div>
            <p className="mt-5 text-xs text-slate-400">{w.manager}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {
                data.products.filter((p) => (p.quantities[w.id] ?? 0) > 0)
                  .length
              }{" "}
              <span className="text-sm font-normal text-slate-400">
                product lines
              </span>
            </p>
            {role === "owner" && (
              <p className="mt-2 text-sm text-slate-500">
                Cost value{" "}
                {money(
                  data.products.reduce(
                    (s, p) => s + (p.quantities[w.id] ?? 0) * p.cost,
                    0,
                  ),
                )}
              </p>
            )}
            <div className="mt-5 divide-y divide-slate-100">
              {data.products.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between gap-2 py-2.5 text-xs"
                >
                  <span className="truncate text-slate-500">{p.name}</span>
                  <span className="font-semibold tabular-nums">
                    {p.quantities[w.id] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </DemoSection>
        ))}
      </div>
      <DemoSection
        title="Transfer trail"
        eyebrow="Location movement"
        className="mt-6"
      >
        <div className="divide-y divide-slate-100">
          {data.movements
            .filter((m) => m.type === "transfer")
            .slice(0, 8)
            .map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap justify-between gap-3 py-4"
              >
                <span className="text-sm font-medium">
                  {data.products.find((p) => p.id === m.productId)?.name}
                </span>
                <span className="text-xs text-slate-500">
                  {data.warehouses.find((w) => w.id === m.from)?.name} →{" "}
                  {data.warehouses.find((w) => w.id === m.to)?.name} ·{" "}
                  {m.quantity}
                </span>
              </div>
            ))}
          {!data.movements.some((m) => m.type === "transfer") && (
            <DemoEmpty
              title="Ready for your first transfer"
              description="Move sample stock between locations. Total business stock stays the same."
            />
          )}
        </div>
        <Link
          href={`${template.demoPath}/inventory`}
          className="demo-text-link mt-5 inline-block"
        >
          View the inventory register →
        </Link>
      </DemoSection>
    </>
  );
}

function Damage({ data, role, open }: Props) {
  const losses = data.movements.filter((m) => m.type === "write_off");
  return (
    <>
      <Stats>
        <DemoMetric
          label="Write-offs"
          value={String(losses.length)}
          hint="Every adjustment requires a reason"
          accent
        />
        <DemoMetric
          label="Affected products"
          value={String(new Set(losses.map((m) => m.productId)).size)}
          hint="Each unit belongs to one location"
        />
        <DemoMetric
          label="Inspection holds"
          value={String(data.products.filter((p) => p.blocked).length)}
          hint="Kept outside the sellable lane"
        />
        <DemoMetric
          label="Access"
          value={role === "owner" ? "Owner" : "Manager"}
          hint="Cashier write-off actions are denied"
        />
      </Stats>
      <div className="demo-toolbar">
        <div>
          <p className="text-sm font-semibold">Damage & loss register</p>
          <p className="mt-1 text-xs text-slate-400">
            Controlled inventory reduction with historical cost and a journal.
          </p>
        </div>
        <Action onClick={() => open({ type: "write_off" })}>
          Record a write-off
          <ArrowMark />
        </Action>
      </div>
      <DataTable
        rows={losses}
        emptyState={
          <DemoEmpty
            title="No losses recorded"
            description="Record a sample write-off to see stock, audit and finance update together."
          />
        }
        columns={[
          { key: "date", header: "Date", render: (m) => demoDate(m.date) },
          {
            key: "product",
            header: "Product",
            render: (m) =>
              data.products.find((p) => p.id === m.productId)?.name,
          },
          {
            key: "quantity",
            header: "Quantity",
            align: "right",
            render: (m) => m.quantity,
          },
          { key: "reason", header: "Reason", render: (m) => m.reason },
          {
            key: "ref",
            header: "Audit reference",
            render: (m) => (
              <span className="font-mono text-xs">
                {m.reference.slice(-14)}
              </span>
            ),
          },
        ]}
      />
    </>
  );
}
function Returns({ data, open }: Props) {
  return (
    <>
      <Stats>
        <DemoMetric
          label="Credit notes"
          value={String(data.sales.filter((s) => s.returned).length)}
          hint="Issued full sample returns"
          accent
        />
        <DemoMetric
          label="Return value"
          value={money(
            data.sales
              .filter((s) => s.returned)
              .reduce((n, s) => n + s.total, 0),
          )}
          hint="Sales and output VAT are reversed"
        />
        <DemoMetric
          label="Inspection returns"
          value={String(
            data.movements.filter(
              (m) => m.type === "return" && m.to === "quarantine",
            ).length,
          )}
          hint="Physical units do not become sellable"
        />
        <DemoMetric
          label="Original invoices"
          value={String(data.sales.length)}
          hint="Historical prices and COGS retained"
        />
      </Stats>
      <DemoSection
        title="Original sales & return control"
        eyebrow="Credit-note boundary"
      >
        <div className="space-y-3">
          {data.sales.slice(0, 10).map((s) => (
            <div key={s.id} className="demo-attention-row">
              <span className="demo-icon-chip">
                <SalesIcon className={iconClass} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.id.slice(-16)}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {demoDate(s.date)} ·{" "}
                  {data.customers.find((c) => c.id === s.customerId)?.name ??
                    "Walk-in customer"}{" "}
                  · {money(s.total)}
                </p>
              </div>
              {s.returned ? (
                <DemoPill tone="quiet">Credit issued</DemoPill>
              ) : (
                <button
                  type="button"
                  onClick={() => open({ type: "return", id: s.id })}
                  className="demo-text-link"
                >
                  Create return →
                </button>
              )}
            </div>
          ))}
        </div>
      </DemoSection>
    </>
  );
}

function Finance({ data, open }: Props) {
  const [view, setView] = useState("journal"),
    t = totals(data),
    trial = demoTrialBalance(data),
    vatIn = trial.find((a) => a.account === "Input VAT")?.debit ?? 0;
  return (
    <>
      <Stats>
        <DemoMetric
          label="Customer receivables"
          value={money(t.receivables)}
          hint="Opening balances and credit sales"
          accent
        />
        <DemoMetric
          label="Supplier payables"
          value={money(t.payables)}
          hint="Purchasing and import receipts"
        />
        <DemoMetric
          label="Output VAT"
          value={money(t.tax)}
          hint={`${data.settings.vatRate}% editable sample rate`}
        />
        <DemoMetric
          label="Import input VAT"
          value={money(vatIn)}
          hint="Recoverable amounts posted on receipt"
        />
      </Stats>
      <div className="demo-toolbar">
        <div className="demo-tabs">
          {[
            ["journal", "Journal ledger"],
            ["trial", "Trial balance"],
            ["vat", "VAT summary"],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={view === id}
              className={view === id ? "demo-tab-active" : ""}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <Action onClick={() => open({ type: "journal" })}>
          <PlusIcon className={iconClass} />
          Manual journal
        </Action>
      </div>
      {view === "journal" ? (
        <div className="space-y-4">
          {data.journals.slice(0, 12).map((j) => (
            <DemoSection
              key={j.id}
              title={j.memo}
              eyebrow={`${demoDate(j.date)} · ${j.reference.slice(-18)}`}
              action={<DemoPill>Balanced</DemoPill>}
            >
              <div className="space-y-2">
                {j.lines.map((l, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_auto_auto] gap-5 rounded-lg bg-slate-50 px-3 py-2.5 text-xs"
                  >
                    <span className="text-slate-500">{l.account}</span>
                    <span className="w-28 text-right tabular-nums">
                      {l.debit ? money(l.debit) : "—"}
                    </span>
                    <span className="w-28 text-right tabular-nums">
                      {l.credit ? money(l.credit) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </DemoSection>
          ))}
        </div>
      ) : view === "trial" ? (
        <DemoSection title="Trial balance" eyebrow="From posted journals">
          <DataTable
            rows={trial.map((r) => ({ ...r, id: r.account }))}
            columns={[
              { key: "account", header: "Account", render: (r) => r.account },
              {
                key: "debit",
                header: "Debit",
                align: "right",
                render: (r) => money(r.debit),
              },
              {
                key: "credit",
                header: "Credit",
                align: "right",
                render: (r) => money(r.credit),
              },
            ]}
          />
          <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm font-semibold">
            <span>Debit {money(trial.reduce((s, r) => s + r.debit, 0))}</span>
            <span>Credit {money(trial.reduce((s, r) => s + r.credit, 0))}</span>
            <DemoPill>Balanced</DemoPill>
          </div>
        </DemoSection>
      ) : (
        <div className="demo-two-column">
          <DemoSection
            title="A clear tax boundary"
            eyebrow="Sample VAT summary"
          >
            <dl className="demo-cost-breakdown">
              <div>
                <dt>Tax-inclusive net sales</dt>
                <dd>{money(t.revenue)}</dd>
              </div>
              <div>
                <dt>Output VAT</dt>
                <dd>{money(t.tax)}</dd>
              </div>
              <div>
                <dt>Recoverable import VAT</dt>
                <dd>{money(vatIn)}</dd>
              </div>
              <div className="demo-cost-total">
                <dt>Indicative net VAT</dt>
                <dd>{money(t.tax - vatIn)}</dd>
              </div>
            </dl>
            <p className="mt-5 text-xs leading-6 text-slate-400">
              Demonstration calculation only. Eligible input VAT, invoice rules
              and filing treatment require production tax configuration. General
              sample purchase orders do not invent a tax claim.
            </p>
          </DemoSection>
          <DemoSection
            title="Connected financial boundaries"
            eyebrow="Posting architecture"
          >
            <ul className="space-y-4 text-sm text-slate-500">
              {[
                "Sales: payment or receivable, revenue, output VAT, historical COGS.",
                "Receipts: inventory and supplier payable.",
                "Imports: landed cost to inventory; recoverable VAT separately.",
                "Returns: credit note, payment reversal and stock disposition.",
                "Write-offs: stock loss with a required reason.",
              ].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </DemoSection>
        </div>
      )}
    </>
  );
}

function Customers({ data, workspace, role, search, open, template }: Props) {
  const loyalty = workspace === "loyalty",
    rows = data.customers.filter((c) =>
      `${c.name} ${c.city}`.toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <>
      <Stats>
        <DemoMetric
          label="Relationships"
          value={String(data.customers.length)}
          hint="Retail customers and trade partners"
          accent
        />
        <DemoMetric
          label="Trade accounts"
          value={String(data.customers.filter((c) => c.company).length)}
          hint="B2B balances and credit limits"
        />
        <DemoMetric
          label={loyalty ? "Points outstanding" : "Gold members"}
          value={
            loyalty
              ? data.customers
                  .reduce((s, c) => s + c.points, 0)
                  .toLocaleString()
              : String(data.customers.filter((c) => c.tier === "Gold").length)
          }
          hint="Earn and redeem through sample checkout"
        />
        <DemoMetric
          label={role === "owner" ? "Receivables" : "Customer cities"}
          value={
            role === "owner"
              ? money(totals(data).receivables)
              : String(new Set(data.customers.map((c) => c.city)).size)
          }
          hint={
            role === "owner"
              ? "Credit limits enforced before sale"
              : "A wider customer community"
          }
        />
      </Stats>
      <div className="demo-toolbar">
        <div>
          <p className="text-sm font-semibold">
            {loyalty ? "Member balances & rewards" : "Customer directory"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {loyalty
              ? `Earn 1 point per ${money(data.settings.loyaltySpend)} spent. Each redeemed point is ${money(data.settings.pointValue)}.`
              : "A shared customer record across sales, credit and loyalty."}
          </p>
        </div>
        {!loyalty && (
          <Action onClick={() => open({ type: "customer" })}>
            <PlusIcon className={iconClass} />
            Add customer
          </Action>
        )}
        {loyalty && (
          <Link href={`${template.demoPath}/pos`} className="demo-primary">
            Try reward checkout
            <ArrowMark />
          </Link>
        )}
      </div>
      <DataTable
        rows={rows}
        emptyState={
          <DemoEmpty
            title="No matching customers"
            description="Search by name or city."
          />
        }
        columns={[
          {
            key: "name",
            header: "Customer",
            render: (c) => (
              <div className="flex items-center gap-3">
                <span className="demo-avatar">{initials(c.name)}</span>
                <span>
                  <span className="block font-semibold">{c.name}</span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {c.city} · {c.company ? "Trade partner" : "Individual"}
                  </span>
                </span>
              </div>
            ),
          },
          {
            key: "tier",
            header: "Membership",
            render: (c) => (
              <DemoPill
                tone={
                  c.tier === "Gold"
                    ? "warn"
                    : c.tier === "Silver"
                      ? "quiet"
                      : "good"
                }
              >
                {c.tier}
              </DemoPill>
            ),
          },
          {
            key: "points",
            header: "Reward points",
            align: "right",
            render: (c) => (
              <span className="font-semibold tabular-nums">
                {c.points.toLocaleString()}
              </span>
            ),
          },
          ...(role === "owner"
            ? [
                {
                  key: "credit",
                  header: "Outstanding",
                  align: "right" as const,
                  render: (c: DemoState["customers"][number]) =>
                    money(c.credit),
                },
                {
                  key: "limit",
                  header: "Credit limit",
                  align: "right" as const,
                  render: (c: DemoState["customers"][number]) =>
                    money(c.creditLimit),
                },
              ]
            : []),
        ]}
      />
      {loyalty && (
        <DemoSection
          title="Rewards with a ledger"
          eyebrow="Customer retention"
          className="mt-6"
        >
          <p className="text-sm leading-7 text-slate-500">
            Checkout earns points on the amount actually paid after reward
            discounts. Redemption checks the customer’s balance. A full credit
            note reverses earned points and restores redeemed points, keeping
            the sample reward ledger connected to the original sale.
          </p>
          <Link
            href={`${template.demoPath}/settings`}
            className="demo-text-link mt-5 inline-block"
          >
            Adjust the sample rewards policy →
          </Link>
        </DemoSection>
      )}
    </>
  );
}

function Staff({ data, search, open }: Props) {
  return (
    <>
      <Stats>
        <DemoMetric
          label="People"
          value={String(data.staff.length)}
          hint="A small team, clear responsibilities"
          accent
        />
        <DemoMetric
          label="Active"
          value={String(data.staff.filter((s) => s.status === "Active").length)}
          hint="Across the sample operating locations"
        />
        <DemoMetric
          label="Invited"
          value={String(
            data.staff.filter((s) => s.status === "Invited").length,
          )}
          hint="Demonstration invitations only"
        />
        <DemoMetric
          label="Role boundaries"
          value="3"
          hint="Owner, manager, cashier"
        />
      </Stats>
      <div className="demo-toolbar">
        <p className="text-sm text-slate-500">
          Operational access and owner financial privacy.
        </p>
        <Action onClick={() => open({ type: "staff" })}>
          <PlusIcon className={iconClass} />
          Add sample teammate
        </Action>
      </div>
      <DataTable
        rows={data.staff.filter((s) =>
          `${s.name} ${s.job}`.toLowerCase().includes(search.toLowerCase()),
        )}
        emptyState={
          <DemoEmpty
            title="No matching people"
            description="Try another name or job title."
          />
        }
        columns={[
          {
            key: "person",
            header: "Person",
            render: (s) => (
              <div className="flex items-center gap-3">
                <span className="demo-avatar">{initials(s.name)}</span>
                <span>
                  <span className="block font-semibold">{s.name}</span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {s.job}
                  </span>
                </span>
              </div>
            ),
          },
          {
            key: "role",
            header: "Role",
            render: (s) => <span className="capitalize">{s.role}</span>,
          },
          { key: "location", header: "Location", render: (s) => s.location },
          {
            key: "status",
            header: "Status",
            render: (s) => (
              <DemoPill tone={s.status === "Active" ? "good" : "warn"}>
                {s.status}
              </DemoPill>
            ),
          },
        ]}
      />
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {[
          {
            title: "Owner",
            text: "Financials, purchasing, imports, reports, subscriptions and business configuration.",
          },
          {
            title: "Manager",
            text: "Sales, inventory, customers, transfers, write-offs and customer returns.",
          },
          {
            title: "Cashier",
            text: "Checkout, stock availability and the customer directory. Internal finance stays private.",
          },
        ].map((r) => (
          <DemoSection key={r.title} title={r.title} eyebrow="Preview access">
            <ShieldIcon className="mb-4 h-6 w-6 text-teal-600" />
            <p className="text-sm leading-7 text-slate-500">{r.text}</p>
          </DemoSection>
        ))}
      </div>
    </>
  );
}
function Reports({ data, template }: Props) {
  const [days, setDays] = useState(14);
  const now = new Date(data.sales[0]?.date ?? data.journals[0].date).getTime(),
    sales = data.sales.filter(
      (s) =>
        !s.returned &&
        new Date(s.date).getTime() >= now - (days - 1) * 86400000,
    ),
    net = sales.reduce((n, s) => n + s.total, 0),
    tax = sales.reduce((n, s) => n + s.tax, 0),
    cost = sales.reduce((n, s) => n + s.cost, 0),
    profit = net - tax - cost,
    rank = data.products
      .map((p) => {
        const lines = sales
          .flatMap((s) => s.lines)
          .filter((l) => l.productId === p.id);
        return {
          id: p.id,
          name: p.name,
          quantity: lines.reduce((n, l) => n + l.quantity, 0),
          revenue: lines.reduce(
            (n, l) => n + Math.round(l.quantity * l.unitAmount),
            0,
          ),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  function exportCsv() {
    const csv =
        "Product,Quantity,Gross line revenue (LKR)\n" +
        rank
          .map(
            (r) =>
              `"${r.name.replaceAll('"', '""')}",${r.quantity},${(r.revenue / 100).toFixed(2)}`,
          )
          .join("\n"),
      url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `lakbiz-demo-${template.id}-product-sales.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="demo-toolbar">
        <label className="demo-field">
          Sample period
          <select
            className="demo-input"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </label>
        <Action onClick={exportCsv} secondary>
          Export product sales CSV
          <ArrowMark />
        </Action>
      </div>
      <Stats>
        <DemoMetric
          label="Net sales"
          value={money(net)}
          hint={`${sales.length} completed invoices`}
          accent
        />
        <DemoMetric
          label="Gross profit"
          value={money(profit)}
          hint="Revenue excluding VAT less COGS"
        />
        <DemoMetric
          label="Average invoice"
          value={money(sales.length ? Math.round(net / sales.length) : 0)}
          hint="Returned invoices excluded"
        />
        <DemoMetric
          label="Gross margin"
          value={`${net - tax ? ((profit / (net - tax)) * 100).toFixed(1) : "0.0"}%`}
          hint="Ex-VAT revenue basis"
        />
      </Stats>
      <DemoSection title="Sales performance" eyebrow="Daily sample revenue">
        <RevenueChart points={trend(data).slice(-Math.min(days, 14))} />
      </DemoSection>
      <div className="demo-two-column mt-6">
        <DemoSection
          title="Products driving the business"
          eyebrow="Gross line sales"
        >
          <div className="space-y-5">
            {rank.slice(0, 5).map((r, i) => (
              <div key={r.id}>
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-slate-500">
                    {String(i + 1).padStart(2, "0")} · {r.name}
                  </span>
                  <span className="font-semibold">{money(r.revenue)}</span>
                </div>
                <div className="demo-progress mt-2">
                  <span
                    style={{
                      width: `${rank[0].revenue ? (r.revenue / rank[0].revenue) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </DemoSection>
        <DemoSection title="Your industry lens" eyebrow={template.nameEn}>
          <ul className="space-y-3 text-sm text-slate-500">
            {template.reports.map((r) => (
              <li key={r} className="rounded-xl border border-slate-100 p-3">
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-6 text-slate-400">
            Industry report definitions are part of the template contract. This
            demo displays the connected sales, stock and credit data; specialist
            reporting requires the corresponding production ledger.
          </p>
        </DemoSection>
      </div>
    </>
  );
}

function Pulse({ data, template }: Props) {
  const t = totals(data);
  return (
    <div className="demo-phone">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[.18em] text-slate-500">
            OWNER PULSE
          </p>
          <p className="mt-2 text-sm font-semibold text-white">
            {data.settings.name}
          </p>
        </div>
        <span className="demo-avatar">DO</span>
      </header>
      <div className="demo-phone-hero">
        <p className="text-xs text-slate-400">The big picture</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-.04em] text-white">
          {money(t.revenue)}
        </h2>
        <p className="mt-3 text-xs text-teal-300">Net sales · sample period</p>
        <div className="mt-7">
          <RevenueChart points={trend(data)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Gross profit", money(t.profit)],
          ["Receivables", money(t.receivables)],
          ["Supplier balances", money(t.payables)],
          [
            "Inbound shipments",
            String(
              data.shipments.filter((s) => s.status !== "received").length,
            ),
          ],
        ].map(([l, v]) => (
          <div key={l} className="demo-phone-stat">
            <p className="text-[10px] text-slate-500">{l}</p>
            <p className="mt-2 text-lg font-semibold tracking-tight text-white">
              {v}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-7">
        <p className="text-xs font-semibold text-slate-300">
          A decision worth your attention
        </p>
        <Link
          href={`${template.demoPath}/inventory`}
          className="mt-3 flex items-center justify-between rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4"
        >
          <span className="text-xs leading-6 text-slate-400">
            {data.products.filter((p) => p.blocked).length} sample product under
            inspection.
            <br />
            Keep held stock out of the sales floor.
          </span>
          <ArrowMark />
        </Link>
      </div>
      <nav aria-label="Owner shortcuts" className="demo-phone-nav">
        <Link href={`${template.demoPath}/overview`}>Overview</Link>
        <Link href={`${template.demoPath}/reports`}>Insights</Link>
        <Link href={`${template.demoPath}/finance`}>Finance</Link>
      </nav>
    </div>
  );
}
function Settings({ data, template, open }: Props) {
  return (
    <div className="demo-two-column">
      <DemoSection
        title="Business profile"
        eyebrow="Workspace identity"
        action={
          <button
            type="button"
            className="demo-text-link"
            onClick={() => open({ type: "settings" })}
          >
            Edit configuration →
          </button>
        }
      >
        <div className="flex gap-4">
          <div className="demo-industry-icon">
            <SectorIcon sectorId={template.id} className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold">{data.settings.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{template.nameEn}</p>
          </div>
        </div>
        <dl className="demo-cost-breakdown mt-7">
          <div>
            <dt>Currency</dt>
            <dd>LKR</dd>
          </div>
          <div>
            <dt>Business timezone</dt>
            <dd>Asia/Colombo</dd>
          </div>
          <div>
            <dt>VAT mode</dt>
            <dd>
              {data.settings.vatRegistered
                ? `Registered · sample ${data.settings.vatRate}%`
                : "Not registered"}
            </dd>
          </div>
          <div>
            <dt>Template version</dt>
            <dd>{template.version}</dd>
          </div>
          <div>
            <dt>Loyalty earning rule</dt>
            <dd>1 point / {money(data.settings.loyaltySpend)}</dd>
          </div>
          <div>
            <dt>Point redemption value</dt>
            <dd>{money(data.settings.pointValue)}</dd>
          </div>
        </dl>
      </DemoSection>
      <DemoSection title="Your subscription" eyebrow="Plan & entitlements">
        <div className="demo-plan-card">
          <p className="demo-overline text-teal-300">ACTIVE SAMPLE PLAN</p>
          <h3 className="mt-3 text-3xl font-semibold text-white">
            {data.settings.plan}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Core commerce, inventory and owner intelligence for your industry.
          </p>
          <div className="mt-6 border-t border-white/10 pt-5 text-xs text-slate-400">
            Demonstration only · no billing or payment action
          </div>
        </div>
        <div className="mt-5 space-y-3 text-sm text-slate-500">
          {[
            "Sales & customer accounts",
            "Purchasing & import management",
            "Inventory, transfers & returns",
            "Owner finance & reports",
          ].map((f) => (
            <p className="flex items-center gap-2" key={f}>
              <span className="h-1 w-1 rounded-full bg-teal-500" />
              {f}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={() => open({ type: "settings" })}
          className="demo-secondary mt-6 w-full"
        >
          Change sample plan
        </button>
      </DemoSection>
      <DemoSection
        title="Preferences that belong to your business"
        eyebrow="Production architecture"
      >
        <p className="text-sm leading-7 text-slate-500">
          Tax policy, invoice numbering, notification rules, receipt branding,
          locations and role permissions are versioned organization settings.
          Industry configuration chooses sensible defaults while preserving
          existing product identities and historical documents.
        </p>
      </DemoSection>
      <DemoSection title="Demo lifecycle" eyebrow="Client presentation">
        <p className="text-sm leading-7 text-slate-500">
          Each industry has its own public sample login and browser-local
          dataset. Reset only restores this industry’s mock transactions.
          Leaving the workspace clears the sample session and leaves your
          presentation data ready for the next visit.
        </p>
        <button
          type="button"
          onClick={() => open({ type: "reset" })}
          className="demo-text-link mt-5"
        >
          Reset this industry demo →
        </button>
      </DemoSection>
    </div>
  );
}
function Templates({ template, open }: Props) {
  return (
    <>
      <Stats>
        <DemoMetric
          label="Template library"
          value={String(INDUSTRY_TEMPLATES.length)}
          hint="Shared core; industry-aware configuration"
          accent
        />
        <DemoMetric
          label="Current release"
          value={template.version}
          hint={template.nameEn}
        />
        <DemoMetric
          label="Configured fields"
          value={String(template.extraFields.length)}
          hint="Product vocabulary from the runtime template"
        />
        <DemoMetric
          label="Workspaces"
          value={String(WORKSPACES.length)}
          hint="One consistent presentation system"
        />
      </Stats>
      <div className="demo-two-column">
        <DemoSection
          title="The industry contract"
          eyebrow="Versioned configuration"
          action={
            <button
              type="button"
              className="demo-text-link"
              onClick={() => open({ type: "template" })}
            >
              Inspect contract →
            </button>
          }
        >
          <dl className="demo-cost-breakdown">
            <div>
              <dt>Template</dt>
              <dd>{template.id}</dd>
            </div>
            <div>
              <dt>Tracking default</dt>
              <dd>{template.inventory.defaultMode.replaceAll("_", " + ")}</dd>
            </div>
            <div>
              <dt>FEFO</dt>
              <dd>
                {template.inventory.fefo
                  ? "Enabled for dated lots"
                  : "Not applicable by default"}
              </dd>
            </div>
            <div>
              <dt>Variant axes</dt>
              <dd>
                {template.inventory.variantAxes.join(", ") ||
                  "Dedicated identity ledger"}
              </dd>
            </div>
            <div>
              <dt>Role policy</dt>
              <dd>Owner financial privacy</dd>
            </div>
            <div>
              <dt>Tax behavior</dt>
              <dd>Organization policy; editable sample rate</dd>
            </div>
          </dl>
        </DemoSection>
        <DemoSection
          title="Rollout with intention"
          eyebrow="Compatibility & migration design"
        >
          <ol className="space-y-4">
            {[
              "Stage an immutable template version.",
              "Validate modules, fields, identity mode and permission boundaries.",
              "Test each owner, manager and cashier workflow in an isolated tenant.",
              "Apply additive schema changes and deploy a compatible app.",
              "Roll out to selected tenants, audit results and retain rollback metadata.",
            ].map((x, i) => (
              <li
                className="flex gap-3 text-sm leading-6 text-slate-500"
                key={x}
              >
                <span className="demo-step-number">{i + 1}</span>
                {x}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => open({ type: "compatibility" })}
            className="demo-secondary mt-6 w-full"
          >
            Run template compatibility check
          </button>
        </DemoSection>
      </div>
      <DemoSection
        title="Industry template library"
        eyebrow="Runtime registry"
        className="mt-6"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {INDUSTRY_TEMPLATES.map((t) => (
            <Link
              key={t.id}
              href={`${t.demoPath}/templates`}
              className="demo-attention-row"
            >
              <SectorIcon sectorId={t.id} className="h-5 w-5 text-slate-400" />
              <span className="flex-1 text-xs font-semibold">{t.nameEn}</span>
              <span className="font-mono text-[10px] text-slate-400">
                v{t.version}
              </span>
            </Link>
          ))}
        </div>
      </DemoSection>
    </>
  );
}
function Admin({ data, template, open }: Props) {
  return (
    <>
      <section className="demo-overview-hero">
        <div>
          <p className="demo-overline text-teal-400">SAAS CONTROL PLANE</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">
            A platform with perspective.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-slate-400">
            Industry provisioning, subscription entitlements and operational
            visibility in a single administrative experience.
          </p>
        </div>
        <div className="demo-hero-summary">
          <p className="demo-overline text-slate-500">
            Sample tenant portfolio
          </p>
          <p className="mt-4 text-5xl font-semibold text-white">
            {INDUSTRY_TEMPLATES.length}
          </p>
          <p className="mt-3 text-xs text-slate-400">
            One fictional tenant per industry
          </p>
        </div>
      </section>
      <Stats>
        <DemoMetric
          label="Sample tenants"
          value={String(INDUSTRY_TEMPLATES.length)}
          hint="Public demonstration workspaces"
          accent
        />
        <DemoMetric
          label="Template releases"
          value={String(INDUSTRY_TEMPLATES.length)}
          hint="All on the current sample release"
        />
        <DemoMetric
          label="Current tenant plan"
          value={data.settings.plan}
          hint={data.settings.name}
        />
        <DemoMetric
          label="Audit events"
          value={String(data.audit.length)}
          hint="This browser’s industry workspace"
        />
      </Stats>
      <DemoSection title="Industry portfolio" eyebrow="Tenant provisioning">
        <DataTable
          rows={INDUSTRY_TEMPLATES}
          columns={[
            {
              key: "tenant",
              header: "Sample tenant",
              render: (t) => <span className="font-semibold">{t.company}</span>,
            },
            { key: "industry", header: "Industry", render: (t) => t.nameEn },
            {
              key: "version",
              header: "Version",
              render: (t) => (
                <span className="font-mono text-xs">{t.version}</span>
              ),
            },
            {
              key: "health",
              header: "Environment",
              render: () => <DemoPill>Mock data only</DemoPill>,
            },
            {
              key: "open",
              header: "Workspace",
              render: (t) => (
                <Link href={t.demoPath} className="demo-text-link">
                  Open demo →
                </Link>
              ),
            },
          ]}
        />
      </DemoSection>
      <div className="demo-two-column mt-6">
        <DemoSection title="Audit trail" eyebrow="Current sample tenant">
          <div className="divide-y divide-slate-100">
            {data.audit.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="flex justify-between gap-3 py-3 text-xs"
              >
                <span className="capitalize text-slate-500">
                  {a.actor} · {a.action}
                </span>
                <span className="text-slate-400">{demoDate(a.date)}</span>
              </div>
            ))}
          </div>
        </DemoSection>
        <DemoSection title="Safe administration" eyebrow="Tenant boundary">
          <p className="text-sm leading-7 text-slate-500">
            This is a synthetic SaaS Admin design preview. Live tenant
            provisioning and platform-administrator authorization remain in the
            existing protected Admin application. Sample controls create no
            users, charges or external invitations.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`${template.demoPath}/templates`}
              className="demo-secondary"
            >
              Template Studio
            </Link>
            <button
              type="button"
              onClick={() => open({ type: "settings" })}
              className="demo-primary"
            >
              Edit sample tenant
            </button>
          </div>
        </DemoSection>
      </div>
    </>
  );
}

function DemoPos({ data, template, run, open }: Props) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [cart, setCart] = useState<Record<string, number>>({}),
    [warehouse, setWarehouse] = useState("main"),
    [customer, setCustomer] = useState(""),
    [payment, setPayment] = useState<"cash" | "card" | "credit">("cash"),
    [redeem, setRedeem] = useState(0),
    [qty, setQty] = useState(1),
    [receipt, setReceipt] = useState<string | null>(null);
  const categories = ["All", ...new Set(data.products.map((p) => p.category))],
    products = data.products.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        `${p.name} ${p.sku} ${p.identity}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
    lines = Object.entries(cart).map(([id, quantity]) => ({
      product: data.products.find((p) => p.id === id)!,
      quantity,
    })),
    gross = lines.reduce(
      (s, l) => s + Math.round(l.product.price * l.quantity),
      0,
    ),
    discount = redeem * data.settings.pointValue,
    total = gross - discount,
    member = data.customers.find((c) => c.id === customer);
  function checkout() {
    if (
      run({
        type: "sale",
        lines: lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
        })),
        customerId: customer || undefined,
        payment,
        warehouseId: warehouse,
        redeemPoints: redeem,
      })
    ) {
      setCart({});
      setRedeem(0);
      setReceipt("latest");
    }
  }
  return (
    <div className="demo-pos-layout">
      <div>
        <div className="demo-pos-search">
          <label className="demo-field flex-1">
            <span className="sr-only">
              Find product, SKU or sample identity
            </span>
            <input
              type="search"
              className="demo-input"
              value={query}
              placeholder="Find a product, SKU or identity…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="demo-field">
            Add quantity
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="demo-input w-24"
            />
          </label>
        </div>
        <div className="demo-product-categories">
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              aria-pressed={category === c}
              className={category === c ? "demo-category-active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="demo-product-grid">
          {products.map((p, i) => {
            const available = p.quantities[warehouse] ?? 0;
            return (
              <button
                type="button"
                className="demo-pos-product"
                key={p.id}
                disabled={p.blocked || !available}
                onClick={() =>
                  setCart({ ...cart, [p.id]: (cart[p.id] ?? 0) + qty })
                }
              >
                <div
                  className={`demo-product-visual demo-product-visual-${i % 4}`}
                >
                  <SectorIcon sectorId={template.id} className="h-12 w-12" />
                  <span>{p.category}</span>
                  <span className="demo-product-plus">+</span>
                </div>
                <div className="p-4">
                  <p className="min-h-10 text-sm font-semibold leading-5">
                    {p.name}
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-slate-400">
                    {p.sku}
                  </p>
                  <div className="mt-4 flex flex-wrap items-end justify-between gap-1">
                    <span className="text-base font-semibold tracking-tight">
                      {money(p.price)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {p.blocked ? "Inspection hold" : `${available} ${p.unit}`}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {!products.length && (
          <DemoEmpty
            title="No matching products"
            description="Try another name, SKU or category."
          />
        )}
      </div>
      <aside className="demo-basket">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div>
            <p className="demo-overline">Current sale</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">
              A thoughtful checkout.
            </h2>
          </div>
          <span className="demo-pill demo-pill-quiet">
            {lines.length} lines
          </span>
        </div>
        <label className="demo-field mt-5">
          Selling location
          <select
            className="demo-input"
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            {data.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="demo-field mt-4">
          Customer
          <select
            className="demo-input"
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setRedeem(0);
            }}
          >
            <option value="">Walk-in customer</option>
            {data.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="demo-basket-lines">
          {lines.length ? (
            lines.map((l) => (
              <div className="demo-basket-line" key={l.product.id}>
                <div>
                  <p className="text-xs font-semibold leading-5">
                    {l.product.name}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {money(l.product.price)} / {l.product.unit}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <label>
                      <span className="sr-only">
                        Quantity for {l.product.name}
                      </span>
                      <input
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={l.quantity}
                        onChange={(e) =>
                          setCart({
                            ...cart,
                            [l.product.id]: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="text-[10px] text-slate-400"
                      onClick={() =>
                        setCart(
                          Object.fromEntries(
                            Object.entries(cart).filter(
                              ([id]) => id !== l.product.id,
                            ),
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="text-xs font-semibold tabular-nums">
                  {money(Math.round(l.product.price * l.quantity))}
                </p>
              </div>
            ))
          ) : (
            <div className="py-10 text-center">
              <SalesIcon className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-3 text-xs text-slate-400">
                Select a product to start the sale.
              </p>
            </div>
          )}
        </div>
        {member && (
          <label className="demo-field mt-4">
            Redeem points{" "}
            <span className="text-xs font-normal text-slate-400">
              ({member.points} available)
            </span>
            <input
              className="demo-input"
              type="number"
              min="0"
              max={Math.max(0, member.points)}
              step="1"
              value={redeem}
              onChange={(e) => setRedeem(Number(e.target.value))}
            />
          </label>
        )}
        <dl className="demo-cost-breakdown mt-4">
          <div>
            <dt>Products</dt>
            <dd>{money(gross)}</dd>
          </div>
          <div>
            <dt>Reward discount</dt>
            <dd>− {money(discount)}</dd>
          </div>
          <div>
            <dt>Included sample VAT</dt>
            <dd>
              {money(
                data.settings.vatRegistered
                  ? Math.round(
                      (Math.max(0, total) * data.settings.vatRate) /
                        (100 + data.settings.vatRate),
                    )
                  : 0,
              )}
            </dd>
          </div>
          <div className="demo-cost-total">
            <dt>Total</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>
        <div className="demo-payment-options mt-4">
          {(["cash", "card", "credit"] as const).map((p) => (
            <button
              type="button"
              key={p}
              aria-pressed={payment === p}
              className={payment === p ? "demo-payment-active" : ""}
              onClick={() => setPayment(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="demo-primary mt-5 w-full"
          disabled={!lines.length}
          onClick={checkout}
        >
          Complete sample sale
          <ArrowMark />
        </button>
        <p className="mt-3 text-center text-[10px] leading-5 text-slate-400">
          No real payment. Stock, credit, rewards and journals update together.
        </p>
        {receipt && (
          <button
            type="button"
            className="demo-secondary mt-4 w-full"
            onClick={() => open({ type: "receipt", id: data.sales[0].id })}
          >
            View latest sample receipt
          </button>
        )}
      </aside>
    </div>
  );
}
