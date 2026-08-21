import type { ReactNode } from "react";
import Link from "next/link";
import { InboxIcon } from "@/components/ui/icons";

export function ProPageShell({ children }: { children: ReactNode }) {
  return <div className="min-h-full bg-[#f5f7fb]">{children}</div>;
}

export function ProMain({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
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

export function ProPageHeader({ eyebrow, title, description, actions }: ProPageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-3xl">
            {title}
          </h1>
          {description && (
            <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              {description}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2.5">{actions}</div>}
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

export function ProButton({ href, children, variant = "primary", className = "" }: ProButtonProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-xl px-4.5 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.98]";
  const styles = {
    primary: "bg-teal-600 text-white shadow-sm shadow-teal-950/15 hover:bg-teal-700 hover:shadow-md hover:shadow-teal-950/15",
    secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950",
    dark: "bg-slate-950 text-white shadow-sm hover:bg-slate-800",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
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

export function ProStatCard({ label, value, hint, icon, tone = "teal" }: ProStatCardProps) {
  const tones = {
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  }[tone];

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-[-0.025em] text-slate-950">{value}</p>
          {hint && <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500">{hint}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base ring-1 ring-inset ${tones}`}>
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

export function ProCard({ title, eyebrow, action, children, className = "" }: ProCardProps) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6 ${className}`}>
      {(title || eyebrow || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{eyebrow}</p>}
            {title && <h2 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950">{title}</h2>}
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
  size?: "compact" | "standard";
}) {
  const padding = size === "compact" ? "p-5" : "px-6 py-10";
  const iconBox = size === "compact" ? "h-10 w-10" : "h-12 w-12";
  return (
    <div className={`rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 text-center ${padding}`}>
      <div className={`mx-auto flex items-center justify-center rounded-xl bg-white text-teal-600 shadow-sm ring-1 ring-slate-200/70 ${iconBox}`}>
        {icon ?? <InboxIcon className="h-5 w-5" />}
      </div>
      <p className="mt-3 font-semibold text-slate-950">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProLoadingState({ label = "Loading your workspace..." }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-500" />
        {label}
      </div>
    </div>
  );
}

export function ProBadge({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "amber" | "rose" | "slate" | "emerald" }) {
  const tones = {
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones}`}>{children}</span>;
}
