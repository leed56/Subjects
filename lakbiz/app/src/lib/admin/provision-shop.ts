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

  // 1. Create the owner auth user.
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

  // 2. Atomic organization + owner membership + subscription (single source of truth).
  const trialing = trialDays > 0;
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  const periodEnd = trialing ? trialEnd.toISOString() : null;

  const { data: orgId, error: provisionError } = await admin.rpc("provision_shop", {
    p_owner_id: userId,
    p_name: shopName,
    p_phone: input.phone?.trim() || null,
    p_sector: sector,
    p_plan_id: planId,
    p_status: trialing ? "trialing" : "active",
    p_trial_ends_at: trialing ? trialEnd.toISOString() : null,
    p_period_end: periodEnd,
  });

  if (provisionError || !orgId) {
    // The RPC is all-or-nothing, so only the auth user can be left behind.
    await admin.auth.admin.deleteUser(userId);
    return { data: null, error: provisionError?.message ?? "Could not provision shop" };
  }

  return {
    data: {
      organizationId: orgId as string,
      userId,
      email,
      sector,
      planId,
    },
    error: null,
  };
}
