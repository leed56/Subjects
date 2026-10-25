import { describe, expect, it } from "vitest";
import {
  groceryCategoryLabel,
  groceryProductLabel,
  groceryProductSearchText,
  groceryUnitLabel,
} from "@/lib/grocery-localization";
import { GROCERY_STARTER_CATALOGUE } from "@/lib/grocery-starter-catalogue";

describe("grocery display localization", () => {
  const banana = {
    name: "Banana",
    sku: "GRC-BAN-001",
    category: "Fruits",
    customFields: { barcode: "2000000000019", unitVariant: "1 kg" },
  };

  it("keeps starter records stable and localizes only their display labels", () => {
    expect(groceryProductLabel(banana, "si")).toBe("කෙසෙල්");
    expect(groceryProductLabel(banana, "ta")).toBe("வாழைப்பழம்");
    expect(groceryProductLabel({ ...banana, sku: "OWNER-001", name: "Amma's bananas" }, "ta")).toBe("Amma's bananas");
    expect(groceryProductLabel({ ...banana, name: "Ambul bananas" }, "ta")).toBe("Ambul bananas");
    expect(groceryProductSearchText({ ...banana, name: "Ambul bananas" })).not.toContain("வாழைப்பழம்");
  });

  it("localizes the shared grocery taxonomy and selling units", () => {
    expect(groceryCategoryLabel("Rice, Flour & Grains", "si")).toBe("සහල්, පිටි සහ වියළි භාණ්ඩ");
    expect(groceryCategoryLabel("Milk & Dairy", "ta")).toBe("பால் பொருட்கள்");
    expect(groceryUnitLabel("10 pack", "si")).toBe("බිත්තර 10 පැකට්ටුව");
    expect(groceryUnitLabel("1 L", "ta")).toBe("1 லிட்டர்");
  });

  it("finds canonical products by English, Sinhala, Tamil, SKU and barcode", () => {
    const index = groceryProductSearchText(banana);
    for (const query of ["banana", "කෙසෙල්", "வாழைப்பழம்", "grc-ban-001", "2000000000019"]) {
      expect(index).toContain(query);
    }
  });

  it("covers every starter item in both local languages without changing its source data", () => {
    const expected = [
      ["Banana", "කෙසෙල්", "வாழைப்பழம்", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Apple", "ඇපල්", "ஆப்பிள்", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Tomato", "තක්කාලි", "தக்காளி", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Potato", "අර්තාපල්", "உருளைக்கிழங்கு", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Red Onion", "රතු ලූනු", "சிவப்பு வெங்காயம்", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Carrot", "කැරට්", "காரட்", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Ginger", "ඉඟුරු", "இஞ்சி", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Green Chilli", "අමු මිරිස්", "பச்சை மிளகாய்", "250 ග්‍රෑම්", "250 கிராம்"],
      ["Chicken", "කුකුල් මස්", "கோழி இறைச்சி", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Bread", "පාන්", "ரொட்டி", "පාන් ගෙඩියක්", "1 ரொட்டி"],
      ["Rice", "සහල්", "அரிசி", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Wheat Flour", "තිරිඟු පිටි", "கோதுமை மா", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Sugar", "සීනි", "சர்க்கரை", "1 කිලෝග්‍රෑම්", "1 கிலோ"],
      ["Coconut", "පොල්", "தேங்காய்", "එකක්", "ஒன்று"],
      ["Eggs", "බිත්තර", "முட்டை", "බිත්තර 10 පැකට්ටුව", "10 முட்டை பொதி"],
      ["Fresh Milk", "නැවුම් කිරි", "புதிய பால்", "1 ලීටර්", "1 லிட்டர்"],
    ] as const;
    expect(GROCERY_STARTER_CATALOGUE).toHaveLength(expected.length);
    for (const [name, sinhala, tamil, sinhalaUnit, tamilUnit] of expected) {
      const product = GROCERY_STARTER_CATALOGUE.find((item) => item.name === name);
      expect(product, name).toBeDefined();
      if (!product) continue;
      expect(groceryProductLabel(product, "en")).toBe(name);
      expect(groceryProductLabel(product, "si")).toBe(sinhala);
      expect(groceryProductLabel(product, "ta")).toBe(tamil);
      const unit = product.customFields?.unitVariant;
      const barcode = product.customFields?.barcode;
      expect(groceryUnitLabel(unit, "si")).toBe(sinhalaUnit);
      expect(groceryUnitLabel(unit, "ta")).toBe(tamilUnit);
      const index = groceryProductSearchText(product);
      for (const search of [name, sinhala, tamil, product.sku, barcode]) {
        expect(index).toContain(String(search).toLocaleLowerCase());
      }
    }
  });
});
