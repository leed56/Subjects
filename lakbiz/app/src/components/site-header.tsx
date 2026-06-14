"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrialBanner } from "@/components/trial-banner";
import { useLocale } from "@/lib/i18n/locale-provider";
import { ROUTE_FEATURES } from "@/lib/subscription/can";
import { useSubscription } from "@/lib/subscription/subscription-provider";

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
  const { can } = useSubscription();
  const pathname = usePathname();

  const visibleNav = navKeys.filter((item) => {
    const feature = ROUTE_FEATURES[item.href];
    if (!feature) return true;
    return can(feature);
  });

  return (
    <header className="border-b border-slate-200 bg-white">
      <TrialBanner />
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
          <Link
            href="/settings/billing"
            className={`text-sm font-medium ${
              pathname === "/settings/billing"
                ? "text-teal-800"
                : "text-slate-600 hover:text-teal-700"
            }`}
          >
            {t("nav.billing")}
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-teal-700"
          >
            {t("nav.login")}
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm font-medium text-slate-600">
            {visibleNav.map((item) => (
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
