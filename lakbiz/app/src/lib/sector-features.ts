import type { SectorId } from "@/lib/types";
import type { PlanFeatures } from "@/lib/subscription/types";

/** Module flags per sector — matches business_templates seed in Supabase. */
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
