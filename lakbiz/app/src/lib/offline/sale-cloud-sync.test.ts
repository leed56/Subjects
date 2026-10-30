import { describe, expect, it, vi } from "vitest";
import { captureSaleCloudSyncError } from "./sale-cloud-sync";

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
