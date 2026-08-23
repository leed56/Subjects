import { describe, expect, it } from "vitest";
import { searchProductReferenceCatalog } from "./product-reference-catalog";

describe("product reference catalogue", () => {
  it.each(["", "   ", "\n\t "])(
    "does not issue a catalogue search for blank input %j",
    async (query) => {
      await expect(searchProductReferenceCatalog(query)).resolves.toEqual([]);
    },
  );
});
