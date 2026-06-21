import type { ACJob } from "@/lib/store/types";
import type { Sale } from "@/lib/store/types";
import type { BusinessInfo } from "@/lib/invoice";

export type MessageChannel = "whatsapp" | "sms" | "api_sms";

export type MessageTemplateId =
  | "bill_receipt"
  | "credit_reminder"
  | "payment_thanks"
  | "job_quote"
  | "job_deposit"
  | "job_scheduled"
  | "job_installed"
  | "job_service_due"
  | "job_service_due_upcoming"
  | "job_service_due_today"
  | "job_service_due_owner"
  | "job_service_due_technician"
  | "job_service_complete_next"
  | "job_completed"
  | "job_assignee_dispatch"
  | "custom";

export type MessageContextType = "sale" | "customer" | "ac_job" | "custom";

export type MessageVariables = Record<string, string | number | undefined>;

export type MessageContext =
  | {
      type: "sale";
      sale: Sale;
      business: BusinessInfo;
      customerName?: string;
    }
  | {
      type: "customer";
      customerName: string;
      creditBalance?: number;
      business: BusinessInfo;
    }
  | {
      type: "ac_job";
      job: ACJob;
      business: BusinessInfo;
    }
  | {
      type: "custom";
      business: BusinessInfo;
      customerName?: string;
    };

export type MessageTemplate = {
  id: MessageTemplateId;
  icon: string;
  labelEn: string;
  labelSi: string;
  category: "sales" | "credit" | "jobs" | "general";
  en: string;
  si: string;
};

export type NotificationSettings = {
  defaultChannel: MessageChannel;
  preferredLanguage: "si" | "en";
  autoPromptOnJobStatus: boolean;
  smsSenderId: string;
  /** Daily cron sends Text.lk SMS for jobs due within N days (when enabled) */
  autoSendServiceDueSms: boolean;
  /** @deprecated use serviceDueRemindDays */
  serviceDueRemindDaysBefore: number;
  /** Days before due to send (0 = on service day) */
  serviceDueRemindDays: number[];
  /** @deprecated platform policy — use PlatformMessagingPolicy.serviceDueRepeatDays */
  serviceDueRepeatDays?: number;
  /** Shop owner mobile — WhatsApp/SMS alerts for service due */
  ownerPhone: string;
  /** Default technician mobile for job alerts */
  technicianPhone: string;
  notifyCustomerOnServiceDue: boolean;
  /** Notify owner when service is due (cron) */
  notifyOwnerOnServiceDue: boolean;
  notifyTechnicianOnServiceDue: boolean;
  /** Default days until next service when marking service done */
  defaultServiceIntervalDays: number;
  /** SMS customer immediately after service done with next due date */
  autoSendOnServiceComplete: boolean;
};

export type NotificationLogEntry = {
  id: string;
  channel: MessageChannel;
  templateId: MessageTemplateId;
  recipientPhone: string;
  recipientName: string;
  messageBody: string;
  contextType: MessageContextType;
  contextId?: string;
  sentAt: string;
  delivery: "opened" | "api_sent" | "api_failed";
  providerRef?: string;
};

export type SendMessageResult = {
  ok: boolean;
  channel: MessageChannel;
  url?: string;
  error?: string;
  providerRef?: string;
};
