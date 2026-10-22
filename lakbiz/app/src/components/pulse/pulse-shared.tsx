"use client";

/**
 * Shared building blocks for Business Pulse — the owner-only, dark,
 * phone-locked "what's going on with the business" view. Originally built
 * textile-only (see textile-business-pulse.tsx); extracted here once a
 * second sector (pharmacy) needed the exact same shell, hero, highlights
 * and bottom-nav shape with only its data sources and a few labels
 * differing. Sector-specific pages import from here rather than each
 * re-implementing the shell/sparkline/attention-list/highlights chrome.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { BellIcon, ChevronDownIcon, SignOutIcon, CheckIcon } from "@/components/ui/icons";
import { initialsFor } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { LOCALE_NAMES, nextLocale } from "@/lib/i18n/translations";
import type { Sale, CustomerPayment } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { type Locale } from "@/lib/revenue-trend";

export type { Locale };

/** Local 3-way locale pick — same convention as dashboard/page.tsx and
 * sector-command-center.tsx. Shared here (rather than duplicated again)
 * because it's now used identically by every Pulse variant, not just one
 * page — the "kept duplicated for a two-line helper" convention applies
 * to coincidental duplicates across unrelated files, not a helper two
 * sibling files in the same feature both import on purpose. */
export function tt(locale: Locale, si: string, en: string, ta: string): string {
  if (locale === "si") return si;
  if (locale === "ta") return ta;
  return en;
}

/** Compact currency for the big glanceable figures ("Rs. 4.82M"). */
export function formatCompactLkr(amount: number): string {
  const compact = new Intl.NumberFormat("en-LK", { notation: "compact", maximumFractionDigits: 2 }).format(amount);
  return `Rs. ${compact}`;
}

/** Same collection formula getDashboardStats() uses for "payments received
 * today" (see actions.ts) — creditAmount is binary in this data model, so
 * total - creditAmount is exactly what was actually collected — just
 * re-scoped from "today" to an arbitrary month key so the hero's period
 * switch (this month / last month) has a real, not fabricated, number for
 * "Cash collected". `monthKey` must be in the same "YYYY-MM" shape
 * getRevenueTrend() already buckets by. Sector-agnostic — sales/payments
 * are the same shape for every sector. */
export function monthCashCollected(sales: Sale[], payments: CustomerPayment[], monthKey: string): number {
  const monthSales = sales.filter((s) => s.date.startsWith(monthKey));
  const monthPayments = payments.filter((p) => p.date.startsWith(monthKey));
  return (
    monthSales.reduce((s, x) => s + (x.total - x.creditAmount), 0) +
    monthPayments.reduce((s, p) => s + p.amount, 0)
  );
}

/** Small inline sparkline — only ever fed a real series. No axes, no
 * labels: it exists purely to show shape/direction at a glance.
 *
 * Scales to the series' OWN min..max, not to zero. Anchoring the floor at
 * zero meant a month range like 3.9M..4.8M occupied only ~19% of the box —
 * every wave got flattened into a sliver near the top no matter what the
 * underlying numbers did. A sparkline's job is relative shape, not
 * absolute magnitude (the real figure is printed right next to it), so
 * the series range is the correct domain here. */
export function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null;
  const w = 128;
  const h = 48;
  const padY = 6;
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Guard a perfectly flat series (every value identical) against /0 — it
  // then draws as a centred straight line, which is the honest rendering.
  const range = max - min || 1;
  const plot = h - padY * 2;
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: padY + plot - ((v - min) / range) * plot,
  }));
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-32 shrink-0" aria-hidden="true">
      <path d={smoothPath(points)} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="3" fill={stroke} />
    </svg>
  );
}

/** Catmull-Rom → cubic Bézier (standard 1/6-tension conversion) — turns a
 * raw point list into one continuous, flowing curve instead of a sharp
 * straight-segment polyline. Passes exactly through every real value —
 * nothing here is smoothed away, only how the segments between them are
 * drawn. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export type StatTone = "default" | "positive" | "warning" | "danger";
const STAT_VALUE_TONE: Record<StatTone, string> = {
  default: "text-slate-50",
  positive: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-rose-400",
};

/** One card in the horizontally-scrolling stat row. Deliberately no
 * sparkline here — a fabricated trend line would misrepresent a series
 * that isn't cheaply available for most of these stats. */
export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint: string; tone?: StatTone }) {
  return (
    <div className="w-[13.5rem] shrink-0 snap-start rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-[-0.02em] ${STAT_VALUE_TONE[tone]}`}>{value}</p>
      <p className={`mt-1 text-xs font-medium ${tone === "danger" ? "text-rose-400" : "text-slate-500"}`}>{hint}</p>
    </div>
  );
}

