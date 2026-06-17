import type { MessageChannel, SendMessageResult } from "./types";
import { normalizeSlPhone } from "./phone";

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

  const { openMessageChannel } = await import("./channels");
  return openMessageChannel(channel, text, phone);
}
