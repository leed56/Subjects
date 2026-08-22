/**
 * LakBiz organization role permissions.
 *
 * Security rule: internal business financials belong to the OWNER only.
 * Managers remain strong operational users, but they do not inherit the
 * owner's buy-cost, profit, banking, accounting, job-revenue or subcontract
 * visibility simply because their role is called "manager".
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

const FINANCIAL_ROLES: OrgRole[] = ["owner"];

const SHOP_STAFF_ROUTES: ShopNavHref[] = [
  "/dashboard",
  "/sales",
  "/stock",
  "/customers",
  "/bills",
];

/**
 * Manager = operational control without the owner's books.
 * Vehicles remains available because a car-sale manager needs that workflow;
 * its cost/margin fields are independently masked by canSeeFinancials/RLS.
 */
const MANAGER_ROUTES: ShopNavHref[] = [
  ...SHOP_STAFF_ROUTES,
  "/jobs",
  "/schedule",
  "/workforce",
  "/vehicles",
  "/assets",
  "/teams",
];

/** Data-entry users handle operational records, never internal finance. */
const DATA_ENTRY_ROUTES: ShopNavHref[] = [...SHOP_STAFF_ROUTES, "/jobs", "/assets", "/schedule"];

/** Field technicians only receive job/field-operation surfaces. */
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

/** Buy cost, profit, accounts, job money and related internal finance. */
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

function isOwnerOnlyJobFinanceRoute(href: string): boolean {
  return /^\/jobs\/[^/]+\/invoice(?:\/|$)/.test(href);
}

/**
 * A normal stock role may use Stock/Inventory Control, but resolving a customer
 * return inspection changes sellability or writes physical stock off. Keep that
 * nested workspace at owner/manager level instead of inheriting `/stock` access
 * through prefix matching.
 */
function isReturnInspectionRoute(href: string): boolean {
  return href === "/stock/advanced/returns" || href.startsWith("/stock/advanced/returns/");
}

export function canAccessShopRoute(role: OrgRole, href: string): boolean {
  if (role === "owner") return true;
  // A role that may operate /jobs must not inherit its nested customer-price
  // invoice just because route access uses prefix matching.
  if (isOwnerOnlyJobFinanceRoute(href)) return false;
  if (isReturnInspectionRoute(href)) return role === "manager";
  if (role === "manager") return routeAllowed(href, MANAGER_ROUTES);
  if (role === "data_entry") return routeAllowed(href, DATA_ENTRY_ROUTES);
  if (role === "cashier") return routeAllowed(href, SHOP_STAFF_ROUTES);
  if (role === "technician") return routeAllowed(href, TECHNICIAN_ROUTES);
  return false;
}

/** Owner/manager may administer the operational job lifecycle. */
export function canManageAcJobs(role: OrgRole): boolean {
  return role === "owner" || role === "manager";
}

/** Owner/manager/data-entry may create/edit normal operational job data. */
export function canOperateAcJobs(role: OrgRole): boolean {
  return role === "owner" || role === "manager" || role === "data_entry";
}

/**
 * Job revenue/collections and contractor cost are owner-only. A non-owner
 * form may still carry the masked zero values for quote/deposit; accepting
 * those zero placeholders keeps create/edit workflows functional while the
 * DB layer preserves any real existing owner values.
 */
export function canUpdateAcJob(role: OrgRole, input: Partial<ACJobInput>): boolean {
  if (!canOperateAcJobs(role)) return false;
  const keys = Object.keys(input) as (keyof ACJobInput)[];
  if (keys.length === 0) return false;
  if (canSeeFinancials(role)) return true;
  if ("subcontractCost" in input) return false;
  if ("quotedAmount" in input && Number(input.quotedAmount) !== 0) return false;
  if ("depositAmount" in input && Number(input.depositAmount) !== 0) return false;
  return true;
}

/**
 * Defense in depth against a tampered non-owner client payload.
 *
 * We mask required quote/deposit fields to zero instead of deleting them:
 * ACJobInput requires both on create. On UPDATE the DB trigger deliberately
 * treats those zeros as masked placeholders and preserves the owner's stored
 * values, so operational edits can never zero real revenue by accident.
 */
export function sanitizeAcJobInputForRole(
  input: Partial<ACJobInput>,
  role: OrgRole,
): Partial<ACJobInput> {
  if (canSeeFinancials(role)) return input;
  const next = { ...input };
  if ("quotedAmount" in next) next.quotedAmount = 0;
  if ("depositAmount" in next) next.depositAmount = 0;
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

/** Supplier purchasing and banking expose owner financial data. */
export function canUseSuppliersModule(role: OrgRole): boolean {
  return canSeeFinancials(role);
}

export function canUseBankingModule(role: OrgRole): boolean {
  return canSeeFinancials(role);
}
