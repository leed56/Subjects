import type { AppData } from "./types";

const STORAGE_KEY_V2 = "lakbiz-app-data-v2";
const STORAGE_KEY_V1 = "lakbiz-app-data-v1";

export const emptyAppData = (): AppData => ({
  products: [],
  sales: [],
  stockLogs: [],
  customers: [],
  customerPayments: [],
  bankAccounts: [],
  cheques: [],
});

function normalizeSale(sale: AppData["sales"][number]): AppData["sales"][number] {
  return {
    ...sale,
    creditAmount: sale.creditAmount ?? (sale.paymentMethod === "credit" ? sale.total : 0),
  };
}

export function loadAppData(): AppData {
  if (typeof window === "undefined") return emptyAppData();
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<AppData>;
      return {
        ...emptyAppData(),
        ...parsed,
        sales: (parsed.sales ?? []).map(normalizeSale),
      };
    }

    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as Partial<AppData>;
      const migrated: AppData = {
        ...emptyAppData(),
        products: parsed.products ?? [],
        sales: (parsed.sales ?? []).map(normalizeSale),
        stockLogs: parsed.stockLogs ?? [],
      };
      saveAppData(migrated);
      return migrated;
    }

    return emptyAppData();
  } catch {
    return emptyAppData();
  }
}

export function saveAppData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(data));
}

export function clearAppData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_V2);
  localStorage.removeItem(STORAGE_KEY_V1);
}
