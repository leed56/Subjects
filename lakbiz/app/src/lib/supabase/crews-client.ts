"use client";

/**
 * Installation & maintenance crews — cloud-only client (Phase 6), same
 * simple direct-Supabase pattern as ac-assets-client.ts (Phase 4). See the
 * migration file for why. Requires being online — there is no offline
 * queue for crews yet.
 */
import { createBrowserClient } from "./client";

export type CrewType = "installation" | "maintenance" | "mixed";
export type CrewMemberType = "technician" | "contractor";

export type Crew = {
  id: string;
  organizationId: string;
  name: string;
  crewType: CrewType;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrewInput = {
  name?: string;
  crewType?: CrewType;
  active?: boolean;
  notes?: string;
};

export type CrewMember = {
  id: string;
  crewId: string;
  memberType: CrewMemberType;
  memberId: string;
  isLead: boolean;
  createdAt: string;
};

type CrewRow = {
  id: string;
  organization_id: string;
  name: string;
  crew_type: CrewType;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CrewMemberRow = {
  id: string;
  crew_id: string;
  member_type: CrewMemberType;
  member_id: string;
  is_lead: boolean;
  created_at: string;
};

function fromRow(row: CrewRow): Crew {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    crewType: row.crew_type,
    active: row.active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function memberFromRow(row: CrewMemberRow): CrewMember {
  return {
    id: row.id,
    crewId: row.crew_id,
    memberType: row.member_type,
    memberId: row.member_id,
    isLead: row.is_lead,
    createdAt: row.created_at,
  };
}

function toRow(input: CrewInput): Partial<CrewRow> {
  const row: Partial<CrewRow> = {};
  if (input.name !== undefined) row.name = input.name.trim();
  if (input.crewType !== undefined) row.crew_type = input.crewType;
  if (input.active !== undefined) row.active = input.active;
  if (input.notes !== undefined) row.notes = input.notes.trim() || null;
  return row;
}

export async function fetchOrgCrews(organizationId: string): Promise<{ data: Crew[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("crews")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as CrewRow[]).map(fromRow), error: null };
}

export async function fetchCrew(id: string): Promise<{ data: Crew | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase.from("crews").select("*").eq("id", id).maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: fromRow(data as CrewRow), error: null };
}

export async function createCrew(
  organizationId: string,
  input: CrewInput,
): Promise<{ data: Crew | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("crews")
    .insert({ organization_id: organizationId, ...toRow(input) })
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };
  return { data: fromRow(data as CrewRow), error: null };
}

export async function updateCrew(
  id: string,
  input: CrewInput,
): Promise<{ data: Crew | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("crews")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "Crew not found or no permission" };
  return { data: fromRow(data as CrewRow), error: null };
}

export async function deleteCrew(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Supabase not configured" };

  const { error } = await supabase.from("crews").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function fetchCrewMembers(crewId: string): Promise<{ data: CrewMember[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("crew_members")
    .select("*")
    .eq("crew_id", crewId)
    .order("is_lead", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as CrewMemberRow[]).map(memberFromRow), error: null };
}

/** All crew_members rows for an org in one query (organization_id is
 * denormalized onto crew_members, see the migration file), so the list
 * page can show a member count per crew without an N+1 fetch. */
export async function fetchOrgCrewMembers(organizationId: string): Promise<{ data: CrewMember[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("crew_members")
    .select("*")
    .eq("organization_id", organizationId);

  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as CrewMemberRow[]).map(memberFromRow), error: null };
}

export async function addCrewMember(
  crewId: string,
  organizationId: string,
  memberType: CrewMemberType,
  memberId: string,
  isLead = false,
): Promise<{ data: CrewMember | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("crew_members")
    .insert({ crew_id: crewId, organization_id: organizationId, member_type: memberType, member_id: memberId, is_lead: isLead })
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };
  return { data: memberFromRow(data as CrewMemberRow), error: null };
}

export async function setCrewMemberLead(memberRowId: string, isLead: boolean): Promise<{ error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Supabase not configured" };

  const { error } = await supabase.from("crew_members").update({ is_lead: isLead }).eq("id", memberRowId);
  return { error: error?.message ?? null };
}

export async function removeCrewMember(memberRowId: string): Promise<{ error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Supabase not configured" };

  const { error } = await supabase.from("crew_members").delete().eq("id", memberRowId);
  return { error: error?.message ?? null };
}

export type CrewJob = {
  id: string;
  jobNo: string;
  jobDate: string;
  status: string;
  description: string;
};

/** A crew's assigned-job history — direct cloud read against the
 * (already tenant- and role-masked) ac_jobs view, filtered by crew_id.
 * Jobs created through the existing /jobs page can't set crew_id yet
 * (that page runs through the local-first sync engine, which doesn't know
 * about this column — see the migration file); this only reads jobs that
 * already reference a crew via a direct DB write. */
export async function fetchCrewJobs(crewId: string): Promise<{ data: CrewJob[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("ac_jobs")
    .select("id, job_no, job_date, status, description")
    .eq("crew_id", crewId)
    .order("job_date", { ascending: false });

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      jobNo: r.job_no as string,
      jobDate: r.job_date as string,
      status: r.status as string,
      description: r.description as string,
    })),
    error: null,
  };
}
