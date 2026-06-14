"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";

const navKeys = [
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/stock", key: "nav.stock" },
  { href: "/suppliers", key: "nav.suppliers" },
  { href: "/sales", key: "nav.sales" },
  { href: "/jobs", key: "nav.jobs" },
  { href: "/vehicles", key: "nav.vehicles" },
  { href: "/bills", key: "nav.bills" },
  { href: "/customers", key: "nav.customers" },
  { href: "/banking", key: "nav.banking" },
] as const;

export function SiteHeader() {
  const { locale, setLocale, t } = useLocale();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-teal-800">LakBiz</span>
          <span className="hidden text-sm text-slate-500 sm:inline font-sinhala">
            {t("common.brand_tagline")}
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setLocale(locale === "si" ? "en" : "si")}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            aria-label="Toggle language"
          >
            {t("nav.lang")}
          </button>
          <nav className="flex flex-wrap gap-3 text-sm font-medium text-slate-600">
            {navKeys.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-teal-700 font-sinhala"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
