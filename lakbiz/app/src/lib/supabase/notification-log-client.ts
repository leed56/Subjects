"use client";

import type { NotificationLogEntry } from "@/lib/messaging/types";
import { createBrowserClient } from "./client";

type LogRow = {
  id: string;
  channel: string;
  template_id: string | null;
  recipient_phone: string;
  recipient_name: string | null;
  message_body: string;
  context_type: string | null;
  context_id: string | null;
  status: string;
  created_at: string;
  provider_ref: string | null;
};

export async function fetchOrgNotificationLog(
  organizationId: string,
  limit = 300,
): Promise<NotificationLogEntry[]> {
  const supabase = createBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("notification_log")
    .select(
      "id, channel, template_id, recipient_phone, recipient_name, message_body, context_type, context_id, status, created_at, provider_ref",
    )
    .eq("organization_id", organizationId)
    .eq("context_type", "ac_job")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as LogRow[]).map((row) => ({
    id: row.id,
    channel:
      row.channel === "api_sms"
        ? "api_sms"
        : row.channel === "sms"
          ? "sms"
          : "whatsapp",
    templateId: (row.template_id ?? "custom") as NotificationLogEntry["templateId"],
    recipientPhone: row.recipient_phone,
    recipientName: row.recipient_name ?? "",
    messageBody: row.message_body,
    contextType: "ac_job",
    contextId: row.context_id ?? undefined,
    sentAt: row.created_at,
    delivery: row.status === "sent" ? "api_sent" : "api_failed",
    providerRef: row.provider_ref ?? undefined,
  }));
}

export function mergeNotificationLogs(
  local: NotificationLogEntry[],
  cloud: NotificationLogEntry[],
): NotificationLogEntry[] {
  const byKey = new Map<string, NotificationLogEntry>();
  for (const entry of [...cloud, ...local]) {
    const key = `${entry.contextId ?? ""}:${entry.templateId}:${entry.sentAt.slice(0, 10)}:${entry.recipientPhone}`;
    if (!byKey.has(key)) byKey.set(key, entry);
  }
  return [...byKey.values()].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
}
