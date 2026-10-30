/**
 * Keep cloud balances for accounts that already exist. A full snapshot may
 * come from an offline device and must not replace a newer bank balance.
 * New accounts retain their supplied opening balance.
 */
export function preserveExistingBankBalances<
  T extends { id: string; balance: number },
  R extends { id: string; balance: unknown },
>(accounts: T[], existingRows: R[]): T[] {
  const existingBalances = new Map(
    existingRows.map((row) => [row.id, Number(row.balance)]),
  );
  return accounts.map((account) => {
    const balance = existingBalances.get(account.id);
    return balance === undefined || !Number.isFinite(balance)
      ? account
      : { ...account, balance };
  });
}

/**
 * Preserve the cloud payable balance for suppliers already present in the
 * cloud. Offline snapshots may contain an older derived balance.
 */
export function preserveExistingSupplierBalances<
  T extends { id: string; payableBalance: number },
  R extends { id: string; payable_balance: unknown },
>(suppliers: T[], existingRows: R[]): T[] {
  const existingBalances = new Map(
    existingRows.map((row) => [row.id, Number(row.payable_balance)]),
  );
  return suppliers.map((supplier) => {
    const balance = existingBalances.get(supplier.id);
    return balance === undefined || !Number.isFinite(balance)
      ? supplier
      : { ...supplier, payableBalance: balance };
  });
}
/**
 * Preserve the authoritative contractor payable balance when syncing an
 * offline snapshot. The masked contractors view returns zero to members
 * without financial visibility; its write trigger independently preserves
 * the underlying balance for those members.
 */
export function preserveExistingContractorBalances<
  T extends { id: string; payableBalance: number },
  R extends { id: string; payable_balance: unknown },
>(contractors: T[], existingRows: R[]): T[] {
  const existingBalances = new Map(
    existingRows.map((row) => [row.id, Number(row.payable_balance)]),
  );
  return contractors.map((contractor) => {
    const balance = existingBalances.get(contractor.id);
    return balance === undefined || !Number.isFinite(balance)
      ? contractor
      : { ...contractor, payableBalance: balance };
  });
}

/** Remove a derived customer balance from payment-related detail snapshots. */
export function omitCustomerCreditBalance<T extends { credit_balance?: unknown }>(
  rows: T[],
): Omit<T, "credit_balance">[] {
  return rows.map((row) => {
    const safeRow = { ...row };
    delete safeRow.credit_balance;
    return safeRow;
  });
}
