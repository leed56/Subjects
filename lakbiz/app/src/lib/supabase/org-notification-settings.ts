"use client";

import { parseNotificationSettings } from "@/lib/messaging/settings";
import { toShopNotificationPayload } from "@/lib/messaging/platform-policy";
import type { NotificationSettings } from "@/lib/messaging/types";

export { parseNotificationSettings as parseOrgNotificationSettings };

export async function fetchOrgNotificationSettings(
  organizationId: string,
): Promise<NotificationSettings | null> {
  if (!organizationId) return null;
  try {
    const res = await fetch("/api/settings/notifications", { credentials: "same-origin" });
    if (res.ok) {
      const json = (await res.json()) as { ok?: boolean; settings?: NotificationSettings };
      if (json.ok && json.settings) return json.settings;
    }
  } catch {
    /* Keep local preferences; retry through the authorized API later. */
  }
  return null;
}

export async function saveOrgNotificationSettings(
  organizationId: string,
  settings: NotificationSettings,
): Promise<string | null> {
  if (!organizationId) return "No shop found";
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
    return json.error ?? "Unable to save notification settings.";
  } catch {
    return "Unable to save notification settings. Check your connection and retry.";
  }
}
