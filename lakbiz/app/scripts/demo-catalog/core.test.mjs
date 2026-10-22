import { describe, expect, it } from "vitest";
import {
  classifyRetailProduct,
  classifySpcProduct,
  exactMediVerifyMatch,
  parseHealthguardProducts,
  parseMediVerifyResults,
  parseSparCollectionProducts,
  parseSpcDosageForm,
  parseSpcRows,
  stableDemoId,
  syntheticDemoCost,
  toNormalizedDemoProduct,
} from "./core.mjs";

describe("Sri Lanka demo catalog normalization", () => {
  it("parses current SPC table order without inventing registration fields", () => {
    const html = `
      <table><tr><th>Item Code</th><th>Description</th><th>Unit</th><th>Supplier</th><th>W/S</th><th>Retail</th></tr>
      <tr><td>1201011015</td><td>AMLODIPINE TAB 5MG (10X10)USP</td><td>100T</td><td>ZYDUS</td><td>207.00</td><td>238.00</td><td></td></tr></table>`;
    const [row] = parseSpcRows(html);
    expect(row.sourceProductId).toBe("1201011015");
    expect(row.unit).toBe("100T");
    expect(row.supplier).toBe("ZYDUS");
    expect(row.wholesalePrice).toBe(207);
    expect(row.retailPrice).toBe(238);
    const normalized = toNormalizedDemoProduct(row, "pharmacy", "2026-08-23T00:00:00.000Z");
    expect(normalized.costSource).toBe("spc_wholesale");
    expect(normalized.registrationNumber).toBeNull();
    expect(normalized.productKind).toBe("medicine");
    expect(normalized.dosageForm).toBe("Tablet");
    expect(normalized.subcategory).toBe("Tablets");
  });

  it("uses only explicit SPC dosage-form words for neutral medicine subcategories", () => {
    expect(parseSpcDosageForm("AMOXYCILLIN CAP 500MG BP")).toEqual({ dosageForm: "Capsule", subcategory: "Capsules" });
    expect(parseSpcDosageForm("CEFTRIAXONE INJ 1G")).toEqual({ dosageForm: "Injection", subcategory: "Injections" });
    expect(parseSpcDosageForm("BETAMETH CREAM 0.1%")).toEqual({ dosageForm: "Topical", subcategory: "Creams, Ointments & Gels" });
    expect(parseSpcDosageForm("ANAESTHETIC ETHER B.P.")).toEqual({ dosageForm: null, subcategory: "Other Medicines" });
  });

  it("keeps deterministic IDs and clearly synthetic cost separate from factual retail price", () => {
    expect(stableDemoId("grocery", "spar2u", "abc")).toBe(stableDemoId("grocery", "spar2u", "abc"));
    expect(syntheticDemoCost(1000, "abc")).toBeGreaterThan(700);
    expect(syntheticDemoCost(1000, "abc")).toBeLessThan(900);
    const product = toNormalizedDemoProduct({
      source: "spar2u",
      sourceUrl: "https://spar2u.lk/products/example",
      sourceProductId: "example",
      productName: "MUNCHEE Milk Short Cake, 200g",
      retailPrice: 250,
      unit: "pack",
    }, "grocery", "2026-08-23T00:00:00.000Z");
    expect(product.sellPrice).toBe(250);
    expect(product.costSource).toBe("synthetic_demo");
    expect(product.category).toBe("Biscuits & Crackers");
  });

  it("parses SPAR public product anchors and prices", () => {
    const html = `<div class="card"><a href="/products/7-up-1-5l">7 UP, 1.5l</a><span>Rs 420.00</span></div>`;
    const [row] = parseSparCollectionProducts(html, "https://spar2u.lk/collections/all?page=1");
    expect(row.sourceProductId).toBe("7-up-1-5l");
    expect(row.retailPrice).toBe(420);
    expect(row.productName).toBe("7 UP, 1.5l");
  });

  it("parses Healthguard public product cards without copying descriptions", () => {
    const html = `<li class="item product product-item"><a class="product-item-link" href="https://www.healthguard.lk/b-well-bpm">B WELL DIGITAL BPM MED 53</a><span class="price-wrapper" data-price-amount="22200"><span class="price">LKR22,200.00</span></span></li>`;
    const [row] = parseHealthguardProducts(html, "https://www.healthguard.lk/all-products/medical-devices");
    expect(row.productName).toBe("B WELL DIGITAL BPM MED 53");
    expect(row.retailPrice).toBe(22200);
    expect(row.sourceProductId).toBe("b-well-bpm");
  });

  it("only applies MediVerify regulatory data on a unique exact brand match", () => {
    const html = `<h4>Name: AMLODIPINE BESYLATE TABLETS USP 5MG</h4><div>Brand: AMLODEP 5<br>Dosage Form: TABLET<br>Pack Type: BLISTER<br>Pack Size: 3X10'S<br>Manufacturer: ARISTO PHARMACEUTICALS (PVT) LTD<br>Made in INDIA<br>Local Agent: VIV PHARMA (PVT) LTD<br>Registration Number: M014746<br>Registration Date: 15-Aug-23<br>Validity Period: Full<br>Schedule: IIB</div>`;
    const parsed = parseMediVerifyResults(html, "https://mediverify.lk/search/similar/?query=AMLODEP%205");
    const match = exactMediVerifyMatch({ productName: "AMLODIPINE TAB 5MG (AMLODEP 5)(3X10)" }, parsed);
    expect(match?.registrationNumber).toBe("M014746");
    expect(match?.schedule).toBe("IIB");
    expect(exactMediVerifyMatch({ productName: "AMLODIPINE TAB 5MG" }, parsed)).toBeNull();
  });

  it("conservatively separates devices/supplies from medicines", () => {
    expect(classifySpcProduct("DISP HYPOD NEEDLE 21G").productKind).toBe("medical_supply");
    expect(classifySpcProduct("AMOXYCILLIN CAP 500MG")).toMatchObject({
      productKind: "medicine",
      subcategory: "Capsules",
      dosageForm: "Capsule",
    });
  });

  it("prioritizes grocery personal-care and household identity over broad food tokens", () => {
    expect(classifyRetailProduct("4 EVER Venivel Face Wash Whitening, 100ml", "grocery")).toMatchObject({ category: "Personal Care" });
    expect(classifyRetailProduct("4 EVER Aloe Vera Gel 90%, 100g", "grocery")).toMatchObject({ category: "Personal Care" });
    expect(classifyRetailProduct("Tea Tree Face Wash, 100ml", "grocery")).toMatchObject({ category: "Personal Care" });
    expect(classifyRetailProduct("Herbal Hair Oil, 200ml", "grocery")).toMatchObject({ category: "Personal Care" });
    expect(classifyRetailProduct("Comfort Lily Fresh Fabric Conditioner, 860ml", "grocery")).toMatchObject({ category: "Cleaning" });
    expect(classifyRetailProduct("Coconut Cooking Oil, 1L", "grocery")).toMatchObject({ category: "Oil & Fats" });
    expect(classifyRetailProduct("Ceylon Tea, 100g", "grocery")).toMatchObject({ category: "Water & Soft Drinks" });
  });
});