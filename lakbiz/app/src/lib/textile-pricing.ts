import type { AppData } from "@/lib/store/types";
import type { Product } from "@/lib/types";
import { wholesalePriceFor } from "@/lib/company-pricing";

export type TextileSaleChannel = "retail" | "wholesale";

function numberField(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function textileUnitPrice(input: {
  product: Pick<Product, "id" | "sellPrice" | "customFields">;
  quantity: number;
  channel: TextileSaleChannel;
  customerId?: string;
  data: Pick<AppData, "customers" | "customerProductPrices">;
  manualOverride?: number;
  canOverride?: boolean;
}): { price: number; source: "manual" | "customer" | "wholesale" | "retail" } {
  if (input.canOverride && input.manualOverride != null && input.manualOverride >= 0) {
    return { price: input.manualOverride, source: "manual" };
  }
  const customerPrice = wholesalePriceFor(
    input.data.customerProductPrices,
    input.customerId,
    input.product.id,
  );
  const customer = input.customerId
    ? input.data.customers.find((row) => row.id === input.customerId)
    : undefined;
  if (customer?.contactType === "company" && customerPrice != null) {
    return { price: customerPrice, source: "customer" };
  }
  const wholesalePrice = numberField(input.product.customFields.wholesalePrice);
  const minimum = numberField(input.product.customFields.wholesaleMinQty) ?? 0;
  if (input.channel === "wholesale" && wholesalePrice != null && input.quantity >= minimum) {
    return { price: wholesalePrice, source: "wholesale" };
  }
  return { price: input.product.sellPrice, source: "retail" };
}

