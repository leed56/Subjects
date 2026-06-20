"use client";

import { createBrowserClient } from "./client";
import { parseSectorId } from "@/lib/sectors";
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
  const { data: existing } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  return existing?.organization_id ?? null;
}

/** Create org + owner membership when the user has none yet. */
export async function ensureUserOrg(
  supabase: NonNullable<ReturnType<typeof createBrowserClient>>,
  userId: string,
  input: EnsureOrgInput = {},
): Promise<string | null> {
  const existingId = await findUserOrgId(supabase, userId);
  if (existingId) return existingId;

  const shopName = input.shopName?.trim() || "My Shop";

  const { data: orgId, error: orgError } = await supabase.rpc(
    "bootstrap_user_organization",
    {
      p_name: shopName,
      p_phone: input.phone?.trim() || null,
      p_sector: parseSectorId(input.sector),
    },
  );

  if (orgError) throw new AuthFlowError(orgError.message, "org");
  if (!orgId) throw new AuthFlowError("Could not create shop", "org");

  return orgId as string;
}

export async function signUpWithShop(input: {
  email: string;
  password: string;
  shopName: string;
  phone?: string;
  sector: SectorId;
}) {
  if (process.env.NEXT_PUBLIC_ADMIN_ONLY === "true") {
    throw new AuthFlowError(
      "Public signup is disabled. Contact your LakBiz administrator.",
      "auth",
    );
  }

  const supabase = createBrowserClient();
  if (!supabase) throw new Error("Supabase not configured");

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/login`
      : undefined;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        shop_name: input.shopName,
        phone: input.phone ?? null,
        sector: input.sector,
      },
    },
  });

  if (authError) throw new AuthFlowError(authError.message, "auth");
  if (!authData.user) throw new AuthFlowError("Sign up failed", "auth");

  // No session until email is confirmed (Supabase default)
  if (!authData.session) {
    throw new AuthFlowError(
      "Account created. Check your email (inbox + spam) and click Confirm, then Sign in here.",
      "email_confirmation",
    );
  }

  const orgId = await ensureUserOrg(supabase, authData.user.id, {
    shopName: input.shopName,
    phone: input.phone,
    sector: input.sector,
  });

  return { user: authData.user, organizationId: orgId };
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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      throw new AuthFlowError(
        "Email not confirmed yet. Use Resend email below, or check spam for mail from noreply@mail.app.supabase.io",
        "email_confirmation",
      );
    }
    throw new AuthFlowError(error.message, "auth");
  }

  const meta = data.user?.user_metadata as {
    shop_name?: string;
    phone?: string;
    sector?: string;
  };
  const isPlatformAdmin = await isPlatformAdminClient(supabase);
  if (!isPlatformAdmin) {
    const emailPrefix = email.split("@")[0]?.trim();
    await ensureUserOrg(supabase, data.user!.id, {
      shopName: meta?.shop_name ?? emailPrefix,
      phone: meta?.phone,
      sector: meta?.sector,
    });
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

    const { data: member } = await supabase
      .from("org_members")
      .select("organization_id, role, organizations(id, name, name_si, phone, sector)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) return { user, org: null, subscription: null };

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_id, status, billing_cycle, trial_ends_at, current_period_end")
      .eq("organization_id", member.organization_id)
      .maybeSingle();

    const orgRaw = member.organizations;
    const orgRow = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;

    return {
      user,
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
