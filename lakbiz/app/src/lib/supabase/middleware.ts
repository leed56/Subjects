import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessSettingsPath,
  canAccessShopRoute,
  parseOrgRole,
} from "@/lib/org-role/permissions";
import type { OrgRole } from "@/lib/subscription/types";

const DEMO_MODE_COOKIE = "lakbiz-demo-mode";
const GUARDED_SHOP_PREFIXES = [
  "/dashboard",
  "/sales",
  "/vat",
  "/stock",
  "/suppliers",
  "/jobs",
  "/schedule",
  "/workforce",
  "/vehicles",
  "/bills",
  "/customers",
  "/banking",
  "/assets",
  "/teams",
  "/job-costing",
  "/expenses",
  "/reports",
];

function isGuardedShopPath(pathname: string): boolean {
  return GUARDED_SHOP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isGuardedSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

function isRoleGuardedPath(pathname: string): boolean {
  return isGuardedShopPath(pathname) || isGuardedSettingsPath(pathname);
}

function clearDemoModeCookie(response: NextResponse, request: NextRequest): void {
  response.cookies.set(DEMO_MODE_COOKIE, "", {
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 0,
  });
}

async function fetchOrgRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<OrgRole | null> {
  const { data } = await supabase
    .from("org_members")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ? parseOrgRole(data.role as string) : null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const demoModeEnabled =
    request.cookies.get(DEMO_MODE_COOKIE)?.value === "1";
  let userId: string | null = null;

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      userId = user?.id ?? null;
      if (userId && isRoleGuardedPath(pathname)) {
        const role = await fetchOrgRole(supabase, userId);
        if (role) {
          const allowed = isGuardedSettingsPath(pathname)
            ? canAccessSettingsPath(role, pathname)
            : canAccessShopRoute(role, pathname);
          if (!allowed) {
            const redirect = NextResponse.redirect(
              new URL("/dashboard", request.url),
            );
            supabaseResponse.cookies.getAll().forEach((cookie) => {
              redirect.cookies.set(cookie.name, cookie.value);
            });
            if (demoModeEnabled) clearDemoModeCookie(redirect, request);
            return redirect;
          }
        }
      }
    } catch {
      // A protected route must fail closed; demo access is an explicit choice.
    }
  }

  if (userId) {
    if (demoModeEnabled) clearDemoModeCookie(supabaseResponse, request);
    return supabaseResponse;
  }

  if (isRoleGuardedPath(pathname) && !demoModeEnabled) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );
    const redirect = NextResponse.redirect(loginUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value);
    });
    return redirect;
  }

  return supabaseResponse;
}
