"use client";

import { parseNotificationSettings } from "@/lib/messaging/settings";
import { toShopNotificationPayload } from "@/lib/messaging/platform-policy";
import type { NotificationSettings } from "@/lib/messaging/types";
import { createBrowserClient } from "./client";

export { parseNotificationSettings as parseOrgNotificationSettings };

export async function fetchOrgNotificationSettings(
  organizationId: string,
): Promise<NotificationSettings | null> {
  try {
    const res = await fetch("/api/settings/notifications", { credentials: "same-origin" });
    if (res.ok) {
      const json = (await res.json()) as { ok?: boolean; settings?: NotificationSettings };
      if (json.ok && json.settings) return json.settings;
    }
  } catch {
    /* fall through to direct fetch */
  }

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
  const payload = toShopNotificationPayload(settings);

  try {
    const res = await fetch("/api/settings/notifications", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && json.ok) return null;
    if (json.error) return json.error;
  } catch {
    /* fall through */
  }

  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const { error } = await supabase
    .from("organizations")
    .update({ notification_settings: payload })
    .eq("id", organizationId);

  return error?.message ?? null;
}
