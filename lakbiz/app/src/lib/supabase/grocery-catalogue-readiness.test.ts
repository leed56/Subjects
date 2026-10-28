import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueImportError, fetchGroceryCatalogueReadiness } from "./grocery-catalogue-readiness";
import { importGrindingMillCatalogue } from "./grinding-mill-import";
import { importGroceryMeatCatalogue } from "./grocery-meat-import";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), connected: true }));
vi.mock("./client", () => ({ createBrowserClient: () => mocks.connected ? { rpc: mocks.rpc } : null }));

describe("grocery catalogue deployment readiness", () => {
  beforeEach(() => { mocks.connected = true; mocks.rpc.mockReset(); });

  it("checks only the read-only readiness function and never imports products", async () => {
    mocks.rpc.mockResolvedValue({ data: { mill: true, meat: false }, error: null });
    expect(await fetchGroceryCatalogueReadiness("shop-a")).toEqual({ mill: true, meat: false, reason: "setup" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("grocery_catalogue_readiness", { p_organization_id: "shop-a" }, { get: true });
  });

  it("keeps both imports unavailable while their database setup is missing", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function in the schema cache" } });
    expect(await fetchGroceryCatalogueReadiness("shop-a")).toEqual({ mill: false, meat: false, reason: "setup" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed on a network failure, denied access or malformed response", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("offline"));
    expect((await fetchGroceryCatalogueReadiness("shop-a")).reason).toBe("connection");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "denied" } });
    expect((await fetchGroceryCatalogueReadiness("shop-a")).mill).toBe(false);
    mocks.rpc.mockResolvedValueOnce({ data: { mill: "true", meat: true }, error: null });
    expect((await fetchGroceryCatalogueReadiness("shop-a")).meat).toBe(false);
  });

  it("does not contact the database without a shop or connection", async () => {
    await fetchGroceryCatalogueReadiness("");
    mocks.connected = false;
    await fetchGroceryCatalogueReadiness("shop-a");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps missing-function and database details out of import feedback", async () => {
    const missing = { code: "PGRST202", message: "Could not find public.import_grocery_mill_catalogue in schema cache" };
    expect(catalogueImportError(missing).setupRequired).toBe(true);
    expect(catalogueImportError(missing).message).not.toContain("schema");
    mocks.rpc.mockResolvedValue({ data: null, error: missing });
    await expect(importGrindingMillCatalogue("shop-a")).rejects.toMatchObject({ setupRequired: true });
    await expect(importGroceryMeatCatalogue("shop-a")).rejects.toMatchObject({ setupRequired: true });
    expect(catalogueImportError({ code: "P0001", message: "sensitive database detail" }).message).not.toContain("sensitive");
  });
});
