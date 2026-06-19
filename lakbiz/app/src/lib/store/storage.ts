import type { AppData } from "./types";
import { defaultBusiness, type BusinessInfo } from "@/lib/invoice";
import { calcInputVat, splitInclusiveTotal } from "@/lib/vat";
import { syncAcJobServiceStatuses } from "@/lib/ac-service";

const STORAGE_KEY_V2 = "lakbiz-app-data-v2";
const STORAGE_KEY_V1 = "lakbiz-app-data-v1";

let activeOrgId: string | null = null;

/** Scope localStorage per tenant so shops never clash on the same browser. */
export function setStorageOrgId(orgId: string | null): void {
  activeOrgId = orgId;
}

function storageKeyV2(orgId?: string | null): string {
  const id = orgId ?? activeOrgId;
  return id ? `${STORAGE_KEY_V2}-${id}` : STORAGE_KEY_V2;
}

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

export function parseAppData(parsed: Partial<AppData>): AppData {
  return {
    ...emptyAppData(),
    ...parsed,
    business: normalizeBusiness(parsed.business),
    sales: (parsed.sales ?? []).map(normalizeSale),
    purchases: (parsed.purchases ?? []).map(normalizePurchase),
    acJobs: (parsed.acJobs ?? []).map((job) => ({
      ...job,
      jobType: job.jobType ?? "installation",
      serviceDueManual: job.serviceDueManual ?? false,
      serviceIntervalDays:
        job.serviceIntervalDays ??
        (job.serviceIntervalMonths != null
          ? job.serviceIntervalMonths * 30
          : undefined),
    })),
  };
}

function migrateLegacyGlobalKey(orgId: string | null): AppData | null {
  if (!orgId || typeof window === "undefined") return null;
  const orgKey = storageKeyV2(orgId);
  if (localStorage.getItem(orgKey)) return null;
  const legacy = localStorage.getItem(STORAGE_KEY_V2);
  if (!legacy) return null;
  try {
    const parsed = JSON.parse(legacy) as Partial<AppData>;
    const businessName = parsed.business?.name?.trim();
    if (!businessName || businessName === "My Shop") return null;
    localStorage.setItem(orgKey, legacy);
    return syncAcJobServiceStatuses(parseAppData(parsed));
  } catch {
    return null;
  }
}

export function loadAppData(orgId?: string | null): AppData {
  if (typeof window === "undefined") return emptyAppData();
  const key = storageKeyV2(orgId);
  try {
    const rawV2 = localStorage.getItem(key);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<AppData>;
      return syncAcJobServiceStatuses(parseAppData(parsed));
    }

    const migrated = migrateLegacyGlobalKey(orgId ?? activeOrgId);
    if (migrated) return migrated;

    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as Partial<AppData>;
      const migratedApp: AppData = {
        ...emptyAppData(),
        products: parsed.products ?? [],
        sales: (parsed.sales ?? []).map(normalizeSale),
        stockLogs: parsed.stockLogs ?? [],
      };
      saveAppData(migratedApp, orgId);
      return migratedApp;
    }

    return emptyAppData();
  } catch {
    return emptyAppData();
  }
}

export function saveAppData(data: AppData, orgId?: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKeyV2(orgId), JSON.stringify(data));
}

export function clearAppData(orgId?: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKeyV2(orgId));
  if (!orgId && !activeOrgId) {
    localStorage.removeItem(STORAGE_KEY_V2);
    localStorage.removeItem(STORAGE_KEY_V1);
  }
}
