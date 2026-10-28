import { parseProductCondition } from "@/lib/product-condition";
import { parseContactType } from "@/lib/contact-type";
import type { AppData } from "./types";
import { defaultBusiness, type BusinessInfo } from "@/lib/invoice";
import { clampCompanyIncomeTaxRatePct } from "@/lib/income-tax";
import { calcInputVat, splitInclusiveTotal } from "@/lib/vat";
import { syncAcJobServiceStatuses } from "@/lib/ac-service";
import { touchLocalSyncWatermark } from "@/lib/supabase/sync-watermark";

const STORAGE_KEY_V2 = "lakbiz-app-data-v2";
const STORAGE_KEY_V1 = "lakbiz-app-data-v1";

let activeOrgId: string | null = null;

/** Anonymous template demos must not share a catalogue with each other. */
export function appStorageScope(orgId: string | null, sector: string): string {
  return orgId ?? `demo-${sector}`;
}

/** Scope localStorage per tenant so shops never clash on the same browser. */
export function setStorageOrgId(orgId: string | null): void {
  activeOrgId = orgId;
}

export function activeAppStorageScope(): string | null {
  return activeOrgId;
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
  customerProductPrices: [],
  suppliers: [],
  purchases: [],
  purchaseOrders: [],
  supplierPayments: [],
  acJobs: [],
  jobItems: [],
  jobStatusHistory: [],
  technicians: [],
  contractors: [],
  contractorPayments: [],
  vehicles: [],
  bankAccounts: [],
  bankTransactions: [],
  bankTransfers: [],
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
    companyIncomeTaxRate: clampCompanyIncomeTaxRatePct(
      business?.companyIncomeTaxRate,
    ),
  };
}

export function parseAppData(parsed: Partial<AppData>): AppData {
  return {
    ...emptyAppData(),
    ...parsed,
    business: normalizeBusiness(parsed.business),
    products: (parsed.products ?? []).map((p) => ({
      ...p,
      condition: parseProductCondition(p.condition),
    })),
    customers: (parsed.customers ?? []).map((c) => ({
      ...c,
      contactType: parseContactType(c.contactType),
    })),
    customerProductPrices: parsed.customerProductPrices ?? [],
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

export function loadAppData(orgId?: string | null): AppData {
  if (typeof window === "undefined") return emptyAppData();
  const key = storageKeyV2(orgId);
  try {
    const rawV2 = localStorage.getItem(key);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<AppData>;
      return syncAcJobServiceStatuses(parseAppData(parsed));
    }

    // A global cache has no proven shop owner. Never adopt it into a shop or
    // template demo (and subsequently sync it to that shop). Keep both legacy
    // keys intact for explicit recovery; existing tenant caches still load above.
    if (orgId ?? activeOrgId) return emptyAppData();

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
  const scopedOrgId = orgId ?? activeOrgId;
  localStorage.setItem(storageKeyV2(orgId), JSON.stringify(data));
  touchLocalSyncWatermark(scopedOrgId);
}

export function clearAppData(orgId?: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKeyV2(orgId));
  if (!orgId && !activeOrgId) {
    localStorage.removeItem(STORAGE_KEY_V2);
    localStorage.removeItem(STORAGE_KEY_V1);
  }
}
