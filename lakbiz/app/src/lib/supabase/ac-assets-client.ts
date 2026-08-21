"use client";

/**
 * HVAC asset lifecycle records — cloud-only client (Phase 4). Reads/writes
 * go straight to Supabase, same simple direct-client pattern as
 * org-settings.ts / notification-log-client.ts, not the local-first sync
 * engine the rest of the app's entities use. See the migration file for
 * why. Requires being online — there is no offline queue for assets yet.
 */
import { createBrowserClient } from "./client";

export type AcAssetStatus = "active" | "inactive" | "removed" | "replaced";

export type AcAsset = {
  id: string;
  organizationId: string;
  customerId: string | null;
  siteAddress: string | null;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  indoorSerial: string | null;
  outdoorSerial: string | null;
  btu: number | null;
  acType: string | null;
  refrigerantType: string | null;
  installDate: string | null;
  warrantyExpiry: string | null;
  locationInProperty: string | null;
  status: AcAssetStatus;
  nextServiceDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AcAssetInput = {
  customerId?: string | null;
  siteAddress?: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  indoorSerial?: string;
  outdoorSerial?: string;
  btu?: number | null;
  acType?: string;
  refrigerantType?: string;
  installDate?: string | null;
  warrantyExpiry?: string | null;
  locationInProperty?: string;
  status?: AcAssetStatus;
  nextServiceDate?: string | null;
  notes?: string;
};

type AcAssetRow = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  site_address: string | null;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  indoor_serial: string | null;
  outdoor_serial: string | null;
  btu: number | null;
  ac_type: string | null;
  refrigerant_type: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  location_in_property: string | null;
  status: AcAssetStatus;
  next_service_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: AcAssetRow): AcAsset {
  return {
    id: row.id,
    organizationId: row.organization_id,
    customerId: row.customer_id,
    siteAddress: row.site_address,
    brand: row.brand,
    model: row.model,
    serialNo: row.serial_no,
    indoorSerial: row.indoor_serial,
    outdoorSerial: row.outdoor_serial,
    btu: row.btu,
    acType: row.ac_type,
    refrigerantType: row.refrigerant_type,
    installDate: row.install_date,
    warrantyExpiry: row.warranty_expiry,
    locationInProperty: row.location_in_property,
    status: row.status,
    nextServiceDate: row.next_service_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: AcAssetInput): Partial<AcAssetRow> {
  const row: Partial<AcAssetRow> = {};
  if ("customerId" in input) row.customer_id = input.customerId || null;
  if (input.siteAddress !== undefined) row.site_address = input.siteAddress.trim() || null;
  if (input.brand !== undefined) row.brand = input.brand.trim() || null;
  if (input.model !== undefined) row.model = input.model.trim() || null;
  if (input.serialNo !== undefined) row.serial_no = input.serialNo.trim() || null;
  if (input.indoorSerial !== undefined) row.indoor_serial = input.indoorSerial.trim() || null;
  if (input.outdoorSerial !== undefined) row.outdoor_serial = input.outdoorSerial.trim() || null;
  if (input.btu !== undefined) row.btu = input.btu;
  if (input.acType !== undefined) row.ac_type = input.acType.trim() || null;
  if (input.refrigerantType !== undefined) row.refrigerant_type = input.refrigerantType.trim() || null;
  if (input.installDate !== undefined) row.install_date = input.installDate || null;
  if (input.warrantyExpiry !== undefined) row.warranty_expiry = input.warrantyExpiry || null;
  if (input.locationInProperty !== undefined) row.location_in_property = input.locationInProperty.trim() || null;
  if (input.status !== undefined) row.status = input.status;
  if (input.nextServiceDate !== undefined) row.next_service_date = input.nextServiceDate || null;
  if (input.notes !== undefined) row.notes = input.notes.trim() || null;
  return row;
}

export async function fetchOrgAssets(organizationId: string): Promise<{ data: AcAsset[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("ac_assets")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as AcAssetRow[]).map(fromRow), error: null };
}

export async function fetchCustomerAssets(customerId: string): Promise<{ data: AcAsset[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("ac_assets")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as AcAssetRow[]).map(fromRow), error: null };
}

export async function createAsset(
  organizationId: string,
  input: AcAssetInput,
): Promise<{ data: AcAsset | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("ac_assets")
    .insert({ organization_id: organizationId, ...toRow(input) })
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };
  return { data: fromRow(data as AcAssetRow), error: null };
}

export async function updateAsset(
  id: string,
  input: AcAssetInput,
): Promise<{ data: AcAsset | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("ac_assets")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "Asset not found or no permission" };
  return { data: fromRow(data as AcAssetRow), error: null };
}

