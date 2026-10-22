import { describe, expect, it } from "vitest";
import { computeSaleExchangePlan } from "./sale-exchange";

describe("computeSaleExchangePlan", () => {
  it("fully offsets an equal-value replacement", () => {
    expect(computeSaleExchangePlan(12500, 12500)).toEqual({
      appliedCredit: 12500,
      remainingReturnCredit: 0,
      replacementBalanceAfterCredit: 0,
    });
  });

  it("leaves the price difference receivable when replacement costs more", () => {
    expect(computeSaleExchangePlan(10000, 14000)).toEqual({
      appliedCredit: 10000,
      remainingReturnCredit: 0,
      replacementBalanceAfterCredit: 4000,
    });
  });

  it("leaves unused return credit open when replacement costs less", () => {
    expect(computeSaleExchangePlan(15000, 9000)).toEqual({
      appliedCredit: 9000,
      remainingReturnCredit: 6000,
      replacementBalanceAfterCredit: 0,
    });
  });

  it("never produces negative or non-finite money", () => {
    expect(computeSaleExchangePlan(-10, Number.NaN)).toEqual({
      appliedCredit: 0,
      remainingReturnCredit: 0,
      replacementBalanceAfterCredit: 0,
    });
  });
});
