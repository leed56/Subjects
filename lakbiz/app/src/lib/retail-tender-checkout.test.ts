import { describe, expect, it } from "vitest";
import { buildCheckoutTenders } from "./retail-tender-checkout";

const cheque = {
  chequeNo: "CHQ-101",
  chequeBank: "Bank of Ceylon",
  chequeDate: "2026-08-23",
  postDated: false,
};

function base() {
  return {
    saleTotal: 1000,
    primaryKind: "cash" as const,
    primaryId: "tender-1",
    split: false,
    secondaryKind: "card" as const,
    secondaryAmount: 0,
    secondaryId: "tender-2",
    cheque,
  };
}

describe("buildCheckoutTenders", () => {
  it("builds one full-value tender for normal checkout", () => {
    const result = buildCheckoutTenders(base());
    expect(result.error).toBeNull();
    expect(result.paymentMethod).toBe("cash");
    expect(result.tenders).toEqual([{ id: "tender-1", kind: "cash", amount: 1000 }]);
    expect(result.cashTenderAmount).toBe(1000);
  });

  it("splits the invoice exactly between two different tenders", () => {
    const result = buildCheckoutTenders({
      ...base(),
      split: true,
      secondaryAmount: 400,
    });
    expect(result.error).toBeNull();
    expect(result.paymentMethod).toBe("mixed");
    expect(result.tenders).toEqual([
      { id: "tender-1", kind: "cash", amount: 600 },
      { id: "tender-2", kind: "card", amount: 400 },
    ]);
    expect(result.cashTenderAmount).toBe(600);
  });

  it("rejects duplicate methods in split mode", () => {
    const result = buildCheckoutTenders({
      ...base(),
      split: true,
      secondaryKind: "cash",
      secondaryAmount: 400,
    });
    expect(result.error).toMatch(/different payment methods/i);
    expect(result.tenders).toHaveLength(0);
  });

  it("rejects a split amount that consumes the whole invoice", () => {
    const result = buildCheckoutTenders({
      ...base(),
      split: true,
      secondaryAmount: 1000,
    });
    expect(result.error).toMatch(/below the invoice total/i);
  });

  it("reports only the allocated credit portion", () => {
    const result = buildCheckoutTenders({
      ...base(),
      primaryKind: "credit",
      split: true,
      secondaryKind: "cash",
      secondaryAmount: 250,
    });
    expect(result.error).toBeNull();
    expect(result.creditTenderAmount).toBe(750);
    expect(result.cashTenderAmount).toBe(250);
  });

  it("attaches inline cheque metadata to the cheque tender", () => {
    const result = buildCheckoutTenders({
      ...base(),
      primaryKind: "card",
      split: true,
      secondaryKind: "cheque",
      secondaryAmount: 300,
    });
    expect(result.error).toBeNull();
    expect(result.tenders[1]).toMatchObject({
      kind: "cheque",
      amount: 300,
      chequeNo: "CHQ-101",
      chequeBank: "Bank of Ceylon",
      chequeDate: "2026-08-23",
      postDated: false,
    });
  });
});
