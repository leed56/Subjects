"use client";

import { createBrowserClient } from "./client";

export type ProductReferenceSuggestion = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  category: string | null;
  source: string | null;
  sourceUrl: string | null;
  packSize: string | null;
  brand: string | null;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
  manufacturingCountry: string | null;
  regulatoryRegistrationNumber: string | null;
  regulatorySource: string | null;
  regulatorySourceUrl: string | null;
};

export async function searchProductReferenceCatalog(
  query: string,
  limit = 12,
): Promise<ProductReferenceSuggestion[]> {
  const term = query.trim();
  if (!term) return [];

  const supabase = createBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("search_product_reference_catalog", {
    p_query: term,
    p_limit: limit,
  });

  if (error) {
    console.warn("[product-reference-catalog] search failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    sku: row.sku ? String(row.sku) : null,
    unit: row.unit ? String(row.unit) : null,
    category: row.category ? String(row.category) : null,
    source: row.source ? String(row.source) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    packSize: row.pack_size ? String(row.pack_size) : null,
    brand: row.brand ? String(row.brand) : null,
    genericName: row.generic_name ? String(row.generic_name) : null,
    strength: row.strength ? String(row.strength) : null,
    dosageForm: row.dosage_form ? String(row.dosage_form) : null,
    manufacturer: row.manufacturer ? String(row.manufacturer) : null,
    manufacturingCountry: row.manufacturing_country
      ? String(row.manufacturing_country)
      : null,
    regulatoryRegistrationNumber: row.regulatory_registration_number
      ? String(row.regulatory_registration_number)
      : null,
    regulatorySource: row.regulatory_source ? String(row.regulatory_source) : null,
    regulatorySourceUrl: row.regulatory_source_url
      ? String(row.regulatory_source_url)
      : null,
  }));
}
