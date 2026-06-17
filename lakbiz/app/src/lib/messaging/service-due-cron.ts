import type { SupabaseClient } from "@supabase/supabase-js";
import { composeMessage } from "./compose";
import { sendFitSms, isFitSmsConfigured } from "./fitsms-server";
import { parseNotificationSettings } from "@/lib/messaging/settings";
import type { NotificationSettings } from "./types";
import type { ACJobStatus } from "@/lib/ac-jobs";
import type { BusinessInfo } from "@/lib/invoice";

type AcJobRow = {
  id: string;
  organization_id: string;
  job_no: string;
  customer_name: string;
  phone: string | null;
  address: string;
  brand: string | null;
  btu: number | null;
  unit_type: string | null;
  unit_count: number;
  description: string;
  quoted_amount: number;
  deposit_amount: number;
  status: string;
  scheduled_date: string | null;
  service_due_date: string | null;
  amc_contract: boolean;
};

type OrgRow = {
  id: string;
  name: string;
  phone: string | null;
  notification_settings: unknown;
};

export type ServiceDueCronResult = {
  ok: boolean;
  skippedReason?: string;
  orgsScanned: number;
  jobsMatched: number;
  sent: number;
  failed: number;
  skippedDuplicate: number;
  skippedNoPhone: number;
  errors: string[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function businessFromOrg(org: OrgRow): BusinessInfo {
  return {
    name: org.name,
    phone: org.phone ?? undefined,
    address: undefined,
    tin: undefined,
    vatRegistered: false,
    quarterStartMonth: 4,
  };
}

function jobFromRow(row: AcJobRow) {
  return {
    id: row.id,
    jobNo: row.job_no,
    date: todayIso(),
    customerName: row.customer_name,
    phone: row.phone ?? undefined,
    address: row.address,
    brand: row.brand ?? undefined,
    btu: row.btu ?? undefined,
    unitType: row.unit_type ?? undefined,
    unitCount: row.unit_count,
    description: row.description,
    quotedAmount: Number(row.quoted_amount),
    depositAmount: Number(row.deposit_amount),
    status: row.status as ACJobStatus,
    scheduledDate: row.scheduled_date ?? undefined,
    serviceDueDate: row.service_due_date ?? undefined,
    amcContract: row.amc_contract,
  };
}

async function wasRecentlySent(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string,
  repeatDays: number,
): Promise<boolean> {
  const since = addDays(todayIso(), -repeatDays);
  const { data } = await supabase
    .from("notification_log")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("context_type", "ac_job")
    .eq("context_id", jobId)
    .eq("template_id", "job_service_due")
    .eq("status", "sent")
    .gte("created_at", `${since}T00:00:00Z`)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

export async function runServiceDueReminders(
  supabase: SupabaseClient,
  options: { organizationId?: string } = {},
): Promise<ServiceDueCronResult> {
  const result: ServiceDueCronResult = {
    ok: true,
    orgsScanned: 0,
    jobsMatched: 0,
    sent: 0,
    failed: 0,
    skippedDuplicate: 0,
    skippedNoPhone: 0,
    errors: [],
  };

  if (!isFitSmsConfigured()) {
    return {
      ...result,
      ok: false,
      skippedReason: "FitSMS not configured",
    };
  }

  let orgQuery = supabase
    .from("organizations")
    .select("id, name, phone, notification_settings");

  if (options.organizationId) {
    orgQuery = orgQuery.eq("id", options.organizationId);
  }

  const { data: orgs, error: orgError } = await orgQuery;
  if (orgError) {
    return { ...result, ok: false, errors: [orgError.message] };
  }

  const today = todayIso();

  for (const org of (orgs ?? []) as OrgRow[]) {
    const settings: NotificationSettings = parseNotificationSettings(
      org.notification_settings,
    );

    if (!settings.autoSendServiceDueSms) continue;

    result.orgsScanned += 1;
    const remindBy = addDays(today, settings.serviceDueRemindDaysBefore);
    const business = businessFromOrg(org);
    const locale = settings.preferredLanguage;

    const { data: jobs, error: jobsError } = await supabase
      .from("ac_jobs")
      .select(
        "id, organization_id, job_no, customer_name, phone, address, brand, btu, unit_type, unit_count, description, quoted_amount, deposit_amount, status, scheduled_date, service_due_date, amc_contract",
      )
      .eq("organization_id", org.id)
      .not("service_due_date", "is", null)
      .lte("service_due_date", remindBy)
      .in("status", ["installed", "service_due", "completed"]);

    if (jobsError) {
      result.errors.push(`${org.name}: ${jobsError.message}`);
      continue;
    }

    for (const row of (jobs ?? []) as AcJobRow[]) {
      result.jobsMatched += 1;

      if (!row.phone?.trim()) {
        result.skippedNoPhone += 1;
        continue;
      }

      if (
        await wasRecentlySent(
          supabase,
          org.id,
          row.id,
          settings.serviceDueRepeatDays,
        )
      ) {
        result.skippedDuplicate += 1;
        continue;
      }

      const job = jobFromRow(row);
      const message = composeMessage(
        "job_service_due",
        locale,
        {
          customerName: job.customerName,
          shopName: business.name,
          shopPhone: business.phone ? `Tel: ${business.phone}` : "",
          jobNo: job.jobNo,
          address: job.address,
          description: job.description,
          quotedAmount: "",
          depositAmount: "",
          balance: "",
          scheduledDate: job.scheduledDate ?? "TBC",
          serviceDueDate: job.serviceDueDate ?? "TBC",
        },
      );

      const sms = await sendFitSms(row.phone, message);
      if (!sms.ok) {
        result.failed += 1;
        result.errors.push(`${row.job_no}: ${sms.error}`);
        await supabase.from("notification_log").insert({
          organization_id: org.id,
          channel: "api_sms",
          template_id: "job_service_due",
          recipient_phone: row.phone,
          recipient_name: row.customer_name,
          message_body: message,
          context_type: "ac_job",
          context_id: row.id,
          status: "failed",
        });
        continue;
      }

      result.sent += 1;
      await supabase.from("notification_log").insert({
        organization_id: org.id,
        channel: "api_sms",
        template_id: "job_service_due",
        recipient_phone: row.phone,
        recipient_name: row.customer_name,
        message_body: message,
        context_type: "ac_job",
        context_id: row.id,
        status: "sent",
        provider_ref: sms.providerRef ?? null,
      });

      if (
        row.service_due_date &&
        row.service_due_date <= today &&
        row.status !== "service_due"
      ) {
        await supabase
          .from("ac_jobs")
          .update({ status: "service_due" })
          .eq("id", row.id)
          .eq("organization_id", org.id);
      }
    }
  }

  return result;
}
