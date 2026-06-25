"use client";

import type { BusinessInfo } from "@/lib/invoice";
import { clampCompanyIncomeTaxRatePct } from "@/lib/income-tax";
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
  companyIncomeTaxRate: number;
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
    nameSi: local.nameSi ?? cloud.nameSi,
    phone: local.phone ?? cloud.phone,
    email: local.email ?? cloud.email,
    address: local.address ?? cloud.address,
    tin: local.tin ?? cloud.tin,
    brNumber: local.brNumber ?? cloud.brNumber,
    logoDataUrl: local.logoDataUrl ?? cloud.logoDataUrl,
    invoiceFooter: local.invoiceFooter ?? cloud.invoiceFooter,
    vatRegistered:
      local.vatRegistered != null
        ? local.vatRegistered
        : (cloud.vatRegistered ?? false),
    vatNumber: local.vatNumber ?? cloud.vatNumber,
    quarterStartMonth: local.quarterStartMonth ?? cloud.quarterStartMonth ?? 4,
    companyIncomeTaxRate:
      local.companyIncomeTaxRate ?? cloud.companyIncomeTaxRate ?? 30,
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
type OrgSettingsRow = {
  name: string;
  name_si?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tin?: string | null;
  br_number?: string | null;
  logo_url?: string | null;
  invoice_footer?: string | null;
  vat_registered?: boolean | null;
  vat_number?: string | null;
  quarter_start_month?: number | null;
  company_income_tax_rate?: number | null;
};

export function businessFromOrg(row: OrgSettingsRow): BusinessInfo {
  return {
    name: row.name,
    nameSi: row.name_si ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    tin: row.tin ?? undefined,
    brNumber: row.br_number ?? undefined,
    logoDataUrl: row.logo_url ?? undefined,
    invoiceFooter: row.invoice_footer ?? undefined,
    vatRegistered: row.vat_registered ?? false,
    vatNumber: row.vat_number ?? undefined,
    quarterStartMonth: row.quarter_start_month ?? 4,
    companyIncomeTaxRate: clampCompanyIncomeTaxRatePct(
      row.company_income_tax_rate ?? undefined,
    ),
  };
}

const BASE_COLUMNS =
  "name, phone, address, tin, vat_registered, vat_number, quarter_start_month";
const BASE_WITH_TAX = `${BASE_COLUMNS}, company_income_tax_rate`;
const PREMIUM_COLUMNS = "name_si, email, br_number, logo_url, invoice_footer";

export async function fetchOrgShopSettings(
  organizationId: string,
): Promise<BusinessInfo | null> {
  const supabase = createBrowserClient();
  if (!supabase) return null;

  const trySelect = async (columns: string) =>
    supabase
      .from("organizations")
      .select(columns)
      .eq("id", organizationId)
      .maybeSingle();

  const withTaxPremium = await trySelect(`${BASE_WITH_TAX}, ${PREMIUM_COLUMNS}`);
  if (!withTaxPremium.error && withTaxPremium.data) {
    return businessFromOrg(withTaxPremium.data as unknown as OrgSettingsRow);
  }

  const withTax = await trySelect(BASE_WITH_TAX);
  if (!withTax.error && withTax.data) {
    return businessFromOrg(withTax.data as unknown as OrgSettingsRow);
  }

  const withPremium = await trySelect(`${BASE_COLUMNS}, ${PREMIUM_COLUMNS}`);
  if (!withPremium.error && withPremium.data) {
    return businessFromOrg(withPremium.data as unknown as OrgSettingsRow);
  }

  const base = await trySelect(BASE_COLUMNS);
  if (base.error || !base.data) return null;
  return businessFromOrg(base.data as unknown as OrgSettingsRow);
}

export async function saveOrgShopSettings(
  organizationId: string,
  business: BusinessInfo,
): Promise<string | null> {
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  // Primary update — only columns that always exist. Must succeed.
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: business.name.trim() || "My Shop",
      phone: business.phone?.trim() || null,
      address: business.address?.trim() || null,
      tin: business.tin?.trim() || null,
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

  // Best-effort — column added in migration 20250625000001.
  await supabase
    .from("organizations")
    .update({
      company_income_tax_rate: clampCompanyIncomeTaxRatePct(
        business.companyIncomeTaxRate,
      ),
    })
    .eq("id", organizationId);

  // Best-effort premium fields — silently ignored until the migration runs.
  await supabase
    .from("organizations")
    .update({
      name_si: business.nameSi?.trim() || null,
      email: business.email?.trim() || null,
      br_number: business.brNumber?.trim() || null,
      logo_url: business.logoDataUrl || null,
      invoice_footer: business.invoiceFooter?.trim() || null,
    })
    .eq("id", organizationId);

  return null;
}
