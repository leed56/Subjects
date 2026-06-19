"use client";

import { composeMessage } from "@/lib/messaging/compose";
import { loadNotificationSettings } from "@/lib/messaging/settings";
import type { NotificationSettings } from "@/lib/messaging/types";
import type { BusinessInfo } from "@/lib/invoice";
import type { ACJob } from "@/lib/store/types";

export async function sendServiceCompleteSms(
  job: ACJob,
  business: BusinessInfo,
  nextDueDate: string,
  intervalDays: number,
  settings: NotificationSettings = loadNotificationSettings(),
): Promise<{ ok: boolean; error?: string }> {
  if (!settings.autoSendOnServiceComplete || !job.phone?.trim()) {
    return { ok: false, error: "SMS disabled or no customer phone" };
  }

  try {
    const message = composeMessage(
      "job_service_complete_next",
      settings.preferredLanguage,
      {
        customerName: job.customerName,
        shopName: business.name,
        shopPhone: business.phone ? `Tel: ${business.phone}` : "",
        jobNo: job.jobNo,
        address: job.address,
        description: job.description,
        serviceDueDate: nextDueDate,
        intervalDays: String(intervalDays),
        quotedAmount: "",
        depositAmount: "",
        balance: "",
        scheduledDate: "",
      },
    );

    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: job.phone,
        message,
        templateId: "job_service_complete_next",
        contextType: "ac_job",
        contextId: job.id,
        recipientName: job.customerName,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "Send failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
