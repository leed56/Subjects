"use client";

import Link from "next/link";
import { NAV_ICON_BY_HREF } from "@/components/shell/nav-icons";
import { SettingsIcon } from "@/components/ui/icons";
import type { NavItem } from "@/lib/nav-sections";

type Locale = "si" | "en" | "ta";

const RETAIL_ORDER = [
  "/dashboard",
  "/sales",
  "/stock",
  "/bills",
  "/customers",
  "/reports",
  "/suppliers",
  "/returns",
  "/expenses",
  "/vat",
  "/settings/shop",
] as const;

const RETAIL_LABELS: Record<string, Record<Locale, string>> = {
  "/dashboard": { en: "Dashboard", si: "පාලක පුවරුව", ta: "முகப்பு" },
  "/sales": { en: "POS / Billing", si: "POS / බිල්පත්", ta: "POS / பில்லிங்" },
  "/stock": { en: "Products & inventory", si: "නිෂ්පාදන සහ තොග", ta: "பொருட்கள் மற்றும் சரக்கு" },
  "/bills": { en: "Orders", si: "ඇණවුම්", ta: "ஆர்டர்கள்" },
  "/customers": { en: "Customers", si: "ගනුදෙනුකරුවන්", ta: "வாடிக்கையாளர்கள்" },
  "/reports": { en: "Reports & analytics", si: "වාර්තා සහ විශ්ලේෂණ", ta: "அறிக்கைகள் மற்றும் பகுப்பாய்வு" },
  "/suppliers": { en: "Suppliers", si: "සැපයුම්කරුවන්", ta: "வழங்குநர்கள்" },
  "/returns": { en: "Returns", si: "ආපසු භාරගැනීම්", ta: "திரும்பப்பெறல்கள்" },
  "/expenses": { en: "Expenses", si: "වියදම්", ta: "செலவுகள்" },
  "/vat": { en: "Store tax settings", si: "වෙළඳසැල් බදු", ta: "கடை வரி" },
  "/settings/shop": { en: "Store management", si: "සාප්පු කළමනාකරණය", ta: "கடை நிர்வாகம்" },
};

const RETAIL_TONES: Record<string, string> = {
  "/dashboard": "from-blue-500 to-indigo-600",
  "/sales": "from-cyan-500 to-blue-600",
  "/stock": "from-emerald-500 to-teal-600",
  "/bills": "from-violet-500 to-fuchsia-600",
  "/customers": "from-sky-500 to-blue-600",
  "/reports": "from-amber-500 to-orange-500",
  "/suppliers": "from-rose-500 to-pink-600",
  "/returns": "from-fuchsia-500 to-violet-600",
  "/expenses": "from-orange-500 to-amber-600",
  "/vat": "from-indigo-500 to-violet-600",
  "/settings/shop": "from-indigo-500 to-violet-600",
};

function fallbackLabel(item: NavItem, locale: Locale, t: (key: string) => string) {
  if (locale === "si" && item.labelSi) return item.labelSi;
  if (locale === "ta" && item.labelTa) return item.labelTa;
  if (locale === "en" && item.labelEn) return item.labelEn;
  return item.labelKey ? t(item.labelKey) : item.labelEn ?? item.labelSi ?? item.href;
}

function GroceryNavLink({ item, active, locale, t }: { item: NavItem; active: boolean; locale: Locale; t: (key: string) => string }) {
  const Icon = NAV_ICON_BY_HREF[item.href] ?? SettingsIcon;
  const label = RETAIL_LABELS[item.href]?.[locale] ?? fallbackLabel(item, locale, t);
  const tone = RETAIL_TONES[item.href] ?? "from-slate-500 to-slate-600";

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
        active
          ? `bg-gradient-to-r ${tone} text-white shadow-[0_12px_26px_rgba(59,130,246,0.24)]`
          : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-white/90" />}
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${active ? "bg-white/16 text-white" : "bg-white/[0.045] text-slate-400 group-hover:bg-white/[0.1] group-hover:text-white"}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 truncate font-sinhala">{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.16)]" />}
    </Link>
  );
}

/** Grocery gets a familiar retail-POS navigation order while retaining only
 * pages that LakBiz actually provides for this shop and the user's plan. */
export function GroceryRetailNavigation({
  items,
  activeHref,
  locale,
  t,
}: {
  items: NavItem[];
  activeHref?: string;
  locale: Locale;
  t: (key: string) => string;
}) {
  const byHref = new Map(items.map((item) => [item.href, item]));
  const mainItems = RETAIL_ORDER.flatMap((href) => {
    const item = byHref.get(href);
    return item ? [item] : [];
  });
  const mainHrefs = new Set(mainItems.map((item) => item.href));
  const moreItems = items.filter((item) => !mainHrefs.has(item.href));

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-3.5 py-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.14)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.14]" aria-label="Grocery retail navigation">
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Retail workspace</p>
      <div className="space-y-1.5">
        {mainItems.map((item) => <GroceryNavLink key={item.href} item={item} active={activeHref === item.href} locale={locale} t={t} />)}
      </div>

      {moreItems.length > 0 && (
        <div className="mt-6 border-t border-white/[0.07] pt-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">More tools</p>
          <div className="space-y-1.5">
            {moreItems.map((item) => <GroceryNavLink key={item.href} item={item} active={activeHref === item.href} locale={locale} t={t} />)}
          </div>
        </div>
      )}
    </nav>
  );
}
