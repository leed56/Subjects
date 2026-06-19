import type { ACJobStatus } from "@/lib/ac-jobs";
import type { MessageTemplate, MessageTemplateId } from "./types";

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "bill_receipt",
    icon: "🧾",
    labelEn: "Bill / Receipt",
    labelSi: "බිල්පත",
    category: "sales",
    en: `Hi {{customerName}}, thank you for shopping at *{{shopName}}*.\n\nBill: {{billNo}}\nTotal: {{total}}\nPayment: {{paymentMethod}}\n\n{{shopPhone}}\nThank you!`,
    si: `ආයුබෝවන් {{customerName}}, *{{shopName}}* වෙත එන ලදීමට ස්තූතියි.\n\nබිල්: {{billNo}}\nමුළු මුදල: {{total}}\nගෙවීම: {{paymentMethod}}\n\n{{shopPhone}}\nස්තූතියි!`,
  },
  {
    id: "credit_reminder",
    icon: "💳",
    labelEn: "Credit reminder",
    labelSi: "ණය මතක් කිරීම",
    category: "credit",
    en: `Hi {{customerName}}, friendly reminder from *{{shopName}}*.\n\nOutstanding balance: *{{creditBalance}}*\n\nPlease settle at your earliest convenience. Call {{shopPhone}} for queries.\nThank you.`,
    si: `ආයුබෝවන් {{customerName}}, *{{shopName}}* වෙතින් මතක් කිරීමක්.\n\nණය ශේෂය: *{{creditBalance}}*\n\nකරුණාකර ගෙවීමට සැලසුම් කරන්න. {{shopPhone}}\nස්තූතියි.`,
  },
  {
    id: "payment_thanks",
    icon: "✅",
    labelEn: "Payment received",
    labelSi: "ගෙවීම ලැබුණා",
    category: "credit",
    en: `Hi {{customerName}}, we received your payment of *{{amount}}* at *{{shopName}}*. Thank you!\n\nRemaining balance: {{creditBalance}}\n{{shopPhone}}`,
    si: `ආයුබෝවන් {{customerName}}, *{{shopName}}* වෙත *{{amount}}* ගෙවීම ලැබුණා. ස්තූතියි!\n\nඉතිරි ශේෂය: {{creditBalance}}\n{{shopPhone}}`,
  },
  {
    id: "job_quote",
    icon: "📋",
    labelEn: "AC quote",
    labelSi: "AC ඇස්තමේන්තුව",
    category: "jobs",
    en: `Hi {{customerName}}, your AC quote from *{{shopName}}*.\n\nJob: {{jobNo}}\n{{description}}\nQuoted: *{{quotedAmount}}*\nDeposit: {{depositAmount}}\nSite: {{address}}\n\nReply or call {{shopPhone}} to confirm.`,
    si: `ආයුබෝවන් {{customerName}}, *{{shopName}}* AC ඇස්තමේන්තුව.\n\nJob: {{jobNo}}\n{{description}}\nමුදල: *{{quotedAmount}}*\nමුද්දර: {{depositAmount}}\nලිපිනය: {{address}}\n\n{{shopPhone}}`,
  },
  {
    id: "job_deposit",
    icon: "💰",
    labelEn: "Deposit received",
    labelSi: "මුද්දර ලැබුණා",
    category: "jobs",
    en: `Hi {{customerName}}, deposit received for AC job *{{jobNo}}* at *{{shopName}}*.\n\nBalance due: *{{balance}}*\nWe will confirm your install date shortly.\n{{shopPhone}}`,
    si: `ආයුබෝවන් {{customerName}}, *{{shopName}}* AC job *{{jobNo}}* මුද්දර ලැබුණා.\n\nඉතිරි: *{{balance}}*\nඅනුස්ථාපන දිනය ඉක්මනින් දන්වන්නෙමු.\n{{shopPhone}}`,
  },
  {
    id: "job_scheduled",
    icon: "📅",
    labelEn: "Install scheduled",
    labelSi: "අනුස්ථාපන දිනය",
    category: "jobs",
    en: `Hi {{customerName}}, your AC installation is *scheduled*.\n\n*{{shopName}}* · Job {{jobNo}}\nDate: *{{scheduledDate}}*\nAddress: {{address}}\n{{description}}\n\nPlease ensure someone is available on site.\n{{shopPhone}}`,
    si: `ආයුබෝවන් {{customerName}}, AC අනුස්ථාපනය *නියමිතයි*.\n\n*{{shopName}}* · Job {{jobNo}}\nදිනය: *{{scheduledDate}}*\nලිපිනය: {{address}}\n{{description}}\n\nකරුණාකර site එකේ කෙනෙක් සිටින බව සහතික කරන්න.\n{{shopPhone}}`,
  },
  {
    id: "job_installed",
    icon: "❄️",
    labelEn: "Installation complete",
    labelSi: "අනුස්ථාපනය සම්පූර්ණ",
    category: "jobs",
    en: `Hi {{customerName}}, your AC installation is complete!\n\n*{{shopName}}* · Job {{jobNo}}\n{{description}}\n\nWarranty & service reminders will follow. For support: {{shopPhone}}`,
    si: `ආයුබෝවන් {{customerName}}, AC අනුස්ථාපනය සම්පූර්ණයි!\n\n*{{shopName}}* · Job {{jobNo}}\n{{description}}\n\nසේවා සහතිකය සහ සේවා මතක් කිරීම් ලැබෙනු ඇත. {{shopPhone}}`,
  },
  {
    id: "job_service_due",
    icon: "🔧",
    labelEn: "Service due",
    labelSi: "සේවාව අවශ්‍ය",
    category: "jobs",
    en: `Hi {{customerName}}, your AC at {{address}} is due for *service/cleaning*.\n\n*{{shopName}}* · Job {{jobNo}}\nBook a visit: {{shopPhone}}\nKeep your unit running efficiently!`,
    si: `ආයුබෝවන් {{customerName}}, {{address}} හි AC එකට *සේවාව/පිරිසිදු කිරීම* අවශ්‍යයි.\n\n*{{shopName}}* · Job {{jobNo}}\nවේලාවක් වෙන්කර ගන්න: {{shopPhone}}`,
  },
  {
    id: "job_service_due_upcoming",
    icon: "📅",
    labelEn: "Service due soon",
    labelSi: "සේවාව ළඟදී",
    category: "jobs",
    en: `Hi {{customerName}}, reminder from *{{shopName}}*.\n\nYour AC service is due on *{{serviceDueDate}}*.\nJob {{jobNo}} · {{address}}\n\nCall {{shopPhone}} to book a visit.`,
    si: `ආයුබෝවන් {{customerName}}, *{{shopName}}* මතක් කිරීම.\n\nAC සේවාව *{{serviceDueDate}}* වන දින.\nJob {{jobNo}} · {{address}}\n\n{{shopPhone}}`,
  },
  {
    id: "job_service_due_today",
    icon: "🔔",
    labelEn: "Service due today",
    labelSi: "සේවාව අද",
    category: "jobs",
    en: `Hi {{customerName}}, your AC service is *due today*.\n\n*{{shopName}}* · Job {{jobNo}}\n{{address}}\nOur team will contact you. Queries: {{shopPhone}}`,
    si: `ආයුබෝවන් {{customerName}}, AC සේවාව *අද*.\n\n*{{shopName}}* · Job {{jobNo}}\n{{address}}\n{{shopPhone}}`,
  },
  {
    id: "job_service_due_owner",
    icon: "📲",
    labelEn: "Service due (owner alert)",
    labelSi: "සේවාව අවශ්‍ය (හිමිකරු)",
    category: "jobs",
    en: `*{{shopName}}* — AC service due\nJob {{jobNo}}\nCustomer: {{customerName}}\nPhone: {{customerPhone}}\nAddress: {{address}}\nDue: {{serviceDueDate}}`,
    si: `*{{shopName}}* — AC සේවාව අවශ්‍ය\nJob {{jobNo}}\n{{customerName}} · {{customerPhone}}\n{{address}}\nDue: {{serviceDueDate}}`,
  },
  {
    id: "job_service_due_technician",
    icon: "👷",
    labelEn: "Service job (technician)",
    labelSi: "සේවා රැකියාව (කාර්මික)",
    category: "jobs",
    en: `*{{shopName}}* service visit\nJob {{jobNo}}\nCustomer: {{customerName}} · {{customerPhone}}\n{{address}}\n{{description}}\nDue: {{serviceDueDate}}`,
    si: `*{{shopName}}* සේවා රැකියාව\nJob {{jobNo}}\n{{customerName}} · {{customerPhone}}\n{{address}}\nDue: {{serviceDueDate}}`,
  },
  {
    id: "job_completed",
    icon: "✨",
    labelEn: "Job completed",
    labelSi: "වැඩ සම්පූර්ණ",
    category: "jobs",
    en: `Hi {{customerName}}, job *{{jobNo}}* is marked complete at *{{shopName}}*.\n\nThank you for choosing us! Rate us or refer a friend.\n{{shopPhone}}`,
    si: `ආයුබෝවන් {{customerName}}, *{{shopName}}* job *{{jobNo}}* සම්පූර්ණයි.\n\nඅපව තෝරා ගැනීමට ස්තූතියි!\n{{shopPhone}}`,
  },
  {
    id: "custom",
    icon: "✏️",
    labelEn: "Custom message",
    labelSi: "අභිරුචි පණිවිඩය",
    category: "general",
    en: `Hi {{customerName}}, message from *{{shopName}}*.\n\n{{shopPhone}}`,
    si: `ආයුබෝවන් {{customerName}}, *{{shopName}}* වෙතින් පණිවිඩයක්.\n\n{{shopPhone}}`,
  },
];

