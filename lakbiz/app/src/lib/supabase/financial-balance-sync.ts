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

