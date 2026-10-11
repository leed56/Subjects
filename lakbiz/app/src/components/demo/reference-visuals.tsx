import Link from "next/link";
import type { SectorId } from "@/lib/types";
import type { IndustryTemplate } from "@/lib/erp/industry-templates";
import type { DemoProduct, DemoState } from "@/lib/erp/demo-types";
import { money, totalStock, landedCost } from "@/lib/erp/demo-engine";
import { DemoSection, DemoPill, demoDate } from "./demo-ui";
import type { DemoAction } from "./demo-action-drawer";

const CELLS: Record<SectorId, number> = {
  grocery: 0,
  pharmacy: 1,
  cosmetics: 2,
  electronics: 3,
  mobile_shop: 4,
  electricals: 5,
  spare_parts: 6,
  footwear: 7,
  textile: 8,
  ac_hvac: 9,
  car_sales: 10,
  hardware: 11,
  stationery: 12,
  wholesale: 13,
};

const COSMETICS_PHOTOS: Record<string, number> = {
  "COS-0001": 0, "COS-0002": 1, "COS-0003": 2, "COS-0004": 3,
  "COS-0005": 4, "COS-0006": 5, "COS-0007": 6, "COS-0008": 7,
};

/** One local photographic atlas avoids external image hosts and keeps all demos reliable. */
export function ProductPhoto({
  industry,
  product,
  className = "",
}: {
  industry: SectorId;
  product?: DemoProduct;
  className?: string;
}) {
  const cosmeticsCell = industry === "cosmetics" && product
    ? COSMETICS_PHOTOS[product.sku]
    : undefined;
  const cell = cosmeticsCell ?? CELLS[industry];
  return (
    <span
      role="img"
      aria-label={
        product
          ? `${product.name} — illustrative industry photo`
          : `${industry.replaceAll("_", " ")} products`
      }
      className={`reference-product-photo ${className}`}
      style={{
        ...(cosmeticsCell !== undefined ? {
          backgroundImage: 'url("/images/cosmetics-products-atlas-v2.webp")',
          backgroundSize: "400% 200%",
          backgroundPosition: `${((cell % 4) * 100) / 3}% ${Math.floor(cell / 4) * 100}%`,
        } : {
          backgroundPosition: `${((cell % 4) * 100) / 3}% ${(Math.floor(cell / 4) * 100) / 3}%`,
        }),
      }}
    />
  );
}

export function ReferenceBanner({
  template,
  title,
  description,
  imports = false,
}: {
  template: IndustryTemplate;
  title: string;
  description: string;
  imports?: boolean;
}) {
  return (
    <section className="reference-banner">
      <div className="reference-banner-copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="reference-banner-images" aria-hidden="true">
        {imports ? (
          <>
            <span
              className="reference-product-photo"
              style={{ backgroundPosition: "66.6667% 100%" }}
            />
            <span
              className="reference-product-photo"
              style={{ backgroundPosition: "100% 100%" }}
            />
          </>
        ) : (
          <>
            <ProductPhoto industry={template.id} />
            <ProductPhoto industry="cosmetics" />
            <ProductPhoto industry="textile" />
          </>
        )}
      </div>
      <div className="reference-banner-end">
        <span>{imports ? "FROM PORT TO STORE" : template.nameEn}</span>
        <strong>
          {imports
            ? "Complete import-to-stock visibility."
            : "One powerful ERP"}
        </strong>
        <p>
          {imports
            ? "Shipments, landed costs and stock in one place."
            : "Products. People. Profits. All in one place."}
        </p>
      </div>
    </section>
  );
}

