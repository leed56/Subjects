import type { PlanId } from "@/lib/subscription/types";

const VALID_PLANS: PlanId[] = ["starter", "business", "pro"];
const MAX_TRIAL_DAYS = 90;

export type ProvisionShopBody = {
  shopName: string;
  ownerEmail: string;
  password: string;
  phone?: string;
  templateId: string;
  planId?: PlanId;
  trialDays?: number;
};

export type NormalizedProvisionInput = {
  shopName: string;
  ownerEmail: string;
  password: string;
  phone?: string;
  templateId: string;
  planId?: PlanId;
  trialDays: number;
};

export function normalizeProvisionInput(
  input: ProvisionShopBody,
): { data: NormalizedProvisionInput } | { error: string } {
  const shopName = input.shopName.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const password = input.password;
  const templateId = input.templateId.trim() || "grocery";

  if (!shopName) {
    return { error: "Shop name is required" };
  }

  if (!ownerEmail || !ownerEmail.includes("@")) {
    return { error: "Valid owner email is required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  if (input.planId && !VALID_PLANS.includes(input.planId)) {
    return { error: "Invalid plan" };
  }

  const trialDaysRaw = input.trialDays ?? 14;
  if (!Number.isFinite(trialDaysRaw) || trialDaysRaw < 0 || trialDaysRaw > MAX_TRIAL_DAYS) {
    return { error: `Trial days must be between 0 and ${MAX_TRIAL_DAYS}` };
  }

  const trialDays = Math.floor(trialDaysRaw);

  return {
    data: {
      shopName,
      ownerEmail,
      password,
      phone: input.phone?.trim() || undefined,
      templateId,
      planId: input.planId,
      trialDays,
    },
  };
}
