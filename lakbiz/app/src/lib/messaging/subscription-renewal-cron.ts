import type { SupabaseClient } from "@supabase/supabase-js";

import { daysUntilIso } from "@/lib/admin/trial-ops";
import { parseNotificationSettings } from "@/lib/messaging/settings";
import { fetchPlatformMessagingPolicy } from "@/lib/messaging/platform-policy-server";
import { getPlan } from "@/lib/subscription/plans";
import type { PlanId } from "@/lib/subscription/types";

import { composeMessage } from "./compose";
import { sendTextLkSms, isTextLkConfigured } from "./textlk-server";
import type { MessageTemplateId } from "./types";

type OrgRow = {
  id: string;
  name: string;
  phone: string | null;
  notification_settings: unknown;
};

type SubscriptionRow = {
  id: string;
  organization_id: string;
  status: string;
  plan_id: PlanId;
  trial_ends_at: string | null;
  current_period_end: string | null;
  organizations: OrgRow | OrgRow[] | null;
};

export type SubscriptionRenewalCronResult = {
  ok: boolean;
  skippedReason?: string;
  subsScanned: number;
  matched: number;
  sent: number;
  failed: number;
  skippedDuplicate: number;
  skippedNoPhone: number;
  errors: string[];
};

const TEMPLATE_ID: MessageTemplateId = "subscription_renewal_reminder";

function supportContact(): string {
  const phone = process.env.LAKBIZ_SUPPORT_PHONE?.trim();
  if (phone) return `Tel: ${phone}`;
  return "LakBiz support";
}

function renewalEndIso(sub: SubscriptionRow): string | null {
  if (sub.status === "trialing") return sub.trial_ends_at;
  if (sub.status === "active") return sub.current_period_end;
  return sub.trial_ends_at ?? sub.current_period_end;
}

function formatEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function orgFromSub(sub: SubscriptionRow): OrgRow | null {
  const raw = sub.organizations;
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function ownerPhone(org: OrgRow): string | null {
  const settings = parseNotificationSettings(org.notification_settings);
  const phone = (org.phone ?? settings.ownerPhone ?? "").trim();
  return phone || null;
}

async function wasSentWithinRepeatWindow(
  supabase: SupabaseClient,
  organizationId: string,
  subscriptionId: string,
  recipientPhone: string,
  repeatDays: number,
): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - repeatDays);

  const { data } = await supabase
    .from("notification_log")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("context_type", "subscription")
    .eq("context_id", subscriptionId)
    .eq("template_id", TEMPLATE_ID)
    .eq("recipient_phone", recipientPhone)
    .eq("status", "sent")
    .gte("created_at", since.toISOString())
    .limit(1);

  return (data?.length ?? 0) > 0;
}

export async function runSubscriptionRenewalReminders(
  supabase: SupabaseClient,
): Promise<SubscriptionRenewalCronResult> {
  const result: SubscriptionRenewalCronResult = {
    ok: true,
    subsScanned: 0,
    matched: 0,
    sent: 0,
    failed: 0,
    skippedDuplicate: 0,
    skippedNoPhone: 0,
    errors: [],
  };

  if (!isTextLkConfigured()) {
    return {
      ...result,
      ok: false,
      skippedReason: "Text.lk not configured",
    };
  }

  const platformPolicy = await fetchPlatformMessagingPolicy(supabase);

  if (!platformPolicy.subscriptionRenewalCronEnabled) {
    return {
      ...result,
      ok: false,
      skippedReason: "Subscription renewal cron disabled by platform admin",
    };
  }

  const remindDays = platformPolicy.subscriptionRenewalRemindDays;
  if (remindDays.length === 0) {
    return { ...result, ok: false, skippedReason: "No renewal remind days configured" };
  }

  const repeatDays = platformPolicy.serviceDueRepeatDays;

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      organization_id,
      status,
      plan_id,
      trial_ends_at,
      current_period_end,
      organizations ( id, name, phone, notification_settings )
    `,
    )
    .in("status", ["trialing", "active"]);

  if (error) {
    return { ...result, ok: false, errors: [error.message] };
  }

  for (const sub of (subs ?? []) as SubscriptionRow[]) {
    result.subsScanned += 1;
    const org = orgFromSub(sub);
    if (!org) continue;

    const endIso = renewalEndIso(sub);
    if (!endIso) continue;

    const daysLeft = daysUntilIso(endIso);
    if (daysLeft == null || daysLeft < 0) continue;
    if (!remindDays.includes(daysLeft)) continue;

    result.matched += 1;

    const phone = ownerPhone(org);
    if (!phone) {
      result.skippedNoPhone += 1;
      continue;
    }

    if (
      await wasSentWithinRepeatWindow(
        supabase,
        org.id,
        sub.id,
        phone,
        repeatDays,
      )
    ) {
      result.skippedDuplicate += 1;
      continue;
    }

    const settings = parseNotificationSettings(org.notification_settings);
    const locale = settings.preferredLanguage;
    const plan = getPlan(sub.plan_id);
    const planName = locale === "si" ? plan.nameSi : plan.nameEn;
    const isTrial = sub.status === "trialing";
    const message = composeMessage(TEMPLATE_ID, locale, {
      shopName: org.name,
      planName,
      endDate: formatEndDate(endIso),
      daysLeft: String(daysLeft),
      renewalLabel: isTrial ? "trial ends" : "renews",
      renewalLabelSi: isTrial ? "අවසන් වේ" : "අලුත් වේ",
      supportContact: supportContact(),
    });

    const sms = await sendTextLkSms(phone, message);

    if (!sms.ok) {
      result.failed += 1;
      result.errors.push(`${org.name}: ${sms.error ?? "SMS failed"}`);
      await supabase.from("notification_log").insert({
        organization_id: org.id,
        channel: "api_sms",
        template_id: TEMPLATE_ID,
        recipient_phone: phone,
        recipient_name: org.name,
        message_body: message,
        context_type: "subscription",
        context_id: sub.id,
        status: "failed",
      });
      continue;
    }

    result.sent += 1;
    await supabase.from("notification_log").insert({
      organization_id: org.id,
      channel: "api_sms",
      template_id: TEMPLATE_ID,
      recipient_phone: phone,
      recipient_name: org.name,
      message_body: message,
      context_type: "subscription",
      context_id: sub.id,
      status: "sent",
      provider_ref: sms.providerRef ?? null,
    });
  }

  if (result.failed > 0 && result.sent === 0) {
    result.ok = false;
  }

  return result;
}