export async function deleteAsset(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Supabase not configured" };

  const { error } = await supabase.from("ac_assets").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export type AssetJob = {
  id: string;
  jobNo: string;
  jobDate: string;
  status: string;
  description: string;
  /** Phase 9 fields — real per-visit complaint/diagnosis, when recorded. */
  complaint: string | null;
  diagnosis: string | null;
  quotedAmount: number;
  assigneeType: string | null;
  /** Already masked to 0/null for non-financial roles by the ac_jobs view
   * itself (can_see_org_financials) — trusted as-is, not re-gated here. */
  subcontractCost: number | null;
  /** installation/service/repair/inspection/warranty/other — needed by
   * computeRepeatRepairSignal() (Phase 11), which only counts
   * repair/service visits. */
  jobType: string;
};

/** An asset's service/repair history — direct cloud read against the
 * (already tenant- and role-masked) ac_jobs view, filtered by asset_id.
 * Jobs created through the existing /jobs page can't set asset_id yet
 * (that page runs through the local-first sync engine, which doesn't know
 * about this column — see the migration file); this only reads jobs that
 * already reference an asset via a direct DB write. */
export async function fetchAssetJobs(assetId: string): Promise<{ data: AssetJob[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("ac_jobs")
    .select("id, job_no, job_date, status, description, complaint, diagnosis, quoted_amount, assignee_type, subcontract_cost, job_type")
    .eq("asset_id", assetId)
    .order("job_date", { ascending: false });

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      jobNo: r.job_no as string,
      jobDate: r.job_date as string,
      status: r.status as string,
      description: r.description as string,
      complaint: (r.complaint as string | null) ?? null,
      diagnosis: (r.diagnosis as string | null) ?? null,
      quotedAmount: Number(r.quoted_amount ?? 0),
      assigneeType: (r.assignee_type as string | null) ?? null,
      jobType: (r.job_type as string | null) ?? "installation",
      subcontractCost: r.subcontract_cost != null ? Number(r.subcontract_cost) : null,
    })),
    error: null,
  };
}

export type AssetJobItem = {
  jobId: string;
  itemType: string;
  name: string;
  qty: number;
  /** Masked to 0 for non-financial roles by the job_items view itself
   * (Phase 6) — trusted as-is. */
  lineTotal: number;
  /** job-parts-materials phase (Part 14/15, docs/JOB_PARTS_ARCHITECTURE.md
   * §2.7) — replacement/warranty columns the job_items view already
   * exposes (§2.1); added here for free, no new query shape needed. */
  isReplacement: boolean;
  oldComponentName: string | null;
  oldComponentDisposition: string | null;
  newComponentSerial: string | null;
  warrantyType: string | null;
  warrantyStartDate: string | null;
  warrantyExpiryDate: string | null;
  supplierId: string | null;
};

/** Parts/labour/service lines across every job linked to this asset — the
 * real, stored basis for "components replaced" and lifetime repair cost
 * (HVAC platform Phase 10). No separate manual "components replaced" log:
 * jobs are the authoritative service-history source, per the spec. */
export async function fetchAssetJobItems(jobIds: string[]): Promise<{ data: AssetJobItem[]; error: string | null }> {
  if (jobIds.length === 0) return { data: [], error: null };
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("job_items")
    .select(
      "job_id, item_type, name, qty, line_total, is_replacement, old_component_name, old_component_disposition, new_component_serial, warranty_type, warranty_start_date, warranty_expiry_date, supplier_id",
    )
    .in("job_id", jobIds);

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => ({
      jobId: r.job_id as string,
      itemType: r.item_type as string,
      name: r.name as string,
      qty: Number(r.qty ?? 0),
      lineTotal: Number(r.line_total ?? 0),
      isReplacement: Boolean(r.is_replacement),
      oldComponentName: (r.old_component_name as string | null) ?? null,
      oldComponentDisposition: (r.old_component_disposition as string | null) ?? null,
      newComponentSerial: (r.new_component_serial as string | null) ?? null,
      warrantyType: (r.warranty_type as string | null) ?? null,
      warrantyStartDate: (r.warranty_start_date as string | null) ?? null,
      warrantyExpiryDate: (r.warranty_expiry_date as string | null) ?? null,
      supplierId: (r.supplier_id as string | null) ?? null,
    })),
    error: null,
  };
}

export async function fetchAsset(id: string): Promise<{ data: AcAsset | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase.from("ac_assets").select("*").eq("id", id).maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: fromRow(data as AcAssetRow), error: null };
}

/** Read/write the asset a job references — a direct, narrow patch on the
 * ac_jobs view (`authenticated` already has UPDATE on it; RLS on the base
 * table still applies). Deliberately bypasses the local-first ACJob type
 * and business-sync.ts, which don't know about asset_id yet — see
 * docs/IMPLEMENTATION_PROGRESS.md, Phase 5. */
export async function fetchJobAssetId(jobId: string): Promise<{ data: string | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase.from("ac_jobs").select("asset_id").eq("id", jobId).maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: (data?.asset_id as string | null) ?? null, error: null };
}

export async function linkJobAsset(jobId: string, assetId: string | null): Promise<{ error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Supabase not configured" };

  const { error } = await supabase.from("ac_jobs").update({ asset_id: assetId }).eq("id", jobId);
  return { error: error?.message ?? null };
}
