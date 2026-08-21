import type { SectorId } from "@/lib/types";
import type { PlanFeatures } from "@/lib/subscription/types";

/**
 * Client mirror of authoritative public.sector_modules. Keep this table and
 * the Supabase seed migration in lockstep: the UI may hide a module, but RLS
 * is the actual security boundary.
 */
const SECTOR_FEATURES: Record<SectorId, PlanFeatures> = {
  grocery: {
    sales: true,
    stock: true,
    bills: true,
    customers: true,
    suppliers: true,
    banking: false,
    ac_jobs: false,
    vehicles: false,
    export: true,
    offline: false,
    bulk_messaging: true,
  },
  pharmacy: {
    sales: true,
    stock: true,
    bills: true,
    customers: true,
    suppliers: true,
    banking: true,
    ac_jobs: false,
    vehicles: false,
    export: true,
    offline: false,
    bulk_messaging: true,
  },
  electronics: {
    sales: true,
    stock: true,
    bills: true,
    customers: true,
    suppliers: true,
    banking: true,
    ac_jobs: false,
    vehicles: false,
    export: true,
    offline: false,
    bulk_messaging: true,
  },
  mobile_shop: {
    sales: true,
    stock: true,
    bills: true,
    customers: true,
    suppliers: true,
    banking: true,
    ac_jobs: false,
    vehicles: false,
    export: true,
    offline: false,
    bulk_messaging: true,
  },
  electricals: {
    sales: true,
    stock: true,
    bills: true,
    customers: true,
    suppliers: true,
    banking: true,
    ac_jobs: false,
    vehicles: false,
    export: true,
    offline: false,
    bulk_messaging: true,
  },
  spare_parts: {
    sales: true,
    stock: true,
    bills: true,
    customers: true,
    suppliers: true,
    banking: true,
    ac_jobs: false,
    vehicles: false,
    export: true,
    offline: false,
    bulk_messaging: true,
  },
  footwear: {
    sales: true,
    stock: true,
    bills: true,
    customers: true,
    suppliers: true,
    banking: true,
    ac_jobs: false,
    vehicles: false,
    export: true,
    offline: false,
    bulk_messaging: true,
  },
  ac_hvac: {
    sales: true,
    stock: true,
    bills: true,
    customers: true,
    suppliers: true,
    banking: true,
    ac_jobs: true,
    vehicles: false,
    export: true,
    offline: true,
    bulk_messaging: true,
  },
  car_sales: {
    sales: true,
    stock: true,
    bills: true,
    customers: true,
    suppliers: true,
    banking: true,
    ac_jobs: false,
    vehicles: true,
    export: true,
    offline: false,
    bulk_messaging: true,
  },
};

export function sectorFeatures(sectorId: SectorId): PlanFeatures {
  return SECTOR_FEATURES[sectorId] ?? SECTOR_FEATURES.grocery;
}

export function sectorAllowsFeature(
  sectorId: SectorId,
  feature: keyof PlanFeatures,
): boolean {
  return sectorFeatures(sectorId)[feature] ?? false;
}
