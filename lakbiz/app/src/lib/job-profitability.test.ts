import { describe, it, expect } from "vitest";
import {
  computeJobProfitability,
  isLowMarginJob,
  LOW_MARGIN_THRESHOLD_PCT,
  type JobLinkedExpense,
} from "./job-profitability";
import type { ACJob, JobItem } from "./store/types";

/**
 * Phase 22 — first automated tests for this project. computeJobProfitability
 * is the one authoritative job-cost/profit calculation (see its own
 * docstring) and has already had two real bugs found and fixed against it
 * this project (the outsourced_repair/subcontractCost double-count, Phase
 * 20; the disclosed job_items INSERT masking gap that could have zeroed
 * real costs). Locking its documented behavior down with tests first,
 * since a regression here would silently corrupt real job-costing numbers
 * exactly the way those two bugs did.
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

function makeItem(overrides: Partial<JobItem> = {}): JobItem {
  return {
    id: "item-1",
    jobId: "job-1",
    itemType: "part",
    name: "Test part",
    qty: 1,
    unitPrice: 0,
    lineTotal: 0,
    invoiceable: true,
    ...overrides,
  };
}

describe("computeJobProfitability", () => {
  it("sums material/labor/other from job_items into totalCost, and revenue - totalCost into grossProfit", () => {
    const job = makeJob({ quotedAmount: 100000 });
    const items: JobItem[] = [
      makeItem({ id: "p1", itemType: "part", lineTotal: 20000 }),
      makeItem({ id: "p2", itemType: "part", lineTotal: 5000 }),
      makeItem({ id: "l1", itemType: "labour", lineTotal: 10000 }),
      makeItem({ id: "s1", itemType: "service", lineTotal: 3000 }),
    ];

    const profit = computeJobProfitability(job, items, []);

    expect(profit.materialCost).toBe(25000);
    expect(profit.laborCost).toBe(10000);
    expect(profit.otherCost).toBe(3000);
    expect(profit.totalCost).toBe(38000);
    expect(profit.revenue).toBe(100000);
    expect(profit.grossProfit).toBe(62000);
    expect(profit.grossMarginPct).toBeCloseTo(62, 5);
  });

  it("returns null grossMarginPct when revenue is 0, never a misleading 0% or Infinity%", () => {
    const job = makeJob({ quotedAmount: 0 });
    const profit = computeJobProfitability(job, [], []);
    expect(profit.revenue).toBe(0);
    expect(profit.grossMarginPct).toBeNull();
  });

  it("adds job.subcontractCost to laborCost for a contractor-assigned job", () => {
    const job = makeJob({
      quotedAmount: 100000,
      assigneeType: "contractor",
      subcontractCost: 40000,
    });
    const items: JobItem[] = [makeItem({ itemType: "part", lineTotal: 10000 })];

    const profit = computeJobProfitability(job, items, []);

    expect(profit.laborCost).toBe(40000);
    expect(profit.materialCost).toBe(10000);
    expect(profit.totalCost).toBe(50000);
  });

  it("does NOT add subcontractCost to laborCost for a team-assigned (non-contractor) job", () => {
    const job = makeJob({
      quotedAmount: 100000,
      assigneeType: "team",
      subcontractCost: 40000, // shouldn't happen in real data, but the function must not trust it blindly
    });
    const profit = computeJobProfitability(job, [], []);
    expect(profit.laborCost).toBe(0);
  });

  it("sums job-linked expenses into otherCost alongside service-type job_items", () => {
    const job = makeJob({ quotedAmount: 100000 });
    const items: JobItem[] = [makeItem({ itemType: "service", lineTotal: 2000 })];
    const expenses: JobLinkedExpense[] = [
      { category: "parking", amount: 500 },
      { category: "equipment_rental", amount: 1500 },
    ];

    const profit = computeJobProfitability(job, items, expenses);

    expect(profit.otherCost).toBe(4000); // 2000 (service item) + 500 + 1500
  });

  describe("outsourced_repair / subcontractCost double-count guard (Phase 20 fix)", () => {
    it("excludes an outsourced_repair linked expense when the job already has a contractor subcontractCost", () => {
      const job = makeJob({
        quotedAmount: 100000,
        assigneeType: "contractor",
        subcontractCost: 30000,
      });
      const expenses: JobLinkedExpense[] = [
        { category: "outsourced_repair", amount: 30000 }, // same payment, logged twice by mistake
        { category: "parking", amount: 500 }, // a genuinely distinct cost, must still count
      ];

      const profit = computeJobProfitability(job, [], expenses);

      // laborCost gets the subcontractCost once; otherCost must NOT also
      // include the outsourced_repair expense - that would double-count
      // the same real payment.
      expect(profit.laborCost).toBe(30000);
      expect(profit.otherCost).toBe(500);
      expect(profit.totalCost).toBe(30500);
    });

    it("still counts an outsourced_repair expense normally on a job with no contractor subcontractCost", () => {
      const job = makeJob({ quotedAmount: 100000, assigneeType: "team" });
      const expenses: JobLinkedExpense[] = [{ category: "outsourced_repair", amount: 15000 }];

      const profit = computeJobProfitability(job, [], expenses);

      expect(profit.otherCost).toBe(15000);
    });

    it("still counts an outsourced_repair expense normally when the job has assigneeType contractor but subcontractCost is 0/unset", () => {
      const job = makeJob({
        quotedAmount: 100000,
        assigneeType: "contractor",
        subcontractCost: 0,
      });
      const expenses: JobLinkedExpense[] = [{ category: "outsourced_repair", amount: 15000 }];

      const profit = computeJobProfitability(job, [], expenses);

      expect(profit.otherCost).toBe(15000);
    });
  });

  describe("parts_purchase double-count guard (job-parts-materials phase)", () => {
    it("always excludes a parts_purchase linked expense — it mirrors an already-counted job_items line, never a second cost", () => {
      const job = makeJob({ quotedAmount: 100000 });
      const items: JobItem[] = [
        makeItem({ itemType: "part", source: "purchased", lineTotal: 8000 }), // the real cost, counted once here
      ];
      const expenses: JobLinkedExpense[] = [
        { category: "parts_purchase", amount: 8000 }, // the mirrored Expense record — must not add a second 8000
        { category: "parking", amount: 500 }, // a genuinely distinct cost, must still count
      ];

      const profit = computeJobProfitability(job, items, expenses);

      expect(profit.materialCost).toBe(8000);
      expect(profit.otherCost).toBe(500); // not 8500
      expect(profit.totalCost).toBe(8500);
    });

    it("excludes parts_purchase unconditionally, even on a job with no contractor subcontractCost (unlike the outsourced_repair guard, which is conditional)", () => {
      const job = makeJob({ quotedAmount: 100000, assigneeType: "team" });
      const expenses: JobLinkedExpense[] = [{ category: "parts_purchase", amount: 5000 }];

      const profit = computeJobProfitability(job, [], expenses);

      expect(profit.otherCost).toBe(0);
    });
  });

  it("multiple part lines from different sources (stock, manual, purchased) all sum into materialCost the same way — the bucket is keyed by itemType, not source", () => {
    const job = makeJob({ quotedAmount: 100000 });
    const items: JobItem[] = [
      makeItem({ id: "p1", itemType: "part", source: "stock", lineTotal: 12000 }),
      makeItem({ id: "p2", itemType: "part", source: "manual", lineTotal: 500 }),
      makeItem({ id: "p3", itemType: "part", source: "purchased", lineTotal: 8000 }),
    ];

    const profit = computeJobProfitability(job, items, []);

    expect(profit.materialCost).toBe(20500);
  });

  it("transport and other item types bucket into otherCost alongside service", () => {
    const job = makeJob({ quotedAmount: 100000 });
    const items: JobItem[] = [
      makeItem({ itemType: "transport", lineTotal: 1500 }),
      makeItem({ itemType: "other", lineTotal: 750 }),
    ];

    const profit = computeJobProfitability(job, items, []);

    expect(profit.otherCost).toBe(2250);
    expect(profit.materialCost).toBe(0);
    expect(profit.laborCost).toBe(0);
  });

  it("produces a negative grossProfit (and negative margin %) when cost exceeds revenue, without clamping to zero", () => {
    const job = makeJob({ quotedAmount: 10000 });
    const items: JobItem[] = [makeItem({ itemType: "part", lineTotal: 15000 })];

    const profit = computeJobProfitability(job, items, []);

    expect(profit.grossProfit).toBe(-5000);
    expect(profit.grossMarginPct).toBeCloseTo(-50, 5);
  });
});

describe("isLowMarginJob", () => {
  it("flags a job strictly below the threshold", () => {
    const job = makeJob({ quotedAmount: 100000 });
    const items: JobItem[] = [makeItem({ itemType: "part", lineTotal: 90000 })]; // 10% margin
    const profit = computeJobProfitability(job, items, []);
    expect(profit.grossMarginPct).toBeLessThan(LOW_MARGIN_THRESHOLD_PCT);
    expect(isLowMarginJob(profit)).toBe(true);
  });

  it("does not flag a job exactly at or above the threshold", () => {
    const job = makeJob({ quotedAmount: 100000 });
    const items: JobItem[] = [makeItem({ itemType: "part", lineTotal: 85000 })]; // exactly 15%
    const profit = computeJobProfitability(job, items, []);
    expect(profit.grossMarginPct).toBeCloseTo(LOW_MARGIN_THRESHOLD_PCT, 5);
    expect(isLowMarginJob(profit)).toBe(false);
  });

  it("never flags a job with unassessable (null) margin, even though its grossProfit may be negative", () => {
    const job = makeJob({ quotedAmount: 0 });
    const items: JobItem[] = [makeItem({ itemType: "part", lineTotal: 5000 })];
    const profit = computeJobProfitability(job, items, []);
    expect(profit.grossMarginPct).toBeNull();
    expect(isLowMarginJob(profit)).toBe(false);
  });
});
