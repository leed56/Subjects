import type { AppData, CustomerProductPrice } from "@/lib/store/types";
import type { Product } from "@/lib/types";

/** Lookup saved wholesale price for a company × product pair. */
export function wholesalePriceFor(
  prices: CustomerProductPrice[],
  customerId: string | undefined,
  productId: string,
): number | undefined {
  if (!customerId) return undefined;
  const row = prices.find(
    (p) => p.customerId === customerId && p.productId === productId,
  );
  return row?.price;
}

/** Count custom wholesale prices configured for a company. */
export function wholesalePriceCount(
  prices: CustomerProductPrice[],
  customerId: string,
): number {
  return prices.filter((p) => p.customerId === customerId).length;
}

/**
 * Resolve POS unit price: manual checkout override → company wholesale → retail.
 */
export function effectiveUnitPrice(
  product: Pick<Product, "id" | "sellPrice">,
  customerId: string | undefined,
  data: Pick<AppData, "customers" | "customerProductPrices">,
  manualOverride?: number,
): number {
  if (manualOverride != null && manualOverride >= 0) return manualOverride;

  const customer = customerId
    ? data.customers.find((c) => c.id === customerId)
    : undefined;
  if (customer?.contactType === "company") {
    const wholesale = wholesalePriceFor(
      data.customerProductPrices,
      customerId,
      product.id,
    );
    if (wholesale != null) return wholesale;
  }

  return product.sellPrice;
}
