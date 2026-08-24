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
import { initialsFor } from "@/lib/format";
import type { NavItem } from "@/lib/nav-sections";

function navLabel(item: NavItem, locale: "si" | "en", t: (key: string) => string): string {
  if (locale === "si" && item.labelSi) return item.labelSi;
  if (locale === "en" && item.labelEn) return item.labelEn;
  return item.labelKey ? t(item.labelKey) : item.labelEn ?? item.labelSi ?? item.href;
}

/** Mobile top bar + slide-out nav drawer — generous touch targets and the
 * same hierarchy and sector-aware navigation as the desktop rail. */
export function MobileNav() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();
  const { user, logout } = useAuth();
  const { isPlatformAdmin, org } = useSubscription();
  const { sections, managementItems } = useShopNav();
  const [open, setOpen] = useState(false);
  const allItems = [...sections.flatMap((section) => section.items), ...managementItems];
  const activeHref = allItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

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
    const active = activeHref === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-3 text-base font-medium transition ${active ? "bg-teal-50 text-teal-900 ring-1 ring-inset ring-teal-100" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-teal-100 text-teal-700" : "bg-slate-50 text-slate-400"}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-sinhala">{navLabel(item, locale, t)}</span>
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur-xl lg:hidden">
        <Link href={isPlatformAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-xs font-bold text-white shadow-sm shadow-teal-900/20">L</span>
          <span className="text-lg font-bold tracking-tight text-slate-950">LakBiz</span>
        </Link>
        <div className="flex items-center gap-2">
          <AcAlertsBell />
          <button type="button" onClick={() => setLocale(locale === "si" ? "en" : "si")} className="min-h-9 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm">{t("nav.lang")}</button>
          <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm"><MenuIcon className="h-5 w-5" /></button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 overflow-hidden lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
          <div className="absolute inset-y-0 right-0 flex w-[min(100%,21rem)] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4">
              <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-xs font-bold text-white">L</span><span className="font-bold tracking-tight text-slate-950">LakBiz</span></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"><CloseIcon className="h-5 w-5" /></button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3.5" aria-label="Primary">
              {sections.map((section, i) => (
                <div key={section.labelKey ?? "root"} className={i > 0 ? "mt-6" : ""}>
                  {section.labelKey && <p className="mb-2 px-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t(section.labelKey)}</p>}
                  <div className="space-y-1">{section.items.map(renderItem)}</div>
                </div>
              ))}

              {managementItems.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 px-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("nav.section.management")}</p>
                  <div className="space-y-1">{managementItems.map(renderItem)}</div>
                </div>
              )}

              {isPlatformAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-3.5 py-3 text-base font-semibold text-teal-200">{t("admin.nav")}</Link>}
            </nav>

            <div className="border-t border-slate-200/80 bg-slate-50/70 p-3.5">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-xs font-bold text-teal-800">{initialsFor(org.name, user?.email)}</span>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-950">{org.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p></div>
              </div>
              {user && (
                <button type="button" onClick={() => { setOpen(false); void handleLogout(); }} className="mt-2.5 flex min-h-11 w-full items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50"><SignOutIcon className="h-4.5 w-4.5" />{t("sub.sign_out")}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
