import type { AppData } from "@/lib/store/types";

/**
 * Redact the owner's internal financial data before AppData reaches any
 * non-owner UI. This is defense in depth on top of database RLS/masked views:
 * it also protects local/offline snapshots and prevents a future component
 * from accidentally rendering a hidden field simply because it exists in the
 * shared store shape.
 */
export function stripFinancialData(data: AppData): AppData {
  return {
    ...data,
    products: data.products.map((p) => ({ ...p, buyPrice: 0 })),
    sales: data.sales.map((s) => ({
      ...s,
      profit: 0,
      lines: s.lines.map((l) => ({ ...l, buyPrice: 0 })),
    })),
    purchases: [],
    purchaseOrders: [],
    supplierPayments: [],
    suppliers: [],
    bankAccounts: [],
    bankTransactions: [],
    bankTransfers: [],
    cheques: [],
    acJobs: data.acJobs.map((job) => ({
      ...job,
      quotedAmount: 0,
      depositAmount: 0,
      subcontractCost: undefined,
    })),
    jobItems: data.jobItems.map((item) => ({
      ...item,
      unitPrice: 0,
      lineTotal: 0,
      customerPrice: undefined,
      discount: undefined,
    })),
    technicians: data.technicians.map((technician) => ({
      ...technician,
      hourlyRate: undefined,
    })),
    contractors: data.contractors.map((contractor) => ({
      ...contractor,
      rateAmount: 0,
      payableBalance: 0,
    })),
    contractorPayments: [],
    vehicles: data.vehicles.map((v) => ({
      ...v,
      purchasePrice: 0,
      reconditionCost: 0,
      minPrice: undefined,
    })),
  };
}
