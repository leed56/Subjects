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
  if (channel === "api_whatsapp") {
    return { ok: false, channel, error: "Use sendApiWhatsApp() for API delivery" };
  }

  const url =
    channel === "whatsapp"
      ? whatsappShareUrl(text, phone)
      : smsShareUrl(text, phone);

  if (typeof window === "undefined") {
    return { ok: true, channel, url };
  }

  // window.open() returns null (Safari/Firefox) or a Window whose
  // `.closed` is already true (Chrome, some ad-block/popup extensions)
  // when the browser silently blocks it as a pop-up -- no thrown error,
  // no visible sign, just nothing on screen. This used to report success
  // either way, so a blocked pop-up looked identical to a sent message:
  // the composer showed "Ready -- app opened" and closed even though
  // nothing ever opened and the customer was never going to receive
  // anything. Now surfaced as a real failure the caller can act on.
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup || popup.closed) {
    return {
      ok: false,
      channel,
      url,
      error:
        "Pop-up blocked by the browser -- allow pop-ups for this site, or use Auto WhatsApp instead.",
    };
  }

  return { ok: true, channel, url };
}

export function isApiSmsConfigured(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_SMS_API_ENABLED === "true",
  );
}
