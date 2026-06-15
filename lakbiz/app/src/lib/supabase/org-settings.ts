"use client";

import type { BusinessInfo } from "@/lib/invoice";
import { ensureUserOrg } from "./auth-actions";
import { createBrowserClient } from "./client";

export type OrgShopSettings = {
  name: string;
  phone?: string;
  address?: string;
  tin?: string;
  vatRegistered: boolean;
  vatNumber?: string;
  quarterStartMonth: number;
};

export function mergeBusinessSettings(
  local: BusinessInfo,
  cloud: BusinessInfo | null,
): BusinessInfo {
  if (!cloud) return local;

  const localIsDefault =
    local.name === "My Shop" &&
    !local.phone &&
    !local.address &&
    !local.vatRegistered &&
    !local.vatNumber;

  return {
    ...cloud,
    ...local,
    name: localIsDefault && cloud.name ? cloud.name : local.name,
    phone: local.phone ?? cloud.phone,
    address: local.address ?? cloud.address,
    tin: local.tin ?? cloud.tin,
    vatRegistered:
      local.vatRegistered != null
        ? local.vatRegistered
        : (cloud.vatRegistered ?? false),
    vatNumber: local.vatNumber ?? cloud.vatNumber,
    quarterStartMonth: local.quarterStartMonth ?? cloud.quarterStartMonth ?? 4,
  };
}

export async function getOrCreateOrgForUser(
  userId: string,
  business: BusinessInfo,
): Promise<{ orgId: string | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { orgId: null, error: "Supabase not configured" };

  try {
    const orgId = await ensureUserOrg(supabase, userId, {
      shopName: business.name,
      phone: business.phone,
    });
    return { orgId, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create shop";
    return { orgId: null, error: message };
  }
}
export function businessFromOrg(row: {
  name: string;
  phone?: string | null;
  address?: string | null;
  tin?: string | null;
  vat_registered?: boolean | null;
  vat_number?: string | null;
  quarter_start_month?: number | null;
}): BusinessInfo {
  return {
    name: row.name,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    tin: row.tin ?? undefined,
    vatRegistered: row.vat_registered ?? false,
    vatNumber: row.vat_number ?? row.tin ?? undefined,
    quarterStartMonth: row.quarter_start_month ?? 4,
  };
}

export async function fetchOrgShopSettings(
  organizationId: string,
): Promise<BusinessInfo | null> {
  const supabase = createBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select(
      "name, phone, address, tin, vat_registered, vat_number, quarter_start_month",
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return businessFromOrg(data);
}

export async function saveOrgShopSettings(
  organizationId: string,
  business: BusinessInfo,
): Promise<string | null> {
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: business.name.trim() || "My Shop",
      phone: business.phone?.trim() || null,
      address: business.address?.trim() || null,
      tin: business.vatNumber?.trim() || business.tin?.trim() || null,
      vat_registered: business.vatRegistered ?? false,
      vat_number: business.vatNumber?.trim() || null,
      quarter_start_month: business.quarterStartMonth ?? 4,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) return error.message;
  if (!data) {
    return "No permission to update shop (sign in as shop owner)";
  }
  return null;
}
