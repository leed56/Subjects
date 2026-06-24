import type { SupabaseClient } from "@supabase/supabase-js";

import { getPlan } from "@/lib/subscription/plans";
import type { PlanId } from "@/lib/subscription/types";

export function planAllowsBulkMessaging(planId: string | null | undefined): boolean {
  if (planId !== "starter" && planId !== "business" && planId !== "pro") {
    return false;
  }
  return getPlan(planId).features.bulk_messaging;
}

async function subscriptionAllowsBulkMessaging(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, status")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!sub) return false;
  if (sub.status !== "trialing" && sub.status !== "active") return false;
  return planAllowsBulkMessaging(sub.plan_id as PlanId);
}

export async function orgAllowsBulkMessaging(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("org_has_module", {
    org_id: organizationId,
    module_key: "bulk_messaging",
  });

  if (!error && data === true) {
    return true;
  }

  // RPC false or unavailable — align with app plan matrix (Business/Pro) when subscription is active.
  return subscriptionAllowsBulkMessaging(supabase, organizationId);
}
