import { describe, expect, it } from "vitest";
import {
  summarizeSaleTenders,
  validateSaleTenders,
  type SaleTenderDraft,
} from "./sale-tender";

const tender = (
  id: string,
  kind: SaleTenderDraft["kind"],
  amount: number,
  extra: Partial<SaleTenderDraft> = {},
): SaleTenderDraft => ({ id, kind, amount, ...extra });

describe("sale tender allocation", () => {
  it("summarizes an exact mixed cash + card settlement", () => {
    const summary = summarizeSaleTenders(10_000, [
      tender("cash-1", "cash", 4_000),
      tender("card-1", "card", 6_000),
    ]);

    expect(summary.tenderedTotal).toBe(10_000);
    expect(summary.remaining).toBe(0);
    expect(summary.changeDue).toBe(0);
    expect(summary.settled).toBe(true);
  });

  it("treats customer credit as an explicit tender rather than an unexplained remainder", () => {
    const tenders = [
      tender("cash-1", "cash", 3_000),
      tender("credit-1", "credit", 7_000),
    ];

    expect(validateSaleTenders(tenders, {
      saleTotal: 10_000,
      hasCustomerAccount: true,
    })).toEqual([]);
    expect(summarizeSaleTenders(10_000, tenders).creditAmount).toBe(7_000);
  });

  it("rejects customer credit on a walk-in sale", () => {
    const errors = validateSaleTenders(
      [tender("credit-1", "credit", 5_000)],
      { saleTotal: 5_000, hasCustomerAccount: false },
    );

    expect(errors).toContain("Credit payment requires a customer account.");
  });

  it("supports return credit plus a price difference without mutating invoice value", () => {
    const tenders = [
      tender("return-1", "return_credit", 10_000, { returnId: "return-a" }),
      tender("card-1", "card", 4_000),
    ];

    const errors = validateSaleTenders(tenders, {
      saleTotal: 14_000,
      hasCustomerAccount: false,
      availableReturnCredit: 10_000,
    });

    expect(errors).toEqual([]);
    expect(summarizeSaleTenders(14_000, tenders).returnCreditApplied).toBe(10_000);
  });

  it("does not allow return credit above the issued available balance", () => {
    const errors = validateSaleTenders(
      [tender("return-1", "return_credit", 8_000, { returnId: "return-a" })],
      {
        saleTotal: 8_000,
        hasCustomerAccount: false,
        availableReturnCredit: 5_000,
      },
    );

    expect(errors).toContain(
      "Return credit exceeds the available issued credit-note balance.",
    );
  });

  it("rejects incomplete and over-allocated tender sets", () => {
    expect(validateSaleTenders(
      [tender("cash-1", "cash", 9_999)],
      { saleTotal: 10_000, hasCustomerAccount: false },
    )).toContain("Payment allocation does not cover the full sale total.");

    expect(validateSaleTenders(
      [tender("cash-1", "cash", 10_001)],
      { saleTotal: 10_000, hasCustomerAccount: false },
    )).toContain("Payment allocation exceeds the sale total.");
  });

  it("requires explicit bank, cheque and return references", () => {
    const errors = validateSaleTenders(
      [
        tender("bank-1", "bank_transfer", 1_000),
        tender("cheque-1", "cheque", 1_000),
        tender("return-1", "return_credit", 1_000),
      ],
      {
        saleTotal: 3_000,
        hasCustomerAccount: false,
        availableReturnCredit: 1_000,
      },
    );

    expect(errors).toEqual(expect.arrayContaining([
      "Bank transfer requires a destination bank account.",
      "Cheque payment requires a cheque record.",
      "Return credit requires a return document.",
    ]));
  });
});
