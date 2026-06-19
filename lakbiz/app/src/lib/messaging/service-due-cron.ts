import type { SupabaseClient } from "@supabase/supabase-js";

import { daysUntilDate } from "@/lib/ac-service";

import { composeMessage } from "./compose";

import { sendTextLkSms, isTextLkConfigured } from "./textlk-server";

import { parseNotificationSettings } from "@/lib/messaging/settings";

import type { MessageTemplateId, NotificationSettings } from "./types";

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

  assigned_technician: string | null;

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

  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);

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



function jobVars(row: AcJobRow, business: BusinessInfo) {

  return {

    customerName: row.customer_name,

    customerPhone: row.phone ?? "",

    shopName: business.name,

    shopPhone: business.phone ? `Tel: ${business.phone}` : "",

    jobNo: row.job_no,

    address: row.address,

    description: row.description,

    quotedAmount: "",

    depositAmount: "",

    balance: "",

    scheduledDate: row.scheduled_date ?? "TBC",

    serviceDueDate: row.service_due_date ?? "TBC",

  };

}



async function wasSentToday(

  supabase: SupabaseClient,

  organizationId: string,

  jobId: string,

  templateId: MessageTemplateId,

  recipientPhone: string,

): Promise<boolean> {

  const today = todayIso();

  const { data } = await supabase

    .from("notification_log")

    .select("id")

    .eq("organization_id", organizationId)

    .eq("context_type", "ac_job")

    .eq("context_id", jobId)

    .eq("template_id", templateId)

    .eq("recipient_phone", recipientPhone)

    .eq("status", "sent")

    .gte("created_at", `${today}T00:00:00Z`)

    .lt("created_at", `${addDays(today, 1)}T00:00:00Z`)

    .limit(1);



  return (data?.length ?? 0) > 0;

}



async function sendSmsReminder(

  supabase: SupabaseClient,

  orgId: string,

  job: AcJobRow,

  templateId: MessageTemplateId,

  phone: string,

  recipientName: string,

  locale: NotificationSettings["preferredLanguage"],

  business: BusinessInfo,

  result: ServiceDueCronResult,

): Promise<void> {

  if (await wasSentToday(supabase, orgId, job.id, templateId, phone)) {

    result.skippedDuplicate += 1;

    return;

  }



  const message = composeMessage(templateId, locale, jobVars(job, business));

  const sms = await sendTextLkSms(phone, message);



  if (!sms.ok) {

    result.failed += 1;

    result.errors.push(`${job.job_no} (${templateId}): ${sms.error}`);

    await supabase.from("notification_log").insert({

      organization_id: orgId,

      channel: "api_sms",

      template_id: templateId,

      recipient_phone: phone,

      recipient_name: recipientName,

      message_body: message,

      context_type: "ac_job",

      context_id: job.id,

      status: "failed",

    });

    return;

  }



  result.sent += 1;

  await supabase.from("notification_log").insert({

    organization_id: orgId,

    channel: "api_sms",

    template_id: templateId,

    recipient_phone: phone,

    recipient_name: recipientName,

    message_body: message,

    context_type: "ac_job",

    context_id: job.id,

    status: "sent",

    provider_ref: sms.providerRef ?? null,

  });

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



  if (!isTextLkConfigured()) {
    return {
      ...result,
      ok: false,
      skippedReason: "Text.lk not configured",
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

    if (settings.serviceDueRemindDays.length === 0) continue;



    result.orgsScanned += 1;

    const business = businessFromOrg(org);

    const locale = settings.preferredLanguage;

    const targetDates = settings.serviceDueRemindDays.map((d) =>

      addDays(today, d),

    );



    const { data: jobs, error: jobsError } = await supabase

      .from("ac_jobs")

      .select(

        "id, organization_id, job_no, customer_name, phone, address, brand, btu, unit_type, unit_count, description, quoted_amount, deposit_amount, status, scheduled_date, service_due_date, amc_contract, assigned_technician",

      )

      .eq("organization_id", org.id)

      .not("service_due_date", "is", null)

      .in("service_due_date", targetDates)

      .in("status", ["installed", "service_due", "completed"]);



    if (jobsError) {

      result.errors.push(`${org.name}: ${jobsError.message}`);

      continue;

    }



    for (const row of (jobs ?? []) as AcJobRow[]) {

      if (!row.service_due_date) continue;



      const daysUntil = daysUntilDate(row.service_due_date);

      if (!settings.serviceDueRemindDays.includes(daysUntil)) continue;



      result.jobsMatched += 1;

      const isDayOf = daysUntil === 0;

      const customerTemplate: MessageTemplateId = isDayOf

        ? "job_service_due_today"

        : "job_service_due_upcoming";



      if (settings.notifyCustomerOnServiceDue) {

        const phone = row.phone?.trim();

        if (!phone) {

          result.skippedNoPhone += 1;

        } else {

          await sendSmsReminder(

            supabase,

            org.id,

            row,

            customerTemplate,

            phone,

            row.customer_name,

            locale,

            business,

            result,

          );

        }

      }



      const ownerPhone = settings.ownerPhone?.trim();

      if (settings.notifyOwnerOnServiceDue && ownerPhone) {

        await sendSmsReminder(

          supabase,

          org.id,

          row,

          "job_service_due_owner",

          ownerPhone,

          business.name,

          locale,

          business,

          result,

        );

      }



      const techPhone = settings.technicianPhone?.trim();

      if (settings.notifyTechnicianOnServiceDue && techPhone) {

        await sendSmsReminder(

          supabase,

          org.id,

          row,

          "job_service_due_technician",

          techPhone,

          row.assigned_technician ?? "Technician",

          locale,

          business,

          result,

        );

      }



      if (

        row.service_due_date <= today &&

        row.status !== "service_due" &&

        (row.status as ACJobStatus) !== "cancelled"

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


