export type LedgerDateRange = { from: string; to: string };

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateLedgerDateRange(range: LedgerDateRange): void {
  if (
    (range.from && !validDate(range.from)) ||
    (range.to && !validDate(range.to))
  )
    throw new Error("Choose valid report dates.");
  if (range.from && range.to && range.from > range.to)
    throw new Error("The start date must not be after the end date.");
}

/** Quote every cell and neutralize spreadsheet formula prefixes in user text. */
export function ledgerCsv(rows: (string | number)[][]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value);
            if (typeof value === "string" && /^[\s\uFEFF]*[=+\-@]/.test(text))
              text = "'" + text;
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n") +
    "\r\n"
  );
}

export function ledgerDecimal(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0)
    throw new Error("Invalid report amount.");
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}
