import { describe, expect, it, vi } from "vitest";
import {
  captureSaleCloudSyncError,
  selectNewSaleStockLogs,
  omitCustomerCreditBalance,
} from "./sale-cloud-sync";

describe("captureSaleCloudSyncError", () => {
  it("returns null when the cloud save succeeds", async () => {
    await expect(captureSaleCloudSyncError(async () => null)).resolves.toBeNull();
  });

  it("preserves a returned Supabase error", async () => {
    await expect(
      captureSaleCloudSyncError(async () => "permission denied"),
    ).resolves.toBe("permission denied");
  });

  it("converts a thrown network error into a retryable error result", async () => {
    const sync = vi.fn().mockRejectedValue(new Error("network disconnected"));

    await expect(captureSaleCloudSyncError(sync)).resolves.toBe(
      "network disconnected",
    );
    expect(sync).toHaveBeenCalledOnce();
  });

  it("uses a safe message for non-Error thrown values", async () => {
    await expect(
      captureSaleCloudSyncError(async () => {
        throw "unexpected failure";
      }),
    ).resolves.toBe("Cloud sync failed");
  });
});

describe("selectNewSaleStockLogs", () => {
  const logs = [
    { id: "sale-log-1", type: "sale", note: "Bill 12345678" },
    { id: "unrelated-sale-log", type: "sale", note: "Bill 12345678-extra" },
    { id: "manual-log", type: "in", note: "Manual adjustment" },
  ];

  it("selects only exact IDs belonging to this sale", () => {
    expect(selectNewSaleStockLogs(logs, ["sale-log-1"])).toEqual([logs[0]]);
  });

  it("does not fall back to bill text when IDs are missing", () => {
    expect(selectNewSaleStockLogs(logs, [])).toEqual([]);
  });

  it("does not include non-sale movements even if their IDs are supplied", () => {
    expect(selectNewSaleStockLogs(logs, ["manual-log"])).toEqual([]);
  });
});

describe("omitCustomerCreditBalance", () => {
  it("keeps customer details but excludes the stale financial balance", () => {
    expect(omitCustomerCreditBalance([
      { id: "customer-1", name: "Customer", credit_balance: 1250, phone: "0770000000" },
    ])).toEqual([
      { id: "customer-1", name: "Customer", phone: "0770000000" },
    ]);
  });

  it("handles an empty customer list", () => {
    expect(omitCustomerCreditBalance([])).toEqual([]);
  });
});
