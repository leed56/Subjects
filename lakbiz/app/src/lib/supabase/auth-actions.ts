"use client";

import { createBrowserClient } from "./client";

export class AuthFlowError extends Error {
  constructor(
    message: string,
    public code: "email_confirmation" | "auth" | "org",
  ) {
    super(message);
    this.name = "AuthFlowError";
  }
}

async function ensureUserOrg(
  supabase: NonNullable<ReturnType<typeof createBrowserClient>>,
  userId: string,
  meta?: { shop_name?: string; phone?: string },
) {
  const { data: existing } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.organization_id;

  const shopName = meta?.shop_name?.trim();
  if (!shopName) return null;

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: shopName,
      phone: meta?.phone ?? null,
    })
    .select("id")
    .single();

  if (orgError) throw new AuthFlowError(orgError.message, "org");

  const { error: memberError } = await supabase.from("org_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) throw new AuthFlowError(memberError.message, "org");

  return org.id;
}

export async function signUpWithShop(input: {
  email: string;
  password: string;
  shopName: string;
  phone?: string;
}) {
  const supabase = createBrowserClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        shop_name: input.shopName,
        phone: input.phone ?? null,
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
    shop_name: input.shopName,
    phone: input.phone,
  });

  return { user: authData.user, organizationId: orgId };
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
        "Email not confirmed yet. Check your inbox and spam folder, click the link, then try Sign in again.",
        "email_confirmation",
      );
    }
    throw new AuthFlowError(error.message, "auth");
  }

  const meta = data.user?.user_metadata as {
    shop_name?: string;
    phone?: string;
  };

  await ensureUserOrg(supabase, data.user!.id, meta);

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("org_members")
    .select("organization_id, role, organizations(id, name, name_si, phone)")
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
}
