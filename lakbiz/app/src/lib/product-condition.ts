/** New vs used inventory lane (Phase A). */
export type ProductCondition = "new" | "used";

export function parseProductCondition(value: unknown): ProductCondition {
  return value === "used" ? "used" : "new";
}

export function conditionI18nKey(condition: ProductCondition): "stock.condition_new" | "stock.condition_used" {
  return condition === "used" ? "stock.condition_used" : "stock.condition_new";
}
