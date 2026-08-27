"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/lib/i18n/locale-provider";
import { LOCALE_NAMES, nextLocale } from "@/lib/i18n/translations";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useShopNav } from "@/components/shell/use-shop-nav";
import { NAV_ICON_BY_HREF } from "@/components/shell/nav-icons";
import { SettingsIcon, SignOutIcon } from "@/components/ui/icons";
import { initialsFor } from "@/lib/format";
import type { NavItem } from "@/lib/nav-sections";

function navLabel(item: NavItem, locale: "si" | "en" | "ta", t: (key: string) => string): string {
  if (locale === "si" && item.labelSi) return item.labelSi;
  if (locale === "ta" && item.labelTa) return item.labelTa;
  if (locale === "en" && item.labelEn) return item.labelEn;
  return item.labelKey ? t(item.labelKey) : item.labelEn ?? item.labelSi ?? item.href;
}

function NavLink({ item, active, locale, t }: { item: NavItem; active: boolean; locale: "si" | "en" | "ta"; t: (key: string) => string }) {
  const Icon = NAV_ICON_BY_HREF[item.href] ?? SettingsIcon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-teal-400/15 text-white ring-1 ring-inset ring-teal-300/15"
          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${active ? "bg-teal-400/15 text-teal-300" : "text-slate-500 group-hover:text-slate-300"}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="truncate font-sinhala">{navLabel(item, locale, t)}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" />}
    </Link>
  );
}

/** Desktop left sidebar — persistent, grouped navigation with a strong
 * brand anchor and quiet inactive states so the content remains primary. */
export function Sidebar() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();
  const { user, logout } = useAuth();
  const { isPlatformAdmin, org } = useSubscription();
  const { sections, managementItems } = useShopNav();
  const allItems = [...sections.flatMap((section) => section.items), ...managementItems];
  // Nested workspaces such as /stock/advanced must not make both /stock and
  // the more-specific child item look active. Longest matching href wins.
  const activeHref = allItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#08111f] lg:flex">
      <div className="flex h-20 items-center border-b border-white/[0.06] px-5">
        <Link href={isPlatformAdmin ? "/admin" : "/dashboard"} className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white shadow-lg shadow-teal-950/30">L</span>
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-lg font-bold tracking-tight text-white">LakBiz</span>
            <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Business workspace</span>
          </div>
        </Link>
      </div>

      {/* `min-h-0` is load-bearing here, not decorative: a flex item's
          default min-height is `auto` (its content size), so without this
          the nav never actually shrinks to the space `flex-1` gives it —
          it overflows the fixed-height `<aside>` above instead of
          scrolling within itself, silently clipping whatever section
          lands past the viewport (reported: "Inventory" cut off at some
          viewport heights). `overflow-y-auto` alone does nothing until
          the flex item is allowed to be smaller than its content. */}
      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3.5 py-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.14)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.14]"
        aria-label="Primary"
      >
        {sections.map((section, i) => (
          <div key={section.labelKey ?? "root"} className={i > 0 ? "mt-6" : ""}>
            {section.labelKey && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{t(section.labelKey)}</p>}
            <div className="space-y-1">
              {section.items.map((item) => <NavLink key={item.href} item={item} active={activeHref === item.href} locale={locale} t={t} />)}
            </div>
          </div>
        ))}

        {managementItems.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{t("nav.section.management")}</p>
            <div className="space-y-1">
              {managementItems.map((item) => <NavLink key={item.href} item={item} active={activeHref === item.href} locale={locale} t={t} />)}
            </div>
          </div>
        )}

        {isPlatformAdmin && (
          <div className="mt-6 border-t border-white/[0.07] pt-5">
            <Link href="/admin" className="flex min-h-10 items-center justify-center rounded-xl border border-teal-300/15 bg-teal-400/10 px-3 py-2.5 text-sm font-semibold text-teal-200 transition hover:bg-teal-400/15 hover:text-white">{t("admin.nav")}</Link>
          </div>
        )}
      </nav>

      <div className="border-t border-white/[0.06] p-3.5">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-400/15 text-xs font-bold text-teal-200 ring-1 ring-inset ring-teal-300/10">{initialsFor(org.name, user?.email)}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{org.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{user?.email}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-teal-300/80">{org.role.replace("_", " ")}</p>
            </div>
          </div>
        </div>
        {/* Desktop had no language control at all before this — only the
            mobile top bar could switch locale. Cycles si → en → ta → si. */}
        <button
          type="button"
          onClick={() => setLocale(nextLocale(locale))}
          className="mt-2.5 flex min-h-10 w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
        >
          <span>{LOCALE_NAMES[locale]}</span>
          <span className="text-xs font-semibold text-teal-300/80">{LOCALE_NAMES[nextLocale(locale)]} →</span>
        </button>
        {user ? (
          <button type="button" onClick={handleLogout} className="mt-1.5 flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300">
            <SignOutIcon className="h-4 w-4" />{t("sub.sign_out")}
          </button>
        ) : (
          // Anonymous visitors land here in the local/demo experience (see
          // subscription-provider's loadDemoOrg) — the shell had no way
          // back to a real account at all before this, only a Sign out
          // button gated behind `user`.
          <Link href="/login" className="mt-1.5 flex min-h-10 w-full items-center justify-center rounded-xl bg-teal-400/15 px-3 py-2.5 text-sm font-semibold text-teal-200 transition hover:bg-teal-400/20">
            {t("sub.sign_in")}
          </Link>
        )}
      </div>
    </aside>
  );
}
