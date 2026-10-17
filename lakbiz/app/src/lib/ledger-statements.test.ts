import { describe, it, expect } from "vitest";
import type { TrialBalanceRow } from "./general-ledger";
import { buildLedgerStatements, statementCsv } from "./ledger-statements";
const row = (
  id: string,
  kind: string,
  debitMinor = 0,
  creditMinor = 0,
): TrialBalanceRow => ({
  id,
  code: id,
  name: id,
  kind,
  debitMinor,
  creditMinor,
});
describe("ledger-only statements", () => {
  it("includes unclosed earnings in equity without creating closing journals", () => {
    const result = buildLedgerStatements([
      row("cash", "asset", 15000),
      row("equity", "equity", 0, 10000),
      row("sales", "income", 0, 8000),
      row("expense", "expense", 3000),
    ]);
    expect(result.profitMinor).toBe(5000);
    expect(result.equityWithEarningsMinor).toBe(15000);
    expect(result.differenceMinor).toBe(0);
  });
  it("represents losses and opposite-side account balances", () => {
    const result = buildLedgerStatements([
      row("cash", "asset", 3000),
      row("overdraft", "asset", 0, 1000),
      row("equity", "equity", 0, 5000),
      row("refund", "income", 1000),
      row("cost", "expense", 2000),
    ]);
    expect(result.incomeMinor).toBe(-1000);
    expect(result.profitMinor).toBe(-3000);
    expect(result.assetMinor).toBe(2000);
    expect(result.differenceMinor).toBe(0);
  });
  it("handles liabilities and zero-balance accounts", () => {
    const result = buildLedgerStatements([
      row("stock", "asset", 1000),
      row("payable", "liability", 0, 1000),
      row("sales", "income"),
    ]);
    expect(result.liabilityMinor).toBe(1000);
    expect(result.income).toHaveLength(1);
    expect(result.differenceMinor).toBe(0);
  });
  it("exposes imbalance rather than fabricating equity", () => {
    expect(
      buildLedgerStatements([row("cash", "asset", 29)]).differenceMinor,
    ).toBe(29);
  });
  it("supports an empty ledger", () => {
    expect(buildLedgerStatements([]).profitMinor).toBe(0);
  });
  it.each([
    row("bad", "other"),
    row("bad", "asset", 1.5),
    row("bad", "asset", -1),
    row("bad", "asset", 1, 1),
    row("bad", "asset", Number.MAX_SAFE_INTEGER + 1),
  ])("rejects malformed balance %j", (value) => {
    expect(() => buildLedgerStatements([value])).toThrow();
  });
  it("rejects duplicate accounts", () => {
    expect(() =>
      buildLedgerStatements([row("same", "asset"), row("same", "asset")]),
    ).toThrow();
  });
  it("rejects unsafe aggregate totals", () => {
    expect(() =>
      buildLedgerStatements([
        row("a", "asset", Number.MAX_SAFE_INTEGER),
        row("b", "asset", 1),
      ]),
    ).toThrow(/precision/);
  });
  it("exports exact cents, negative signs and scope with formula safety", () => {
    const csv = statementCsv([row("=cmd", "income", 29)]);
    expect(csv).toContain('"\'=cmd"');
    expect(csv).toContain('"Net profit / loss","Negative","0.29"');
    expect(csv).toContain("All-time posted accounting journals only");
    expect(csv).toContain("not a statutory statement");
  });
});
