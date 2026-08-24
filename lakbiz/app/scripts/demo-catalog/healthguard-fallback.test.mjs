import { describe, expect, it } from "vitest";
import {
  parseHealthguardListingText,
  pharmacyRetailCandidatesFromSpar,
} from "./healthguard-fallback.mjs";

describe("Healthguard / pharmacy retail acquisition fallbacks", () => {
  it("extracts only a nearby product name and public LKR price from listing text", () => {
    const html = `
      <div class="toolbar">Sort By</div>
      <div class="product-card">
        <strong>B WELL DIGITAL BPM MED 53</strong>
        <span>(80)</span>
        <span>LKR22,200.00</span>
        <button>Add to Cart</button>
      </div>
      <div class="product-card">
        <strong>KODOMO TOOTHPASTE WITH TOOTHBRUSH</strong>
        <span>(20)</span>
        <span>LKR645.00</span>
      </div>`;

    const rows = parseHealthguardListingText(
      html,
      "https://www.healthguard.lk/all-products/medical-devices?p=1",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      source: "healthguard",
      productName: "B WELL DIGITAL BPM MED 53",
      retailPrice: 22200,
      sourceIdentityQuality: "listing_name_hash",
    });
    expect(rows[1].productName).toBe("KODOMO TOOTHPASTE WITH TOOTHBRUSH");
    expect(rows[1].retailPrice).toBe(645);
  });

  it("selects modern pharmacy convenience/personal-care candidates from SPAR without inventing products", () => {
    const rows = pharmacyRetailCandidatesFromSpar([
      { productName: "Sensodyne Toothpaste 70g", sourceProductId: "tooth", source: "spar2u" },
      { productName: "Munchy Biscuits 200g", sourceProductId: "biscuit", source: "spar2u" },
      { productName: "Keeri Samba Rice 5kg", sourceProductId: "rice", source: "spar2u" },
      { productName: "Baby Diapers 24pcs", sourceProductId: "baby", source: "spar2u" },
    ]);

    expect(rows.map((row) => row.sourceProductId)).toEqual(["tooth", "biscuit", "baby"]);
  });
});
