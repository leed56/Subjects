import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { provisionShop } from "@/lib/admin/provision-shop";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/subscription/types";

export async function GET() {
  const admin = await requirePlatformAdmin();
  if ("error" in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const supabase = await createServerSupabaseClient();
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select(
      `
      id,
      name,
      phone,
      sector,
      created_at,
      subscriptions ( plan_id, status, trial_ends_at, billing_cycle ),
      org_members ( user_id, role )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const service = createAdminSupabaseClient();
  const ownerEmails = new Map<string, string>();

  if (service && orgs?.length) {
    const userIds = orgs.flatMap((o) => {
      const members = Array.isArray(o.org_members) ? o.org_members : [o.org_members];
      return members.filter((m) => m?.role === "owner").map((m) => m.user_id);
    });

    for (const uid of userIds) {
      const { data } = await service.auth.admin.getUserById(uid);
      if (data.user?.email) ownerEmails.set(uid, data.user.email);
    }
  }

  const shops = (orgs ?? []).map((org) => {
    const members = Array.isArray(org.org_members) ? org.org_members : [org.org_members];
    const owner = members.find((m) => m?.role === "owner");
    const subRaw = org.subscriptions;
    const sub = Array.isArray(subRaw) ? subRaw[0] : subRaw;

    return {
      id: org.id,
      name: org.name,
      phone: org.phone,
      sector: org.sector,
      createdAt: org.created_at,
      planId: sub?.plan_id ?? "business",
      status: sub?.status ?? "trialing",
      billingCycle: sub?.billing_cycle ?? "monthly",
      trialEndsAt: sub?.trial_ends_at ?? null,
      ownerEmail: owner ? (ownerEmails.get(owner.user_id) ?? null) : null,
    };
  });

  return NextResponse.json({ ok: true, shops });
}

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();
  if ("error" in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  let body: {
    shopName?: string;
    ownerEmail?: string;
    password?: string;
    phone?: string;
    templateId?: string;
    planId?: PlanId;
    trialDays?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const result = await provisionShop({
    shopName: body.shopName ?? "",
    ownerEmail: body.ownerEmail ?? "",
    password: body.password ?? "",
    phone: body.phone,
    templateId: body.templateId ?? "grocery",
    planId: body.planId,
    trialDays: body.trialDays,
  });

  if (result.error || !result.data) {
    return NextResponse.json({ ok: false, error: result.error ?? "Failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, shop: result.data });
}
