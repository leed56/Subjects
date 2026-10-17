import { describe, expect, it } from "vitest";
import { validateProductDraft } from "./product-form-validation";

describe("product form validation", () => {
  it("requires a meaningful item name", () => {
    expect(validateProductDraft({ name: "   ", buyPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 0 })).toEqual({ name: "required" });
  });

  it("accepts zero values because pricing and opening stock can be completed later", () => {
    expect(validateProductDraft({ name: "Cotton roll", buyPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 0 })).toEqual({});
  });

  it("rejects negative and non-finite quantities or prices", () => {
    expect(validateProductDraft({ name: "Item", buyPrice: -1, sellPrice: Number.NaN, stockQty: -2, reorderLevel: Number.POSITIVE_INFINITY })).toEqual({
      buyPrice: "non_negative_number",
      sellPrice: "non_negative_number",
      stockQty: "non_negative_number",
      reorderLevel: "non_negative_number",
    });
  });
});
