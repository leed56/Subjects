import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_PLATFORM_MESSAGING_POLICY,
  parsePlatformMessagingPolicy,
  type PlatformMessagingPolicy,
} from "./platform-policy";

const SETTINGS_ROW_ID = "default";

export async function fetchPlatformMessagingPolicy(
  supabase: SupabaseClient,
): Promise<PlatformMessagingPolicy> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("messaging_policy")
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();

  if (error || !data?.messaging_policy) {
    return DEFAULT_PLATFORM_MESSAGING_POLICY;
  }

  return parsePlatformMessagingPolicy(data.messaging_policy);
}

export async function savePlatformMessagingPolicy(
  supabase: SupabaseClient,
  policy: PlatformMessagingPolicy,
): Promise<string | null> {
  const parsed = parsePlatformMessagingPolicy(policy);

  const { error } = await supabase.from("platform_settings").upsert(
    {
      id: SETTINGS_ROW_ID,
      messaging_policy: parsed,
    },
    { onConflict: "id" },
  );

  return error?.message ?? null;
}
