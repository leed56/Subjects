import { describe, it, expect } from "vitest";
import {
  VAT_RATE,
  splitInclusiveTotal,
  calcInputVat,
  isVatEnabled,
  getVatQuarterBounds,
  isDateInQuarter,
  getVatQuarterSummary,
  resolveSaleOutputVat,
  resolvePurchaseInputVat,
} from "./vat";
import type { AppData, Sale, Purchase } from "./store/types";

/**
 * Test-coverage pass — the one explicitly flagged gap left after Phase 22
 * ("tests for vat.ts... not done in this pass"). Writing these tests
 * found a real, live bug in getVatQuarterBounds (see the correction
 * comment on that function in vat.ts) rather than just locking down
 * already-correct behavior — the brute-force test below is the exact
 * check that found it, kept as a permanent regression guard.
 */

function makeAppData(overrides: Partial<AppData> = {}): AppData {
  return {
    business: { name: "Test Shop", quarterStartMonth: 4, vatRegistered: true },
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
    total: 11800,
    profit: 3000,
    paymentMethod: "cash",
    creditAmount: 0,
    ...overrides,
  };
}

function makePurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: "purch-1",
    grnNo: "GRN-001",
    date: "2026-06-01",
    supplierId: "sup-1",
    supplierName: "Test Supplier",
    lines: [],
    total: 11800,
    paymentMethod: "cash",
    creditAmount: 0,
    ...overrides,
  };
}

describe("splitInclusiveTotal", () => {
  it("splits a VAT-inclusive total into subtotal + output VAT at VAT_RATE", () => {
    const { subtotal, vat, total } = splitInclusiveTotal(11800);
    expect(total).toBe(11800);
    expect(subtotal + vat).toBe(11800);
    // 11800 / 1.18 = 10000 exactly
    expect(subtotal).toBe(10000);
    expect(vat).toBe(1800);
  });

  it("returns all zeros for a zero or negative total, never a negative VAT amount", () => {
    expect(splitInclusiveTotal(0)).toEqual({ subtotal: 0, vat: 0, total: 0 });
    expect(splitInclusiveTotal(-500)).toEqual({ subtotal: 0, vat: 0, total: 0 });
  });
});

describe("calcInputVat", () => {
  it("computes input VAT from a pre-VAT subtotal at VAT_RATE", () => {
    expect(calcInputVat(10000)).toBe(Math.round(10000 * VAT_RATE));
  });

  it("returns 0 for a zero or negative subtotal", () => {
    expect(calcInputVat(0)).toBe(0);
    expect(calcInputVat(-100)).toBe(0);
  });
});

describe("isVatEnabled", () => {
  it("is true only when vatRegistered is exactly true", () => {
    expect(isVatEnabled({ name: "x", vatRegistered: true })).toBe(true);
    expect(isVatEnabled({ name: "x", vatRegistered: false })).toBe(false);
    expect(isVatEnabled({ name: "x" })).toBe(false);
  });
});

