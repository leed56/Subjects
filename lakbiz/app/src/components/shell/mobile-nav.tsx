"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AcAlertsBell } from "@/components/ac-alerts-bell";
import { useLocale } from "@/lib/i18n/locale-provider";
import { LOCALE_NAMES, nextLocale } from "@/lib/i18n/translations";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useShopNav } from "@/components/shell/use-shop-nav";
import { useBottomBarOccupied } from "@/components/shell/bottom-bar-overlay";
import { NAV_ICON_BY_HREF } from "@/components/shell/nav-icons";
import { MenuIcon, CloseIcon, SettingsIcon, SignOutIcon, BellIcon } from "@/components/ui/icons";
import { initialsFor } from "@/lib/format";
import type { NavItem } from "@/lib/nav-sections";
import { useCriticalAlertCount } from "@/lib/dashboard/use-critical-alert-count";

function navLabel(item: NavItem, locale: "si" | "en" | "ta", t: (key: string) => string): string {
  if (locale === "si" && item.labelSi) return item.labelSi;
  if (locale === "ta" && item.labelTa) return item.labelTa;
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
  const bottomBarOccupied = useBottomBarOccupied();
  const criticalAlertCount = useCriticalAlertCount();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
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

  useEffect(() => {
    if (!open || !drawerRef.current) return;
    const drawer = drawerRef.current;
    const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
    focusable[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open || !previousFocusRef.current) return;
    previousFocusRef.current.focus();
    previousFocusRef.current = null;
  }, [open]);

  const openDrawer = () => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  };

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
        className={`flex min-h-12 items-center gap-3 rounded-xl border-l-4 px-3 py-3 text-base font-medium transition ${active ? "border-teal-500 bg-teal-50 text-teal-950 ring-1 ring-inset ring-teal-100" : "border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-teal-100 text-teal-700" : "bg-slate-50 text-slate-400"}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-sinhala">{navLabel(item, locale, t)}</span>
      </Link>
    );
  };

  const bottomItems = ["/dashboard", "/sales", "/stock", "/jobs", "/schedule", "/vehicles"]
    .map((href) => allItems.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item))
    .slice(0, 3);
  // The checkout/settlement pages render their own fixed bottom bar once
  // the cart has items — the shared tab bar steps aside only for that,
  // not for the whole /sales route (an empty cart has nothing to collide
  // with, and hiding it there made the nav look like it had vanished).
  const showBottomNav = !isPlatformAdmin && !bottomBarOccupied;

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3.5 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur-xl lg:hidden">
        <Link href={isPlatformAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-xs font-bold text-white shadow-sm shadow-teal-900/20">L</span>
          <span className="text-base font-bold tracking-tight text-slate-950">LakBiz</span>
        </Link>
        <div className="flex items-center gap-2">
          <AcAlertsBell />
          {/* ac_hvac already has its own richer alerts bell above; this
              badge covers pharmacy/grocery/other sectors so the same
              expired/blocked/low-stock signal is visible from anywhere,
              not just the desktop sidebar. See useCriticalAlertCount. */}
          {!isPlatformAdmin && org.sector !== "ac_hvac" && (
            <Link
              href="/dashboard"
              aria-label={criticalAlertCount > 0 ? `${criticalAlertCount} alerts need attention` : "No alerts"}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
            >
              <BellIcon className="h-4.5 w-4.5" />
              {criticalAlertCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                  {criticalAlertCount > 99 ? "99+" : criticalAlertCount}
                </span>
              )}
            </Link>
          )}
          <button type="button" onClick={() => setLocale(nextLocale(locale))} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm">{LOCALE_NAMES[nextLocale(locale)]}</button>
          <button type="button" aria-label="Open menu" onClick={openDrawer} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm"><MenuIcon className="h-5 w-5" /></button>
        </div>
      </header>

      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "visible" : "invisible"}`} aria-hidden={!open}>
        <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className={`absolute inset-0 bg-slate-950/55 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
        <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation menu" className={`absolute inset-y-0 right-0 flex w-[min(100%,21rem)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex h-14 items-center justify-between border-b border-slate-200/80 px-4">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-xs font-bold text-white">L</span><span className="font-bold tracking-tight text-slate-950">LakBiz</span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"><CloseIcon className="h-5 w-5" /></button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3.5" aria-label="Primary">
            {sections.map((section, i) => (
              <div key={section.labelKey ?? "root"} className={i > 0 ? "mt-6" : ""}>
                {section.labelKey && <p className="mb-2 px-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t(section.labelKey)}</p>}
                <div className="space-y-1">{section.items.map(renderItem)}</div>
              </div>
            ))}

            {isPlatformAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-3.5 py-3 text-base font-semibold text-teal-200">{t("admin.nav")}</Link>}
          </nav>

          <div className="border-t border-slate-200/80 bg-slate-50/70 p-3.5">
            {managementItems.length > 0 && <div className="mb-3 grid grid-cols-2 gap-1.5">{managementItems.map((item) => { const Icon=NAV_ICON_BY_HREF[item.href]??SettingsIcon; return <Link key={item.href} href={item.href} onClick={()=>setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-950"><Icon className="h-4 w-4 shrink-0 text-slate-400"/><span className="truncate">{navLabel(item,locale,t)}</span></Link>; })}</div>}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-xs font-bold text-teal-800">{initialsFor(org.name, user?.email)}</span>
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-950">{org.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p></div>
            </div>
            {user ? (
              <button type="button" onClick={() => { setOpen(false); void handleLogout(); }} className="mt-2.5 flex min-h-11 w-full items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50"><SignOutIcon className="h-4.5 w-4.5" />{t("sub.sign_out")}</button>
            ) : (
              // Anonymous visitors land here in the local/demo experience —
              // the drawer had no way back to a real account at all before
              // this, only a Sign out button gated behind `user`.
              <Link href="/login" onClick={() => setOpen(false)} className="mt-2.5 flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-600 px-3.5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700">{t("sub.sign_in")}</Link>
            )}
          </div>
        </div>
      </div>

      {showBottomNav && <nav aria-label="Mobile quick navigation" className="fixed inset-x-0 bottom-0 z-40 grid h-[4.25rem] grid-cols-4 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">{bottomItems.map((item)=>{const Icon=NAV_ICON_BY_HREF[item.href]??SettingsIcon;const active=pathname===item.href||pathname.startsWith(`${item.href}/`);return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold ${active?"text-teal-700":"text-slate-500"}`}><Icon className="h-5 w-5"/><span className="max-w-full truncate">{navLabel(item,locale,t)}</span></Link>;})}<button type="button" onClick={openDrawer} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold ${bottomItems.some((item)=>pathname===item.href||pathname.startsWith(`${item.href}/`))?"text-slate-500":"text-teal-700"}`}><MenuIcon className="h-5 w-5"/><span className="max-w-full truncate">{t("dash.more")}</span></button></nav>}
    </>
  );
}
