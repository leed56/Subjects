import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_PLATFORM_MESSAGING_POLICY } from "./platform-policy";
import { fetchPlatformMessagingPolicy } from "./platform-policy-server";

export async function checkOrgSmsQuota(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const policy = await fetchPlatformMessagingPolicy(supabase);
  const dailyLimit = policy.dailySmsLimitPerOrg;

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const { count, error } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("channel", "api_sms")
    .eq("status", "sent")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error) {
    return { ok: false, error: error.message };
  }

  if ((count ?? 0) >= dailyLimit) {
    return {
      ok: false,
      error: `Daily SMS limit reached (${dailyLimit} per shop). Try again tomorrow.`,
    };
  }

  return { ok: true };
}

/** @deprecated use fetchPlatformMessagingPolicy().dailySmsLimitPerOrg */
export const DAILY_SMS_LIMIT = DEFAULT_PLATFORM_MESSAGING_POLICY.dailySmsLimitPerOrg;
