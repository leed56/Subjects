"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale-provider";

export function AdminNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  const links = [
    { href: "/admin", label: t("admin.nav_dashboard") },
    { href: "/admin/shops", label: t("admin.nav_shops") },
    { href: "/admin/shops/new", label: t("admin.nav_create") },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
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
        </nav>
      </div>
    </header>
  );
}