export function getTemplate(id: MessageTemplateId): MessageTemplate {
  return MESSAGE_TEMPLATES.find((t) => t.id === id) ?? MESSAGE_TEMPLATES[0];
}

export function templatesForContext(
  contextType: "sale" | "customer" | "ac_job" | "custom",
): MessageTemplate[] {
  if (contextType === "sale") {
    return MESSAGE_TEMPLATES.filter((t) =>
      ["bill_receipt", "custom"].includes(t.id),
    );
  }
  if (contextType === "customer") {
    return MESSAGE_TEMPLATES.filter((t) =>
      ["credit_reminder", "payment_thanks", "custom"].includes(t.id),
    );
  }
  if (contextType === "ac_job") {
    return MESSAGE_TEMPLATES.filter((t) => t.category === "jobs" || t.id === "custom");
  }
  return MESSAGE_TEMPLATES;
}

export function defaultTemplateForJob(status: ACJobStatus): MessageTemplateId {
  const map: Partial<Record<ACJobStatus, MessageTemplateId>> = {
    quote: "job_quote",
    deposit_received: "job_deposit",
    scheduled: "job_scheduled",
    installed: "job_installed",
    service_due: "job_service_due",
    completed: "job_completed",
  };
  return map[status] ?? "job_quote";
}
