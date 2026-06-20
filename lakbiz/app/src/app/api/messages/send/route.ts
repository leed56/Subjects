import { NextResponse } from "next/server";
import { sendTextLkSms, isTextLkConfigured } from "@/lib/messaging/textlk-server";
import { normalizeSlPhone } from "@/lib/messaging/phone";
import { checkOrgSmsQuota } from "@/lib/messaging/sms-quota-server";
import { fetchPlatformMessagingPolicy } from "@/lib/messaging/platform-policy-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isTextLkConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SMS API not configured. Add TEXTLK_API_TOKEN and TEXTLK_SENDER_ID to server environment.",
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

  const { data: member } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member?.organization_id) {
    return NextResponse.json({ ok: false, error: "No shop found" }, { status: 404 });
  }

  if (member.role !== "owner" && member.role !== "manager") {
    return NextResponse.json({ ok: false, error: "Owner or manager only" }, { status: 403 });
  }

  const platformPolicy = await fetchPlatformMessagingPolicy(supabase);
  const maxSmsLength = platformPolicy.maxSmsLength;

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

  const phone = normalizeSlPhone(body.phone ?? "");
  const message = body.message?.trim();

  if (!phone || !message) {
    return NextResponse.json(
      { ok: false, error: "Valid phone and message required" },
      { status: 400 },
    );
  }

  if (message.length > maxSmsLength) {
    return NextResponse.json(
      { ok: false, error: `Message too long (max ${maxSmsLength} characters)` },
      { status: 400 },
    );
  }

  const quota = await checkOrgSmsQuota(supabase, member.organization_id);
  if (!quota.ok) {
    return NextResponse.json({ ok: false, error: quota.error }, { status: 429 });
  }

  const sms = await sendTextLkSms(phone, message);
  if (!sms.ok) {
    return NextResponse.json(
      { ok: false, error: sms.error },
      { status: 502 },
    );
  }

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
    provider_ref: sms.providerRef ?? null,
  });

  return NextResponse.json({
    ok: true,
    providerRef: sms.providerRef,
  });
}
