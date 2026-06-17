"use client";

import type { AppData } from "@/lib/store/types";
import { parseAppData } from "@/lib/store/storage";
import { createBrowserClient } from "./client";

export type CloudAppDataRow = {
  data: AppData;
  updatedAt: string;
};

function hasOperationalData(data: AppData): boolean {
  return (
    data.products.length > 0 ||
    data.sales.length > 0 ||
    data.customers.length > 0 ||
    data.suppliers.length > 0 ||
    data.purchases.length > 0 ||
    data.acJobs.length > 0 ||
    data.vehicles.length > 0 ||
    data.bankAccounts.length > 0 ||
    data.cheques.length > 0
  );
}

/** Cloud wins when it has data; otherwise keep local for first-time upload. */
export function mergeAppDataOnLogin(
  local: AppData,
  cloud: AppData | null,
): { data: AppData; shouldUploadLocal: boolean } {
  if (!cloud || !hasOperationalData(cloud)) {
    return {
      data: local,
      shouldUploadLocal: hasOperationalData(local),
    };
  }
  return { data: cloud, shouldUploadLocal: false };
}

export async function fetchOrgAppData(
  organizationId: string,
): Promise<CloudAppDataRow | null> {
  const supabase = createBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("org_app_data")
    .select("data, updated_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) return null;

  try {
    return {
      data: parseAppData(data.data as Partial<AppData>),
      updatedAt: data.updated_at as string,
    };
  } catch {
    return null;
  }
}

export async function upsertOrgAppData(
  organizationId: string,
  appData: AppData,
): Promise<string | null> {
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    organization_id: organizationId,
    data: appData,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  };

  const { error } = await supabase.from("org_app_data").upsert(payload, {
    onConflict: "organization_id",
  });

  return error?.message ?? null;
}
