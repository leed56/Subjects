import { getPlan } from "./plans";
import type {
  AddonType,
  FeatureKey,
  PlanFeatures,
  SubscriptionState,
} from "./types";

function hasAddon(addons: AddonType[], addon: AddonType): boolean {
  if (addon === "ac_jobs" || addon === "vehicles") {
    return addons.includes(addon) || addons.includes("sector_pack");
  }
  return addons.includes(addon);
}

function effectiveFeatures(
  base: PlanFeatures,
  addons: AddonType[],
): PlanFeatures {
  return {
    ...base,
    ac_jobs: base.ac_jobs || hasAddon(addons, "ac_jobs"),
    vehicles: base.vehicles || hasAddon(addons, "vehicles"),
  };
}

export function canAccess(
  subscription: SubscriptionState,
  feature: FeatureKey,
): boolean {
  const { status, planId, addons } = subscription;

  if (status === "canceled") {
    return feature === "bills"; // view-only billing/export path later
  }

  const readOnly = status === "past_due" || status === "read_only";
  if (readOnly && feature === "write") {
    return false;
  }
  if (readOnly && feature !== "bills" && feature !== "export") {
    // read-only: can view dashboards/lists but not write
    if (feature === "write") return false;
  }

  const plan = getPlan(planId);
  const features = effectiveFeatures(plan.features, addons);

  if (feature === "write") {
    return status === "trialing" || status === "active" || !readOnly;
  }

  return features[feature as keyof PlanFeatures] ?? false;
}

export function isReadOnlyStatus(status: SubscriptionState["status"]): boolean {
  return status === "past_due" || status === "read_only";
}

export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const end = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

/** Map app routes to required features */
export const ROUTE_FEATURES: Record<string, FeatureKey> = {
  "/customers": "customers",
  "/suppliers": "suppliers",
  "/banking": "banking",
  "/jobs": "ac_jobs",
  "/vehicles": "vehicles",
};
