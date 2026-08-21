"use client";

/** Phase 1 design-system primitives: page/section headers, metrics, empty
 * states, badges, search/filter controls, tabs, and a small action menu.
 *
 * Design language: ~10-14px radius, subtle borders, minimal shadow, neutral
 * slate-50 background, teal-600/700 accent — replacing pro-shell.tsx's
 * rounded-[2rem]/heavy-shadow "dashboard card demo" look page by page as
 * each page is migrated (see docs/IMPLEMENTATION_PROGRESS.md).
 */
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ChevronDownIcon, MoreIcon, SearchIcon, FilterIcon } from "@/components/ui/icons";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  metrics?: ReactNode;
};

export function PageHeader({ title, description, actions, metrics }: PageHeaderProps) {
  return (
    <div className="mb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {metrics && <div className="mt-4">{metrics}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
  uppercase = true,
}: {
  title: string;
  action?: ReactNode;
  /** Reserve uppercase for short eyebrow/metadata-style labels — set false
   * for a section title that should read as normal-case hierarchy. */
  uppercase?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2
        className={
          uppercase
            ? "text-sm font-semibold uppercase tracking-wide text-slate-500"
            : "text-sm font-semibold text-slate-700"
        }
      >
        {title}
      </h2>
      {action}
    </div>
  );
}

/** A titled group of form fields with optional helper text — the "group
 * long forms into sections" primitive. Use `collapsible` for advanced/
 * optional groups that shouldn't compete with the required fields above
 * the fold. */
export function FormSection({
  title,
  hint,
  collapsible = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  hint?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const showBody = !collapsible || open;

  return (
    <section className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-slate-800">{title}</span>
            {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
          </span>
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      ) : (
        <div className="mb-1">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
      )}
      {showBody && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "positive" | "warning" | "danger";
};

const METRIC_TONE: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "text-slate-900",
  positive: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
};

export function MetricCard({ label, value, hint, icon, tone = "default" }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${METRIC_TONE[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Global premium UI phase — the "Operational Panel" card type from the
 * card taxonomy (docs/DESIGN_SYSTEM_CONVERGENCE.md §4): a bordered
 * grouping surface for a table/list/workspace section, distinct from a
 * KPI reading (`MetricCard`) or a page-level empty state. Same visual
 * shape `ProCard` converged to in Stage 1, exposed here so pages already
 * on `primitives.tsx` don't need `pro-shell.tsx` just for a titled card. */
export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
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

type AlertRowTone = "warning" | "danger" | "info" | "positive";

const ALERT_ROW_TONE: Record<AlertRowTone, string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

/** Global premium UI phase — the compact "needs attention" row (Part 10's
 * "only show active alerts, never five zeros"; Part 11's "SMS reminders
 * off" inline status instead of a giant warning panel). One line, one
 * optional action — never a tall decorative card for what is, at most, a
 * sentence and a button. */
export function AlertRow({
  tone = "warning",
  icon,
  children,
  action,
}: {
  tone?: AlertRowTone;
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm ${ALERT_ROW_TONE[tone]}`}>
      <span className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="min-w-0 truncate font-medium">{children}</span>
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}

export function EmptyState({
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
  /** "compact" for a state nested inside a card/section that already has
   * its own heading (avoids two headings + a tall dashed box stacked on
   * top of real content elsewhere on the page); "standard" (default) for
   * a page-level empty state. */
  size?: "compact" | "standard";
}) {
  const padding = size === "compact" ? "px-4 py-6" : "px-6 py-10";
  const iconBox = size === "compact" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className={`rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center ${padding}`}>
      {icon && (
        <div className={`mx-auto mb-2.5 flex items-center justify-center text-slate-400 ${iconBox}`}>{icon}</div>
      )}
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type StatusTone = "neutral" | "positive" | "warning" | "danger" | "info";

const STATUS_TONE: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  positive: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-sky-50 text-sky-700",
};

export function StatusBadge({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_TONE[tone]}`}>
      {children}
    </span>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
      />
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5">
      <FilterIcon className="ml-1 h-4 w-4 shrink-0 text-slate-400" />
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-slate-200">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              active
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "text";
type ButtonSize = "sm" | "md";

const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-teal-600 text-white hover:bg-teal-700",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  destructive: "bg-rose-50 text-rose-700 hover:bg-rose-100",
  text: "text-teal-700 hover:text-teal-800 hover:underline underline-offset-2",
};

const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

/** Standard action-button variants — one primary per context, everything
 * else secondary/ghost/text, destructive kept visually separate. Use
 * `IconButton` below for icon-only controls (always needs `label`). */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  className = "",
  children,
  type = "button",
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  const shape = variant === "text" ? "" : "rounded-lg font-semibold";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${shape} ${
        variant === "text" ? "text-sm font-medium" : BUTTON_SIZE_CLASS[size]
      } ${BUTTON_VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {loading ? "…" : children}
    </button>
  );
}

/** Icon-only control — always requires an accessible `label` (rendered as
 * both `aria-label` and a native tooltip via `title`). */
export function IconButton({
  icon,
  label,
  onClick,
  className = "",
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {icon}
    </button>
  );
}

export type ActionMenuItem = {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

export function ActionMenu({ items, label = "Actions" }: { items: ActionMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <MoreIcon className="h-4.5 w-4.5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`block w-full px-3 py-2 text-left text-sm disabled:opacity-40 ${
                item.tone === "danger"
                  ? "text-rose-600 hover:bg-rose-50"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
