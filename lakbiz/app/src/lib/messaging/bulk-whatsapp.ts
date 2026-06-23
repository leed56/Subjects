import { whatsappShareUrl } from "./channels";
import { normalizeSlPhone } from "./phone";

export type BulkWhatsAppRecipient = {
  id: string;
  name: string;
  phone: string;
  creditBalance?: number;
};

/** Replace {{customerName}} and {{creditBalance}} in a bulk template body. */
export function personalizeBulkMessage(
  body: string,
  recipient: BulkWhatsAppRecipient,
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

export function recipientsWithPhone<
  T extends { id: string; name: string; phone?: string; creditBalance?: number },
>(rows: T[]): BulkWhatsAppRecipient[] {
  return rows
    .filter((r) => normalizeSlPhone(r.phone))
    .map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone!.trim(),
      creditBalance: r.creditBalance,
    }));
}
