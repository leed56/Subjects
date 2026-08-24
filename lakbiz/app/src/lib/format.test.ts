import { describe, it, expect } from "vitest";
import { initialsFor } from "./format";

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
