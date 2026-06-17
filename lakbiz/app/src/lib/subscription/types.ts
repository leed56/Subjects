import type { SectorId } from "@/lib/types";

export type PlanId = "starter" | "business" | "pro";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "read_only";

export type BillingCycle = "monthly" | "annual";

export type AddonType =
  | "extra_user"
  | "extra_branch"
  | "ac_jobs"
  | "vehicles"
  | "sector_pack";

export type OrgRole = "owner" | "manager" | "cashier" | "technician";

export type FeatureKey =
  | "sales"
  | "stock"
  | "bills"
  | "customers"
  | "suppliers"
  | "banking"
  | "ac_jobs"
  | "vehicles"
  | "export"
  | "offline"
  | "write"; // any create/update/delete

export interface PlanFeatures {
  sales: boolean;
  stock: boolean;
  bills: boolean;
  customers: boolean;
  suppliers: boolean;
  banking: boolean;
  ac_jobs: boolean;
  vehicles: boolean;
  export: boolean;
  offline: boolean;
}

export interface SubscriptionState {
  planId: PlanId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  addons: AddonType[];
  isDemo: boolean;
}

export interface OrganizationState {
  id: string | null;
  name: string;
  sector: SectorId;
  isAuthenticated: boolean;
}

export interface SubscriptionContextValue {
  org: OrganizationState;
  subscription: SubscriptionState;
  can: (feature: FeatureKey) => boolean;
  daysLeftInTrial: number | null;
  isReadOnly: boolean;
  setDemoPlan: (planId: PlanId) => void;
  setDemoBillingCycle: (cycle: BillingCycle) => void;
  refreshOrg: () => Promise<boolean>;
}
