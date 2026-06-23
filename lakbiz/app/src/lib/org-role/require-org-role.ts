import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/subscription/types";
import { parseOrgRole } from "./permissions";

export type OrgMemberContext = {
  userId: string;
  organizationId: string;
  role: OrgRole;
  email: string;
};

export async function getOrgMemberContext(): Promise<
  OrgMemberContext | { error: string; status: number }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sign in required", status: 401 };
  }

  const { data: member, error } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !member?.organization_id) {
    return { error: "No shop found", status: 404 };
  }

  return {
    userId: user.id,
    organizationId: member.organization_id,
    role: parseOrgRole(member.role as string),
    email: user.email ?? "",
  };
}

export async function requireOrgOwner(): Promise<
  OrgMemberContext | { error: string; status: number }
> {
  const ctx = await getOrgMemberContext();
  if ("error" in ctx) return ctx;
  if (ctx.role !== "owner") {
    return { error: "Shop owner only", status: 403 };
  }
  return ctx;
}