describe("getVatQuarterBounds", () => {
  it("REGRESSION: returns bounds that contain refDate for every (fiscalStartMonth, month) combination", () => {
    // The exact brute-force check that found the original bug: for a
    // non-calendar fiscal year, the old implementation's ad hoc
    // startYear/endYear branches disagreed with refDate's own year for
    // 66 of these 144 combinations (46%) — always off by exactly one
    // year. Every one of the 144 cells below must contain its own
    // refDate, and every quarter must span exactly 3 calendar months.
    for (let fiscalStartMonth = 1; fiscalStartMonth <= 12; fiscalStartMonth++) {
      for (let month = 1; month <= 12; month++) {
        const refDate = new Date(2026, month - 1, 15);
        const bounds = getVatQuarterBounds(refDate, fiscalStartMonth);

        expect(
          refDate.getTime() >= bounds.start.getTime() && refDate.getTime() <= bounds.end.getTime(),
          `fiscalStartMonth=${fiscalStartMonth} month=${month}: refDate ${refDate.toISOString()} not in [${bounds.start.toISOString()}, ${bounds.end.toISOString()}]`,
        ).toBe(true);

        const spanMonths =
          (bounds.end.getFullYear() * 12 + bounds.end.getMonth()) -
          (bounds.start.getFullYear() * 12 + bounds.start.getMonth());
        expect(spanMonths, `fiscalStartMonth=${fiscalStartMonth} month=${month}: quarter spans ${spanMonths} months, not 2`).toBe(2);
      }
    }
  });

  it("the originally-failing case: April fiscal start, a January reference date", () => {
    // Before the fix: this returned Jan 1 2025 – Mar 31 2025, a full
    // year stale relative to the Jan 2026 refDate — the concrete bug
    // that would have shown a real shop last year's VAT quarter.
    const bounds = getVatQuarterBounds(new Date(2026, 0, 15), 4);
    expect(bounds.start.getFullYear()).toBe(2026);
    expect(bounds.start.getMonth()).toBe(0); // January
    expect(bounds.end.getFullYear()).toBe(2026);
    expect(bounds.end.getMonth()).toBe(2); // March
  });

  it("calendar quarters (fiscalStartMonth 1) match plain Q1-Q4", () => {
    const q2 = getVatQuarterBounds(new Date(2026, 4, 10), 1); // May -> Q2
    expect(q2.key).toBe("2026-Q2");
    expect(q2.start.getMonth()).toBe(3); // April
    expect(q2.end.getMonth()).toBe(5); // June
  });

  it("a fiscal quarter that itself straddles a calendar year end resolves both ends to the correct year", () => {
    // fiscalStartMonth 11 (November): Q1 is Nov-Jan, spanning two
    // calendar years. Viewed from December (still year y) and from the
    // following January (year y+1) it must resolve to the SAME quarter.
    const fromDecember = getVatQuarterBounds(new Date(2026, 11, 10), 11);
    const fromJanuary = getVatQuarterBounds(new Date(2027, 0, 10), 11);
    expect(fromDecember.start).toEqual(new Date(2026, 10, 1));
    expect(fromJanuary.start).toEqual(new Date(2026, 10, 1));
    expect(fromDecember.end).toEqual(fromJanuary.end);
  });
});

describe("isDateInQuarter", () => {
  it("is true for a date inside the bounds and false just outside them", () => {
    const bounds = getVatQuarterBounds(new Date(2026, 5, 1), 4); // Apr-Jun 2026
    expect(isDateInQuarter("2026-05-15", bounds)).toBe(true);
    expect(isDateInQuarter("2026-03-31", bounds)).toBe(false);
    expect(isDateInQuarter("2026-07-01", bounds)).toBe(false);
  });
});

