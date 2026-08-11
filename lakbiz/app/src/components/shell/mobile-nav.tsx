"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AcAlertsBell } from "@/components/ac-alerts-bell";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useShopNav } from "@/components/shell/use-shop-nav";
import { NAV_ICON_BY_HREF } from "@/components/shell/nav-icons";
import { MenuIcon, CloseIcon, SettingsIcon, SignOutIcon } from "@/components/ui/icons";
import type { NavItem } from "@/lib/nav-sections";

/** Mobile top bar + slide-out nav drawer — compact header, no horizontal
 * overflow, same grouped nav model as the desktop Sidebar. */
export function MobileNav() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();
  const { user, logout } = useAuth();
  const { isPlatformAdmin, org } = useSubscription();
  const { sections, managementItems } = useShopNav();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const renderItem = (item: NavItem) => {
    const Icon = NAV_ICON_BY_HREF[item.href] ?? SettingsIcon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-base font-medium ${
          active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${active ? "text-teal-700" : "text-slate-400"}`} />
        <span className="font-sinhala">{t(item.labelKey)}</span>
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur-md lg:hidden">
        <Link href={isPlatformAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-xs font-bold text-white">
            L
          </span>
          <span className="text-base font-bold text-slate-900">LakBiz</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <AcAlertsBell />
          <button
            type="button"
            onClick={() => setLocale(locale === "si" ? "en" : "si")}
            className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
          >
            {t("nav.lang")}
          </button>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-800"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "visible" : "invisible"}`} aria-hidden={!open}>
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-y-0 right-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
            <span className="font-bold text-slate-900">LakBiz</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3" aria-label="Primary">
            {sections.map((section, i) => (
              <div key={section.labelKey ?? "root"} className={i > 0 ? "mt-4" : ""}>
                {section.labelKey && (
                  <p className="mb-1 px-3.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t(section.labelKey)}
                  </p>
                )}
                {section.items.map(renderItem)}
              </div>
            ))}

            {managementItems.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 px-3.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t("nav.section.management")}
                </p>
                {managementItems.map(renderItem)}
              </div>
            )}

            {isPlatformAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="mt-4 flex items-center gap-3 rounded-xl bg-slate-900 px-3.5 py-3 text-base font-medium text-teal-300"
              >
                {t("admin.nav")}
              </Link>
            )}
          </nav>

          <div className="border-t border-slate-200 p-3">
            <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
              <p className="truncate text-sm font-semibold text-slate-900">{org.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            {user && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void handleLogout();
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50"
              >
                <SignOutIcon className="h-4.5 w-4.5" />
                {t("sub.sign_out")}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
