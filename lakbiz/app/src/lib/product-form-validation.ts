export type ProductDraftField = "name" | "buyPrice" | "sellPrice" | "stockQty" | "reorderLevel";
export type ProductDraftError = "required" | "non_negative_number";

export type ProductDraftForValidation = {
  name: string;
  buyPrice: number;
  sellPrice: number;
  stockQty: number;
  reorderLevel?: number;
};

export function validateProductDraft(draft: ProductDraftForValidation): Partial<Record<ProductDraftField, ProductDraftError>> {
  const errors: Partial<Record<ProductDraftField, ProductDraftError>> = {};
  if (!draft.name.trim()) errors.name = "required";
  for (const field of ["buyPrice", "sellPrice", "stockQty", "reorderLevel"] as const) {
    const value = draft[field] ?? 0;
    if (!Number.isFinite(value) || value < 0) errors[field] = "non_negative_number";
  }
  return errors;
}
