import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./pagination";

describe("fetchAllPages", () => {
  it("loads beyond 1000 rows when the server returns smaller capped pages", async () => {
    const source = Array.from({ length: 1385 }, (_, index) => index);
    const serverCap = 173;
    const calls: Array<[number, number]> = [];

    const result = await fetchAllPages(async (from, to) => {
      calls.push([from, to]);
      const endExclusive = Math.min(to + 1, from + serverCap, source.length);
      return { data: source.slice(from, endExclusive), error: null };
    }, 500);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1385);
    expect(result.data?.[0]).toBe(0);
    expect(result.data?.at(-1)).toBe(1384);
    expect(calls[1]?.[0]).toBe(173);
  });

  it("loads the 1600-row grocery demo across exact 500-row pages", async () => {
    const source = Array.from({ length: 1600 }, (_, index) => `grocery-${index}`);
    const result = await fetchAllPages(async (from, to) => ({
      data: source.slice(from, Math.min(to + 1, source.length)),
      error: null,
    }), 500);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1600);
    expect(result.data?.at(-1)).toBe("grocery-1599");
  });

  it("terminates with one empty probe when the row count exactly fills pages", async () => {
    const source = Array.from({ length: 1000 }, (_, index) => index);
    const calls: Array<[number, number]> = [];

    const result = await fetchAllPages(async (from, to) => {
      calls.push([from, to]);
      return { data: source.slice(from, to + 1), error: null };
    }, 500);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1000);
    expect(calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
  });

  it("returns an empty collection cleanly", async () => {
    const result = await fetchAllPages(async () => ({ data: [], error: null }));
    expect(result).toEqual({ data: [], error: null });
  });

  it("stops and preserves a page error", async () => {
    let calls = 0;
    const result = await fetchAllPages(async () => {
      calls += 1;
      if (calls === 1) return { data: [1, 2], error: null };
      return { data: null, error: { message: "network" } };
    }, 2);

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("network");
    expect(calls).toBe(2);
  });
});