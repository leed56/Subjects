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

async function ensureUserCanSignIn(
  admin: SupabaseClient,
  userId: string,
  password: string,
): Promise<{ error: string } | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return { error: error?.message ?? "Could not verify new user" };
  }

  if (!data.user.email_confirmed_at) {
    const { error: confirmError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (confirmError) return { error: confirmError.message };
  }

  return null;
}

export async function resetTeamMemberPassword(input: {
  admin: SupabaseClient;
  organizationId: string;
  email: string;
  password: string;
}): Promise<{ userId: string; email: string } | { error: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();

  if (!email.includes("@")) return { error: "Valid email required" };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const existing = await findAuthUserByEmail(input.admin, email);
  if (!existing) {
    return { error: "No account with this email. Create the user first." };
  }

  const { data: membership, error: memberLookupError } = await input.admin
    .from("org_members")
    .select("organization_id")
    .eq("user_id", existing.id)
    .maybeSingle();

  if (memberLookupError) return { error: memberLookupError.message };
  if (!membership || membership.organization_id !== input.organizationId) {
    return { error: "This email is not on your team" };
  }

  const { error: updateError } = await input.admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (updateError) return { error: updateError.message };

  const verifyError = await ensureUserCanSignIn(input.admin, existing.id, password);
  if (verifyError) return verifyError;

  return { userId: existing.id, email };
}

export async function createTeamMember(input: {
  admin: SupabaseClient;
  organizationId: string;
  ownerUserId: string;
  email: string;
  password: string;
  role: OrgRole;
}): Promise<{ userId: string; email: string; role: OrgRole } | { error: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const { admin, organizationId, ownerUserId, role } = input;

  if (!TEAM_MEMBER_ROLES.includes(role)) {
    return { error: "Invalid role" };
  }
  if (!email.includes("@")) return { error: "Valid email required" };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
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
    if (membership.organization_id !== organizationId) {
      if (createdAuthUser) await admin.auth.admin.deleteUser(userId);
      return { error: "This email belongs to another shop" };
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) {
      if (createdAuthUser) await admin.auth.admin.deleteUser(userId);
      return { error: updateError.message };
    }

    if (membership.role !== role) {
      await admin.from("org_members").update({ role }).eq("user_id", userId);
    }

    const verifyError = await ensureUserCanSignIn(admin, userId, password);
    if (verifyError) return verifyError;

    return { userId, email, role };
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

  const verifyError = await ensureUserCanSignIn(admin, userId, password);
  if (verifyError) {
    if (createdAuthUser) await admin.auth.admin.deleteUser(userId);
    await admin.from("org_members").delete().eq("user_id", userId);
    return verifyError;
  }

  return { userId, email, role };
}
