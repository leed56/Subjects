import { describe, expect, it } from "vitest";
import { addProduct, createSale } from "./actions";
import { emptyAppData } from "./storage";

describe("sale banking settlement", () => {
  it("posts a card sale to its receiving account", () => {
    const account = {
      id: "66666666-6666-4666-8666-666666666666",
      bankName: "Sampath Bank",
      accountName: "LakBiz",
      accountNumber: "789012",
      balance: 5_000,
    };
    const stocked = addProduct(
      { ...emptyAppData(), bankAccounts: [account] },
      {
        name: "Test product",
        category: "General",
        sectorId: "grocery",
        buyPrice: 600,
        sellPrice: 1_000,
        stockQty: 2,
        unit: "pcs",
      },
    );
    const next = createSale(
      stocked,
      [{ productId: stocked.products[0].id, qty: 1 }],
      "card",
      { bankAccountId: account.id },
    );

    expect(next.sales).toHaveLength(1);
    expect(next.bankAccounts[0].balance).toBe(6_000);
    expect(next.bankTransactions[0]).toMatchObject({
      id: next.sales[0].id,
      accountId: account.id,
      type: "deposit",
      amount: 1_000,
    });
  });
});
