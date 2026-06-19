import { normalizeSlPhone } from "./phone";

const TEXTLK_URL = "https://app.text.lk/api/v3/sms/send";

export type TextLkSendResult =
  | { ok: true; providerRef?: string }
  | { ok: false; error: string };

export function isTextLkConfigured(): boolean {
  return Boolean(process.env.TEXTLK_API_TOKEN && process.env.TEXTLK_SENDER_ID);
}

export async function sendTextLkSms(
  phone: string,
  message: string,
): Promise<TextLkSendResult> {
  const token = process.env.TEXTLK_API_TOKEN;
  const senderId = process.env.TEXTLK_SENDER_ID;

  if (!token || !senderId) {
    return { ok: false, error: "Text.lk not configured" };
  }

  const recipient = normalizeSlPhone(phone);
  if (!recipient) {
    return { ok: false, error: "Invalid phone number" };
  }

  try {
    const res = await fetch(TEXTLK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient,
        sender_id: senderId,
        type: "plain",
        message,
      }),
    });

    const data = (await res.json()) as {
      status?: string;
      message?: string;
      data?: { uid?: string };
    };

    if (!res.ok || data.status === "error") {
      return { ok: false, error: data.message ?? "Provider rejected message" };
    }

    return { ok: true, providerRef: data.data?.uid };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "SMS gateway error",
    };
  }
}
