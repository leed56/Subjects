import { NextResponse } from "next/server";
import { orgAllowsBulkMessaging } from "@/lib/messaging/plan-gate-server";
import { sendWasenderWhatsApp, isWasenderConfigured } from "@/lib/messaging/wasender-server";
import { normalizeSlPhone } from "@/lib/messaging/phone";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Mirrors /api/messages/send (the Text.lk SMS route) — same auth/role/
// plan-gate shape, same notification_log write-back — but for the
// WasenderAPI WhatsApp channel. One deliberate addition: a sector gate.
// This is a pharmacy-only pilot for now (explicit product decision, not
// a technical limitation) — WasenderAPI ties a single WhatsApp Business
// number to one account, and there's only one connected today. No
// per-org credential storage yet, so every org would otherwise be
// sending from the same pharmacy's number.
//
// No standalone daily-quota table check (unlike SMS's checkOrgSmsQuota)
// — WasenderAPI's own free-trial plan already enforces a hard 1
// request/minute cap server-side, which is stricter than anything a
// simple per-org counter here would add; its own rate-limit error is
// surfaced back to the caller as-is.
export async function POST(request: Request) {
  if (!isWasenderConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "WhatsApp API not configured. Add WASENDER_API_TOKEN to server environment.",
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

  const { data: org } = await supabase
    .from("organizations")
    .select("sector")
    .eq("id", member.organization_id)
    .maybeSingle();

  if (org?.sector !== "pharmacy") {
    return NextResponse.json(
      { ok: false, error: "WhatsApp API sending is currently enabled for pharmacy shops only." },
      { status: 403 },
    );
  }

  const bulkAllowed = await orgAllowsBulkMessaging(supabase, member.organization_id);
  if (!bulkAllowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "WhatsApp API requires a Business or Pro plan. Contact LakBiz to upgrade.",
      },
      { status: 403 },
    );
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

  const phone = normalizeSlPhone(body.phone ?? "");
  const message = body.message?.trim();

  if (!phone || !message) {
    return NextResponse.json(
      { ok: false, error: "Valid phone and message required" },
      { status: 400 },
    );
  }

  // WhatsApp's own text limit is ~65,536 chars, far beyond anything this
  // app composes — 4096 is a sane sanity cap, not a provider requirement.
  if (message.length > 4096) {
    return NextResponse.json(
      { ok: false, error: "Message too long (max 4096 characters)" },
      { status: 400 },
    );
  }

  const wa = await sendWasenderWhatsApp(phone, message);
  if (!wa.ok) {
    return NextResponse.json({ ok: false, error: wa.error }, { status: 502 });
  }

  const { error: logError } = await supabase.from("notification_log").insert({
    organization_id: member.organization_id,
    channel: "api_whatsapp",
    template_id: body.templateId ?? null,
    recipient_phone: phone,
    recipient_name: body.recipientName ?? null,
    message_body: message,
    context_type: body.contextType ?? null,
    context_id: body.contextId ?? null,
    status: "sent",
    provider_ref: wa.providerRef ?? null,
  });

  if (logError) {
    console.error("notification_log insert failed after WhatsApp send:", logError);
    return NextResponse.json(
      {
        ok: false,
        error: "WhatsApp message sent but delivery log failed — contact support if this repeats",
        providerRef: wa.providerRef,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    providerRef: wa.providerRef,
  });
}
