import { createBrowserClient } from "@/lib/supabase/client";
import { catalogueImportError } from "./grocery-catalogue-readiness";

export type GroceryMeatImportResult = { added: number; existing: number; total: number };

/** The RPC inserts all missing templates in one database transaction. */
export async function importGroceryMeatCatalogue(orgId: string): Promise<GroceryMeatImportResult> {
  const client = createBrowserClient();
  if (!client) throw new Error("Cloud connection is unavailable.");
  const { data, error } = await client.rpc("import_grocery_meat_catalogue", {
    p_organization_id: orgId,
  });
  if (error) throw catalogueImportError(error);
  const result = data as Partial<GroceryMeatImportResult> | null;
  if (!result || !Number.isInteger(result.added) || !Number.isInteger(result.existing) || result.total !== 9) {
    throw new Error("The meat catalogue import did not return a valid result. Refresh Stock before retrying.");
  }
  return result as GroceryMeatImportResult;
}
