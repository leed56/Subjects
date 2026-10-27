import { createBrowserClient } from "@/lib/supabase/client";

export type GrindingMillImportResult = { added: number; existing: number; total: number };

/** The RPC inserts all missing templates in one database transaction. */
export async function importGrindingMillCatalogue(orgId: string): Promise<GrindingMillImportResult> {
  const client = createBrowserClient();
  if (!client) throw new Error("Cloud connection is unavailable.");
  const { data, error } = await client.rpc("import_grocery_mill_catalogue", {
    p_organization_id: orgId,
  });
  if (error) throw new Error(error.message);
  const result = data as Partial<GrindingMillImportResult> | null;
  if (!result || !Number.isInteger(result.added) || !Number.isInteger(result.existing) || result.total !== 36) {
    throw new Error("The catalogue import did not return a valid result. Refresh Stock before retrying.");
  }
  return result as GrindingMillImportResult;
}
