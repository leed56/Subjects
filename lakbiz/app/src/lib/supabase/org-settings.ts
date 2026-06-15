"use client";

import type { BusinessInfo } from "@/lib/invoice";
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

  const { error } = await supabase
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
    .eq("id", organizationId);

  if (error) return error.message;
  return null;
}