/** One plain-language sentence summarizing the month, the way a person
 * would say it out loud rather than making the reader assemble it from
 * separate numbers — built entirely from figures already computed on the
 * calling page (salesChangePct, attentionCount), nothing new fetched. */
export function buildSummaryLine(locale: Locale, salesChangePct: number | null, attentionCount: number): string {
  const salesPhrase =
    salesChangePct == null
      ? tt(locale, "අලෙවිය මෙම මාසය ස්ථාවරයි", "Sales are steady this month", "இந்த மாதம் விற்பனை நிலையானது")
      : salesChangePct > 0
        ? tt(locale, `අලෙවිය මෙම මාසය ${salesChangePct}%කින් ඉහළ ගොස් ඇත`, `Sales are up ${salesChangePct}% this month`, `இந்த மாதம் விற்பனை ${salesChangePct}% அதிகரித்துள்ளது`)
        : salesChangePct < 0
          ? tt(locale, `අලෙවිය මෙම මාසය ${Math.abs(salesChangePct)}%කින් පහළ ගොස් ඇත`, `Sales are down ${Math.abs(salesChangePct)}% this month`, `இந்த மாதம் விற்பனை ${Math.abs(salesChangePct)}% குறைந்துள்ளது`)
          : tt(locale, "අලෙවිය මෙම මාසය ස්ථාවරයි", "Sales are flat this month", "இந்த மாதம் விற்பனை மாறவில்லை");
  const attentionPhrase =
    attentionCount > 0
      ? tt(locale, `${attentionCount} ක් ඔබේ තීරණය අවශ්‍යයි`, `${attentionCount} item${attentionCount === 1 ? "" : "s"} need your attention`, `${attentionCount} உருப்படி(கள்) உங்கள் கவனம் தேவை`)
      : tt(locale, "දැනට කිසිවක් ඔබේ තීරණය අවශ්‍ය නොවේ", "nothing needs your attention right now", "தற்போது எதுவும் உங்கள் கவனத்திற்குத் தேவையில்லை");
  return `${salesPhrase} — ${attentionPhrase}.`;
}

/** Dark-themed loading state, local to Pulse — the shared ProLoadingState
 * (pro-shell.tsx) is hardcoded light (bg-white) and used across ~30 other
 * pages that stay light; swapping its colors would break every one of
 * them. Small enough to keep as a Pulse-only variant. */
export function PulseLoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-400">
        <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-400" />
        {label}
      </div>
    </div>
  );
}

/** Dark-themed empty state, local to Pulse for the same reason as
 * PulseLoadingState above. */
export function PulseEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 px-6 py-11 text-center">
      <p className="text-sm font-bold text-slate-100">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Business Pulse's own chrome — deliberately not <AppShell>. AppShell's
 * Sidebar carries the full 20+-item operational nav (Sales, Stock, Jobs,
 * Banking, VAT, Settings, ...), which is exactly the clutter this page
 * exists to get away from. An owner opening Business Pulse should see the
 * brand, which shop they're in, a way to check what needs attention, and
 * nothing else competing for it — a genuinely separate, minimal "owner
 * app" feel. Language switch, sign-out and the door back to the full
 * operational app live in one account panel instead of a nav rail.
 *
 * Locked to phone width (max-w-md) and bordered on both sides — on an
 * actual phone this is invisible (the viewport IS this width), but on a
 * desktop browser it stops Pulse from stretching into a wide dashboard.
 * Dark palette built from the app's existing Tailwind slate/teal scale
 * (not new bespoke hex values), so it stays part of the same design
 * system rather than a bolted-on separate look.
 */
