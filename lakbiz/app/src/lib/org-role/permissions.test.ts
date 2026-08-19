import { describe, it, expect } from "vitest";
import {
  parseOrgRole,
  canSeeFinancials,
  canManageTeam,
  canAccessShopRoute,
  canManageAcJobs,
  canOperateAcJobs,
  canUpdateAcJob,
  sanitizeAcJobInputForRole,
  canAccessSettingsPath,
  canUseSuppliersModule,
  canUseBankingModule,
} from "./permissions";
import type { OrgRole } from "@/lib/subscription/types";

/**
 * Test-coverage pass — the other gap explicitly flagged after Phase 22
 * ("the role/permission matrix... not done in this pass"). This file is
 * the documented source of truth for what each of the 5 roles can do
 * (see its own header comment/table) and was the exact subject of the
 * Phase 19 security audit — locking its documented behavior down with
 * tests means a future edit that silently loosens a role's access fails
 * a test instead of shipping as a live security regression.
 */

const ALL_ROLES: OrgRole[] = ["owner", "manager", "data_entry", "cashier", "technician"];

describe("parseOrgRole", () => {
  it("accepts every valid role string as-is", () => {
    for (const role of ALL_ROLES) {
      expect(parseOrgRole(role)).toBe(role);
    }
  });

  it("defaults to owner for null, undefined, or an unrecognized string", () => {
    expect(parseOrgRole(null)).toBe("owner");
    expect(parseOrgRole(undefined)).toBe("owner");
    expect(parseOrgRole("superadmin")).toBe("owner");
    expect(parseOrgRole("")).toBe("owner");
  });
});

describe("canSeeFinancials", () => {
  it("is true only for owner and manager", () => {
    expect(canSeeFinancials("owner")).toBe(true);
    expect(canSeeFinancials("manager")).toBe(true);
    expect(canSeeFinancials("data_entry")).toBe(false);
    expect(canSeeFinancials("cashier")).toBe(false);
    expect(canSeeFinancials("technician")).toBe(false);
  });
});

describe("canManageTeam", () => {
  it("is true only for owner — per the matrix, manager cannot invite team members", () => {
    expect(canManageTeam("owner")).toBe(true);
    for (const role of ALL_ROLES.filter((r) => r !== "owner")) {
      expect(canManageTeam(role)).toBe(false);
    }
  });
});

describe("canAccessShopRoute", () => {
  it("owner and manager can access every route, including ones on no explicit list", () => {
    for (const role of ["owner", "manager"] as OrgRole[]) {
      expect(canAccessShopRoute(role, "/job-costing")).toBe(true);
      expect(canAccessShopRoute(role, "/expenses")).toBe(true);
      expect(canAccessShopRoute(role, "/reports")).toBe(true);
      expect(canAccessShopRoute(role, "/suppliers")).toBe(true);
      expect(canAccessShopRoute(role, "/banking")).toBe(true);
    }
  });

  it("cashier is restricted to the shop-staff routes only — no AC jobs, no financial pages", () => {
    expect(canAccessShopRoute("cashier", "/dashboard")).toBe(true);
    expect(canAccessShopRoute("cashier", "/sales")).toBe(true);
    expect(canAccessShopRoute("cashier", "/stock")).toBe(true);
    expect(canAccessShopRoute("cashier", "/customers")).toBe(true);
    expect(canAccessShopRoute("cashier", "/bills")).toBe(true);

    expect(canAccessShopRoute("cashier", "/jobs")).toBe(false);
    expect(canAccessShopRoute("cashier", "/schedule")).toBe(false);
    expect(canAccessShopRoute("cashier", "/workforce")).toBe(false);
    expect(canAccessShopRoute("cashier", "/suppliers")).toBe(false);
    expect(canAccessShopRoute("cashier", "/banking")).toBe(false);
    expect(canAccessShopRoute("cashier", "/job-costing")).toBe(false);
    expect(canAccessShopRoute("cashier", "/expenses")).toBe(false);
    expect(canAccessShopRoute("cashier", "/reports")).toBe(false);
  });

  it("data_entry gets shop-staff routes plus the AC jobs front desk, but no financial pages", () => {
    expect(canAccessShopRoute("data_entry", "/sales")).toBe(true);
    expect(canAccessShopRoute("data_entry", "/jobs")).toBe(true);
    expect(canAccessShopRoute("data_entry", "/assets")).toBe(true);
    expect(canAccessShopRoute("data_entry", "/schedule")).toBe(true);

    expect(canAccessShopRoute("data_entry", "/workforce")).toBe(false);
    expect(canAccessShopRoute("data_entry", "/suppliers")).toBe(false);
    expect(canAccessShopRoute("data_entry", "/banking")).toBe(false);
    expect(canAccessShopRoute("data_entry", "/job-costing")).toBe(false);
    expect(canAccessShopRoute("data_entry", "/expenses")).toBe(false);
    expect(canAccessShopRoute("data_entry", "/reports")).toBe(false);
  });

  it("technician gets the job/field-ops routes plus dashboard, but no shop/sales/financial routes", () => {
    expect(canAccessShopRoute("technician", "/dashboard")).toBe(true); // deliberately included to avoid a redirect loop — see permissions.ts
    expect(canAccessShopRoute("technician", "/jobs")).toBe(true);
    expect(canAccessShopRoute("technician", "/schedule")).toBe(true);
    expect(canAccessShopRoute("technician", "/workforce")).toBe(true);
    expect(canAccessShopRoute("technician", "/assets")).toBe(true);
    expect(canAccessShopRoute("technician", "/teams")).toBe(true);

    expect(canAccessShopRoute("technician", "/sales")).toBe(false);
    expect(canAccessShopRoute("technician", "/stock")).toBe(false);
    expect(canAccessShopRoute("technician", "/customers")).toBe(false);
    expect(canAccessShopRoute("technician", "/suppliers")).toBe(false);
    expect(canAccessShopRoute("technician", "/banking")).toBe(false);
    expect(canAccessShopRoute("technician", "/job-costing")).toBe(false);
    expect(canAccessShopRoute("technician", "/expenses")).toBe(false);
    expect(canAccessShopRoute("technician", "/reports")).toBe(false);
  });

  it("treats a route as allowed for its own sub-paths (prefix match), not just the exact route", () => {
    expect(canAccessShopRoute("data_entry", "/jobs/abc123/invoice")).toBe(true);
    // but NOT for an unrelated route that merely starts with the same characters
    expect(canAccessShopRoute("cashier", "/jobsxyz")).toBe(false);
  });
});