describe("getVatQuarterSummary", () => {
  it("reflects business.vatRegistered in `enabled`", () => {
    const on = getVatQuarterSummary(makeAppData({ business: { name: "x", vatRegistered: true } }), new Date(2026, 5, 15));
    const off = getVatQuarterSummary(makeAppData({ business: { name: "x", vatRegistered: false } }), new Date(2026, 5, 15));
    expect(on.enabled).toBe(true);
    expect(off.enabled).toBe(false);
  });

  it("only counts sales/purchases inside the current quarter", () => {
    const data = makeAppData({
      sales: [
        makeSale({ id: "in", date: "2026-05-01", total: 11800 }),
        makeSale({ id: "out", date: "2026-03-01", total: 999999 }), // previous quarter
      ],
      purchases: [
        makePurchase({ id: "in", date: "2026-05-01", total: 11800 }),
        makePurchase({ id: "out", date: "2026-03-01", total: 999999 }),
      ],
    });

    const summary = getVatQuarterSummary(data, new Date(2026, 5, 15)); // June -> Apr-Jun quarter

    expect(summary.salesCount).toBe(1);
    expect(summary.purchasesCount).toBe(1);
  });

  it("uses a sale's own outputVat when set, and derives it via splitInclusiveTotal when not", () => {
    const data = makeAppData({
      sales: [
        makeSale({ id: "explicit", date: "2026-05-01", total: 11800, outputVat: 1234 }),
        makeSale({ id: "derived", date: "2026-05-01", total: 11800, outputVat: undefined }),
      ],
    });

    const summary = getVatQuarterSummary(data, new Date(2026, 5, 15));

    // 1234 (explicit) + 1800 (derived via splitInclusiveTotal(11800).vat)
    expect(summary.outputVat).toBe(1234 + 1800);
  });

  it("uses a purchase's own inputVat when set, and derives it via calcInputVat(subtotal ?? total) when not", () => {
    const data = makeAppData({
      purchases: [
        makePurchase({ id: "explicit", date: "2026-05-01", inputVat: 500 }),
        makePurchase({ id: "derived-subtotal", date: "2026-05-01", subtotal: 10000, inputVat: undefined }),
        makePurchase({ id: "derived-total", date: "2026-05-01", subtotal: undefined, total: 10000, inputVat: undefined }),
      ],
    });

    const summary = getVatQuarterSummary(data, new Date(2026, 5, 15));

    // 500 (explicit) + calcInputVat(10000) + calcInputVat(10000)
    expect(summary.inputVat).toBe(500 + calcInputVat(10000) * 2);
  });

  it("computes netPayable as outputVat - inputVat, which can be negative (input credit)", () => {
    const data = makeAppData({
      sales: [makeSale({ date: "2026-05-01", total: 11800, outputVat: 1000 })],
      purchases: [makePurchase({ date: "2026-05-01", inputVat: 5000 })],
    });

    const summary = getVatQuarterSummary(data, new Date(2026, 5, 15));

    expect(summary.netPayable).toBe(1000 - 5000);
    expect(summary.netPayable).toBeLessThan(0);
  });

  it("REGRESSION: a stored outputVat/inputVat of exactly 0 does not zero out a real invoice or purchase", () => {
    // The actual Round 2 bug: actions.ts stores a literal outputVat: 0 /
    // inputVat: 0 (not null) for any sale/purchase recorded while the
    // business wasn't VAT-registered at the time. The VAT Return page
    // read that stored field directly, so a shop that later registered
    // for VAT saw Rs. 0 output/input VAT for every historical invoice —
    // 185 invoices and 3 purchases counted correctly, VAT all zero.
    const data = makeAppData({
      sales: [makeSale({ date: "2026-05-01", total: 11800, outputVat: 0 })],
      purchases: [makePurchase({ date: "2026-05-01", total: 11800, subtotal: 10000, inputVat: 0 })],
    });

    const summary = getVatQuarterSummary(data, new Date(2026, 5, 15));

    expect(summary.outputVat).toBe(splitInclusiveTotal(11800).vat);
    expect(summary.inputVat).toBe(calcInputVat(10000));
    expect(summary.outputVat).toBeGreaterThan(0);
    expect(summary.inputVat).toBeGreaterThan(0);
  });

  it("REGRESSION: Net VAT Payable is non-zero when real taxable sales/purchases exist in the period", () => {
    const data = makeAppData({
      sales: [
        makeSale({ id: "s1", date: "2026-05-01", total: 11800, outputVat: 0 }),
        makeSale({ id: "s2", date: "2026-05-10", total: 23600 }),
      ],
      purchases: [makePurchase({ date: "2026-05-01", total: 5900, subtotal: 5000, inputVat: 0 })],
    });

    const summary = getVatQuarterSummary(data, new Date(2026, 5, 15));

    expect(summary.outputVat).toBeGreaterThan(0);
    expect(summary.inputVat).toBeGreaterThan(0);
    expect(summary.netPayable).not.toBe(0);
  });

  it("still trusts a genuine zero when the total itself is zero (nothing to derive VAT from)", () => {
    const data = makeAppData({
      sales: [makeSale({ date: "2026-05-01", total: 0, outputVat: 0 })],
    });

    const summary = getVatQuarterSummary(data, new Date(2026, 5, 15));

    expect(summary.outputVat).toBe(0);
  });
});

describe("resolveSaleOutputVat", () => {
  it("trusts a stored positive value as-is", () => {
    expect(resolveSaleOutputVat({ outputVat: 1234, total: 11800 })).toBe(1234);
  });

  it("derives from the sale's total when outputVat is 0, undefined, or missing", () => {
    expect(resolveSaleOutputVat({ outputVat: 0, total: 11800 })).toBe(splitInclusiveTotal(11800).vat);
    expect(resolveSaleOutputVat({ outputVat: undefined, total: 11800 })).toBe(splitInclusiveTotal(11800).vat);
  });

  it("never returns a positive amount for a zero-total sale", () => {
    expect(resolveSaleOutputVat({ outputVat: 0, total: 0 })).toBe(0);
  });
});

describe("resolvePurchaseInputVat", () => {
  it("trusts a stored positive value as-is", () => {
    expect(resolvePurchaseInputVat({ inputVat: 500, subtotal: 10000, total: 11800 })).toBe(500);
  });

  it("derives from subtotal (falling back to total) when inputVat is 0, undefined, or missing", () => {
    expect(resolvePurchaseInputVat({ inputVat: 0, subtotal: 10000, total: 11800 })).toBe(calcInputVat(10000));
    expect(resolvePurchaseInputVat({ inputVat: undefined, subtotal: undefined, total: 10000 })).toBe(calcInputVat(10000));
  });

  it("never returns a positive amount when there is no subtotal or total to derive from", () => {
    expect(resolvePurchaseInputVat({ inputVat: 0, subtotal: 0, total: 0 })).toBe(0);
  });
});
