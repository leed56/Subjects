"use client";

/**
 * Business Pulse — a clean, glanceable owner-only view of "what's going on
 * with the business", separate from the operational dashboard. Where
 * /dashboard is built for running today's work (jobs, alerts, tables),
 * Pulse answers one question in under five seconds: is the business healthy
 * right now, and what (if anything) needs a decision.
 *
 * v1 scope: textile sector, owner role only (see nav-sections.ts). Every
 * number here is read from the same sources /dashboard already uses —
 * getDashboardStats(), fetchSectorOperationalSnapshot(), getRevenueTrend()
 * and buildTextileAttentionActions() — no new queries, no separate
 * "simplified" formula that could quietly drift from the real numbers.
 */
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, SectionHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { SignOutIcon } from "@/components/ui/icons";
import { formatLkr, initialsFor } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { LOCALE_NAMES, nextLocale } from "@/lib/i18n/translations";
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { fetchSectorOperationalSnapshot, summarizeTextileRolls, type SectorOperationalSnapshot } from "@/lib/supabase/sector-dashboard-client";
import { buildTextileAttentionActions } from "@/components/dashboard/sector-command-center";
import { getRevenueTrend, type Locale, type TrendPeriod } from "@/lib/revenue-trend";

/**
 * Business Pulse's own chrome — deliberately not <AppShell>. AppShell's
 * Sidebar carries the full 20+-item operational nav (Sales, Stock, Jobs,
 * Banking, VAT, Settings, ...), which is exactly the clutter this page
 * exists to get away from. An owner opening Business Pulse should see the
 * brand, which shop they're in, a language switch, sign-out, and nothing
 * else competing for attention — a genuinely separate, minimal "owner app"
 * feel rather than one more item bolted onto the operational shell. The
 * one deliberate door back into the full app is the "Full dashboard" link
 * already in the page header/footer below, not a nav rail.
 */
