import { describe, it, expect } from "vitest";
import { initialsFor, formatLkrCompact } from "./format";

/**
 * Global premium UI phase, Part 4/9 — the avatar-initials helper used by
 * Sidebar/MobileNav's account block (and reused by Dashboard's "Teams
 * Today" in a later stage). Real data only: no fabricated name, honest
 * "?" when there's truly nothing to derive from.
 */
describe("initialsFor", () => {
  it("takes the first letter of up to two words in name", () => {
    expect(initialsFor("LakBiz Cooling")).toBe("LC");
    expect(initialsFor("Nimal")).toBe("N");
    expect(initialsFor("Nimal Perera Silva")).toBe("NP"); // only the first two words
  });

  it("falls back to the first letter of the fallback when name is empty/missing", () => {
    expect(initialsFor("", "owner@lakbiz.lk")).toBe("O");
    expect(initialsFor(undefined, "owner@lakbiz.lk")).toBe("O");
    expect(initialsFor(null, "owner@lakbiz.lk")).toBe("O");
    expect(initialsFor("   ", "owner@lakbiz.lk")).toBe("O"); // whitespace-only name
  });

  it("returns a plain '?' — never a fabricated initial — when nothing is available", () => {
    expect(initialsFor(null, null)).toBe("?");
    expect(initialsFor(undefined, undefined)).toBe("?");
    expect(initialsFor("", "")).toBe("?");
  });

  it("uppercases the derived letters regardless of input case", () => {
    expect(initialsFor("lakbiz cooling")).toBe("LC");
    expect(initialsFor("", "owner@lakbiz.lk")).toBe("O");
  });
});

/**
 * Pharmacy dashboard audit — KPI cards that render a currency value inside
 * a fixed-width `truncate` card (e.g. "Stock cost value") were getting
 * clipped mid-digit for large owner-only totals ("Rs. 43,676,0…"). This
 * abbreviated formatter is the fix; callers pair it with the full
 * formatLkr() string as a title/tooltip so the exact figure is never lost,
 * only shortened on-screen.
 */
describe("formatLkrCompact", () => {
  it("abbreviates large values with a magnitude suffix", () => {
    expect(formatLkrCompact(43_676_012)).toBe("Rs. 43.7M");
    expect(formatLkrCompact(1_235_498)).toBe("Rs. 1.2M");
    expect(formatLkrCompact(950_000)).toBe("Rs. 950K");
  });

  it("leaves small values unabbreviated", () => {
    expect(formatLkrCompact(0)).toBe("Rs. 0");
    expect(formatLkrCompact(499)).toBe("Rs. 499");
  });
});
