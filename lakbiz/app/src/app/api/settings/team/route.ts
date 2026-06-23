import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireOrgOwner } from "@/lib/org-role/require-org-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/subscription/types";
import { parseOrgRole } from "@/lib/org-role/permissions";

export async function GET() {
  const owner = await requireOrgOwner();
  if ("error" in owner) {
    return NextResponse.json({ ok: false, error: owner.error }, { status: owner.status });
  }

  const supabase = await createServerSupabaseClient();
  const { data: members, error } = await supabase
    .from("org_members")
    .select("user_id, role, created_at")
    .eq("organization_id", owner.organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const admin = createAdminSupabaseClient();
  const rows = await Promise.all(
    (members ?? []).map(async (m) => {
      let email: string | null = null;
      if (admin) {
        const { data } = await admin.auth.admin.getUserById(m.user_id);
        email = data.user?.email ?? null;
      }
      return {
        userId: m.user_id,
        role: parseOrgRole(m.role as string),
        email,
        createdAt: m.created_at,
      };
    }),
  );

  return NextResponse.json({ ok: true, members: rows });
}

const INVITE_ROLES: OrgRole[] = ["data_entry", "cashier", "technician", "manager"];

export async function POST(request: Request) {
  const owner = await requireOrgOwner();
  if ("error" in owner) {
    return NextResponse.json({ ok: false, error: owner.error }, { status: owner.status });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string; role?: OrgRole };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const role = parseOrgRole(body.role ?? "data_entry");

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }
  if (!INVITE_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: "Invalid role for invite" }, { status: 400 });
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { invited_by: owner.userId, shop_role: role },
  });

  if (authError) {
    return NextResponse.json({ ok: false, error: authError.message }, { status: 400 });
  }

  const userId = authData.user.id;

  const { error: memberError } = await admin.from("org_members").insert({
    organization_id: owner.organizationId,
    user_id: userId,
    role,
  });

  if (memberError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ ok: false, error: memberError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    member: { userId, email, role },
  });
}
