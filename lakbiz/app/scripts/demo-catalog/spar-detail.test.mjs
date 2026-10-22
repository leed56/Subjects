import { describe, expect, it } from "vitest";
import { needsSparTitleHydration, parseSparProductTitle } from "./spar-detail.mjs";

describe("SPAR product-title hydration", () => {
  it("extracts the full factual h1 without descriptions", () => {
    const html = `<html><head><title>4 EVER Venivel Face Wash Whitening, 100ml – SPAR2U Sri Lanka</title></head><body><h1>4 EVER Venivel Face Wash Whitening, 100ml</h1><p>Long marketing description not retained.</p></body></html>`;
    expect(parseSparProductTitle(html)).toBe("4 EVER Venivel Face Wash Whitening, 100ml");
  });

  it("uses og:title as a safe fallback and strips the store suffix", () => {
    const html = `<meta property="og:title" content="AHMAD TEA English Breakfast, 200g – SPAR2U Sri Lanka">`;
    expect(parseSparProductTitle(html)).toBe("AHMAD TEA English Breakfast, 200g");
  });

  it("hydrates only truncated public SPAR product URLs", () => {
    expect(needsSparTitleHydration({ source: "spar2u", productName: "AHMAD TEA...", sourceUrl: "https://spar2u.lk/products/ahmad-tea" })).toBe(true);
    expect(needsSparTitleHydration({ source: "spar2u", productName: "AHMAD TEA 200g", sourceUrl: "https://spar2u.lk/products/ahmad-tea" })).toBe(false);
    expect(needsSparTitleHydration({ source: "healthguard", productName: "THING...", sourceUrl: "https://www.healthguard.lk/thing" })).toBe(false);
  });
});
