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
 * | AC jobs / workforce     |  Y    |    Y    |     N      |    N    |     Y*     |
 *
 * * technician: future — not wired in UI yet.
 *
 * RLS follow-up: restrict SELECT on products.buy_price, purchase_lines.unit_cost,
 * sales.profit for data_entry at the database layer (views or policies).
 */

import type { OrgRole } from "@/lib/subscription/types";

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
  if (role === "data_entry" || role === "cashier") {
    return routeAllowed(href, SHOP_STAFF_ROUTES);
  }
  if (role === "technician") {
    return routeAllowed(href, TECHNICIAN_ROUTES);
  }
  return false;
}

export function canAccessSettingsPath(role: OrgRole, pathname: string): boolean {
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
