import { formatLkr } from "@/lib/format";
import { buildInvoiceText, buildQuoteText } from "@/lib/invoice";
import { formatPaymentLabel } from "@/lib/invoice";
import type { Locale } from "@/lib/i18n/translations";
import { defaultTemplateForJob } from "./templates";
import { getTemplate } from "./templates";
import type {
  MessageContext,
  MessageTemplateId,
  MessageVariables,
} from "./types";

function fillTemplate(body: string, vars: MessageVariables): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value != null ? String(value) : "";
  });
}

export function variablesFromContext(context: MessageContext): MessageVariables {
  const shopPhone = context.business.phone
    ? `Tel: ${context.business.phone}`
    : "";

  if (context.type === "sale") {
    const { sale, business } = context;
    return {
      customerName: context.customerName ?? sale.customerName ?? "Customer",
      shopName: business.name,
      shopPhone,
      billNo: sale.billNo ?? sale.id.slice(0, 8).toUpperCase(),
      total: formatLkr(sale.total),
      paymentMethod: formatPaymentLabel(sale.paymentMethod),
      date: new Date(sale.date).toLocaleDateString("en-LK"),
    };
  }

  if (context.type === "customer") {
    return {
      customerName: context.customerName,
      shopName: context.business.name,
      shopPhone,
      creditBalance: formatLkr(context.creditBalance ?? 0),
      amount: "",
    };
  }

  if (context.type === "ac_job") {
    const { job, business } = context;
    return {
      customerName: job.customerName,
      shopName: business.name,
      shopPhone,
      jobNo: job.jobNo,
      description: job.description,
      quotedAmount: formatLkr(job.quotedAmount),
      depositAmount: formatLkr(job.depositAmount),
      balance: formatLkr(job.quotedAmount - job.depositAmount),
      address: job.address,
      scheduledDate: job.scheduledDate ?? "TBC",
      serviceDueDate: job.serviceDueDate ?? "TBC",
      brand: job.brand ?? "",
      btu: job.btu ? `${job.btu} BTU` : "",
    };
  }

  return {
    customerName: context.customerName ?? "Customer",
    shopName: context.business.name,
    shopPhone,
  };
}

export function defaultTemplateForContext(context: MessageContext): MessageTemplateId {
  if (context.type === "sale") return "bill_receipt";
  if (context.type === "customer") {
    return (context.creditBalance ?? 0) > 0 ? "credit_reminder" : "payment_thanks";
  }
  if (context.type === "ac_job") return defaultTemplateForJob(context.job.status);
  return "custom";
}

export function composeMessage(
  templateId: MessageTemplateId,
  locale: Locale,
  vars: MessageVariables,
): string {
  const template = getTemplate(templateId);
  const body = locale === "si" ? template.si : template.en;
  return fillTemplate(body, vars);
}

export function composeFromContext(
  context: MessageContext,
  templateId: MessageTemplateId,
  locale: Locale,
): string {
  const vars = variablesFromContext(context);

  if (context.type === "sale" && templateId === "bill_receipt") {
    return buildInvoiceText(context.sale, context.business);
  }

  if (context.type === "sale" && templateId === "sales_quote") {
    return buildQuoteText(context.sale, context.business);
  }

  return composeMessage(templateId, locale, vars);
}

export function smsSegmentInfo(text: string, locale: Locale): {
  chars: number;
  segments: number;
  limit: number;
} {
  const hasUnicode = /[^\u0000-\u007F]/.test(text);
  const limit = hasUnicode || locale === "si" ? 70 : 160;
  const chars = text.length;
  const segments = Math.max(1, Math.ceil(chars / limit));
  return { chars, segments, limit };
}
