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
      {
        ok: false,
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not configured. Subscription updates require the service role key on the server.",
      },
      { status: 503 },
    );
  }

  let body: { status?: SubscriptionStatus; planId?: PlanId };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const validPlans: PlanId[] = ["starter", "business", "pro"];
  if (body.planId && !validPlans.includes(body.planId)) {
    return NextResponse.json({ ok: false, error: "Invalid plan" }, { status: 400 });
  }

  const validStatuses: SubscriptionStatus[] = [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "read_only",
  ];
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }

  if (!body.status && !body.planId) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
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
