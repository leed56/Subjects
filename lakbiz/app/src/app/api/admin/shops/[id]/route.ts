import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { PlanId, SubscriptionStatus } from "@/lib/subscription/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await requirePlatformAdmin();
  if ("error" in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { id: organizationId } = await params;
  const service = createAdminSupabaseClient();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "Service role not configured" },
      { status: 503 },
    );
  }

  let body: { status?: SubscriptionStatus; planId?: PlanId };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) updates.status = body.status;
  if (body.planId) updates.plan_id = body.planId;

  const { error } = await service
    .from("subscriptions")
    .update(updates)
    .eq("organization_id", organizationId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: RouteParams) {
  const admin = await requirePlatformAdmin();
  if ("error" in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { id: organizationId } = await params;
  const service = createAdminSupabaseClient();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "Service role not configured" },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { data: member } = await service
    .from("org_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ ok: false, error: "Owner not found" }, { status: 404 });
  }

  const updates: { email?: string; password?: string; email_confirm?: boolean } = {
    email_confirm: true,
  };
  if (body.email) updates.email = body.email.trim().toLowerCase();
  if (body.password) updates.password = body.password;

  const { error } = await service.auth.admin.updateUserById(member.user_id, updates);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
