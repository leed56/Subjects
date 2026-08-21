import type { ReactNode } from "react";
import Link from "next/link";
import { InboxIcon } from "@/components/ui/icons";

/**
 * Global premium UI phase — Stage 1 token convergence
 * (docs/DESIGN_SYSTEM_CONVERGENCE.md §3-4).
 *
 * Every component below keeps its exact existing prop API — the 12 pages
 * still importing them (docs/DESIGN_SYSTEM_CONVERGENCE.md §1) need zero
 * per-page changes to pick up the calmer look. Only the Tailwind classes
 * changed: radius rounded-[1.5rem]/[2rem] → rounded-lg/rounded-xl,
 * font-black → font-bold/font-semibold, ambient shadow-lg/shadow-xl +
 * backdrop-blur (glassmorphism) → border-only, gradient icon boxes → flat
 * tone fills — converging toward primitives.tsx's existing token scale,
 * per this phase's Part 2 ("fix shared primitives first, don't reinvent a
 * third system"). `ProPageShell` is unchanged and confirmed dead code
 * (grepped: never rendered anywhere — AppShell's own flat `bg-slate-50`
 * replaced it back in Phase 1); left in place rather than removed, since
 * deleting an exported component is out of scope for a token-convergence
 * pass.
 */

export function ProPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_32rem),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      {children}
    </div>
  );
}

export function ProMain({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {children}
    </main>
  );
}

type ProPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

/** Converged to match primitives.tsx's bare PageHeader (no card wrapper —
 * a page title is page-level typography, not a "surface" that needs
 * grouping/elevation). Kept as its own component rather than replaced
 * with PageHeader itself: 12 pages call it with an `eyebrow` prop
 * PageHeader doesn't have. */
export function ProPageHeader({ eyebrow, title, description, actions }: ProPageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          {description && (
            <div className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

type ProButtonProps = {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "dark" | "ghost";
  className?: string;
};

/** Radius/weight/shadow converged to match primitives.tsx's Button exactly
 * (rounded-lg, font-semibold, no ambient shadow on primary) — same visual
 * language, different component only because this one also renders as a
 * `<Link>` when given `href`, which Button doesn't support. */
export function ProButton({ href, children, variant = "primary", className = "" }: ProButtonProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]";
  const styles = {
    primary: "bg-teal-600 text-white hover:bg-teal-700",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-800",
    dark: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  }[variant];
  const cn = `${base} ${styles} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cn}>
        {children}
      </Link>
    );
  }

  return <span className={cn}>{children}</span>;
}

type ProStatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "teal" | "amber" | "blue" | "emerald" | "slate" | "rose";
};

/** Converged to a flat KPI card — rounded-xl border, no ambient shadow, no
 * hover-lift/shine animation, flat (not gradient) tone-colored icon box.
 * Semantic tone is still meaningful here (this is a real KPI reading, not
 * decoration) so the icon-box color stays, just without the gradient/ring/
 * shadow treatment. */
export function ProStatCard({ label, value, hint, icon, tone = "teal" }: ProStatCardProps) {
  const tones = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1.5 text-xs font-medium text-slate-500">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base ${tones}`}>
          {icon ?? "•"}
        </div>
      </div>
    </article>
  );
}

type ProCardProps = {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Converged to match primitives.tsx's plain card shape (rounded-xl
 * border, no ambient shadow/ring). */
export function ProCard({ title, eyebrow, action, children, className = "" }: ProCardProps) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      {(title || eyebrow || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{eyebrow}</p>}
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function ProEmptyState({
  title,
  description,
  action,
  icon,
  size = "standard",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  /** "compact" for a state nested inside a card that already has its own
   * heading — avoids stacking a second heading + a tall dashed box on top
   * of real content elsewhere on the page. */
  size?: "compact" | "standard";
}) {
  const padding = size === "compact" ? "p-4" : "p-6";
  const iconBox = size === "compact" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className={`rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center ${padding}`}>
      <div className={`mx-auto flex items-center justify-center rounded-lg bg-white text-teal-600 ${iconBox}`}>
        {icon ?? <InboxIcon className="h-5 w-5" />}
      </div>
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProLoadingState({ label = "Loading your workspace..." }: { label?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <span className="h-3 w-3 animate-pulse rounded-full bg-teal-500" />
        {label}
      </div>
    </div>
  );
}

export function ProBadge({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "amber" | "rose" | "slate" | "emerald" }) {
  const tones = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${tones}`}>{children}</span>;
}
