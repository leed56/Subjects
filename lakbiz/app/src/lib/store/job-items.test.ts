import { describe, it, expect } from "vitest";
import { addJobItem, deleteJobItem } from "./actions";
import { emptyAppData } from "./storage";
import type { AppData, ACJob } from "./types";
import type { Product } from "@/lib/types";

/**
 * job-parts-materials phase — addJobItem/deleteJobItem are the reducer
 * pair every stock-affecting Add-Part path (From Stock, External
 * Purchase → Add to Inventory) and every removal flows through (see
 * their own docstrings in actions.ts). Both are pure `(AppData) =>
 * AppData` functions, so they're testable directly against fixtures,
 * without a live Supabase/DB — the DB-level guarantees (cross-tenant
 * isolation, RLS) are a separate, server-side layer these tests don't
 * reach; see docs/JOB_PARTS_ARCHITECTURE.md §5 for how those are
 * verified instead.
 */

function makeJob(overrides: Partial<ACJob> = {}): ACJob {
  return {
    id: "job-1",
    jobNo: "J-0001",
    date: "2026-01-15",
    jobType: "installation",
    customerName: "Test Customer",
    address: "123 Test Rd",
    unitCount: 1,
    description: "Test job",
    quotedAmount: 100000,
    depositAmount: 0,
    status: "completed",
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    name: "1.5T Compressor",
    category: "compressor",
    sectorId: "ac_hvac",
    condition: "new",
    buyPrice: 12000,
    sellPrice: 18000,
    stockQty: 5,
    active: true,
    customFields: {},
    ...overrides,
  };
}

function baseData(overrides: Partial<AppData> = {}): AppData {
  return { ...emptyAppData(), acJobs: [makeJob()], ...overrides };
}