function PulseShell({ children }: { children: ReactNode }) {
  const { locale, setLocale } = useLocale();
  const { user, logout } = useAuth();
  const { org } = useSubscription();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,rgba(20,184,166,0.055),transparent_28rem),radial-gradient(circle_at_95%_12%,rgba(56,189,248,0.035),transparent_26rem),linear-gradient(180deg,#f5f8fc_0%,#edf3f8_100%)] text-slate-950">
      <header className="border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-white shadow-sm shadow-teal-900/20">L</span>
            <span className="shrink-0 text-sm font-bold tracking-tight text-slate-950">LakBiz</span>
            <span className="hidden shrink-0 text-slate-300 sm:inline" aria-hidden="true">·</span>
            <span className="hidden min-w-0 truncate text-sm font-medium text-slate-500 sm:inline">{org.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale(nextLocale(locale))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              {LOCALE_NAMES[locale]}
            </button>
            {user && (
              <span className="hidden h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-[10px] font-bold text-teal-700 ring-1 ring-inset ring-teal-100 sm:flex">
                {initialsFor(org.name, user.email)}
              </span>
            )}
            {user && (
              <button
                type="button"
                onClick={() => void handleLogout()}
                aria-label="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <SignOutIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

/** Local 3-way locale pick — same convention as dashboard/page.tsx and
 * sector-command-center.tsx; kept duplicated per file rather than shared
 * for a two-line helper (see those files' identical docstrings). */
function tt(locale: Locale, si: string, en: string, ta: string): string {
  if (locale === "si") return si;
  if (locale === "ta") return ta;
  return en;
}

type Tone = "positive" | "warning" | "danger" | "default";

const TONE_DOT: Record<Tone, string> = {
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  default: "bg-slate-300",
};

const TONE_TEXT: Record<Tone, string> = {
  positive: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
  default: "text-slate-900",
};

/** One quiet, plain-language row of the health strip — deliberately not a
 * card grid. An owner should be able to read all four in one vertical
 * glance without any of them competing for attention. */
function HealthRow({ label, value, hint, tone = "default" }: { label: string; value: string; hint: string; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3.5 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="truncate text-xs text-slate-500">{hint}</p>
        </div>
      </div>
      <p className={`shrink-0 font-mono text-base font-bold tabular-nums ${TONE_TEXT[tone]}`}>{value}</p>
    </div>
  );
}

export default function BusinessPulsePage() {
  const { data, ready } = useAppStore();
  const { locale, t } = useLocale();
  const { org, orgRole, canSeeFinancials } = useSubscription();
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("6m");

  // Same fetch, same gating, as the dashboard and command centre — one
  // snapshot shape, never a second independently-derived textile view.
  const [textileSnapshot, setTextileSnapshot] = useState<SectorOperationalSnapshot | null>(null);
  useEffect(() => {
    if (org.sector !== "textile" || !org.isAuthenticated || !org.id) {
      setTextileSnapshot(null);
      return;
    }
    let cancelled = false;
    void fetchSectorOperationalSnapshot(org.id, org.sector, canSeeFinancials).then((result) => {
      if (!cancelled) setTextileSnapshot(result);
    });
    return () => {
      cancelled = true;
    };
  }, [canSeeFinancials, org.id, org.isAuthenticated, org.sector]);

  if (!ready || !data) {
    return (
      <PulseShell>
        <ProLoadingState label={t("common.loading")} />
      </PulseShell>
    );
  }

  // Owner + textile only for v1 (see the Business Pulse plan). Not routed
  // through ShopRouteGuard's SHOP_PREFIXES — same deliberate in-page gate
  // as /textile/owner-intelligence, since canAccessShopRoute already
  // returns true unconditionally for "owner" regardless of href.
  if (org.sector !== "textile" || orgRole !== "owner") {
    return (
      <PulseShell>
        <EmptyState
          title={tt(locale, "හිමිකරු පමණි", "Owner access only", "உரிமையாளர் அணுகல் மட்டும்")}
          description={tt(
            locale,
            "Business Pulse දැනට රෙදි ව්‍යාපාර හිමිකරුවන් සඳහා පමණි.",
            "Business Pulse is available to textile business owners for now.",
            "Business Pulse தற்போது துணி வணிக உரிமையாளர்களுக்கு மட்டுமே கிடைக்கும்.",
          )}
          action={
            <Link href="/dashboard" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {tt(locale, "සම්පූර්ණ dashboard", "Full dashboard", "முழு dashboard")} →
            </Link>
          }
        />
      </PulseShell>
    );
  }

  const stats = getDashboardStats(data);
  const shopName = data.business.name || org.name || "LakBiz";
  const rollSummary = textileSnapshot ? summarizeTextileRolls(textileSnapshot) : null;
  const attentionActions = textileSnapshot ? buildTextileAttentionActions(textileSnapshot, locale) : [];

  const trend = getRevenueTrend(data.sales, trendPeriod, locale, new Date());
  const trendMax = Math.max(1, ...trend.map((p) => Math.max(p.revenue, p.profit)));
  // Current-month profit is read off the trend's own last bucket rather
  // than re-deriving a second "this month" filter — one calculation, one
  // definition of "this month", shared with the chart directly below it.
  const thisMonthProfit = trend.length > 0 ? trend[trend.length - 1].profit : 0;

  const salesUp = (stats.monthSalesChangePct ?? 0) >= 0;
  const heroTone: Tone = stats.monthSalesChangePct == null ? "default" : salesUp ? "positive" : "danger";

  // One plain-language sentence combining the two things an owner actually
  // wants to know at a glance: is revenue moving, and is anything waiting
  // on a decision. Never fabricated — built entirely from stats.monthSalesChangePct
  // and attentionActions.length, both already computed above.
  const summarySentence =
    stats.monthSalesChangePct == null
      ? tt(
          locale,
          "මෙම මාසයේ අලෙවි ප්‍රවණතාවක් සංසන්දනය කිරීමට පසුගිය මාසයේ දත්ත ප්‍රමාණවත් නැත.",
          "Not enough sales history yet to compare this month's trend.",
          "இந்த மாத போக்கை ஒப்பிட கடந்த மாத தரவு போதுமானதாக இல்லை.",
        )
      : tt(
          locale,
          `අලෙවි පසුගිය මාසයට වඩා ${salesUp ? "වැඩි" : "අඩු"} ${Math.abs(stats.monthSalesChangePct)}%${attentionActions.length > 0 ? tt(locale, ` — කරුණාකර සලකා බලන කරුණු ${attentionActions.length}ක් ඇත.` , "", "") : " — මෙහෙයුම් පැහැදිලිය."}`,
          `Sales are ${salesUp ? "up" : "down"} ${Math.abs(stats.monthSalesChangePct)}% versus last month${attentionActions.length > 0 ? ` — ${attentionActions.length} item${attentionActions.length > 1 ? "s" : ""} waiting on your decision.` : ", and operations are clear."}`,
          `விற்பனை கடந்த மாதத்தை விட ${salesUp ? "அதிகரித்துள்ளது" : "குறைந்துள்ளது"} ${Math.abs(stats.monthSalesChangePct)}%${attentionActions.length > 0 ? ` — உங்கள் முடிவுக்காக ${attentionActions.length} விஷயங்கள் காத்திருக்கின்றன.` : " — செயல்பாடுகள் தெளிவாக உள்ளன."}`,
        );

  const decisionItems = attentionActions.slice(0, 2);

  return (
    <PulseShell>
      <PageHeader
        title={tt(locale, "ව්‍යාපාර ස්පන්දනය", "Business Pulse", "வணிக துடிப்பு")}
        description={`${shopName} · ${tt(locale, "ඔබේ ව්‍යාපාරයට එක් පැහැදිලි දැක්මක්", "One clear view of your business", "உங்கள் வணிகத்தின் ஒரு தெளிவான பார்வை")}`}
        actions={
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {tt(locale, "සම්පූර්ණ dashboard", "Full dashboard", "முழு dashboard")} →
          </Link>
        }
      />

      {/* Hero — the one number an owner opens this page to see. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
          {tt(locale, "මෙම මාසයේ අලෙවිය", "This month's sales", "இந்த மாத விற்பனை")}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <p className="text-4xl font-bold tracking-[-0.03em] text-slate-950 sm:text-5xl">{formatLkr(stats.monthSales)}</p>
          {stats.monthSalesChangePct != null && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${salesUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {salesUp ? "▲" : "▼"} {Math.abs(stats.monthSalesChangePct)}%
            </span>
          )}
        </div>
        <p className={`mt-3 max-w-2xl text-sm leading-6 ${TONE_TEXT[heroTone]}`}>{summarySentence}</p>
      </div>

      {/* Health strip — four plain-language rows, read top to bottom. */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-1 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:px-6">
        <HealthRow
          label={tt(locale, "ලාභය", "Profit", "லாபம்")}
          value={formatLkr(thisMonthProfit)}
          hint={tt(locale, "මෙම මාසයේ දළ ලාභය", "This month's gross profit", "இந்த மாத மொத்த லாபம்")}
          tone={thisMonthProfit > 0 ? "positive" : "default"}
        />
        <HealthRow
          label={tt(locale, "මුදල් තත්ත්වය", "Cash position", "பண நிலை")}
          value={formatLkr(stats.bankBalance - stats.payableOutstanding)}
          hint={tt(locale, "බැංකු ශේෂය අඩු සැපයුම්කරු ගෙවීම්", "Bank balance minus supplier payables", "வங்கி இருப்பு கழித்தல் சப்ளையர் பணம்")}
          tone={stats.bankBalance - stats.payableOutstanding >= 0 ? "positive" : "danger"}
        />
        <HealthRow
          label={tt(locale, "තොග තත්ත්වය", "Inventory health", "சரக்கு நிலை")}
          value={rollSummary ? `${rollSummary.activeRolls} ${tt(locale, "Rolls", "rolls", "Rolls")}` : "—"}
          hint={
            rollSummary
              ? tt(
                  locale,
                  `මීටර් ${rollSummary.metres.toFixed(0)} · යාර්ඩ් ${rollSummary.yards.toFixed(0)} · ඉතිරි ${rollSummary.remnants}`,
                  `${rollSummary.metres.toFixed(0)}m · ${rollSummary.yards.toFixed(0)}yd · ${rollSummary.remnants} remnants`,
                  `மீட்டர் ${rollSummary.metres.toFixed(0)} · யார்டு ${rollSummary.yards.toFixed(0)} · மீதி ${rollSummary.remnants}`,
                )
              : tt(locale, "දත්ත නොමැත", "No roll data yet", "Roll தரவு இல்லை")
          }
          tone={rollSummary && rollSummary.remnants > 0 ? "warning" : rollSummary ? "positive" : "default"}
        />
        <HealthRow
          label={tt(locale, "අවදානම", "Risk", "இடர்")}
          value={String(attentionActions.length)}
          hint={
            attentionActions.length > 0
              ? tt(locale, "ඔබේ තීරණය අවශ්‍යයි", "Waiting on your decision", "உங்கள் முடிவுக்காக காத்திருக்கிறது")
              : tt(locale, "සියල්ල පැහැදිලිය", "All clear", "அனைத்தும் தெளிவாக உள்ளது")
          }
          tone={attentionActions.length > 0 ? "danger" : "positive"}
        />
      </div>

      {/* Needs your decision — top 2 real exceptions, same single source
          of truth as the dashboard's Needs Attention card and the sector
          command centre (buildTextileAttentionActions). Never a separate,
          potentially-contradictory list. */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <SectionHeader title={tt(locale, "ඔබේ තීරණය අවශ්‍යයි", "Needs your decision", "உங்கள் முடிவு தேவை")} />
        {decisionItems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
            {tt(locale, "සියල්ල පැහැදිලිය — කිසිවක් ඔබේ තීරණය අවශ්‍ය නොවේ.", "Everything is clear — nothing needs your decision right now.", "அனைத்தும் தெளிவாக உள்ளது — தற்போது எதுவும் உங்கள் முடிவுக்குத் தேவையில்லை.")}
          </p>
        ) : (
          <div className="space-y-2">
            {decisionItems.map((action) => (
              <div key={action.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{action.title}</p>
                  <p className="truncate text-xs text-slate-500">{action.detail}</p>
                </div>
                <Link href={action.href} className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  {t("dash.view")}
                </Link>
              </div>
            ))}
            {attentionActions.length > decisionItems.length && (
              <Link href="/dashboard" className="block pt-1 text-xs font-semibold text-teal-700 hover:underline">
                {tt(
                  locale,
                  `තව ${attentionActions.length - decisionItems.length}ක් dashboard හි බලන්න →`,
                  `${attentionActions.length - decisionItems.length} more on the full dashboard →`,
                  `மேலும் ${attentionActions.length - decisionItems.length} முழு dashboard-இல் →`,
                )}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Quiet trend — same getRevenueTrend() as the dashboard, but
          deliberately smaller and muted: this page answers "how are we
          doing", not "show me every number". */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <SectionHeader
          title={tt(locale, "ප්‍රවණතාව", "Trend", "போக்கு")}
          action={
            <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5">
              {(["3m", "6m", "12m"] as TrendPeriod[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTrendPeriod(p)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${trendPeriod === p ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  {t(`dash.period_${p}`)}
                </button>
              ))}
            </div>
          }
        />
        {trend.every((p) => p.revenue === 0) ? (
          <EmptyState size="compact" title={t("dash.performance_empty")} />
        ) : (
          <div className="flex h-24 items-end gap-1.5">
            {trend.map((p) => (
              <div key={p.key} className="flex flex-1 flex-col items-center justify-end gap-1">
                <div
                  title={`${p.label}: ${formatLkr(p.revenue)}`}
                  className="w-full rounded-t bg-teal-400/70"
                  style={{ height: `${Math.max(2, (p.revenue / trendMax) * 100)}%` }}
                />
                <span className="text-[10px] text-slate-400">{p.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        <StatusBadge tone="neutral">{tt(locale, "රෙදි · හිමිකරු දැක්ම", "Textile · Owner view", "துணி · உரிமையாளர் பார்வை")}</StatusBadge>{" "}
        <Link href="/dashboard" className="ml-2 font-semibold text-teal-700 hover:underline">
          {tt(locale, "සම්පූර්ණ මෙහෙයුම් dashboard බලන්න →", "View the full operational dashboard →", "முழு செயல்பாட்டு dashboard-ஐப் பார்க்கவும் →")}
        </Link>
      </p>
    </PulseShell>
  );
}
