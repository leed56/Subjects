import { smsShareUrl, whatsappShareUrl } from "./channels";
import { normalizeSlPhone } from "./phone";
import type { MessageChannel } from "./types";

export type BulkMessageRecipient = {
  id: string;
  name: string;
  phone: string;
  creditBalance?: number;
};

/** @deprecated use BulkMessageRecipient */
export type BulkWhatsAppRecipient = BulkMessageRecipient;

/** Replace {{customerName}} and {{creditBalance}} in a bulk template body. */
export function personalizeBulkMessage(
  body: string,
  recipient: BulkMessageRecipient,
  formatCredit: (amount: number) => string,
): string {
  return body
    .replace(/\{\{customerName\}\}/g, recipient.name)
    .replace(
      /\{\{creditBalance\}\}/g,
      formatCredit(recipient.creditBalance ?? 0),
    );
}

export function openWhatsAppShare(text: string, phone?: string): void {
  const url = whatsappShareUrl(text, phone);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openSmsShare(text: string, phone?: string): void {
  const url = smsShareUrl(text, phone);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openBulkMessageChannel(
  channel: Extract<MessageChannel, "sms" | "whatsapp">,
  text: string,
  phone?: string,
): void {
  if (channel === "sms") openSmsShare(text, phone);
  else openWhatsAppShare(text, phone);
}

export function recipientsWithPhone<
  T extends { id: string; name: string; phone?: string; creditBalance?: number },
>(rows: T[]): BulkMessageRecipient[] {
  return rows
    .filter((r) => normalizeSlPhone(r.phone))
    .map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone!.trim(),
      creditBalance: r.creditBalance,
    }));
}
