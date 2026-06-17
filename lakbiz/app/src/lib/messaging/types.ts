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
  | "job_completed"
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
