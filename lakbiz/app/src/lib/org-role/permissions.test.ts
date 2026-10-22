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

const ALL_ROLES: OrgRole[] = ["owner", "manager", "data_entry", "cashier", "technician"];

describe("parseOrgRole", () => {
  it("accepts every valid role string as-is", () => {
    for (const role of ALL_ROLES) expect(parseOrgRole(role)).toBe(role);
  });

  it("defaults to owner for null, undefined, or an unrecognized string", () => {
    expect(parseOrgRole(null)).toBe("owner");
    expect(parseOrgRole(undefined)).toBe("owner");
    expect(parseOrgRole("superadmin")).toBe("owner");
    expect(parseOrgRole("")).toBe("owner");
  });
});

describe("canSeeFinancials", () => {
  it("is true only for the organization owner", () => {
    expect(canSeeFinancials("owner")).toBe(true);
    for (const role of ALL_ROLES.filter((r) => r !== "owner")) {
      expect(canSeeFinancials(role)).toBe(false);
    }
  });
});

describe("canManageTeam", () => {
  it("is true only for owner", () => {
    expect(canManageTeam("owner")).toBe(true);
    for (const role of ALL_ROLES.filter((r) => r !== "owner")) {
      expect(canManageTeam(role)).toBe(false);
    }
  });
});

describe("canAccessShopRoute", () => {
  it("owner can access every shop route", () => {
    for (const route of ["/job-costing", "/expenses", "/reports", "/suppliers", "/banking", "/vat", "/jobs", "/jobs/abc/invoice"]) {
      expect(canAccessShopRoute("owner", route)).toBe(true);
    }
  });

  it("manager controls operations but not owner financial routes", () => {
    for (const route of ["/dashboard", "/sales", "/stock", "/customers", "/bills", "/jobs", "/schedule", "/workforce", "/vehicles", "/assets", "/teams"]) {
      expect(canAccessShopRoute("manager", route)).toBe(true);
    }
    for (const route of ["/vat", "/suppliers", "/banking", "/job-costing", "/expenses", "/reports", "/jobs/abc/invoice"]) {
      expect(canAccessShopRoute("manager", route)).toBe(false);
    }
  });

  it("cashier is restricted to shop-staff routes only", () => {
    for (const route of ["/dashboard", "/sales", "/stock", "/customers", "/bills"]) {
      expect(canAccessShopRoute("cashier", route)).toBe(true);
    }
    for (const route of ["/jobs", "/schedule", "/workforce", "/suppliers", "/banking", "/job-costing", "/expenses", "/reports"]) {
      expect(canAccessShopRoute("cashier", route)).toBe(false);
    }
  });

  it("data_entry gets shop-staff routes plus AC jobs front desk but no owner finance", () => {
    for (const route of ["/sales", "/jobs", "/assets", "/schedule"]) {
      expect(canAccessShopRoute("data_entry", route)).toBe(true);
    }
    for (const route of ["/workforce", "/suppliers", "/banking", "/job-costing", "/expenses", "/reports", "/vat", "/jobs/abc123/invoice"]) {
      expect(canAccessShopRoute("data_entry", route)).toBe(false);
    }
  });

  it("technician gets field-operation routes but no retail or finance routes", () => {
    for (const route of ["/dashboard", "/jobs", "/schedule", "/workforce", "/assets", "/teams"]) {
      expect(canAccessShopRoute("technician", route)).toBe(true);
    }
    for (const route of ["/sales", "/stock", "/customers", "/suppliers", "/banking", "/job-costing", "/expenses", "/reports", "/jobs/abc/invoice"]) {
      expect(canAccessShopRoute("technician", route)).toBe(false);
    }
  });

  it("does exact path-segment prefix matching, not string-prefix matching", () => {
    expect(canAccessShopRoute("data_entry", "/jobs/abc123")).toBe(true);
    expect(canAccessShopRoute("cashier", "/jobsxyz")).toBe(false);
    expect(canAccessShopRoute("manager", "/banking/accounts/1")).toBe(false);
  });
});

describe("canManageAcJobs / canOperateAcJobs", () => {
  it("owner and manager may manage the operational job lifecycle", () => {
    expect(canManageAcJobs("owner")).toBe(true);
    expect(canManageAcJobs("manager")).toBe(true);
    expect(canManageAcJobs("data_entry")).toBe(false);
  });

  it("owner/manager/data_entry can operate jobs", () => {
    expect(canOperateAcJobs("owner")).toBe(true);
    expect(canOperateAcJobs("manager")).toBe(true);
    expect(canOperateAcJobs("data_entry")).toBe(true);
    expect(canOperateAcJobs("cashier")).toBe(false);
    expect(canOperateAcJobs("technician")).toBe(false);
  });
});

