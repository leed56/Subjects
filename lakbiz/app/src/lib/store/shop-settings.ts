import type { BusinessInfo } from "@/lib/invoice";
import { defaultBusiness } from "@/lib/invoice";
import { clampCompanyIncomeTaxRatePct } from "@/lib/income-tax";
import { activeAppStorageScope, loadAppData, saveAppData } from "./storage";

const SHOP_SETTINGS_KEY = "lakbiz-shop-settings-v1";

function settingsKey(scope?: string): string {
  const current = scope ?? activeAppStorageScope();
  return current ? `${SHOP_SETTINGS_KEY}-${current}` : SHOP_SETTINGS_KEY;
}

function normalize(business: BusinessInfo): BusinessInfo {
  return {
    ...business,
    name: business.name.trim() || "My Shop",
    phone: business.phone?.trim() || undefined,
    address: business.address?.trim() || undefined,
    vatRegistered: business.vatRegistered ?? false,
    vatNumber: business.vatNumber?.trim() || undefined,
    quarterStartMonth: business.quarterStartMonth ?? 4,
    companyIncomeTaxRate: clampCompanyIncomeTaxRatePct(
      business.companyIncomeTaxRate,
    ),
  };
}

export function loadShopSettings(scope?: string): BusinessInfo {
  if (typeof window === "undefined") return defaultBusiness();
  try {
    const raw = localStorage.getItem(settingsKey(scope));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BusinessInfo>;
      return normalize({ ...defaultBusiness(), ...parsed });
    }
  } catch {
    /* fall through */
  }
  return { ...loadAppData(scope).business };
}

export function saveShopSettings(business: BusinessInfo, scope?: string): void {
  if (typeof window === "undefined") {
    throw new Error("Cannot save on server");
  }

  const payload = normalize(business);
  localStorage.setItem(settingsKey(scope), JSON.stringify(payload));

  const app = loadAppData(scope);
  app.business = {
    ...app.business,
    ...payload,
  };
  saveAppData(app, scope);
}
