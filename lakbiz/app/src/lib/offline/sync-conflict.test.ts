import { describe, expect, it } from "vitest";
import { emptyAppData } from "@/lib/store/storage";
import { localHasUnsyncedRecordsFromData, mergePullWithLocal } from "./sync-conflict";

describe("offline sync protection", () => {
  it("preserves local-only bank transactions when a cloud generation is newer", () => {
    const local = emptyAppData();
    const remote = emptyAppData();
    local.bankTransactions.push({
      id: "local-bank-txn",
      accountId: "account-1",
      type: "deposit",
      amount: 1250,
      date: "2026-10-30",
    });

    expect(localHasUnsyncedRecordsFromData(local, remote)).toBe(true);
    expect(mergePullWithLocal(local, remote).bankTransactions).toEqual(
      local.bankTransactions,
    );
  });

  it("does not report unsynced records when both snapshots contain the same rows", () => {
    const local = emptyAppData();
    const remote = emptyAppData();
    const transaction = {
      id: "bank-txn-1",
      accountId: "account-1",
      type: "deposit" as const,
      amount: 1250,
      date: "2026-10-30",
    };
    local.bankTransactions.push(transaction);
    remote.bankTransactions.push(transaction);

    expect(localHasUnsyncedRecordsFromData(local, remote)).toBe(false);
  });
});
