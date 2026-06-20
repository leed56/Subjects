"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { SignOutButton } from "@/components/sign-out-button";
import { useLocale } from "@/lib/i18n/locale-provider";

export function AdminNav() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useLocale();
  const { user } = useAuth();

  const links = [
    { href: "/admin", label: t("admin.nav_dashboard") },
    { href: "/admin/shops", label: t("admin.nav_shops") },
    { href: "/admin/shops/new", label: t("admin.nav_create") },
    { href: "/admin/messaging", label: t("admin.nav_messaging") },
  ];

  const displayEmail = user?.email ?? null;

  return (
    <header className="border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-teal-400">
            {t("admin.platform")}
          </p>
          <h1 className="text-lg font-bold">{t("admin.super_admin")}</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => {
            const active =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-teal-700 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t("admin.shop_app")}
          </Link>
          <button
            type="button"
            onClick={() => setLocale(locale === "si" ? "en" : "si")}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            {t("nav.lang")}
          </button>
          {displayEmail && (
            <span
              className="hidden max-w-[10rem] truncate rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-400 sm:inline"
              title={displayEmail}
            >
              {displayEmail}
            </span>
          )}
          <SignOutButton
            redirectTo="/login?next=/admin"
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-red-300 hover:bg-slate-700 hover:text-red-200"
          />
        </nav>
      </div>
    </header>
  );
}
