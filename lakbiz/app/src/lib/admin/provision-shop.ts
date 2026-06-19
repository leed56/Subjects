import { parseSectorId } from "@/lib/sectors";
import type { PlanId } from "@/lib/subscription/types";
import type { SectorId } from "@/lib/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getTemplate } from "./templates";

export type ProvisionShopInput = {
  shopName: string;
  ownerEmail: string;
  password: string;
  phone?: string;
  templateId: string;
  planId?: PlanId;
  trialDays?: number;
};

export type ProvisionShopResult = {
  organizationId: string;
  userId: string;
  email: string;
  sector: SectorId;
  planId: PlanId;
};

export async function provisionShop(
  input: ProvisionShopInput,
): Promise<{ data: ProvisionShopResult | null; error: string | null }> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { data: null, error: "SUPABASE_SERVICE_ROLE_KEY not configured on server" };
  }

  const template = getTemplate(input.templateId);
  if (!template) {
    return { data: null, error: "Invalid business template" };
  }

  const shopName = input.shopName.trim();
  const email = input.ownerEmail.trim().toLowerCase();
  const password = input.password;

  if (!shopName || !email || password.length < 6) {
    return { data: null, error: "Shop name, valid email, and password (6+ chars) required" };
  }

  const planId = input.planId ?? template.defaultPlanId;
  const trialDays = input.trialDays ?? 14;
  const sector = parseSectorId(template.sectorId);

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      shop_name: shopName,
      sector,
      provisioned_by: "platform_admin",
    },
  });

  if (authError) {
    return { data: null, error: authError.message };
  }

  const userId = authData.user.id;

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: shopName,
      phone: input.phone?.trim() || null,
      sector,
    })
    .select("id")
    .single();

  if (orgError || !org) {
    await admin.auth.admin.deleteUser(userId);
    return { data: null, error: orgError?.message ?? "Could not create organization" };
  }

  const { error: memberError } = await admin.from("org_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    return { data: null, error: memberError.message };
  }

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);

  const { error: subError } = await admin
    .from("subscriptions")
    .update({
      plan_id: planId,
      status: trialDays > 0 ? "trialing" : "active",
      trial_ends_at: trialDays > 0 ? trialEnd.toISOString() : null,
      current_period_start: new Date().toISOString(),
      current_period_end: trialDays > 0 ? trialEnd.toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", org.id);

  if (subError) {
    await admin.from("org_members").delete().eq("organization_id", org.id);
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    return { data: null, error: subError.message };
  }

  return {
    data: {
      organizationId: org.id,
      userId,
      email,
      sector,
      planId,
    },
    error: null,
  };
}
