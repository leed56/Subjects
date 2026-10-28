import { createBrowserClient } from "./client";

export type GroceryCatalogueKind = "mill" | "meat";
export type GroceryCatalogueReadiness = {
  mill: boolean;
  meat: boolean;
  reason?: "setup" | "connection";
};

export function isCatalogueSetupError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const row = error as { code?: string; message?: string };
  return row.code === "PGRST202" || row.code === "42883" ||
    Boolean(row.message?.includes("schema cache") && row.message?.includes("function"));
}

/** Never probe an import function: even a capability check must not add data. */
export async function fetchGroceryCatalogueReadiness(orgId: string): Promise<GroceryCatalogueReadiness> {
  const client = createBrowserClient();
  if (!client || !orgId) return { mill: false, meat: false, reason: "connection" };
  try {
    const { data, error } = await client.rpc("grocery_catalogue_readiness", { p_organization_id: orgId }, { get: true });
    if (error) return { mill: false, meat: false, reason: isCatalogueSetupError(error) ? "setup" : "connection" };
    if (!data || typeof data.mill !== "boolean" || typeof data.meat !== "boolean") return { mill: false, meat: false, reason: "connection" };
    return { mill: data.mill, meat: data.meat, ...(!data.mill || !data.meat ? { reason: "setup" as const } : {}) };
  } catch {
    return { mill: false, meat: false, reason: "connection" };
  }
}

export class CatalogueImportError extends Error {
  constructor(readonly setupRequired: boolean) {
    super(setupRequired ? "Catalogue setup is pending." : "The catalogue could not be imported. Check your connection and retry.");
  }
}

export function catalogueImportError(error: unknown): CatalogueImportError {
  return new CatalogueImportError(isCatalogueSetupError(error));
}
