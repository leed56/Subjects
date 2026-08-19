import { describe, it, expect } from "vitest";
import { buildReportsCsv, type ReportsExportData, type ReportsExportLabels } from "./reports";

/** Reports/page.tsx follow-up (Phase 24) — /reports never had CSV/print
 * export. buildReportsCsv is the one pure, DOM-free piece of that
 * (exportReportsCsv/printReportsSummary touch window/Blob, out of scope
 * for a Node test environment) — locks its section structure down,
 * including that the AC-jobs section is omitted entirely (not
 * zero-filled) when the caller never populated it. */

const labels: ReportsExportLabels = {
  period: "Period",
  totalRevenue: "Total revenue",
  totalProfit: "Total profit",
  salesCount: "Sales count",
  avgSale: "Average sale",
  topProducts: "Top products",
  productName: "Name",
  qty: "Qty",
  revenue: "Revenue",
  topCustomers: "Top customers",
  customerName: "Name",
  orders: "Orders",
  total: "Total",
  acJobsTitle: "AC job performance",
  totalQuoted: "Total quoted",
  totalCost: "Total cost",
  totalMargin: "Total margin",
  jobsNeedingAttention: "Jobs needing attention",
  jobCustomer: "Customer",
  jobNo: "Job No.",
  margin: "Margin",
  marginPct: "Margin %",
};

function baseData(overrides: Partial<ReportsExportData> = {}): ReportsExportData {
  return {
    periodLabel: "Last 30 days",
    totalRevenue: 100000,
    totalProfit: 25000,
    salesCount: 12,
    avgSale: 8333,
    topProducts: [{ name: "Compressor 1.5T", qty: 3, revenue: 60000 }],
    topCustomers: [{ name: "Jane Doe", orders: 2, total: 15000 }],
    ...overrides,
  };
}

describe("buildReportsCsv", () => {
  it("includes the period, metrics, and top-products/top-customers sections", () => {
    const csv = buildReportsCsv(baseData(), labels);
    expect(csv).toContain("Period,Last 30 days");
    expect(csv).toContain("Total revenue,100000");
    expect(csv).toContain("Top products");
    expect(csv).toContain("Compressor 1.5T,3,60000");
    expect(csv).toContain("Top customers");
    expect(csv).toContain("Jane Doe,2,15000");
  });

  it("omits the AC-jobs section entirely when acJobs is not provided (org/role never saw it on screen)", () => {
    const csv = buildReportsCsv(baseData(), labels);
    expect(csv).not.toContain("AC job performance");
    expect(csv).not.toContain("Jobs needing attention");
  });

  it("includes the AC-jobs section, with its low-margin jobs, when acJobs is provided", () => {
    const csv = buildReportsCsv(
      baseData({
        acJobs: {
          totalQuoted: 500000,
          totalCost: 460000,
          totalMargin: 40000,
          lowMarginJobs: [
            { customerName: "AC Job Customer", jobNo: "J-0042", grossProfit: 4000, grossMarginPct: 8 },
          ],
        },
      }),
      labels,
    );

    expect(csv).toContain("AC job performance");
    expect(csv).toContain("Total quoted,500000");
    expect(csv).toContain("Jobs needing attention");
    expect(csv).toContain("AC Job Customer,J-0042,4000,8.0%");
  });
});
