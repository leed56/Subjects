import { describe, it, expect } from "vitest";
import { getFiscalYearBounds, getIncomeTaxYearSummary } from "./income-tax";
import type { JobLinkedExpense } from "./job-profitability";
import type { AppData, Sale, ACJob, JobItem } from "./store/types";
import type { VehicleRecord } from "./store/types";

/**
 * Phase 22 — income-tax.ts is the fix-all pass's own most recent bug: AC
 * job revenue/cost was completely absent from the tax estimate until that
 * fix, and a real double-counting risk (expenses/page.tsx's otherExpenses
 * including job-linked expenses acJobProfit already nets out) was found
 * and fixed in the same pass. These tests lock down the formula this
 * function now uses, plus the fiscal-year date filtering every branch of
 * it depends on.
 *
 * Deliberately builds AppData literals inline rather than importing
 * storage.ts's emptyAppData()/invoice.ts's defaultBusiness(): those pull
 * in a chain of client-side modules (offline sync, ac-service, vat) not
 * meant for a plain Node test environment. AppData/BusinessInfo are typed
 * imports only here — zero runtime dependency on the rest of the app.
 */

function makeAppData(overrides: Partial<AppData> = {}): AppData {
  return {
    business: { name: "Test Shop", quarterStartMonth: 4, companyIncomeTaxRate: 30 },
    products: [],
    sales: [],
    stockLogs: [],
    customers: [],
    customerPayments: [],
    customerProductPrices: [],
    suppliers: [],
    purchases: [],
    purchaseOrders: [],
    supplierPayments: [],
    acJobs: [],
    jobItems: [],
    jobStatusHistory: [],
    technicians: [],
    contractors: [],
    contractorPayments: [],
    vehicles: [],
    bankAccounts: [],
    bankTransactions: [],
    bankTransfers: [],
    cheques: [],
    ...overrides,
  };
}

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "sale-1",
    date: "2026-06-01",
    lines: [],
    total: 10000,
    profit: 3000,
    paymentMethod: "cash",
    creditAmount: 0,
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<VehicleRecord> = {}): VehicleRecord {
  return {
    id: "veh-1",
    stockId: "V-001",
    dateAdded: "2026-01-01",
    make: "Toyota",
    model: "Test",
    year: 2020,
    chassisNo: "CHASSIS1",
    fuel: "petrol",
    transmission: "auto",
    mileageKm: 10000,
    condition: "good",
    purchasePrice: 1000000,
    reconditionCost: 100000,
    askPrice: 1300000,
    status: "sold",
    ...overrides,
  };
}

function makeJob(overrides: Partial<ACJob> = {}): ACJob {
  return {
    id: "job-1",
    jobNo: "J-0001",
    date: "2026-06-01",
    jobType: "installation",
    customerName: "Test Customer",
    address: "123 Test Rd",
    unitCount: 1,
    description: "Test job",
    quotedAmount: 50000,
    depositAmount: 0,
    status: "completed",
    ...overrides,
  };
}

// A fiscal year starting in April (quarterStartMonth: 4) means the FY
// containing 2026-06-01 runs 2026-04-01..2027-03-31.
const IN_YEAR = new Date("2026-06-15T00:00:00Z");

describe("getFiscalYearBounds", () => {
  it("puts a date just before the fiscal start month into the PRIOR fiscal year", () => {
    const bounds = getFiscalYearBounds(new Date("2026-03-31T00:00:00Z"), 4);
    expect(bounds.start.getFullYear()).toBe(2025);
    expect(bounds.start.getMonth()).toBe(3); // April = index 3
  });

  it("puts a date on the fiscal start month into the NEW fiscal year", () => {
    const bounds = getFiscalYearBounds(new Date("2026-04-01T00:00:00Z"), 4);
    expect(bounds.start.getFullYear()).toBe(2026);
    expect(bounds.start.getMonth()).toBe(3);
  });
});

