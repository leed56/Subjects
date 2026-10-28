import type { SupabaseClient } from "@supabase/supabase-js";
import { messageRequiresAcJobs, sectorAllowsMessage } from "./sector-policy";

/** Resolve the sector from the signed-in organization, never a request field. */
export async function messageSectorAccessError(supabase: SupabaseClient, organizationId: string, contextType?: unknown, templateId?: unknown): Promise<string | null> {
  const { data: org, error } = await supabase.from("organizations").select("sector").eq("id", organizationId).maybeSingle();
  if (error || !org?.sector) return "Unable to verify the shop's workspace template.";
  if (!sectorAllowsMessage(org.sector, contextType, templateId)) return "AC service messages are available only to HVAC workspaces.";
  if (messageRequiresAcJobs(contextType, templateId)) {
    const { data, error: moduleError } = await supabase.rpc("org_has_module", { org_id: organizationId, module_key: "ac_jobs" });
    if (moduleError || data !== true) return "AC jobs are not enabled for this workspace.";
  }
  return null;
}
