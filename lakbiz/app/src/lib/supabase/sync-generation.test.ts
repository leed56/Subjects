import { describe, expect, it } from "vitest";
import { isSameSyncGeneration, isValidSyncGeneration } from "./sync-generation";

describe("sync generation validation", () => {
  it.each([0, 1, 42, Number.MAX_SAFE_INTEGER])("accepts valid generation %s", (value) => {
    expect(isValidSyncGeneration(value)).toBe(true);
  });

  it.each([null, undefined, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "4", {}, []])(
    "rejects invalid generation %#",
    (value) => {
      expect(isValidSyncGeneration(value)).toBe(false);
    },
  );

  it("considers only equal, verified generations stable", () => {
    expect(isSameSyncGeneration(7, 7)).toBe(true);
    expect(isSameSyncGeneration(7, 8)).toBe(false);
    expect(isSameSyncGeneration(-1, -1)).toBe(false);
    expect(isSameSyncGeneration(7, -1)).toBe(false);
  });
});