describe("getIncomeTaxYearSummary", () => {
  it("sums revenue/salesProfit only from sales inside the fiscal year", () => {
    const data = makeAppData({
      sales: [
        makeSale({ id: "in-1", date: "2026-06-01", total: 10000, profit: 3000 }),
        makeSale({ id: "in-2", date: "2026-12-01", total: 20000, profit: 5000 }),
        makeSale({ id: "out-1", date: "2026-02-01", total: 999999, profit: 999999 }), // prior FY
      ],
    });

    const summary = getIncomeTaxYearSummary(data, IN_YEAR);

    expect(summary.salesCount).toBe(2);
    expect(summary.revenue).toBe(30000);
    expect(summary.salesProfit).toBe(8000);
  });

  it("includes only SOLD vehicles with soldDate in the fiscal year in vehicleProfit", () => {
    const data = makeAppData({
      vehicles: [
        makeVehicle({
          id: "sold-in-year",
          status: "sold",
          soldDate: "2026-05-01",
          soldPrice: 1500000,
          purchasePrice: 1000000,
          reconditionCost: 100000,
        }),
        makeVehicle({
          id: "sold-out-of-year",
          status: "sold",
          soldDate: "2025-01-01",
          soldPrice: 9999999,
          purchasePrice: 1,
          reconditionCost: 1,
        }),
        makeVehicle({ id: "not-sold", status: "for_sale", soldDate: undefined }),
      ],
    });

    const summary = getIncomeTaxYearSummary(data, IN_YEAR);

    // 1500000 - (1000000 + 100000) = 400000
    expect(summary.vehicleProfit).toBe(400000);
  });

  it("folds AC job profit (revenue AND cost) for completed jobs into acJobProfit via computeJobProfitability", () => {
    const jobItems: JobItem[] = [
      {
        id: "item-1",
        jobId: "job-1",
        itemType: "part",
        name: "Compressor",
        qty: 1,
        unitPrice: 20000,
        lineTotal: 20000,
        invoiceable: true,
      },
    ];
    const data = makeAppData({
      acJobs: [
        makeJob({ id: "job-1", status: "completed", quotedAmount: 50000, installedDate: "2026-06-01" }),
        makeJob({ id: "job-2", status: "quote", quotedAmount: 999999, installedDate: "2026-06-01" }), // not completed - excluded
      ],
      jobItems,
    });

    const summary = getIncomeTaxYearSummary(data, IN_YEAR);

    // job-1: revenue 50000, materialCost 20000 -> grossProfit 30000.
    // job-2 excluded entirely (not completed).
    expect(summary.acJobProfit).toBe(30000);
  });

  it("nets job-linked expenses into acJobProfit via the jobLinkedExpenses map", () => {
    const data = makeAppData({
      acJobs: [makeJob({ id: "job-1", status: "completed", quotedAmount: 50000, installedDate: "2026-06-01" })],
    });
    const linked = new Map<string, JobLinkedExpense[]>([
      ["job-1", [{ category: "parking", amount: 5000 }]],
    ]);

    const summary = getIncomeTaxYearSummary(data, IN_YEAR, 0, linked);

    // revenue 50000 - 5000 linked expense = 45000
    expect(summary.acJobProfit).toBe(45000);
  });

  it("computes estimatedTaxableProfit as salesProfit + vehicleProfit + acJobProfit - otherExpenses, floored at 0", () => {
    const data = makeAppData({
      sales: [makeSale({ date: "2026-06-01", total: 10000, profit: 5000 })],
    });

    const summary = getIncomeTaxYearSummary(data, IN_YEAR, 100000); // otherExpenses swamps a small profit
    expect(summary.estimatedTaxableProfit).toBe(0);
    expect(summary.estimatedTax).toBe(0);
  });

  it("computes estimatedTax as round(estimatedTaxableProfit * ratePct / 100)", () => {
    const data = makeAppData({
      business: { name: "Test Shop", quarterStartMonth: 4, companyIncomeTaxRate: 30 },
      sales: [makeSale({ date: "2026-06-01", total: 100000, profit: 100000 })],
    });

    const summary = getIncomeTaxYearSummary(data, IN_YEAR);

    expect(summary.estimatedTaxableProfit).toBe(100000);
    expect(summary.ratePct).toBe(30);
    expect(summary.estimatedTax).toBe(30000);
  });

  it("defaults jobLinkedExpenses to an empty map so existing callers that don't pass it still get a correct acJobProfit", () => {
    const data = makeAppData({
      acJobs: [makeJob({ id: "job-1", status: "completed", quotedAmount: 20000, installedDate: "2026-06-01" })],
    });

    // No 4th argument at all.
    const summary = getIncomeTaxYearSummary(data, IN_YEAR);
    expect(summary.acJobProfit).toBe(20000);
  });
});
