"use client";

import { createBrowserClient } from "./client";

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
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign up failed");

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: input.shopName,
      phone: input.phone ?? null,
    })
    .select("id")
    .single();

  if (orgError) throw orgError;

  const { error: memberError } = await supabase.from("org_members").insert({
    organization_id: org.id,
    user_id: authData.user.id,
    role: "owner",
  });

  if (memberError) throw memberError;

  return { user: authData.user, organizationId: org.id };
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createBrowserClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
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
