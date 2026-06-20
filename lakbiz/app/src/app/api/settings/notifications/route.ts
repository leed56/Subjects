import { NextResponse } from "next/server";
import { parseNotificationSettings } from "@/lib/messaging/settings";
import { toShopNotificationPayload } from "@/lib/messaging/platform-policy";
import type { NotificationSettings } from "@/lib/messaging/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function requireOrgMember() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sign in required", status: 401 as const };
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member?.organization_id) {
    return { error: "No shop found", status: 404 as const };
  }

  if (member.role !== "owner" && member.role !== "manager") {
    return { error: "Owner or manager only", status: 403 as const };
  }

  return { supabase, organizationId: member.organization_id };
}

export async function GET() {
  const ctx = await requireOrgMember();
  if ("error" in ctx) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  }

  const { data, error } = await ctx.supabase
    .from("organizations")
    .select("notification_settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Not found" }, { status: 500 });
  }

  const settings = parseNotificationSettings(data.notification_settings);
  return NextResponse.json({ ok: true, settings });
}

export async function PUT(request: Request) {
  const ctx = await requireOrgMember();
  if ("error" in ctx) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  }

  let body: Partial<NotificationSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existingRow } = await ctx.supabase
    .from("organizations")
    .select("notification_settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  const merged = parseNotificationSettings({
    ...(existingRow?.notification_settings as object),
    ...body,
  });

  const payload = toShopNotificationPayload(merged);

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ notification_settings: payload })
    .eq("id", ctx.organizationId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, settings: parseNotificationSettings(payload) });
}
