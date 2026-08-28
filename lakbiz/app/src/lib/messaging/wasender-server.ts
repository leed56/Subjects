import { normalizeSlPhone } from "./phone";

// WasenderAPI (wasenderapi.com) — a hosted WhatsApp Business API service.
// Endpoint/payload shape confirmed against their public docs
// (api-docs/messages/send-text-message), not guessed: POST a bearer-token
// request with { to, text } to /api/send-message; success responses carry
// { success: true, data: { msgId, jid, status } }, failures carry
// { success: false, message, errors? }. Mirrors textlk-server.ts's shape
// (isConfigured() + send()) so the two providers plug into the same
// dispatch pattern on the API-route side.
const WASENDER_SEND_URL = "https://www.wasenderapi.com/api/send-message";

export type WasenderSendResult =
  | { ok: true; providerRef?: string }
  | { ok: false; error: string };

export function isWasenderConfigured(): boolean {
  return Boolean(process.env.WASENDER_API_TOKEN);
}

export async function sendWasenderWhatsApp(
  phone: string,
  text: string,
): Promise<WasenderSendResult> {
  const token = process.env.WASENDER_API_TOKEN;
  if (!token) {
    return { ok: false, error: "WhatsApp API not configured" };
  }

  const digits = normalizeSlPhone(phone);
  if (!digits) {
    return { ok: false, error: "Invalid phone number" };
  }
  // normalizeSlPhone returns bare digits (947XXXXXXXX); WasenderAPI's `to`
  // field wants E.164 (leading +), per their docs' own example ("+1234567890").
  const to = `+${digits}`;

  try {
    const res = await fetch(WASENDER_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, text }),
    });

    const data = (await res.json()) as {
      success?: boolean;
      message?: string;
      errors?: Record<string, string[]>;
      data?: { msgId?: number | string; jid?: string; status?: string };
    };

    if (!res.ok || data.success === false) {
      const fieldError = data.errors ? Object.values(data.errors).flat()[0] : undefined;
      return { ok: false, error: fieldError ?? data.message ?? "Provider rejected message" };
    }

    return { ok: true, providerRef: data.data?.msgId != null ? String(data.data.msgId) : undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "WhatsApp gateway error",
    };
  }
}