export function BranchPerformance({
  data,
  owner = true,
}: {
  data: DemoState;
  owner?: boolean;
}) {
  return (
    <div className="reference-table-scroll">
      <table className="reference-table">
        <thead>
          <tr>
            <th>Branch / location</th>
            <th>Sales</th>
            {owner && <th>Gross profit</th>}
            <th>Transactions</th>
            <th>{owner ? "Stock value" : "Stock quantity"}</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.warehouses.map((w, i) => {
            const sales = data.sales.filter(
              (s) => !s.returned && s.warehouseId === w.id,
            );
            return (
              <tr key={w.id}>
                <td>
                  <span className="reference-rank">{i + 1}</span>
                  <strong>{w.name}</strong>
                </td>
                <td>{money(sales.reduce((n, s) => n + s.total, 0))}</td>
                {owner && (
                  <td>
                    {money(
                      sales.reduce((n, s) => n + s.total - s.tax - s.cost, 0),
                    )}
                  </td>
                )}
                <td>{sales.length}</td>
                <td>
                  {owner
                    ? money(
                        data.products.reduce(
                          (n, p) => n + (p.quantities[w.id] ?? 0) * p.cost,
                          0,
                        ),
                      )
                    : data.products.reduce(
                        (n, p) => n + (p.quantities[w.id] ?? 0),
                        0,
                      )}
                </td>
                <td>
                  <DemoPill>Active</DemoPill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProductAlerts({
  data,
  template,
  mode = "expiry",
  open,
}: {
  data: DemoState;
  template: IndustryTemplate;
  mode?: "expiry" | "low" | "held";
  open: (a: DemoAction) => void;
}) {
  const day = new Date(data.sales[0]?.date ?? data.journals[0].date).getTime();
  const rows = data.products.filter((p) =>
    mode === "expiry"
      ? Boolean(
          p.expiry &&
          new Date(p.expiry).getTime() >= day - 86400000 &&
          new Date(p.expiry).getTime() <= day + 30 * 86400000,
        )
      : mode === "held"
        ? p.blocked
        : totalStock(p) <= p.reorder,
  );
  return (
    <div className="reference-alert-list">
      {rows.slice(0, 5).map((p) => (
        <button
          type="button"
          key={p.id}
          onClick={() => open({ type: "product", id: p.id })}
        >
          <ProductPhoto industry={template.id} product={p} />
          <span>
            <strong>{p.name}</strong>
            <small>{p.identity}</small>
          </span>
          <DemoPill tone={mode === "held" ? "bad" : "warn"}>
            {mode === "expiry"
              ? `${Math.ceil((new Date(p.expiry!).getTime() - day) / 86400000)} days`
              : mode === "held"
                ? "Inspection"
                : `${totalStock(p)} left`}
          </DemoPill>
        </button>
      ))}
      {!rows.length && (
        <p className="py-5 text-xs text-slate-500">
          No{" "}
          {mode === "expiry"
            ? "dated stock"
            : mode === "held"
              ? "held products"
              : "products below their reorder threshold"}{" "}
          in this sample.
        </p>
      )}
    </div>
  );
}

export function ImportSummary({
  data,
  template,
  owner,
  open,
}: {
  data: DemoState;
  template: IndustryTemplate;
  owner: boolean;
  open: (a: DemoAction) => void;
}) {
  const s = data.shipments[0],
    c = s ? landedCost(s) : null;
  return (
    <div className="reference-import-grid">
      <DemoSection
        title="Recent Shipments & GRNs"
        action={
          owner ? (
            <button
              type="button"
              className="demo-primary"
              onClick={() => open({ type: "shipment" })}
            >
              + New import
            </button>
          ) : undefined
        }
      >
        <div className="reference-table-scroll">
          <table className="reference-table">
            <thead>
              <tr>
                <th>Shipment / container</th>
                <th>Supplier</th>
                <th>Items</th>
                <th>Status</th>
                <th>ETA</th>
                {owner && <th>Landed value</th>}
              </tr>
            </thead>
            <tbody>
              {data.shipments.map((sh) => (
                <tr key={sh.id}>
                  <td>
                    <strong>{sh.reference}</strong>
                    <small>{sh.origin}</small>
                  </td>
                  <td>{sh.supplier}</td>
                  <td>{sh.lines.length}</td>
                  <td>
                    <DemoPill tone={sh.status === "received" ? "good" : "warn"}>
                      {sh.status.replaceAll("_", " ")}
                    </DemoPill>
                  </td>
                  <td>{demoDate(sh.eta)}</td>
                  {owner && <td>{money(landedCost(sh).capitalized)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {owner && (
          <Link
            className="demo-text-link mt-4 inline-block"
            href={`${template.demoPath}/imports`}
          >
            Manage shipments →
          </Link>
        )}
      </DemoSection>
      {owner && s && c && (
        <DemoSection
          title="Landed Cost Breakdown"
          action={<span className="text-xs text-slate-500">{s.reference}</span>}
        >
          <div className="reference-cost-product">
            <ProductPhoto industry={template.id} />
            <div>
              <strong>
                {
                  data.products.find((p) => p.id === s.lines[0]?.productId)
                    ?.name
                }
              </strong>
              <small>
                {s.supplier} · {s.currency} at {s.exchangeRate}
              </small>
            </div>
          </div>
          <table className="reference-table">
            <thead>
              <tr>
                <th>Cost component</th>
                <th>Amount (LKR)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Product cost", c.goods],
                ["Freight & shipping", s.freight],
                ["Insurance", s.insurance],
                ["Import duty", s.duty],
                ["Customs clearing", s.clearing],
              ].map(([l, v]) => (
                <tr key={l}>
                  <td>{l}</td>
                  <td>{money(Number(v))}</td>
                </tr>
              ))}
              <tr className="reference-total-row">
                <td>Total landed cost</td>
                <td>{money(c.capitalized)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-slate-500">
            Recoverable sample import VAT: {money(s.recoverableVat)}
          </p>
        </DemoSection>
      )}
    </div>
  );
}

export function WarehouseStock({
  data,
  owner,
}: {
  data: DemoState;
  owner: boolean;
}) {
  return (
    <div className="reference-table-scroll">
      <table className="reference-table">
        <thead>
          <tr>
            <th>Location</th>
            <th>Product lines</th>
            <th>Quantity</th>
            {owner && <th>Stock value</th>}
          </tr>
        </thead>
        <tbody>
          {data.warehouses.map((w) => (
            <tr key={w.id}>
              <td>
                <strong>{w.name}</strong>
                <small>{w.city}</small>
              </td>
              <td>
                {
                  data.products.filter((p) => (p.quantities[w.id] ?? 0) > 0)
                    .length
                }
              </td>
              <td>
                {data.products
                  .reduce((n, p) => n + (p.quantities[w.id] ?? 0), 0)
                  .toLocaleString("en-LK", { maximumFractionDigits: 3 })}
              </td>
              {owner && (
                <td>
                  {money(
                    data.products.reduce(
                      (n, p) => n + (p.quantities[w.id] ?? 0) * p.cost,
                      0,
                    ),
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
