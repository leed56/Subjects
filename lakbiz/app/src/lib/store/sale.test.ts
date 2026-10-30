import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import { createSale } from "./actions";
import { emptyAppData } from "./storage";

function makeProduct(stockQty: number): Product {
  return {
    id: "product-1",
    name: "Test product",
    category: "general",
    sectorId: "grocery",
    condition: "new",
    buyPrice: 50,
    sellPrice: 100,
    stockQty,
    active: true,
    customFields: {},
  };
}

describe("createSale duplicate product lines", () => {
  it("aggregates duplicate quantities when reducing stock", () => {
    const data = {
      ...emptyAppData(),
      products: [makeProduct(7)],
    };

    const next = createSale(
      data,
      [
        { productId: "product-1", qty: 3 },
        { productId: "product-1", qty: 3 },
      ],
      "cash",
    );

    expect(next.sales).toHaveLength(1);
    expect(next.sales[0].lines).toHaveLength(2);
    expect(next.products[0].stockQty).toBe(1);
    expect(
      next.stockLogs
        .filter((log) => log.type === "sale")
        .reduce((total, log) => total + log.qty, 0),
    ).toBe(6);
  });



  it("rejects sale calculations that overflow finite input values", () => {
    const data = {
      ...emptyAppData(),
      products: [makeProduct(Number.MAX_VALUE)],
    };

    const next = createSale(
      data,
      [{ productId: "product-1", qty: Number.MAX_VALUE, unitPrice: Number.MAX_VALUE }],
      "cash",
    );

    expect(next).toBe(data);
    expect(next.sales).toHaveLength(0);
    expect(next.products[0].stockQty).toBe(Number.MAX_VALUE);
    expect(next.stockLogs).toHaveLength(0);
  });

  it("rejects a non-finite discount", () => {
    const data = {
      ...emptyAppData(),
      products: [makeProduct(5)],
    };

    const next = createSale(
      data,
      [{ productId: "product-1", qty: 1 }],
      "cash",
      { discount: Number.NaN },
    );

    expect(next).toBe(data);
    expect(next.sales).toHaveLength(0);
    expect(next.products[0].stockQty).toBe(5);
  });

  it("rejects the entire sale if any requested line is invalid", () => {
    const data = {
      ...emptyAppData(),
      products: [makeProduct(10)],
    };

    const next = createSale(
      data,
      [
        { productId: "product-1", qty: 2 },
        { productId: "missing-product", qty: 1 },
      ],
      "cash",
    );

    expect(next).toBe(data);
    expect(next.sales).toHaveLength(0);
    expect(next.products[0].stockQty).toBe(10);
    expect(next.stockLogs).toHaveLength(0);
  });

  it("rejects non-finite quantities and prices without partial writes", () => {
    const data = {
      ...emptyAppData(),
      products: [makeProduct(10)],
    };

    const next = createSale(
      data,
      [{ productId: "product-1", qty: 1, unitPrice: Number.POSITIVE_INFINITY }],
      "cash",
    );

    expect(next).toBe(data);
    expect(next.sales).toHaveLength(0);
    expect(next.products[0].stockQty).toBe(10);
    expect(next.stockLogs).toHaveLength(0);
  });

  it("rejects the whole sale when duplicate lines exceed available stock", () => {
    const data = {
      ...emptyAppData(),
      products: [makeProduct(5)],
    };

    const next = createSale(
      data,
      [
        { productId: "product-1", qty: 3 },
        { productId: "product-1", qty: 3 },
      ],
      "cash",
    );

    expect(next).toBe(data);
    expect(next.sales).toHaveLength(0);
    expect(next.products[0].stockQty).toBe(5);
    expect(next.stockLogs).toHaveLength(0);
  });
});