describe("addJobItem", () => {
  it("stock source: decrements product.stockQty and uses the product's own buyPrice, ignoring a mismatched input.unitPrice (historical-cost guarantee)", () => {
    const data = baseData({ products: [makeProduct({ stockQty: 5, buyPrice: 12000 })] });

    const next = addJobItem(data, {
      jobId: "job-1",
      itemType: "part",
      name: "Compressor",
      qty: 2,
      unitPrice: 999999, // client-supplied — must be ignored for a stock line
      source: "stock",
      productId: "prod-1",
    });

    expect(next.products[0].stockQty).toBe(3);
    expect(next.jobItems).toHaveLength(1);
    expect(next.jobItems[0].unitPrice).toBe(12000);
    expect(next.jobItems[0].lineTotal).toBe(24000);
    expect(next.jobItems[0].source).toBe("stock");
  });

  it("stock source: refuses to consume more than is available (no negative stock)", () => {
    const data = baseData({ products: [makeProduct({ stockQty: 1 })] });

    const next = addJobItem(data, {
      jobId: "job-1",
      itemType: "part",
      name: "Compressor",
      qty: 5,
      unitPrice: 0,
      source: "stock",
      productId: "prod-1",
    });

    expect(next).toBe(data); // unchanged — nothing added, nothing decremented
    expect(next.jobItems).toHaveLength(0);
  });

  it("manual source: never touches products/stockLogs, keeps the given internal cost and customer price, carries no productId", () => {
    const data = baseData({ products: [makeProduct()] });

    const next = addJobItem(data, {
      jobId: "job-1",
      itemType: "part",
      name: "Generic copper pipe (loose)",
      qty: 3,
      unitPrice: 500,
      customerPrice: 900,
      source: "manual",
    });

    expect(next.products).toBe(data.products); // untouched
    expect(next.stockLogs).toHaveLength(0);
    expect(next.jobItems[0].source).toBe("manual");
    expect(next.jobItems[0].productId).toBeUndefined();
    expect(next.jobItems[0].unitPrice).toBe(500);
    expect(next.jobItems[0].lineTotal).toBe(1500);
    expect(next.jobItems[0].customerPrice).toBe(900);
    expect(next.jobItems[0].invoiceable).toBe(true); // defaults true when omitted
  });

  it("external purchase, 'Expense only': purchased source never touches stock, still invoiceable", () => {
    const data = baseData();

    const next = addJobItem(data, {
      jobId: "job-1",
      itemType: "part",
      name: "PCB board",
      qty: 1,
      unitPrice: 8000,
      customerPrice: 12000,
      source: "purchased",
      supplierId: "sup-1",
      purchaseRef: "INV-2201",
    });

    expect(next.products).toBe(data.products);
    expect(next.stockLogs).toHaveLength(0);
    expect(next.jobItems[0].source).toBe("purchased");
    expect(next.jobItems[0].supplierId).toBe("sup-1");
    expect(next.jobItems[0].purchaseRef).toBe("INV-2201");
    expect(next.jobItems[0].purchasedForJob).toBeUndefined();
  });

  it("external purchase, 'Add to Inventory' (source stock + receiveQty): creates the product, receives surplus stock, decrements only the used qty, and flags purchasedForJob", () => {
    const data = baseData({ products: [] });

    const next = addJobItem(data, {
      jobId: "job-1",
      itemType: "part",
      name: "Fan motor",
      qty: 1, // used on this job
      unitPrice: 7000, // purchase unit cost — becomes the new product's buyPrice
      source: "stock",
      receiveQty: 4, // 3 surplus stay as real spare stock
      newProductName: "Fan motor 1/4HP",
      supplierId: "sup-2",
      purchaseRef: "INV-3301",
    });

    expect(next.products).toHaveLength(1);
    const product = next.products[0];
    expect(product.name).toBe("Fan motor 1/4HP");
    expect(product.buyPrice).toBe(7000);
    expect(product.stockQty).toBe(3); // 4 received - 1 used on this job

    expect(next.jobItems[0].source).toBe("stock");
    expect(next.jobItems[0].purchasedForJob).toBe(true);
    expect(next.jobItems[0].unitPrice).toBe(7000);

    // Two distinct stock movements, oldest-last (unshifted): the receipt
    // and the job-usage consumption — never one merged movement, so the
    // audit trail shows both real events.
    expect(next.stockLogs).toHaveLength(2);
    expect(next.stockLogs.map((l) => l.type).sort()).toEqual(["job_usage", "purchase"]);
    expect(next.stockLogs.every((l) => l.relatedJobId === "job-1")).toBe(true);
  });

  it("labour/service/transport/other item types never carry a source or productId even if stray-passed in", () => {
    const data = baseData();

    const next = addJobItem(data, {
      jobId: "job-1",
      itemType: "labour",
      name: "Technician labor",
      qty: 2,
      unitPrice: 1500,
      source: "stock", // stray — must be dropped, this isn't a part
      productId: "prod-1",
    });

    expect(next.jobItems[0].source).toBeUndefined();
    expect(next.jobItems[0].productId).toBeUndefined();
    expect(next.jobItems[0].lineTotal).toBe(3000);
  });

  it("replacement + warranty: computes warrantyExpiryDate from warrantyStartDate + warrantyDays", () => {
    const data = baseData();

    const next = addJobItem(data, {
      jobId: "job-1",
      itemType: "part",
      name: "Capacitor",
      qty: 1,
      unitPrice: 1200,
      source: "manual",
      isReplacement: true,
      oldComponentName: "Capacitor (old, burnt)",
      oldComponentDisposition: "disposed",
      warrantyType: "supplier",
      warrantyStartDate: "2026-01-15",
      warrantyDays: 90,
    });

    const item = next.jobItems[0];
    expect(item.isReplacement).toBe(true);
    expect(item.oldComponentName).toBe("Capacitor (old, burnt)");
    expect(item.warrantyExpiryDate).toBe("2026-04-15");
  });

  it("does not add a line to a job that doesn't exist", () => {
    const data = baseData();
    const next = addJobItem(data, { jobId: "no-such-job", itemType: "part", name: "X", qty: 1, unitPrice: 100 });
    expect(next).toBe(data);
  });
});

describe("deleteJobItem", () => {
  it("reverses a stock-sourced item: restores stockQty and logs a job_return movement", () => {
    const withProduct = baseData({ products: [makeProduct({ stockQty: 5 })] });
    const afterAdd = addJobItem(withProduct, {
      jobId: "job-1",
      itemType: "part",
      name: "Compressor",
      qty: 2,
      unitPrice: 0,
      source: "stock",
      productId: "prod-1",
    });
    expect(afterAdd.products[0].stockQty).toBe(3);

    const afterDelete = deleteJobItem(afterAdd, afterAdd.jobItems[0].id);

    expect(afterDelete.products[0].stockQty).toBe(5); // fully restored
    expect(afterDelete.jobItems).toHaveLength(0);
    const returnLog = afterDelete.stockLogs.find((l) => l.type === "job_return");
    expect(returnLog).toBeTruthy();
    expect(returnLog?.qty).toBe(2);
  });

  it("removing a manual/purchased item never touches stock", () => {
    const data = baseData();
    const afterAdd = addJobItem(data, {
      jobId: "job-1",
      itemType: "part",
      name: "Loose material",
      qty: 1,
      unitPrice: 500,
      source: "manual",
    });

    const afterDelete = deleteJobItem(afterAdd, afterAdd.jobItems[0].id);

    expect(afterDelete.products).toBe(afterAdd.products);
    expect(afterDelete.stockLogs).toBe(afterAdd.stockLogs);
    expect(afterDelete.jobItems).toHaveLength(0);
  });

  it("deleting an unknown id is a no-op", () => {
    const data = baseData();
    expect(deleteJobItem(data, "no-such-id")).toBe(data);
  });
});
