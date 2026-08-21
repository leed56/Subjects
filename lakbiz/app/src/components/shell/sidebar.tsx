"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useShopNav } from "@/components/shell/use-shop-nav";
import { NAV_ICON_BY_HREF } from "@/components/shell/nav-icons";
import { SettingsIcon, SignOutIcon } from "@/components/ui/icons";
import { initialsFor } from "@/lib/format";
import type { NavItem } from "@/lib/nav-sections";

function NavLink({ item, active, t }: { item: NavItem; active: boolean; t: (key: string) => string }) {
  const Icon = NAV_ICON_BY_HREF[item.href] ?? SettingsIcon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
        active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-teal-700" : "text-slate-400"}`} />
      <span className="truncate font-sinhala">{t(item.labelKey)}</span>
    </Link>
  );
}

/** Desktop left sidebar — persistent, grouped nav. Replaces the old
 * horizontal top nav (no more duplicated top+bottom desktop navigation). */
export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLocale();
  const { user, logout } = useAuth();
  const { isPlatformAdmin, org } = useSubscription();
  const { sections, managementItems } = useShopNav();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <Link href={isPlatformAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-xs font-bold text-white">
            L
          </span>
          <span className="truncate text-base font-bold text-slate-900">LakBiz</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {sections.map((section, i) => (
          <div key={section.labelKey ?? "root"} className={i > 0 ? "mt-5" : ""}>
            {section.labelKey && (
              <p className="mb-1.5 px-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t(section.labelKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                  t={t}
                />
              ))}
            </div>
          </div>
        ))}

        {managementItems.length > 0 && (
          <div className="mt-5">
            <p className="mb-1.5 px-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("nav.section.management")}
            </p>
            <div className="space-y-0.5">
              {managementItems.map((item) => (
                <NavLink key={item.href} item={item} active={pathname === item.href} t={t} />
              ))}
            </div>
          </div>
        )}

        {isPlatformAdmin && (
          <div className="mt-5 border-t border-slate-200 pt-4">
            <Link
              href="/admin"
              className="flex items-center gap-2.5 rounded-lg bg-slate-900 px-2.5 py-2 text-sm font-medium text-teal-300 hover:bg-slate-800"
            >
              {t("admin.nav")}
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-slate-200 p-3">
        {/* Part 4's "organization/avatar initials, user name, role, email"
         * — this app has no separate user display-name field (checked:
         * auth-provider only carries `email`), so the org name is the
         * identity shown next to the avatar, same as before; email/role
         * fill the rest. Real data only, no fabricated name field. */}
        <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">
            {initialsFor(org.name, user?.email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{org.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            <p className="text-xs font-medium capitalize text-teal-700">{org.role.replace("_", " ")}</p>
          </div>
        </div>
        {user && (
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700"
          >
            <SignOutIcon className="h-4 w-4" />
            {t("sub.sign_out")}
          </button>
        )}
      </div>
    </aside>
  );
}
