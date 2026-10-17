import { describe, it, expect } from "vitest";
import { parseLedgerAmount, validateJournal } from "./general-ledger";
const accounts = [
  { id: "a", code: "1000", name: "Cash", kind: "asset" },
  { id: "b", code: "3000", name: "Equity", kind: "equity" },
];
describe("general ledger financial input", () => {
  it("parses decimal minor units exactly", () => {
    expect(parseLedgerAmount("0.29")).toBe(29);
    expect(parseLedgerAmount("123.4")).toBe(12340);
  });
  it.each([
    "-1",
    "NaN",
    "Infinity",
    "1.001",
    "1e3",
    "",
    "1,000",
    "1000000000001",
  ])("rejects invalid money %s", (value) =>
    expect(() => parseLedgerAmount(value)).toThrow(),
  );
  it("accepts balanced journals", () =>
    expect(() =>
      validateJournal(
        [
          { accountCode: "1000", debitMinor: 12345, creditMinor: 0 },
          { accountCode: "3000", debitMinor: 0, creditMinor: 12345 },
        ],
        accounts,
      ),
    ).not.toThrow());
  it("rejects imbalance, unknown accounts, mixed sides and fractional units", () => {
    const good = { accountCode: "1000", debitMinor: 100, creditMinor: 0 },
      credit = { accountCode: "3000", debitMinor: 0, creditMinor: 100 };
    for (const bad of [
      { ...good, debitMinor: 101 },
      { ...good, accountCode: "9999" },
      { ...good, creditMinor: 100 },
      { ...good, debitMinor: 99.5 },
    ])
      expect(() => validateJournal([bad, credit], accounts)).toThrow();
  });
});
