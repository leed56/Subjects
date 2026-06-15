import type { BusinessInfo } from "@/lib/invoice";
import { defaultBusiness } from "@/lib/invoice";
import { updateBusiness as mergeBusinessIntoApp } from "./actions";
import { loadAppData, saveAppData } from "./storage";

const SHOP_SETTINGS_KEY = "lakbiz-shop-settings-v1";

export function loadShopSettings(): BusinessInfo {
  if (typeof window === "undefined") return defaultBusiness();
  try {
    const raw = localStorage.getItem(SHOP_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BusinessInfo>;
      return {
        ...defaultBusiness(),
        ...parsed,
        vatRegistered: parsed.vatRegistered ?? false,
        quarterStartMonth: parsed.quarterStartMonth ?? 4,
      };
    }
  } catch {
    /* fall through */
  }
  return { ...loadAppData().business };
}

/** Persist shop settings to dedicated key + main app blob. Returns false if write failed. */
export function saveShopSettings(business: BusinessInfo): boolean {
  if (typeof window === "undefined") return false;

  const payload: BusinessInfo = {
    ...business,
    name: business.name.trim() || "My Shop",
    phone: business.phone?.trim() || undefined,
    address: business.address?.trim() || undefined,
    vatRegistered: business.vatRegistered ?? false,
    vatNumber: business.vatRegistered
      ? business.vatNumber?.trim() || undefined
      : undefined,
    quarterStartMonth: business.quarterStartMonth ?? 4,
  };

  try {
    localStorage.setItem(SHOP_SETTINGS_KEY, JSON.stringify(payload));
    const app = mergeBusinessIntoApp(loadAppData(), payload);
    saveAppData(app);

    const check = localStorage.getItem(SHOP_SETTINGS_KEY);
    if (!check) return false;
    const parsed = JSON.parse(check) as BusinessInfo;
    return parsed.name === payload.name;
  } catch {
    return false;
  }
}
