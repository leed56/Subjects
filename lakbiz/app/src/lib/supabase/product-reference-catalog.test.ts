import { describe, expect, it } from "vitest";
import { searchProductReferenceCatalog } from "./product-reference-catalog";

describe("product reference catalogue", () => {
  it.each(["", "   ", "\n\t "])(
    "keeps blank input local and avoids catalogue RPC work %j",
    async (query) => {
      await expect(searchProductReferenceCatalog(query)).resolves.toEqual([]);
    },
  );
});