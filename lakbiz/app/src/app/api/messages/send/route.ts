import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const FITSMS_URL = "https://app.fitsms.lk/api/v4/sms/send";

function formatSlPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("07") && digits.length === 10) digits = `94${digits.slice(1)}`;
  else if (digits.startsWith("7") && digits.length === 9) digits = `94${digits}`;
  if (digits.startsWith("94") && digits.length === 11) return digits;
  return null;
}

export async function POST(request: Request) {
  const token = process.env.FITSMS_API_TOKEN;
  const senderId = process.env.FITSMS_SENDER_ID;

  if (!token || !senderId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SMS API not configured. Add FITSMS_API_TOKEN and FITSMS_SENDER_ID to server environment.",
      },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  }

  let body: {
    phone?: string;
    message?: string;
    templateId?: string;
    contextType?: string;
    contextId?: string;
    recipientName?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const phone = formatSlPhone(body.phone ?? "");
  const message = body.message?.trim();

  if (!phone || !message) {
    return NextResponse.json(
      { ok: false, error: "Valid phone and message required" },
      { status: 400 },
    );
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
        recipient: phone,
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
      return NextResponse.json(
        { ok: false, error: data.message ?? "Provider rejected message" },
        { status: 502 },
      );
    }

    const { data: member } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (member?.organization_id) {
      await supabase.from("notification_log").insert({
        organization_id: member.organization_id,
        channel: "api_sms",
        template_id: body.templateId ?? null,
        recipient_phone: phone,
        recipient_name: body.recipientName ?? null,
        message_body: message,
        context_type: body.contextType ?? null,
        context_id: body.contextId ?? null,
        status: "sent",
        provider_ref: data.data?.ruid ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      providerRef: data.data?.ruid,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "SMS gateway error",
      },
      { status: 502 },
    );
  }
}
