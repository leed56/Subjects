export type LedgerEntry = { date: string; label: string; amount: number };

/** Merge debit/credit entries chronologically with a running balance. */
export function buildLedger(
  debits: LedgerEntry[],
  credits: LedgerEntry[],
): (LedgerEntry & { balance: number })[] {
  const all = [...debits, ...credits].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  let balance = 0;
  return all.map((e) => {
    balance += e.amount;
    return { ...e, balance };
  });
}
