"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export function SettingsNav() {
  const pathname = usePathname();
  const { t } = useLocale();
  const { canAccessSettingsPath } = useSubscription();
  const items = [
    { href: "/settings/shop", label: t("nav.settings_shop") },
    { href: "/settings/team", label: t("nav.team") },
    { href: "/settings/notifications", label: t("nav.notifications") },
    { href: "/settings/plans", label: t("nav.plans") },
  ].filter((item) => canAccessSettingsPath(item.href));

  return (
    <nav aria-label="Settings" className="mb-7 overflow-x-auto border-b border-slate-200">
      <div className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
                active ? "text-teal-700" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {item.label}
              {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-teal-600" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
