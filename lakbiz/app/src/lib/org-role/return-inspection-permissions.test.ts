import { describe, expect, it } from "vitest";
import { canAccessShopRoute } from "./permissions";

describe("advanced customer-return inspection route", () => {
  it("allows owner and operational manager", () => {
    expect(canAccessShopRoute("owner", "/stock/advanced/returns")).toBe(true);
    expect(canAccessShopRoute("manager", "/stock/advanced/returns")).toBe(true);
    expect(canAccessShopRoute("manager", "/stock/advanced/returns/abc")).toBe(true);
  });

  it("does not inherit broad /stock access for data-entry or cashier roles", () => {
    expect(canAccessShopRoute("data_entry", "/stock")).toBe(true);
    expect(canAccessShopRoute("cashier", "/stock")).toBe(true);
    expect(canAccessShopRoute("data_entry", "/stock/advanced/returns")).toBe(false);
    expect(canAccessShopRoute("cashier", "/stock/advanced/returns")).toBe(false);
  });

  it("keeps technicians out of return inspection", () => {
    expect(canAccessShopRoute("technician", "/stock/advanced/returns")).toBe(false);
  });
});
