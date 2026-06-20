import { sectorAllowsFeature } from "@/lib/sector-features";
import type { SectorId } from "@/lib/types";
import type { AddonType, BillingCycle, PlanFeatures, PlanId, SubscriptionStatus } from "./types";

export interface PlanDefinition {
  id: PlanId;
  nameEn: string;
  nameSi: string;
  priceMonthlyLkr: number;
  priceAnnualLkr: number;
  maxUsers: number;
  maxBranches: number;
  maxProducts: number | null;
  features: PlanFeatures;
  highlight?: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "starter",
    nameEn: "Starter",
    nameSi: "ආරම්භක",
    priceMonthlyLkr: 1490,
    priceAnnualLkr: 14900,
    maxUsers: 1,
    maxBranches: 1,
    maxProducts: 500,
    features: {
      sales: true,
      stock: true,
      bills: true,
      customers: false,
      suppliers: false,
      banking: false,
      ac_jobs: false,
      vehicles: false,
      export: false,
      offline: false,
    },
  },
  {
    id: "business",
    nameEn: "Business",
    nameSi: "ව්‍යාපාර",
    priceMonthlyLkr: 2990,
    priceAnnualLkr: 29900,
    maxUsers: 3,
    maxBranches: 1,
    maxProducts: null,
    highlight: true,
    features: {
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
  },
  {
    id: "pro",
    nameEn: "Pro",
    nameSi: "ප්‍රො",
    priceMonthlyLkr: 4990,
    priceAnnualLkr: 49900,
    maxUsers: 10,
    maxBranches: 3,
    maxProducts: null,
    features: {
      sales: true,
      stock: true,
      bills: true,
      customers: true,
      suppliers: true,
      banking: true,
      ac_jobs: true,
      vehicles: true,
      export: true,
      offline: true,
    },
  },
];

export const ADDONS: {
  id: AddonType;
  nameEn: string;
  nameSi: string;
  priceMonthlyLkr: number;
}[] = [
  { id: "extra_user", nameEn: "Extra user", nameSi: "අමතර පරිශීලක", priceMonthlyLkr: 490 },
  { id: "extra_branch", nameEn: "Extra branch", nameSi: "අමතර ශාඛාව", priceMonthlyLkr: 990 },
  { id: "ac_jobs", nameEn: "AC Jobs module", nameSi: "AC රැකියා", priceMonthlyLkr: 790 },
  { id: "vehicles", nameEn: "Vehicles module", nameSi: "වාහන", priceMonthlyLkr: 790 },
  { id: "sector_pack", nameEn: "AC + Vehicles pack", nameSi: "AC + වාහන", priceMonthlyLkr: 1290 },
];

export const TRIAL_DAYS = 14;
export const GRACE_READ_ONLY_DAYS = 7;

export function getPlan(id: PlanId): PlanDefinition {
  return PLANS.find((p) => p.id === id) ?? PLANS[1];
}

export function formatLkrPrice(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

export function planPrice(
  plan: PlanDefinition,
  cycle: BillingCycle,
): number {
  return cycle === "annual" ? plan.priceAnnualLkr : plan.priceMonthlyLkr;
}

/**
 * Add-ons relevant to a shop's sector + current plan.
 * Hides module add-ons the sector doesn't use (e.g. Vehicles for an AC shop)
 * and ones the current plan already includes.
 */
export function relevantAddons(
  sectorId: SectorId,
  planId: PlanId,
): typeof ADDONS {
  const plan = getPlan(planId);
  return ADDONS.filter((addon) => {
    if (addon.id === "extra_user" || addon.id === "extra_branch") return true;
    if (addon.id === "sector_pack") {
      return (
        sectorAllowsFeature(sectorId, "ac_jobs") &&
        sectorAllowsFeature(sectorId, "vehicles")
      );
    }
    const feature = addon.id as "ac_jobs" | "vehicles";
    return sectorAllowsFeature(sectorId, feature) && !plan.features[feature];
  });
}

export function defaultTrialSubscription(): {
  planId: PlanId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  trialEndsAt: string;
  currentPeriodEnd: string;
  addons: AddonType[];
} {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  const iso = trialEnd.toISOString();
  return {
    planId: "business",
    status: "trialing",
    billingCycle: "monthly",
    trialEndsAt: iso,
    currentPeriodEnd: iso,
    addons: [],
  };
}
