import { normalizeSlPhone } from "./phone";

const FITSMS_URL = "https://app.fitsms.lk/api/v4/sms/send";

export type FitSmsSendResult =
  | { ok: true; providerRef?: string }
  | { ok: false; error: string };

export function isFitSmsConfigured(): boolean {
  return Boolean(process.env.FITSMS_API_TOKEN && process.env.FITSMS_SENDER_ID);
}

export async function sendFitSms(
  phone: string,
  message: string,
): Promise<FitSmsSendResult> {
  const token = process.env.FITSMS_API_TOKEN;
  const senderId = process.env.FITSMS_SENDER_ID;

  if (!token || !senderId) {
    return { ok: false, error: "FitSMS not configured" };
  }

  const recipient = normalizeSlPhone(phone);
  if (!recipient) {
    return { ok: false, error: "Invalid phone number" };
  }

  try {
    const res = await fetch(FITSMS_URL, {
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
      data?: { ruid?: string };
    };

    if (!res.ok || data.status === "error") {
      return { ok: false, error: data.message ?? "Provider rejected message" };
    }

    return { ok: true, providerRef: data.data?.ruid };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "SMS gateway error",
    };
  }
}
