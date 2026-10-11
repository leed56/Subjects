import { describe, expect, it } from "vitest";
import {
  ledgerCsv,
  ledgerDecimal,
  validateLedgerDateRange,
} from "./ledger-report";

describe("ledger reports", () => {
  it("supports unbounded, one-sided and inclusive same-day ranges", () => {
    for (const range of [
      { from: "", to: "" },
      { from: "2026-10-11", to: "" },
      { from: "", to: "2026-10-11" },
      { from: "2024-02-29", to: "2024-02-29" },
    ])
      expect(() => validateLedgerDateRange(range)).not.toThrow();
  });
  it.each([
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "0000-01-01",
    "11/10/2026",
  ])("rejects date %s", (from) => {
    expect(() => validateLedgerDateRange({ from, to: "" })).toThrow();
  });
  it("rejects reversed date bounds", () => {
    expect(() =>
      validateLedgerDateRange({ from: "2026-10-12", to: "2026-10-11" }),
    ).toThrow();
  });
  it("preserves commas, quotes, Unicode and multiline descriptions", () => {
    expect(ledgerCsv([["தமிழ், cash", 'A "quote"\nnext']])).toBe(
      '\uFEFF"தமிழ், cash","A ""quote""\nnext"\r\n',
    );
  });
  it.each(["=SUM(A1)", "+cmd", "-cmd", "@SUM(A1)", " \t=cmd", "\n@cmd"])(
    "neutralizes formula %s",
    (value) => {
      expect(ledgerCsv([[value]])).toContain(`"'${value}"`);
    },
  );
  it("exports minor units exactly", () => {
    expect(ledgerDecimal(29)).toBe("0.29");
    expect(ledgerDecimal(12340)).toBe("123.40");
    expect(ledgerDecimal(0)).toBe("0.00");
    expect(() => ledgerDecimal(1.1)).toThrow();
    expect(() => ledgerDecimal(-1)).toThrow();
  });
});