export function PulseShell({
  children,
  attentionCount,
  onBellClick,
}: {
  children: ReactNode;
  attentionCount: number;
  onBellClick: () => void;
}) {
  const { locale, setLocale } = useLocale();
  const { user, logout } = useAuth();
  const { org } = useSubscription();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [accountOpen]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const accountPanel = accountOpen && (
    <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-xl">
      <div className="rounded-xl bg-slate-800/60 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-slate-50">{org.name}</p>
        <p className="truncate text-xs text-slate-400">{user?.email}</p>
      </div>
      <button
        type="button"
        onClick={() => setLocale(nextLocale(locale))}
        className="mt-1.5 flex min-h-10 w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/60"
      >
        <span>{LOCALE_NAMES[locale]}</span>
        <span className="text-xs font-semibold text-teal-300">{LOCALE_NAMES[nextLocale(locale)]} →</span>
      </button>
      <Link href="/dashboard" className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/60">
        {tt(locale, "සම්පූර්ණ dashboard", "Full dashboard", "முழு dashboard")} →
      </Link>
      {user && (
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-400/10"
        >
          <SignOutIcon className="h-4 w-4" />
          {tt(locale, "පිටවන්න", "Sign out", "வெளியேறு")}
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,rgba(45,212,191,0.09),transparent_28rem),radial-gradient(circle_at_95%_12%,rgba(56,189,248,0.05),transparent_26rem),linear-gradient(180deg,#0a1613_0%,#070f0d_100%)] pb-24 text-slate-50 lg:pb-6">
      {/* Not sticky — a pinned header on a page this short adds a seam for
          no real benefit; Alerts/More in the bottom tab bar already cover
          the same reachability on mobile. */}
      <div className="mx-auto max-w-md min-h-screen border-x border-slate-800/70">
        <header className="border-b border-slate-800/70 bg-slate-900/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-white shadow-sm shadow-teal-900/20">L</span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-bold tracking-tight text-slate-50">LakBiz</p>
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-0.5 truncate text-xs font-medium text-slate-400 hover:text-slate-300"
                >
                  <span className="truncate">{org.name}</span>
                  <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
            </div>
            <div className="relative flex shrink-0 items-center gap-2" ref={accountRef}>
              <button
                type="button"
                onClick={onBellClick}
                aria-label={tt(locale, "දැනුම්දීම්", "Notifications", "அறிவிப்புகள்")}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:border-teal-400/30 hover:bg-teal-400/10"
              >
                <BellIcon className="h-4.5 w-4.5" />
                {attentionCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">
                    {attentionCount > 9 ? "9+" : attentionCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-label={tt(locale, "ගිණුම", "Account", "கணக்கு")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white"
              >
                {initialsFor(org.name, user?.email)}
              </button>
              {accountPanel}
            </div>
          </div>
        </header>
        <main className="space-y-4 px-4 py-5 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

/** One actionable item in the Needs attention list. Deliberately carries
 * its own Icon and pre-resolved actionLabel rather than a `key` an
 * AttentionList would switch on internally — that kept the list itself
 * completely sector-agnostic instead of needing to know every possible
 * action key from every sector that might ever use it. */
export type PulseAction = {
  key: string;
  title: string;
  detail: string;
  href: string;
  tone: "warning" | "danger";
  actionLabel: string;
  Icon: (props: { className?: string }) => ReactNode;
};

/** Needs-attention list body — split out so the "View N more"
 * expand/collapse has its own small piece of state without cluttering the
 * calling page. Sector-agnostic: every action already carries its own
 * icon and action-button label, resolved by the caller. */
export function AttentionList({ actions }: { actions: PulseAction[] }) {
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? actions : actions.slice(0, 2);
  return (
    <div className="space-y-2">
      {visible.map((action) => {
        const tone = action.tone === "danger" ? "bg-rose-400/10 text-rose-400" : "bg-amber-400/10 text-amber-400";
        return (
          <div key={action.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <action.Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{action.title}</p>
                <p className="truncate text-xs text-slate-400">{action.detail}</p>
              </div>
            </div>
            <Link
              href={action.href}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold ${action.tone === "danger" ? "border-rose-400/30 text-rose-400 hover:bg-rose-400/10" : "border-amber-400/30 text-amber-400 hover:bg-amber-400/10"}`}
            >
              {action.actionLabel}
            </Link>
          </div>
        );
      })}
      {actions.length > 2 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-center gap-1 pt-1 text-xs font-semibold text-teal-300 hover:underline">
          {expanded ? tt(locale, "අඩුවෙන් පෙන්වන්න", "Show less", "குறைவாகக் காட்டு") : tt(locale, `තව ${actions.length - 2}ක් බලන්න`, `View ${actions.length - 2} more`, `மேலும் ${actions.length - 2} பார்க்க`)}
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

/** Highlights — the positive counterpart to Needs attention. Real facts
 * only, never manufactured praise; the whole card should be skipped by
 * the caller (not rendered empty) when there's nothing genuine to show. */
export function HighlightsCard({ title, highlights }: { title: string; highlights: { key: string; title: string }[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
      <h2 className="mb-3 text-base font-bold tracking-tight text-slate-100">{title}</h2>
      <div className="space-y-2">
        {highlights.map((highlight) => (
          <div key={highlight.key} className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-400">
              <CheckIcon className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-emerald-200">{highlight.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
