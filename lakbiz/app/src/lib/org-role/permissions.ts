/**
 * LakBiz org role permission matrix (Phase F).
 *
 * | Capability              | owner | manager | data_entry | cashier | technician |
 * |-------------------------|-------|---------|------------|---------|------------|
 * | View sell price         |  Y    |    Y    |     Y      |    Y    |     Y      |
 * | View buy price / profit |  Y    |    Y    |     N      |    N    |     N      |
 * | Stock in/out, products  |  Y    |    Y    |     Y      |    Y    |     N      |
 * | Sales / POS             |  Y    |    Y    |     Y      |    Y    |     N      |
 * | Customers (basic CRUD)  |  Y    |    Y    |     Y      |    Y    |     N      |
 * | Suppliers / GRN         |  Y    |    Y    |     N      |    N    |     N      |
 * | Banking                 |  Y    |    Y    |     N      |    N    |     N      |
 * | Settings / plans        |  Y    |    Y    |     N      |    N    |     N      |
 * | Team invites            |  Y    |    N    |     N      |    N    |     N      |
 * | AC jobs / workforce     |  Y    |    Y    |     Y*     |    N    |     Y*     |
 *
 * * data_entry: /jobs front desk — create/edit jobs, quotes, alerts; no margin/subcontract/buy cost.
 *   technician: /jobs + /workforce.
 *
 * RLS follow-up: restrict SELECT on products.buy_price, purchase_lines.unit_cost,
 * sales.profit for data_entry at the database layer (views or policies).
 */

import type { OrgRole } from "@/lib/subscription/types";
import type { ACJobInput } from "@/lib/store/types";

export type ShopNavHref =
  | "/dashboard"
  | "/sales"
  | "/vat"
  | "/stock"
  | "/suppliers"
  | "/jobs"
  | "/workforce"
  | "/vehicles"
  | "/bills"
  | "/customers"
  | "/banking";

const FINANCIAL_ROLES: OrgRole[] = ["owner", "manager"];

const SHOP_STAFF_ROUTES: ShopNavHref[] = [
  "/dashboard",
  "/sales",
  "/stock",
  "/customers",
  "/bills",
];

/** data_entry: shop floor + AC jobs front desk (create/edit — no company profit/cost fields). */
const DATA_ENTRY_ROUTES: ShopNavHref[] = [...SHOP_STAFF_ROUTES, "/jobs"];

const TECHNICIAN_ROUTES: ShopNavHref[] = ["/jobs", "/workforce"];

const MANAGER_PLUS_SETTINGS = ["/settings/shop", "/settings/plans", "/settings/notifications"];

export function parseOrgRole(value: string | null | undefined): OrgRole {
  if (
    value === "owner" ||
    value === "manager" ||
    value === "data_entry" ||
    value === "cashier" ||
    value === "technician"
  ) {
    return value;
  }
  return "owner";
}

export function canSeeFinancials(role: OrgRole): boolean {
  return FINANCIAL_ROLES.includes(role);
}

export function canManageTeam(role: OrgRole): boolean {
  return role === "owner";
}

function routeAllowed(href: string, allowedRoutes: ShopNavHref[]): boolean {
  return allowedRoutes.some(
    (allowed) => href === allowed || href.startsWith(`${allowed}/`),
  );
}

export function canAccessShopRoute(role: OrgRole, href: string): boolean {
  if (role === "owner" || role === "manager") return true;
  if (role === "data_entry") {
    return routeAllowed(href, DATA_ENTRY_ROUTES);
  }
  if (role === "cashier") {
    return routeAllowed(href, SHOP_STAFF_ROUTES);
  }
  if (role === "technician") {
    return routeAllowed(href, TECHNICIAN_ROUTES);
  }
  return false;
}

/** Owner/manager: delete jobs, subcontract cost, margin views, priced job-sheet admin. */
export function canManageAcJobs(role: OrgRole): boolean {
  return role === "owner" || role === "manager";
}

/** Front desk + managers: create/edit AC jobs (all types), assign techs, customer alerts. */
export function canOperateAcJobs(role: OrgRole): boolean {
  return role === "owner" || role === "manager" || role === "data_entry";
}

/** Internal cost fields — hidden from data_entry (company profit / subcontract). */
const AC_JOB_INTERNAL_FINANCIAL_KEYS = new Set<keyof ACJobInput>(["subcontractCost"]);

/** data_entry: full job ops except internal cost fields; owner/manager: all fields. */
export function canUpdateAcJob(role: OrgRole, input: Partial<ACJobInput>): boolean {
  if (canManageAcJobs(role)) return true;
  if (!canOperateAcJobs(role)) return false;
  const keys = Object.keys(input) as (keyof ACJobInput)[];
  if (keys.length === 0) return false;
  return keys.every((key) => !AC_JOB_INTERNAL_FINANCIAL_KEYS.has(key));
}

/** Strip fields data_entry must not write (e.g. subcontract cost from tampered payloads). */
export function sanitizeAcJobInputForRole(
  input: Partial<ACJobInput>,
  role: OrgRole,
): Partial<ACJobInput> {
  if (canManageAcJobs(role)) return input;
  const next = { ...input };
  delete next.subcontractCost;
  return next;
}

export function canAccessSettingsPath(role: OrgRole, pathname: string): boolean {
  if (pathname === "/settings/team" || pathname.startsWith("/settings/team/")) {
    return true;
  }
  if (role === "owner") return true;
  if (role === "manager") {
    return MANAGER_PLUS_SETTINGS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
  }
  return false;
}

export function canUseSuppliersModule(role: OrgRole): boolean {
  return canSeeFinancials(role);
}

export function canUseBankingModule(role: OrgRole): boolean {
  return canSeeFinancials(role);
}
