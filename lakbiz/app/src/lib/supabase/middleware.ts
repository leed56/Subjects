import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessSettingsPath,
  canAccessShopRoute,
  parseOrgRole,
} from "@/lib/org-role/permissions";
import type { OrgRole } from "@/lib/subscription/types";

const GUARDED_SHOP_PREFIXES = [
  "/dashboard",
  "/sales",
  "/vat",
  "/stock",
  "/suppliers",
  "/jobs",
  "/workforce",
  "/vehicles",
  "/bills",
  "/customers",
  "/banking",
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

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

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

    const pathname = request.nextUrl.pathname;
    if (user && isRoleGuardedPath(pathname)) {
      const role = await fetchOrgRole(supabase, user.id);
      if (role) {
        const allowed = isGuardedSettingsPath(pathname)
          ? canAccessSettingsPath(role, pathname)
          : canAccessShopRoute(role, pathname);
        if (!allowed) {
          const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
          supabaseResponse.cookies.getAll().forEach((cookie) => {
            redirect.cookies.set(cookie.name, cookie.value);
          });
          return redirect;
        }
      }
    }
  } catch {
    // Ignore transient network failures — page can still render in demo mode.
  }

  return supabaseResponse;
}
