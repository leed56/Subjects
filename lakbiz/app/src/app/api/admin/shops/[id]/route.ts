import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import {
  extendTrialFromDays,
  parseTrialEndsAtInput,
  shouldReactivateTrial,
} from "@/lib/admin/subscription-patch";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { PlanId, SubscriptionStatus } from "@/lib/subscription/types";

type RouteParams = { params: Promise<{ id: string }> };

type PatchBody = {
  status?: SubscriptionStatus;
  planId?: PlanId;
  trialEndsAt?: string | null;
  extendTrialDays?: number;
};

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

  let body: PatchBody;
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

  const wantsTrialUpdate =
    body.trialEndsAt !== undefined || body.extendTrialDays !== undefined;

  if (!body.status && !body.planId && !wantsTrialUpdate) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) updates.status = body.status;
  if (body.planId) updates.plan_id = body.planId;

  if (wantsTrialUpdate) {
    const { data: sub, error: subError } = await service
      .from("subscriptions")
      .select("trial_ends_at, status")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (subError) {
      return NextResponse.json({ ok: false, error: subError.message }, { status: 400 });
    }
    if (!sub) {
      return NextResponse.json({ ok: false, error: "Subscription not found" }, { status: 404 });
    }

    let nextTrialEnd: string | null = null;

    if (body.extendTrialDays !== undefined) {
      nextTrialEnd = extendTrialFromDays(sub.trial_ends_at, body.extendTrialDays);
      if (!nextTrialEnd) {
        return NextResponse.json(
          { ok: false, error: "extendTrialDays must be an integer from 1 to 90" },
          { status: 400 },
        );
      }
    } else if (body.trialEndsAt === null) {
      nextTrialEnd = null;
    } else if (body.trialEndsAt !== undefined) {
      nextTrialEnd = parseTrialEndsAtInput(body.trialEndsAt);
      if (!nextTrialEnd) {
        return NextResponse.json({ ok: false, error: "Invalid trial end date" }, { status: 400 });
      }
    }

    updates.trial_ends_at = nextTrialEnd;
    updates.current_period_end = nextTrialEnd;

    if (shouldReactivateTrial(sub.status, nextTrialEnd) && !body.status) {
      updates.status = "trialing";
    }
  }

  const { error } = await service
    .from("subscriptions")
    .update(updates)
    .eq("organization_id", organizationId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    trialEndsAt: (updates.trial_ends_at as string | null | undefined) ?? undefined,
  });
}
