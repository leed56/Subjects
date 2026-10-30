import { describe, expect, it } from "vitest";
import { preserveExistingBankBalances, preserveExistingSupplierBalances, preserveExistingContractorBalances, omitCustomerCreditBalance } from "./financial-balance-sync";

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

describe("preserveExistingSupplierBalances", () => {
  it("keeps the cloud payable balance for existing suppliers", () => {
    expect(
      preserveExistingSupplierBalances(
        [{ id: "supplier-1", payableBalance: 40 }],
        [{ id: "supplier-1", payable_balance: "215.50" }],
      ),
    ).toEqual([{ id: "supplier-1", payableBalance: 215.5 }]);
  });

  it("keeps the local opening balance for new suppliers", () => {
    expect(
      preserveExistingSupplierBalances(
        [{ id: "supplier-new", payableBalance: 700 }],
        [{ id: "supplier-old", payable_balance: "90" }],
      ),
    ).toEqual([{ id: "supplier-new", payableBalance: 700 }]);
  });

  it("does not use invalid cloud payable balances", () => {
    expect(
      preserveExistingSupplierBalances(
        [{ id: "supplier-1", payableBalance: 40 }],
        [{ id: "supplier-1", payable_balance: "invalid" }],
      ),
    ).toEqual([{ id: "supplier-1", payableBalance: 40 }]);
  });
});

describe("preserveExistingContractorBalances", () => {
  it("keeps the cloud payable balance for existing contractors", () => {
    expect(
      preserveExistingContractorBalances(
        [{ id: "contractor-1", payableBalance: 25 }],
        [{ id: "contractor-1", payable_balance: "180.25" }],
      ),
    ).toEqual([{ id: "contractor-1", payableBalance: 180.25 }]);
  });

  it("keeps the local opening balance for new contractors", () => {
    expect(
      preserveExistingContractorBalances(
        [{ id: "contractor-new", payableBalance: 500 }],
        [{ id: "contractor-old", payable_balance: "80" }],
      ),
    ).toEqual([{ id: "contractor-new", payableBalance: 500 }]);
  });

  it("handles the masked zero value returned to members without financial visibility", () => {
    expect(
      preserveExistingContractorBalances(
        [{ id: "contractor-1", payableBalance: 25 }],
        [{ id: "contractor-1", payable_balance: 0 }],
      ),
    ).toEqual([{ id: "contractor-1", payableBalance: 0 }]);
  });
});

describe("omitCustomerCreditBalance", () => {
  it("keeps customer details but excludes stale credit balances", () => {
    expect(
      omitCustomerCreditBalance([
        { id: "customer-1", name: "Customer", credit_balance: 950, phone: "123" },
      ]),
    ).toEqual([{ id: "customer-1", name: "Customer", phone: "123" }]);
  });

  it("supports an empty customer list", () => {
    expect(omitCustomerCreditBalance([])).toEqual([]);
  });
});
