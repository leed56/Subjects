import type { AppData } from "./types";
import { defaultBusiness, type BusinessInfo } from "@/lib/invoice";
import { calcInputVat, splitInclusiveTotal } from "@/lib/vat";
import { syncAcJobServiceStatuses } from "@/lib/ac-service";

const STORAGE_KEY_V2 = "lakbiz-app-data-v2";
const STORAGE_KEY_V1 = "lakbiz-app-data-v1";

export const emptyAppData = (): AppData => ({
  business: defaultBusiness(),
  products: [],
  sales: [],
  stockLogs: [],
  customers: [],
  customerPayments: [],
  suppliers: [],
  purchases: [],
  supplierPayments: [],
  acJobs: [],
  vehicles: [],
  bankAccounts: [],
  cheques: [],
});

function normalizeSale(sale: AppData["sales"][number]): AppData["sales"][number] {
  const split = splitInclusiveTotal(sale.total);
  return {
    ...sale,
    billNo: sale.billNo ?? `LB-${sale.id.slice(0, 8).toUpperCase()}`,
    creditAmount:
      sale.creditAmount ?? (sale.paymentMethod === "credit" ? sale.total : 0),
    subtotal: sale.subtotal ?? split.subtotal,
    outputVat: sale.outputVat ?? split.vat,
  };
}

function normalizePurchase(
  purchase: AppData["purchases"][number],
): AppData["purchases"][number] {
  const subtotal =
    purchase.subtotal ??
    purchase.lines.reduce((s, l) => s + l.unitCost * l.qty, 0);
  return {
    ...purchase,
    subtotal,
    inputVat: purchase.inputVat ?? calcInputVat(subtotal),
    total: purchase.total ?? subtotal + (purchase.inputVat ?? calcInputVat(subtotal)),
  };
}

function normalizeBusiness(
  business: Partial<BusinessInfo> | undefined,
): BusinessInfo {
  const base = defaultBusiness();
  return {
    ...base,
    ...business,
    quarterStartMonth: business?.quarterStartMonth ?? 4,
    vatRegistered: business?.vatRegistered ?? false,
  };
}

export function loadAppData(): AppData {
  if (typeof window === "undefined") return emptyAppData();
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<AppData>;
      return syncAcJobServiceStatuses({
        ...emptyAppData(),
        ...parsed,
        business: normalizeBusiness(parsed.business),
        sales: (parsed.sales ?? []).map(normalizeSale),
        purchases: (parsed.purchases ?? []).map(normalizePurchase),
      });
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
