import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgRole } from "@/lib/subscription/types";

export const TEAM_MEMBER_ROLES: OrgRole[] = [
  "data_entry",
  "cashier",
  "technician",
  "manager",
];

async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; email: string | undefined } | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return { id: match.id, email: match.email };
    if (data.users.length < 200) return null;
    page += 1;
  }
}

export async function createTeamMember(input: {
  admin: SupabaseClient;
  organizationId: string;
  ownerUserId: string;
  email: string;
  password: string;
  role: OrgRole;
}): Promise<{ userId: string; email: string; role: OrgRole } | { error: string }> {
  const { admin, organizationId, ownerUserId, email, password, role } = input;

  if (!TEAM_MEMBER_ROLES.includes(role)) {
    return { error: "Invalid role" };
  }

  let userId: string;
  let createdAuthUser = false;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { created_by: ownerUserId, shop_role: role },
  });

  if (authError) {
    const duplicate = /already|registered|exists/i.test(authError.message);
    if (!duplicate) {
      return { error: authError.message };
    }

    const existing = await findAuthUserByEmail(admin, email);
    if (!existing) {
      return { error: authError.message };
    }

    userId = existing.id;
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) {
      return { error: updateError.message };
    }
  } else {
    userId = authData.user.id;
    createdAuthUser = true;
  }

  const { data: membership, error: memberLookupError } = await admin
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (memberLookupError) {
    if (createdAuthUser) await admin.auth.admin.deleteUser(userId);
    return { error: memberLookupError.message };
  }

  if (membership) {
    if (createdAuthUser) await admin.auth.admin.deleteUser(userId);
    if (membership.organization_id === organizationId) {
      return { error: "This user is already on your team" };
    }
    return { error: "This email belongs to another shop" };
  }

  const { error: memberError } = await admin.from("org_members").insert({
    organization_id: organizationId,
    user_id: userId,
    role,
  });

  if (memberError) {
    if (createdAuthUser) await admin.auth.admin.deleteUser(userId);
    return { error: memberError.message };
  }

  return { userId, email, role };
}
