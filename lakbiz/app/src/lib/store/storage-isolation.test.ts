import { afterEach, describe, expect, it, vi } from "vitest";
import { appStorageScope, emptyAppData, loadAppData, saveAppData, setStorageOrgId } from "./storage";
import { loadShopSettings, saveShopSettings } from "./shop-settings";

function browserStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}

describe("shop and template data isolation", () => {
  afterEach(() => { setStorageOrgId(null); vi.unstubAllGlobals(); });

  it("retains unassigned legacy data without copying it into any shop or demo", () => {
    const storage = browserStorage();
    const legacy = { ...emptyAppData(), business: { ...emptyAppData().business, name: "Old AC Shop" }, products: [{ id: "legacy-item", name: "AC unit" }] };
    storage.set("lakbiz-app-data-v2", JSON.stringify(legacy));
    storage.set("lakbiz-app-data-v1", JSON.stringify(legacy));
    for (const scope of ["shop-a", "shop-b", appStorageScope(null, "grocery"), appStorageScope(null, "ac_hvac")]) {
      setStorageOrgId(scope);
      expect(loadAppData().products).toEqual([]);
      expect(storage.has(`lakbiz-app-data-v2-${scope}`)).toBe(false);
    }
    expect(storage.get("lakbiz-app-data-v2")).toBe(JSON.stringify(legacy));
    expect(storage.get("lakbiz-app-data-v1")).toBe(JSON.stringify(legacy));
  });

  it("preserves existing tenant caches and keeps template changes separate", () => {
    browserStorage();
    const original = { ...emptyAppData(), business: { ...emptyAppData().business, name: "Existing Shop" } };
    saveAppData(original, "shop-a");
    expect(loadAppData("shop-a").business.name).toBe("Existing Shop");
    expect(loadAppData("shop-b").business.name).not.toBe("Existing Shop");
    setStorageOrgId(appStorageScope(null, "grocery"));
    saveAppData(original);
    setStorageOrgId(appStorageScope(null, "ac_hvac"));
    expect(loadAppData().business.name).not.toBe("Existing Shop");
    setStorageOrgId(appStorageScope(null, "grocery"));
    expect(loadAppData().business.name).toBe("Existing Shop");
    expect(appStorageScope("existing-uuid", "grocery")).toBe("existing-uuid");
  });

  it("isolates shop identity, logo and tax settings and retains legacy settings", () => {
    const storage = browserStorage();
    storage.set("lakbiz-shop-settings-v1", JSON.stringify({ name: "Old AC Shop", logoDataUrl: "old-logo" }));
    const first = { ...emptyAppData().business, name: "Grocery One", logoDataUrl: "grocery-logo", vatRegistered: true };
    saveShopSettings(first, "shop-a");
    expect(loadShopSettings("shop-a")).toMatchObject(first);
    expect(loadShopSettings("shop-b").name).toBe("My Shop");
    expect(loadShopSettings("shop-b").logoDataUrl).toBeUndefined();
    expect(loadAppData("shop-a").business).toMatchObject(first);
    expect(storage.get("lakbiz-shop-settings-v1")).toContain("Old AC Shop");
  });
});
