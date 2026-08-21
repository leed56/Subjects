import { describe, it, expect } from "vitest";
import { invoiceableLinesTotal, buildJobInvoiceText, type InvoiceLineItem } from "./job-invoice";
import type { ACJob } from "./store/types";
import { defaultBusiness } from "./invoice";
import { formatLkr } from "./format";

/**
 * job-parts-materials phase (Part 12/25) — invoiceableLinesTotal and the
 * itemized-vs-flat branch in buildJobInvoiceText are the one place
 * "which job_items lines may reach a customer-facing invoice" is
 * decided. Locking down: discount handling, non-invoiceable exclusion,
 * missing-price exclusion, and the itemized/flat fallback switch itself
 * — this is exactly the boundary the brief's own warning example
 * ("internal purchase cost 45,000 must NOT appear") depends on.
 */

function makeJob(overrides: Partial<ACJob> = {}): ACJob {
  return {
    id: "job-1",
    jobNo: "J-0001",
    date: "2026-01-15",
    jobType: "repair",
    customerName: "Test Customer",
    address: "123 Test Rd",
    unitCount: 1,
    description: "Compressor replacement",
    quotedAmount: 50000,
    depositAmount: 0,
    status: "completed",
    ...overrides,
  };
}

function makeLine(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return { id: "l1", name: "Compressor", qty: 1, invoiceable: true, customerPrice: 45000, ...overrides };
}

describe("invoiceableLinesTotal", () => {
  it("sums qty * customerPrice across invoiceable, priced lines", () => {
    const items = [makeLine({ id: "l1", qty: 1, customerPrice: 45000 }), makeLine({ id: "l2", qty: 2, customerPrice: 1500, name: "Refrigerant top-up" })];
    expect(invoiceableLinesTotal(items)).toBe(48000);
  });

  it("subtracts a flat discount from a line's total, clamped to zero (never negative)", () => {
    const items = [makeLine({ qty: 1, customerPrice: 1000, discount: 1500 })];
    expect(invoiceableLinesTotal(items)).toBe(0);
  });

  it("excludes a line marked invoiceable: false — the internal-only-cost guarantee", () => {
    const items = [
      makeLine({ id: "l1", qty: 1, customerPrice: 45000, invoiceable: true }),
      makeLine({ id: "l2", qty: 1, customerPrice: 45000, invoiceable: false, name: "Internal purchase cost" }),
    ];
    expect(invoiceableLinesTotal(items)).toBe(45000);
  });

  it("excludes a line with no customerPrice set at all", () => {
    const items = [makeLine({ id: "l1", qty: 1, customerPrice: undefined })];
    expect(invoiceableLinesTotal(items)).toBe(0);
  });

  it("returns 0 for an empty line list", () => {
    expect(invoiceableLinesTotal([])).toBe(0);
  });
});

describe("buildJobInvoiceText — itemized vs flat fallback", () => {
  const business = defaultBusiness();

  it("itemizes when invoiceable, priced lines exist — one line per item, totalled from those lines, not job.quotedAmount", () => {
    const job = makeJob({ quotedAmount: 999999 }); // deliberately different from the itemized total
    const items = [
      makeLine({ id: "l1", name: "Compressor", qty: 1, customerPrice: 45000 }),
      makeLine({ id: "l2", name: "Labor", qty: 1, customerPrice: 5000 }),
    ];

    const text = buildJobInvoiceText(job, business, "en", undefined, items);

    expect(text).toContain("Compressor × 1");
    expect(text).toContain("Labor × 1");
    expect(text).not.toContain(job.description); // flat fallback line must not also appear
    expect(text).toContain(`Total: ${formatLkr(50000)}`);
  });

  it("never lets an invoiceable: false line's amount appear on the printed text", () => {
    const job = makeJob({ quotedAmount: 45000 });
    const items = [
      makeLine({ id: "l1", name: "Compressor", qty: 1, customerPrice: 45000, invoiceable: true }),
      makeLine({ id: "l2", name: "Internal purchase cost", qty: 1, customerPrice: 45000, invoiceable: false }),
    ];

    const text = buildJobInvoiceText(job, business, "en", undefined, items);

    expect(text).not.toContain("Internal purchase cost");
  });

  it("falls back to the flat job-type + description line at job.quotedAmount when no items are passed", () => {
    const job = makeJob({ quotedAmount: 45000, jobType: "repair", description: "Compressor replacement" });

    const text = buildJobInvoiceText(job, business, "en");

    expect(text).toContain("Compressor replacement");
    expect(text).toContain(`Total: ${formatLkr(45000)}`);
  });

  it("also falls back to flat when every passed item is non-invoiceable or unpriced (e.g. masked customerPrice for a non-financial role)", () => {
    const job = makeJob({ quotedAmount: 45000, description: "Compressor replacement" });
    const items = [makeLine({ customerPrice: undefined })]; // masked to null, as the DB view does for technician/data_entry

    const text = buildJobInvoiceText(job, business, "en", undefined, items);

    expect(text).toContain("Compressor replacement");
    expect(text).toContain(`Total: ${formatLkr(45000)}`);
  });
});
