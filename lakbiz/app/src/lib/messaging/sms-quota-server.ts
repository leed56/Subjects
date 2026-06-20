import type { SupabaseClient } from "@supabase/supabase-js";

/** Max outbound API SMS per org per calendar day (UTC). */
export const DAILY_SMS_LIMIT = 100;

export async function checkOrgSmsQuota(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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

  if ((count ?? 0) >= DAILY_SMS_LIMIT) {
    return {
      ok: false,
      error: `Daily SMS limit reached (${DAILY_SMS_LIMIT} per shop). Try again tomorrow.`,
    };
  }

  return { ok: true };
}
