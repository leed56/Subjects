"use client";

import { createBrowserClient } from "./client";
import { parseSectorId } from "@/lib/sectors";
import { parseOrgRole } from "@/lib/org-role/permissions";
import type { SectorId } from "@/lib/types";

export class AuthFlowError extends Error {
  constructor(
    message: string,
    public code: "email_confirmation" | "auth" | "org",
  ) {
    super(message);
    this.name = "AuthFlowError";
  }
}

export type EnsureOrgInput = {
  shopName?: string;
  phone?: string;
  sector?: string;
};

export async function isPlatformAdminClient(
  supabase: NonNullable<ReturnType<typeof createBrowserClient>>,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("platform_admins")
      .select("user_id")
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

async function findUserOrgId(
  supabase: NonNullable<ReturnType<typeof createBrowserClient>>,
  userId: string,
): Promise<string | null> {
  const { data: rows } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1);

  return rows?.[0]?.organization_id ?? null;
}

/**
 * Compatibility helper retained for existing callers. Shop creation is no
 * longer a client-side operation: platform admin provisioning must create the
 * organization and membership before a shop user can access LakBiz.
 */
export async function ensureUserOrg(
  supabase: NonNullable<ReturnType<typeof createBrowserClient>>,
  userId: string,
  _input: EnsureOrgInput = {},
): Promise<string | null> {
  const existingId = await findUserOrgId(supabase, userId);
  if (existingId) return existingId;

  throw new AuthFlowError(
    "No LakBiz workspace is assigned to this login. Contact your LakBiz administrator.",
    "org",
  );
}

export async function signUpWithShop(input: {
  email: string;
  password: string;
  shopName: string;
  phone?: string;
  sector: SectorId;
}) {
  void input;
  throw new AuthFlowError(
    "Public shop signup is disabled. LakBiz workspaces and business configuration are created by the platform administrator.",
    "auth",
  );
}

export async function resendConfirmationEmail(email: string) {
  const supabase = createBrowserClient();
  if (!supabase) throw new Error("Supabase not configured");

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/login`
      : undefined;

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    if (error.message.toLowerCase().includes("rate limit")) {
      throw new AuthFlowError(
        "Please wait a minute before requesting another email.",
        "auth",
      );
    }
    throw new AuthFlowError(error.message, "auth");
  }
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createBrowserClient();
  if (!supabase) throw new Error("Supabase not configured");

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: normalizedPassword,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("email not confirmed")) {
      throw new AuthFlowError(
        "Email not confirmed yet. Ask your shop owner to reset your password from Settings → Team, or use Resend email below.",
        "email_confirmation",
      );
    }
    if (msg.includes("invalid login credentials")) {
      throw new AuthFlowError(
        "Invalid email or password. Check for extra spaces and ask the owner to reset your password from Settings → Team if needed.",
        "auth",
      );
    }
    throw new AuthFlowError(error.message, "auth");
  }

  const isPlatformAdmin = await isPlatformAdminClient(supabase);
  if (!isPlatformAdmin) {
    const existingOrgId = await findUserOrgId(supabase, data.user!.id);
    if (!existingOrgId) {
      await supabase.auth.signOut();
      throw new AuthFlowError(
        "This login has no LakBiz workspace assigned. Contact your LakBiz administrator.",
        "org",
      );
    }
  }

  return data;
}

export async function signOut() {
  const supabase = createBrowserClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function fetchUserOrg() {
  const supabase = createBrowserClient();
  if (!supabase) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: memberRows } = await supabase
      .from("org_members")
      .select("organization_id, role, organizations(id, name, name_si, phone, sector)")
      .eq("user_id", user.id)
      .limit(1);

    const member = memberRows?.[0];
    if (!member) return { user, org: null, subscription: null, role: null };

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_id, status, billing_cycle, trial_ends_at, current_period_end")
      .eq("organization_id", member.organization_id)
      .maybeSingle();

    const orgRaw = member.organizations;
    const orgRow = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;

    return {
      user,
      role: parseOrgRole(member.role as string),
      org: orgRow
        ? {
            id: orgRow.id as string,
            name: orgRow.name as string,
            phone: (orgRow.phone as string | null) ?? undefined,
            sector: parseSectorId(orgRow.sector as string | null),
          }
        : null,
      subscription: subscription
        ? {
            planId: subscription.plan_id,
            status: subscription.status,
            billingCycle: subscription.billing_cycle,
            trialEndsAt: subscription.trial_ends_at,
            currentPeriodEnd: subscription.current_period_end,
          }
        : null,
    };
  } catch {
    return null;
  }
}
