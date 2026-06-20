import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** PayHere checkout placeholder — wire merchant ID + hash when credentials are ready. */
export async function POST(request: Request) {
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

  if (member.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Shop owner only" }, { status: 403 });
  }

  let body: { planId?: string; billingCycle?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.planId) {
    return NextResponse.json({ ok: false, error: "planId required" }, { status: 400 });
  }

  if (!process.env.PAYHERE_MERCHANT_ID || !process.env.PAYHERE_MERCHANT_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        error: "PayHere is not configured yet. Contact LakBiz support to upgrade your plan.",
        code: "payhere_not_configured",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: "PayHere checkout integration is pending final wiring.",
      code: "payhere_pending",
    },
    { status: 501 },
  );
}
