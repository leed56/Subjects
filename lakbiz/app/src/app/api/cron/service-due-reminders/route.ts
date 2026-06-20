import { NextResponse } from "next/server";
import { runServiceDueReminders } from "@/lib/messaging/service-due-cron";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Vercel Cron — daily batch SMS for AC service-due jobs */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET environment variable is not configured" },
      { status: 503 },
    );
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  const result = await runServiceDueReminders(supabase);
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

/** Manual run for signed-in shop owner (settings page "Send now") */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Server SMS job not configured" },
      { status: 503 },
    );
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

  const result = await runServiceDueReminders(admin, {
    organizationId: member.organization_id,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
