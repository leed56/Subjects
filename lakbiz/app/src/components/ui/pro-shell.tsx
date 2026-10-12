import { WorkspaceMetric, WorkspacePanel } from "@/components/ui/workspace-surfaces";
import { IndustryHeaderImages } from "@/components/ui/industry-imagery";
import type { SectorId } from "@/lib/types";
import type { ReactNode } from "react";
import Link from "next/link";
import { InboxIcon } from "@/components/ui/icons";

export function ProPageShell({ children }: { children: ReactNode }) {
  return <div className="min-h-full bg-[#f3f6fa]">{children}</div>;
}

export function ProMain({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      {children}
    </main>
  );
}

type ProPageHeaderProps = {
  sector?: SectorId;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function ProPageHeader({ sector, eyebrow, title, description, actions }: ProPageHeaderProps) {
  return (
    <div data-ui="pro-page-header" className="workspace-page-header">
      <div className={`workspace-banner ${sector ? "live-industry-header" : ""}`}>
        {sector && <IndustryHeaderImages sector={sector} />}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-[2rem]">
              {title}
            </h1>
            {description && (
              <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                {description}
              </div>
            )}
          </div>
          {actions && <div className="workspace-header-actions">{actions}</div>}
        </div>
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
    "inline-flex min-h-11 items-center justify-center rounded-xl px-4.5 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.985]";
  const styles = {
    primary:
      "bg-teal-600 text-white shadow-[0_8px_20px_rgba(13,148,136,0.18)] hover:bg-teal-700 hover:shadow-[0_10px_26px_rgba(13,148,136,0.22)]",
    secondary:
      "border border-slate-200 bg-white text-slate-700 shadow-[0_3px_10px_rgba(15,23,42,0.045)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950",
    dark: "bg-[#07111f] text-white shadow-[0_8px_20px_rgba(7,17,31,0.16)] hover:bg-slate-800",
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
  className?: string;
};

export function ProStatCard(props: ProStatCardProps) {
  return <WorkspaceMetric {...props} ui="pro-stat-card" />;
}

type ProCardProps = {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ProCard(props: ProCardProps) {
  return <WorkspacePanel {...props} ui="pro-card" />;
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
  const padding = size === "compact" ? "px-5 py-6" : "px-6 py-8 sm:py-9";
  const iconBox = size === "compact" ? "h-10 w-10" : "h-12 w-12";
  return (
    <div
      data-ui="pro-empty-state"
      className={`workspace-empty relative overflow-hidden rounded-2xl text-center ${padding}`}
    >
      <div className="pointer-events-none absolute inset-x-[20%] top-0 h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent" />
      <div className={`mx-auto flex items-center justify-center rounded-xl bg-white text-teal-700 shadow-[0_6px_18px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80 ${iconBox}`}>
        {icon ?? <InboxIcon className="h-5 w-5" />}
      </div>
      <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-slate-950">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProLoadingState({ label = "Loading your workspace..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-500" />
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
