"use client";

import { useEffect, useState } from "react";
import type { OrganizationState, OrgRole } from "@/lib/subscription/types";
import { fetchGroceryCatalogueReadiness, type GroceryCatalogueKind, type GroceryCatalogueReadiness } from "@/lib/supabase/grocery-catalogue-readiness";

export function useGroceryCatalogueReadiness(kind: GroceryCatalogueKind, org: OrganizationState, role: OrgRole) {
  const [result, setResult] = useState<{ orgId: string; readiness: GroceryCatalogueReadiness } | null>(null);
  useEffect(() => {
    if (!org.isAuthenticated || !org.id || org.sector !== "grocery" || role !== "owner") return;
    let cancelled = false;
    void fetchGroceryCatalogueReadiness(org.id).then((readiness) => {
      if (!cancelled) setResult({ orgId: org.id!, readiness });
    });
    return () => { cancelled = true; };
  }, [org.id, org.isAuthenticated, org.sector, role]);

  const checking = org.isAuthenticated && (!result || result.orgId !== org.id);
  return {
    checking,
    ready: !org.isAuthenticated || (!checking && result?.readiness[kind] === true),
    reason: result?.orgId === org.id ? result.readiness.reason : undefined,
    markSetupPending: () => { if (org.id) setResult({ orgId: org.id, readiness: { mill: false, meat: false, reason: "setup" } }); },
  };
}
