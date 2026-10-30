import { describe, expect, it } from "vitest";
import { captureCloudPushResult } from "./cloud-push-result";

describe("captureCloudPushResult", () => {
  it("preserves a successful push result", async () => {
    await expect(
      captureCloudPushResult(async () => ({ err: null, conflict: false })),
    ).resolves.toEqual({ err: null, conflict: false });
  });

  it("preserves a conflict result without treating it as an error", async () => {
    await expect(
      captureCloudPushResult(async () => ({ err: null, conflict: true })),
    ).resolves.toEqual({ err: null, conflict: true });
  });

  it("converts thrown network errors into retryable results", async () => {
    await expect(
      captureCloudPushResult(async () => {
        throw new Error("connection reset");
      }),
    ).resolves.toEqual({ err: "connection reset", conflict: false });
  });

  it("uses a safe message for non-Error thrown values", async () => {
    await expect(
      captureCloudPushResult(async () => {
        throw "unexpected";
      }),
    ).resolves.toEqual({ err: "Cloud sync failed", conflict: false });
  });
});
