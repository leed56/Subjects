import type { ReactNode } from "react";
import Link from "next/link";

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

export function ProPageHeader({ eyebrow, title, description, actions }: ProPageHeaderProps) {
  return (
    <div className="mb-6 overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl shadow-slate-950/5 backdrop-blur-xl sm:p-6 lg:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-600">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {description && (
            <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              {description}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2 sm:gap-3">{actions}</div>}
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
    "inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-black transition active:scale-[0.98]";
  const styles = {
    primary: "bg-teal-600 text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700",
    secondary: "border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-teal-200 hover:text-teal-800",
    dark: "bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800",
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
    teal: "from-teal-50 to-white text-teal-700 ring-teal-100",
    amber: "from-amber-50 to-white text-amber-700 ring-amber-100",
    blue: "from-sky-50 to-white text-sky-700 ring-sky-100",
    emerald: "from-emerald-50 to-white text-emerald-700 ring-emerald-100",
    slate: "from-slate-100 to-white text-slate-700 ring-slate-200",
    rose: "from-rose-50 to-white text-rose-700 ring-rose-100",
  }[tone];

  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-white bg-white p-5 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-teal-950/5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-teal-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-3 truncate text-2xl font-black tracking-tight text-slate-950">{value}</p>
          {hint && <p className="mt-2 text-xs font-bold text-slate-500">{hint}</p>}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-lg shadow-sm ring-1 ${tones}`}>
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
    <section className={`rounded-[1.5rem] border border-white bg-white p-5 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60 ${className}`}>
      {(title || eyebrow || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-600">{eyebrow}</p>}
            {title && <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function ProEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">✨</div>
      <p className="mt-3 font-black text-slate-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProLoadingState({ label = "Loading your workspace..." }: { label?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white bg-white p-6 shadow-lg shadow-slate-950/5">
      <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
        <span className="h-3 w-3 animate-pulse rounded-full bg-teal-500" />
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
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1 ${tones}`}>{children}</span>;
}