describe("canManageAcJobs / canOperateAcJobs", () => {
  it("only owner/manager can manage (delete, see subcontract cost/margin)", () => {
    expect(canManageAcJobs("owner")).toBe(true);
    expect(canManageAcJobs("manager")).toBe(true);
    expect(canManageAcJobs("data_entry")).toBe(false);
    expect(canManageAcJobs("cashier")).toBe(false);
    expect(canManageAcJobs("technician")).toBe(false);
  });

  it("owner/manager/data_entry can operate (create/edit) AC jobs; cashier and technician cannot", () => {
    expect(canOperateAcJobs("owner")).toBe(true);
    expect(canOperateAcJobs("manager")).toBe(true);
    expect(canOperateAcJobs("data_entry")).toBe(true);
    expect(canOperateAcJobs("cashier")).toBe(false);
    expect(canOperateAcJobs("technician")).toBe(false);
  });
});

describe("canUpdateAcJob", () => {
  it("owner/manager can update any field, including subcontractCost", () => {
    expect(canUpdateAcJob("owner", { subcontractCost: 5000 })).toBe(true);
    expect(canUpdateAcJob("manager", { subcontractCost: 5000, notes: "x" })).toBe(true);
  });

  it("data_entry can update non-financial fields but not subcontractCost", () => {
    expect(canUpdateAcJob("data_entry", { notes: "customer called" })).toBe(true);
    expect(canUpdateAcJob("data_entry", { subcontractCost: 5000 })).toBe(false);
    // a mixed payload containing even one internal-financial field is rejected wholesale
    expect(canUpdateAcJob("data_entry", { notes: "x", subcontractCost: 5000 })).toBe(false);
  });

  it("a role that cannot operate AC jobs at all (cashier, technician) cannot update any field", () => {
    expect(canUpdateAcJob("cashier", { notes: "x" })).toBe(false);
    expect(canUpdateAcJob("technician", { notes: "x" })).toBe(false);
  });

  it("an empty update payload is rejected (nothing to check, so nothing to allow)", () => {
    expect(canUpdateAcJob("data_entry", {})).toBe(false);
  });
});

describe("sanitizeAcJobInputForRole", () => {
  it("leaves the input untouched for owner/manager", () => {
    const input = { subcontractCost: 5000, notes: "x" };
    expect(sanitizeAcJobInputForRole(input, "owner")).toEqual(input);
  });

  it("strips subcontractCost for any non-financial role, even if the client sent it (tamper defense)", () => {
    const input = { subcontractCost: 5000, notes: "x" };
    const sanitized = sanitizeAcJobInputForRole(input, "data_entry");
    expect(sanitized).toEqual({ notes: "x" });
    expect(sanitized).not.toHaveProperty("subcontractCost");
    // original object is not mutated
    expect(input).toHaveProperty("subcontractCost");
  });
});

describe("canAccessSettingsPath", () => {
  it("/settings/team is reachable by every role (team invites are gated separately, by canManageTeam)", () => {
    for (const role of ALL_ROLES) {
      expect(canAccessSettingsPath(role, "/settings/team")).toBe(true);
      expect(canAccessSettingsPath(role, "/settings/team/invite")).toBe(true);
    }
  });

  it("owner can access any settings path", () => {
    expect(canAccessSettingsPath("owner", "/settings/shop")).toBe(true);
    expect(canAccessSettingsPath("owner", "/settings/billing")).toBe(true);
  });

  it("manager is limited to shop/plans/notifications settings, not e.g. billing", () => {
    expect(canAccessSettingsPath("manager", "/settings/shop")).toBe(true);
    expect(canAccessSettingsPath("manager", "/settings/plans")).toBe(true);
    expect(canAccessSettingsPath("manager", "/settings/notifications")).toBe(true);
    expect(canAccessSettingsPath("manager", "/settings/billing")).toBe(false);
  });

  it("non-management roles cannot access any settings path beyond /settings/team", () => {
    for (const role of ["data_entry", "cashier", "technician"] as OrgRole[]) {
      expect(canAccessSettingsPath(role, "/settings/shop")).toBe(false);
      expect(canAccessSettingsPath(role, "/settings/plans")).toBe(false);
    }
  });
});

describe("canUseSuppliersModule / canUseBankingModule", () => {
  it("both mirror canSeeFinancials exactly — owner/manager only", () => {
    for (const role of ALL_ROLES) {
      expect(canUseSuppliersModule(role)).toBe(canSeeFinancials(role));
      expect(canUseBankingModule(role)).toBe(canSeeFinancials(role));
    }
  });
});
