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
 * | AC assets               |  Y    |    Y    |     Y      |    N    |     Y      |
 * | Installation/maint. crews|  Y   |    Y    |     N      |    N    |     Y      |
 * | Schedule / dispatch     |  Y    |    Y    |     Y      |    N    |     Y      |
 * | Job costing report      |  Y    |    Y    |     N      |    N    |     N      |
 * | Expenses                |  Y    |    Y    |     N      |    N    |     N      |
 * | Business reports        |  Y    |    Y    |     N      |    N    |     N      |
 *
 * * data_entry: /jobs front desk — create/edit jobs, quotes, alerts; no margin/subcontract/buy cost.
 *   technician: /jobs + /workforce + /assets + /teams + /schedule (read/update equipment + crew records, no financial fields).
 *   Crews follow /workforce's access level, not /jobs's — data_entry is front-desk job intake, not staffing.
 *   Schedule follows /jobs's access level (it's a view/reschedule surface over the same jobs).
 *   Job costing, Expenses, and Reports are owner/manager only, same mechanism —
 *   deliberately absent from every non-financial role's route list below (no
 *   special-case needed — canAccessShopRoute's owner/manager bypass already
 *   covers it, everyone else falls through to their route list and 403s).
 *
 * RLS: products/sales buy_price & profit masked via views; ac_jobs subcontract_cost;
 * contractors rate/payable; vehicles cost fields; financial tables owner/manager SELECT.
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
  | "/schedule"
  | "/workforce"
  | "/vehicles"
  | "/bills"
  | "/customers"
  | "/banking"
  | "/assets"
  | "/teams"
  | "/job-costing"
  | "/expenses"
  | "/reports";

const FINANCIAL_ROLES: OrgRole[] = ["owner", "manager"];

const SHOP_STAFF_ROUTES: ShopNavHref[] = [
  "/dashboard",
  "/sales",
  "/stock",
  "/customers",
  "/bills",
];

/** data_entry: shop floor + AC jobs front desk (create/edit — no company profit/cost fields). */
const DATA_ENTRY_ROUTES: ShopNavHref[] = [...SHOP_STAFF_ROUTES, "/jobs", "/assets", "/schedule"];

/** `/dashboard` included deliberately: middleware and ShopRouteGuard both
 * redirect a disallowed route *to* `/dashboard`, so leaving it out here
 * created a redirect loop for technicians hitting any blocked route.
 * The page itself renders a simplified, job-focused view (no financials)
 * for this role rather than the owner command center — see dashboard/page.tsx. */
const TECHNICIAN_ROUTES: ShopNavHref[] = ["/dashboard", "/jobs", "/schedule", "/workforce", "/assets", "/teams"];

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
