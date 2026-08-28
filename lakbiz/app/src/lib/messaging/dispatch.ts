import type { MessageChannel, SendMessageResult } from "./types";
import { normalizeSlPhone } from "./phone";
import { openMessageChannel } from "./channels";

export type ApiSmsPayload = {
  phone: string;
  message: string;
  templateId?: string;
  contextType?: string;
  contextId?: string;
  recipientName?: string;
};

export async function sendApiSms(
  payload: ApiSmsPayload,
): Promise<SendMessageResult> {
  const phone = normalizeSlPhone(payload.phone);
  if (!phone) {
    return { ok: false, channel: "api_sms", error: "Invalid phone number" };
  }

  try {
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, phone }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      providerRef?: string;
    };

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        channel: "api_sms",
        error: data.error ?? "SMS send failed",
      };
    }

    return {
      ok: true,
      channel: "api_sms",
      providerRef: data.providerRef,
    };
  } catch (err) {
    return {
      ok: false,
      channel: "api_sms",
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function sendApiWhatsApp(
  payload: ApiSmsPayload,
): Promise<SendMessageResult> {
  const phone = normalizeSlPhone(payload.phone);
  if (!phone) {
    return { ok: false, channel: "api_whatsapp", error: "Invalid phone number" };
  }

  try {
    const res = await fetch("/api/messages/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, phone }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      providerRef?: string;
    };

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        channel: "api_whatsapp",
        error: data.error ?? "WhatsApp send failed",
      };
    }

    return {
      ok: true,
      channel: "api_whatsapp",
      providerRef: data.providerRef,
    };
  } catch (err) {
    return {
      ok: false,
      channel: "api_whatsapp",
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function dispatchMessage(
  channel: MessageChannel,
  text: string,
  phone: string | undefined,
  meta?: Omit<ApiSmsPayload, "phone" | "message">,
): Promise<SendMessageResult> {
  if (channel === "api_sms") {
    if (!phone) {
      return { ok: false, channel, error: "Phone required for SMS API" };
    }
    return sendApiSms({ phone, message: text, ...meta });
  }

  if (channel === "api_whatsapp") {
    if (!phone) {
      return { ok: false, channel, error: "Phone required for WhatsApp API" };
    }
    return sendApiWhatsApp({ phone, message: text, ...meta });
  }

  // Reported: "I sent a message but they didn't receive it" -- for the
  // manual whatsapp/sms channels, the only thing this function ever did
  // was window.open() a wa.me/sms: link; nothing is actually transmitted
  // until the customer's browser/app tab opens and a human presses Send
  // inside it. That open() used to sit behind an `await import("./channels")`
  // -- a dynamic import breaks the synchronous call stack a click handler
  // needs for window.open() to reliably count as user-activated, so on a
  // cold chunk load (the common case: first WhatsApp send of the session)
  // browsers are free to silently block it as a pop-up. openMessageChannel
  // returned `ok: true` unconditionally either way, so the composer showed
  // "Ready -- app opened" and auto-closed even when no tab ever opened.
  // Importing it statically keeps window.open() inside the same
  // synchronous gesture as the click that triggered handleSend, and
  // openMessageChannel (below) now also checks whether the popup actually
  // opened instead of assuming it did.
  return openMessageChannel(channel, text, phone);
}
