import type { Product } from "@/lib/types";
import type { AppData } from "@/lib/store/types";

export type SyncConflictResolution = "keep_local" | "use_remote" | "merge";

export type SyncConflictSummary = {
  localOnlySales: number;
  remoteOnlySales: number;
  localOnlyPurchases: number;
  remoteOnlyPurchases: number;
  changedProducts: number;
  localOnlyCustomers: number;
  remoteOnlyCustomers: number;
  localOnlyAcJobs: number;
  remoteOnlyAcJobs: number;
  hasConflict: boolean;
};

function idSet<T extends { id: string }>(rows: T[]): Set<string> {
  return new Set(rows.map((row) => row.id));
}

function countOnlyIn<T extends { id: string }>(left: T[], rightIds: Set<string>): number {
  return left.filter((row) => !rightIds.has(row.id)).length;
}

function productChanged(a: Product, b: Product): boolean {
  return (
    a.stockQty !== b.stockQty ||
    a.sellPrice !== b.sellPrice ||
    a.buyPrice !== b.buyPrice ||
    a.name !== b.name ||
    a.reorderLevel !== b.reorderLevel
  );
}

export function summarizeSyncConflict(
  local: AppData,
  remote: AppData,
): SyncConflictSummary {
  const remoteSaleIds = idSet(remote.sales);
  const localSaleIds = idSet(local.sales);
  const remotePurchaseIds = idSet(remote.purchases);
  const localPurchaseIds = idSet(local.purchases);
  const remoteCustomerIds = idSet(remote.customers);
  const localCustomerIds = idSet(local.customers);
  const remoteAcJobIds = idSet(remote.acJobs);
  const localAcJobIds = idSet(local.acJobs);

  const localOnlySales = countOnlyIn(local.sales, remoteSaleIds);
  const remoteOnlySales = countOnlyIn(remote.sales, localSaleIds);
  const localOnlyPurchases = countOnlyIn(local.purchases, remotePurchaseIds);
  const remoteOnlyPurchases = countOnlyIn(remote.purchases, localPurchaseIds);
  const localOnlyCustomers = countOnlyIn(local.customers, remoteCustomerIds);
  const remoteOnlyCustomers = countOnlyIn(remote.customers, localCustomerIds);
  const localOnlyAcJobs = countOnlyIn(local.acJobs, remoteAcJobIds);
  const remoteOnlyAcJobs = countOnlyIn(remote.acJobs, localAcJobIds);

  const remoteProducts = new Map(remote.products.map((p) => [p.id, p]));
  let changedProducts = 0;
  for (const product of local.products) {
    const other = remoteProducts.get(product.id);
    if (other && productChanged(product, other)) changedProducts += 1;
  }

  const hasConflict =
    (localOnlySales > 0 && remoteOnlySales > 0) ||
    (localOnlyPurchases > 0 && remoteOnlyPurchases > 0) ||
    (localOnlyCustomers > 0 && remoteOnlyCustomers > 0) ||
    (localOnlyAcJobs > 0 && remoteOnlyAcJobs > 0) ||
    changedProducts > 0;

  return {
    localOnlySales,
    remoteOnlySales,
    localOnlyPurchases,
    remoteOnlyPurchases,
    changedProducts,
    localOnlyCustomers,
    remoteOnlyCustomers,
    localOnlyAcJobs,
    remoteOnlyAcJobs,
    hasConflict,
  };
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of remote) byId.set(row.id, row);
  for (const row of local) byId.set(row.id, row);
  return [...byId.values()];
}

function mergeBusiness(local: AppData["business"], remote: AppData["business"]) {
  return {
    ...remote,
    ...local,
    name: local.name || remote.name,
  };
}

/** Union records by id — local wins when the same id exists on both sides. */
export function mergeAppData(local: AppData, remote: AppData): AppData {
  return {
    business: mergeBusiness(local.business, remote.business),
    products: mergeById(local.products, remote.products),
    sales: mergeById(local.sales, remote.sales).sort((a, b) =>
      b.date.localeCompare(a.date),
    ),
    stockLogs: mergeById(local.stockLogs, remote.stockLogs).sort((a, b) =>
      b.date.localeCompare(a.date),
    ),
    customers: mergeById(local.customers, remote.customers),
    customerPayments: mergeById(local.customerPayments, remote.customerPayments).sort(
      (a, b) => b.date.localeCompare(a.date),
    ),
    customerProductPrices: mergeById(
      local.customerProductPrices,
      remote.customerProductPrices,
    ),
    suppliers: mergeById(local.suppliers, remote.suppliers),
    purchases: mergeById(local.purchases, remote.purchases).sort((a, b) =>
      b.date.localeCompare(a.date),
    ),
    supplierPayments: mergeById(local.supplierPayments, remote.supplierPayments).sort(
      (a, b) => b.date.localeCompare(a.date),
    ),
    acJobs: mergeById(local.acJobs, remote.acJobs),
    jobItems: mergeById(local.jobItems, remote.jobItems),
    jobStatusHistory: mergeById(local.jobStatusHistory, remote.jobStatusHistory).sort(
      (a, b) => b.date.localeCompare(a.date),
    ),
    technicians: mergeById(local.technicians, remote.technicians),
    contractors: mergeById(local.contractors, remote.contractors),
    contractorPayments: mergeById(
      local.contractorPayments,
      remote.contractorPayments,
    ).sort((a, b) => b.date.localeCompare(a.date)),
    vehicles: mergeById(local.vehicles, remote.vehicles),
    bankAccounts: mergeById(local.bankAccounts, remote.bankAccounts),
    bankTransactions: mergeById(local.bankTransactions, remote.bankTransactions).sort(
      (a, b) => b.date.localeCompare(a.date),
    ),
    bankTransfers: mergeById(local.bankTransfers, remote.bankTransfers).sort((a, b) =>
      b.date.localeCompare(a.date),
    ),
    cheques: mergeById(local.cheques, remote.cheques),
  };
}

export function hasSyncConflict(local: AppData, remote: AppData): boolean {
  return summarizeSyncConflict(local, remote).hasConflict;
}
