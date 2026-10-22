import { describe, expect, it } from "vitest";
import { textileUnitPrice } from "./textile-pricing";

const product = { id: "fabric-1", sellPrice: 500, customFields: { wholesalePrice: 420, wholesaleMinQty: 10 } };
const data = {
  customers: [{ id: "c1", name: "Dealer", contactType: "company" as const, creditBalance: 0 }],
  customerProductPrices: [{ id: "p1", customerId: "c1", productId: "fabric-1", price: 390 }],
};

describe("textile price resolution", () => {
  it("uses customer contract pricing before the general wholesale tier", () => {
    expect(textileUnitPrice({ product, quantity: 20, channel: "wholesale", customerId: "c1", data })).toEqual({ price: 390, source: "customer" });
  });
  it("uses wholesale only after its quantity threshold", () => {
    expect(textileUnitPrice({ product, quantity: 9, channel: "wholesale", data })).toEqual({ price: 500, source: "retail" });
    expect(textileUnitPrice({ product, quantity: 10, channel: "wholesale", data })).toEqual({ price: 420, source: "wholesale" });
  });
  it("allows manual override only for an authorized role", () => {
    expect(textileUnitPrice({ product, quantity: 10, channel: "retail", data, manualOverride: 350, canOverride: false }).price).toBe(500);
    expect(textileUnitPrice({ product, quantity: 10, channel: "retail", data, manualOverride: 350, canOverride: true })).toEqual({ price: 350, source: "manual" });
  });
});