describe("canUpdateAcJob", () => {
  it("owner may update operational and financial fields", () => {
    expect(canUpdateAcJob("owner", { quotedAmount: 120000, depositAmount: 50000, subcontractCost: 15000 })).toBe(true);
  });

  it("manager may update operational fields but not real job money", () => {
    expect(canUpdateAcJob("manager", { notes: "customer called" })).toBe(true);
    expect(canUpdateAcJob("manager", { quotedAmount: 120000 })).toBe(false);
    expect(canUpdateAcJob("manager", { depositAmount: 50000 })).toBe(false);
    expect(canUpdateAcJob("manager", { subcontractCost: 15000 })).toBe(false);
    expect(canUpdateAcJob("manager", { quotedAmount: 0, depositAmount: 0, notes: "masked form" })).toBe(true);
  });

  it("data_entry may update operational fields but not real job money", () => {
    expect(canUpdateAcJob("data_entry", { notes: "customer called" })).toBe(true);
    expect(canUpdateAcJob("data_entry", { quotedAmount: 120000 })).toBe(false);
    expect(canUpdateAcJob("data_entry", { depositAmount: 50000 })).toBe(false);
    expect(canUpdateAcJob("data_entry", { subcontractCost: 5000 })).toBe(false);
    expect(canUpdateAcJob("data_entry", { quotedAmount: 0, depositAmount: 0, notes: "masked form" })).toBe(true);
  });

  it("cashier and technician cannot update jobs", () => {
    expect(canUpdateAcJob("cashier", { notes: "x" })).toBe(false);
    expect(canUpdateAcJob("technician", { notes: "x" })).toBe(false);
  });

  it("rejects an empty update payload", () => {
    expect(canUpdateAcJob("data_entry", {})).toBe(false);
  });
});

describe("sanitizeAcJobInputForRole", () => {
  it("leaves owner input untouched", () => {
    const input = { quotedAmount: 100000, depositAmount: 20000, subcontractCost: 5000, notes: "x" };
    expect(sanitizeAcJobInputForRole(input, "owner")).toEqual(input);
  });

  it("masks required quote/deposit fields and strips subcontract cost for every non-owner", () => {
    const input = { quotedAmount: 100000, depositAmount: 20000, subcontractCost: 5000, notes: "x" };
    for (const role of ["manager", "data_entry", "cashier", "technician"] as OrgRole[]) {
      expect(sanitizeAcJobInputForRole(input, role)).toEqual({ quotedAmount: 0, depositAmount: 0, notes: "x" });
    }
    expect(input).toHaveProperty("quotedAmount", 100000);
  });

  it("does not add financial keys to a partial operational update", () => {
    expect(sanitizeAcJobInputForRole({ notes: "visit complete" }, "manager")).toEqual({ notes: "visit complete" });
  });
});

describe("canAccessSettingsPath", () => {
  it("/settings/team is reachable by every role; invite permission is separate", () => {
    for (const role of ALL_ROLES) {
      expect(canAccessSettingsPath(role, "/settings/team")).toBe(true);
      expect(canAccessSettingsPath(role, "/settings/team/invite")).toBe(true);
    }
  });

  it("owner can access any settings path", () => {
    expect(canAccessSettingsPath("owner", "/settings/shop")).toBe(true);
    expect(canAccessSettingsPath("owner", "/settings/billing")).toBe(true);
  });

  it("manager is limited to shop/plans/notifications settings", () => {
    expect(canAccessSettingsPath("manager", "/settings/shop")).toBe(true);
    expect(canAccessSettingsPath("manager", "/settings/plans")).toBe(true);
    expect(canAccessSettingsPath("manager", "/settings/notifications")).toBe(true);
    expect(canAccessSettingsPath("manager", "/settings/billing")).toBe(false);
  });

  it("non-management roles cannot access settings beyond team", () => {
    for (const role of ["data_entry", "cashier", "technician"] as OrgRole[]) {
      expect(canAccessSettingsPath(role, "/settings/shop")).toBe(false);
      expect(canAccessSettingsPath(role, "/settings/plans")).toBe(false);
    }
  });
});

describe("canUseSuppliersModule / canUseBankingModule", () => {
  it("both are owner-only because both expose business financials", () => {
    expect(canUseSuppliersModule("owner")).toBe(true);
    expect(canUseBankingModule("owner")).toBe(true);
    for (const role of ALL_ROLES.filter((r) => r !== "owner")) {
      expect(canUseSuppliersModule(role)).toBe(false);
      expect(canUseBankingModule(role)).toBe(false);
    }
  });
});
