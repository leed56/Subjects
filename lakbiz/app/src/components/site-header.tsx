"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TrialBanner } from "@/components/trial-banner";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/lib/i18n/locale-provider";
import { ROUTE_FEATURES } from "@/lib/subscription/can";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const navKeys = [
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/sales", key: "nav.sales" },
  { href: "/vat", key: "nav.vat" },
  { href: "/stock", key: "nav.stock" },
  { href: "/suppliers", key: "nav.suppliers" },
  { href: "/jobs", key: "nav.jobs" },
  { href: "/vehicles", key: "nav.vehicles" },
  { href: "/bills", key: "nav.bills" },
  { href: "/customers", key: "nav.customers" },
  { href: "/banking", key: "nav.banking" },
] as const;

export function SiteHeader({ sticky = true }: { sticky?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const { can, org, isPlatformAdmin } = useSubscription();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const visibleNav = navKeys.filter((item) => {
    const feature = ROUTE_FEATURES[item.href];
    if (!feature) return true;
    return can(feature);
  });

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={
          sticky
            ? "sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md"
            : "relative z-30 border-b border-slate-200 bg-white"
        }
      >
        <TrialBanner />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <Link href={isPlatformAdmin ? "/admin" : "/"} className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-xs font-bold text-white">
              L
            </span>
            <div className="min-w-0 leading-tight">
              <span className="block text-base font-bold text-teal-800 sm:text-lg">
                LakBiz
              </span>
              <span className="hidden truncate text-xs text-slate-500 sm:block font-sinhala">
                {t("common.brand_tagline")}
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => setLocale(locale === "si" ? "en" : "si")}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              aria-label="Toggle language"
            >
              {t("nav.lang")}
            </button>
            <Link
              href="/settings/notifications"
              className={`rounded-lg px-2 py-1 text-sm font-medium ${
                pathname === "/settings/notifications"
                  ? "text-teal-800"
                  : "text-slate-600 hover:text-teal-700"
              }`}
            >
              {t("nav.notifications")}
            </Link>
            <Link
              href="/settings/billing"
              className={`rounded-lg px-2 py-1 text-sm font-medium ${
                pathname === "/settings/billing"
                  ? "text-teal-800"
                  : "text-slate-600 hover:text-teal-700"
              }`}
            >
              {t("nav.billing")}
            </Link>
            {isPlatformAdmin && (
              <Link
                href="/admin"
                className="rounded-lg bg-slate-900 px-2 py-1 text-sm font-medium text-teal-300 hover:bg-slate-800"
              >
                Admin
              </Link>
            )}
            <Link
              href={user ? "/settings/shop" : "/login"}
              className="rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:text-teal-700"
            >
              {user ? user.email?.split("@")[0] : t("nav.login")}
            </Link>
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-red-600"
              >
                {t("sub.sign_out")}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setLocale(locale === "si" ? "en" : "si")}
              className="rounded-full border border-slate-300 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
            >
              {t("nav.lang")}
            </button>
            <button
              type="button"
              aria-label="Menu"
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800"
            >
              <svg
                width="20"
                height="20"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="hidden border-t border-slate-100 md:block">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 py-2">
            {visibleNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium font-sinhala transition ${
                    active
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-600 hover:bg-slate-50 hover:text-teal-700"
                  }`}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <div
        className={`fixed inset-0 z-50 md:hidden transition ${
          open ? "visible" : "invisible"
        }`}
      >
        <button
          type="button"
          aria-label="Close menu"
          className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute inset-y-0 right-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <span className="font-bold text-slate-900">LakBiz</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            {visibleNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`mb-1 block rounded-xl px-4 py-3.5 text-base font-medium font-sinhala ${
                    active
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-4 space-y-2">
            <Link
              href="/settings/notifications"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("nav.notifications")}
            </Link>
            <Link
              href="/settings/billing"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("nav.billing")}
            </Link>
            <Link
              href={user ? "/settings/shop" : "/login"}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {user ? user.email?.split("@")[0] : t("nav.login")}
            </Link>
            {user && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void handleLogout();
                }}
                className="w-full rounded-xl px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"
              >
                {t("sub.sign_out")}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
