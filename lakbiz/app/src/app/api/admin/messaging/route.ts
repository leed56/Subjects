import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import {
  DEFAULT_PLATFORM_MESSAGING_POLICY,
  parsePlatformMessagingPolicy,
} from "@/lib/messaging/platform-policy";
import {
  fetchPlatformMessagingPolicy,
  savePlatformMessagingPolicy,
} from "@/lib/messaging/platform-policy-server";
import { isTextLkConfigured } from "@/lib/messaging/textlk-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const admin = await requirePlatformAdmin();
  if ("error" in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const supabase = await createServerSupabaseClient();
  const policy = await fetchPlatformMessagingPolicy(supabase);

  return NextResponse.json({
    ok: true,
    policy,
    textLkConfigured: isTextLkConfigured(),
  });
}

export async function PATCH(request: Request) {
  const admin = await requirePlatformAdmin();
  if ("error" in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const policy = parsePlatformMessagingPolicy(body);
  const supabase = await createServerSupabaseClient();
  const err = await savePlatformMessagingPolicy(supabase, policy);

  if (err) {
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true, policy });
}

export async function POST() {
  const admin = await requirePlatformAdmin();
  if ("error" in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const supabase = await createServerSupabaseClient();
  const err = await savePlatformMessagingPolicy(
    supabase,
    DEFAULT_PLATFORM_MESSAGING_POLICY,
  );

  if (err) {
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    policy: DEFAULT_PLATFORM_MESSAGING_POLICY,
  });
}
