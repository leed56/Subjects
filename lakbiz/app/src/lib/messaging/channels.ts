import { normalizeSlPhone } from "./phone";
import type { MessageChannel, SendMessageResult } from "./types";

export function whatsappShareUrl(text: string, phone?: string): string {
  const encoded = encodeURIComponent(text);
  const digits = normalizeSlPhone(phone);
  if (digits) {
    return `https://wa.me/${digits}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export function smsShareUrl(text: string, phone?: string): string {
  const encoded = encodeURIComponent(text);
  const digits = normalizeSlPhone(phone);
  if (digits) {
    return `sms:+${digits}?body=${encoded}`;
  }
  return `sms:?body=${encoded}`;
}

export function openMessageChannel(
  channel: MessageChannel,
  text: string,
  phone?: string,
): SendMessageResult {
  if (channel === "api_sms") {
    return { ok: false, channel, error: "Use sendApiSms() for API delivery" };
  }

  const url =
    channel === "whatsapp"
      ? whatsappShareUrl(text, phone)
      : smsShareUrl(text, phone);

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return { ok: true, channel, url };
}

export function isApiSmsConfigured(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_SMS_API_ENABLED === "true",
  );
}
