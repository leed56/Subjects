"use client";

import { parseNotificationSettings } from "@/lib/messaging/settings";
import type { NotificationSettings } from "@/lib/messaging/types";
import { createBrowserClient } from "./client";

export { parseNotificationSettings as parseOrgNotificationSettings };

export async function fetchOrgNotificationSettings(
  organizationId: string,
): Promise<NotificationSettings | null> {
  const supabase = createBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select("notification_settings")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return parseNotificationSettings(data.notification_settings);
}

export async function saveOrgNotificationSettings(
  organizationId: string,
  settings: NotificationSettings,
): Promise<string | null> {
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const { error } = await supabase
    .from("organizations")
    .update({ notification_settings: settings })
    .eq("id", organizationId);

  return error?.message ?? null;
}
