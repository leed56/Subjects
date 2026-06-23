import type { AppData } from "@/lib/store/types";

/** Redact buy prices, margins, and supplier payables from client state for data_entry. */
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
    supplierPayments: [],
    suppliers: [],
    bankAccounts: [],
    bankTransactions: [],
    bankTransfers: [],
    cheques: [],
    contractorPayments: [],
    vehicles: data.vehicles.map((v) => ({
      ...v,
      purchasePrice: 0,
      reconditionCost: 0,
    })),
  };
}
