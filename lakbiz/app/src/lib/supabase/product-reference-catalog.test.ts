import { describe, expect, it } from "vitest";
import { searchProductReferenceCatalog } from "./product-reference-catalog";

describe("product reference catalogue", () => {
  it("does not issue a catalogue search for blank input", async () => {
    await expect(searchProductReferenceCatalog("   ")).resolves.toEqual([]);
  });
});
