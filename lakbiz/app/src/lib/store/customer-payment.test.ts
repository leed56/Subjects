import { describe, expect, it } from "vitest";
import { recordCustomerPayment } from "./actions";
import { emptyAppData } from "./storage";

const customer = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Credit Customer",
  contactType: "individual" as const,
  creditBalance: 50_000,
};

describe("recordCustomerPayment", () => {
  it("rejects an overpayment without changing the ledger", () => {
    const data = { ...emptyAppData(), customers: [customer] };
    expect(recordCustomerPayment(data, customer.id, 50_001, "cash")).toBe(data);
  });

  it("records an electronic receipt in customer and bank ledgers", () => {
    const account = {
      id: "55555555-5555-4555-8555-555555555555",
      bankName: "BOC",
      accountName: "LakBiz",
      accountNumber: "123456",
      balance: 10_000,
    };
    const data = { ...emptyAppData(), customers: [customer], bankAccounts: [account] };
    const next = recordCustomerPayment(
      data,
      customer.id,
      20_000,
      "bank_transfer",
      "Invoice settlement",
      account.id,
    );

    expect(next.customers[0].creditBalance).toBe(30_000);
    expect(next.customerPayments[0]).toMatchObject({ amount: 20_000, note: "Invoice settlement" });
    expect(next.bankAccounts[0].balance).toBe(30_000);
    expect(next.bankTransactions[0]).toMatchObject({
      id: next.customerPayments[0].id,
      accountId: account.id,
      type: "deposit",
      amount: 20_000,
    });
  });
});
