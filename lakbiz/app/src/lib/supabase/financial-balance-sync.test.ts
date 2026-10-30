import { describe, expect, it } from "vitest";
import { preserveExistingBankBalances } from "./financial-balance-sync";

describe("preserveExistingBankBalances", () => {
  it("keeps the cloud balance for existing accounts", () => {
    expect(
      preserveExistingBankBalances(
        [{ id: "bank-1", balance: 50 }],
        [{ id: "bank-1", balance: "125.75" }],
      ),
    ).toEqual([{ id: "bank-1", balance: 125.75 }]);
  });

  it("keeps the local opening balance for new accounts", () => {
    expect(
      preserveExistingBankBalances(
        [{ id: "bank-new", balance: 900 }],
        [{ id: "bank-old", balance: "300" }],
      ),
    ).toEqual([{ id: "bank-new", balance: 900 }]);
  });

  it("does not replace a local balance with an invalid cloud value", () => {
    expect(
      preserveExistingBankBalances(
        [{ id: "bank-1", balance: 50 }],
        [{ id: "bank-1", balance: "invalid" }],
      ),
    ).toEqual([{ id: "bank-1", balance: 50 }]);
  });
});
