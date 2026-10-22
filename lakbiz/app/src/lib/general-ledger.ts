export type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  kind: string;
};
export type JournalInputLine = {
  accountCode: string;
  debitMinor: number;
  creditMinor: number;
};
export type TrialBalanceRow = LedgerAccount & {
  debitMinor: number;
  creditMinor: number;
};

/** Decimal input is parsed exactly; never silently round a financial entry. */
export function parseLedgerAmount(value: string): number {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a positive amount with at most two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > 100000000000000)
    throw new Error("Amount is too large.");
  return minor;
}
export function validateJournal(
  lines: JournalInputLine[],
  accounts: LedgerAccount[],
): void {
  if (lines.length < 2 || lines.length > 200)
    throw new Error("Use two to 200 journal lines.");
  const codes = new Set(accounts.map((a) => a.code));
  let debit = 0,
    credit = 0;
  for (const line of lines) {
    if (!codes.has(line.accountCode))
      throw new Error("Choose a valid account.");
    if (
      ![line.debitMinor, line.creditMinor].every(
        (n) => Number.isSafeInteger(n) && n >= 0 && n <= 100000000000000,
      )
    )
      throw new Error("Invalid journal amount.");
    if (!(
      (line.debitMinor > 0 && line.creditMinor === 0) ||
      (line.creditMinor > 0 && line.debitMinor === 0)
    ))
      throw new Error("Each line needs either a debit or a credit.");
    debit += line.debitMinor;
    credit += line.creditMinor;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit))
      throw new Error("Journal total is too large.");
  }
  if (debit !== credit) throw new Error("Debits and credits must balance.");
}
