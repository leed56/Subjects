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

export function saveShopSettings(business: BusinessInfo): void {
  if (typeof window === "undefined") {
    throw new Error("Cannot save on server");
  }

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

  localStorage.setItem(SHOP_SETTINGS_KEY, JSON.stringify(payload));
  const app = mergeBusinessIntoApp(loadAppData(), payload);
  saveAppData(app);
}
