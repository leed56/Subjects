"use client";

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
    <div className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2.5">{actions}</div>}
      </div>
      {metrics && <div className="mt-5">{metrics}</div>}
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
  uppercase?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2
        className={
          uppercase
            ? "text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"
            : "text-base font-semibold tracking-tight text-slate-800"
        }
      >
        {title}
      </h2>
      {action}
    </div>
  );
}

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
    <section className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
        >
          <span>
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            {hint && <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span>}
          </span>
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      ) : (
        <div className="mb-1">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
        </div>
      )}
      {showBody && <div className="mt-4 space-y-4">{children}</div>}
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
  default: "text-slate-950",
  positive: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
};

export function MetricCard({ label, value, hint, icon, tone = "default" }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-100">
            {icon}
          </span>
        )}
      </div>
      <p className={`mt-2.5 text-2xl font-bold tracking-[-0.025em] ${METRIC_TONE[tone]}`}>{value}</p>
      {hint && <p className="mt-1.5 text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

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
    <section className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6 ${className}`}>
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

type AlertRowTone = "warning" | "danger" | "info" | "positive";

const ALERT_ROW_TONE: Record<AlertRowTone, string> = {
  warning: "border-amber-200/80 bg-amber-50/80 text-amber-900",
  danger: "border-rose-200/80 bg-rose-50/80 text-rose-900",
  info: "border-sky-200/80 bg-sky-50/80 text-sky-900",
  positive: "border-emerald-200/80 bg-emerald-50/80 text-emerald-900",
};

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
    <div className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${ALERT_ROW_TONE[tone]}`}>
      <span className="flex min-w-0 items-center gap-2.5">
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
  size?: "compact" | "standard";
}) {
  const padding = size === "compact" ? "px-5 py-7" : "px-6 py-11";
  const iconBox = size === "compact" ? "h-10 w-10" : "h-12 w-12";
  return (
    <div className={`rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 text-center ${padding}`}>
      {icon && (
        <div className={`mx-auto mb-3 flex items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/70 ${iconBox}`}>
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

type StatusTone = "neutral" | "positive" | "warning" | "danger" | "info";

const STATUS_TONE: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  danger: "bg-rose-50 text-rose-700 ring-rose-100",
  info: "bg-sky-50 text-sky-700 ring-sky-100",
};

export function StatusBadge({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[tone]}`}>
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
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.03)] placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-100/70"
      />
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_6px_24px_rgba(15,23,42,0.035)]">
      <FilterIcon className="ml-1 h-4 w-4 shrink-0 text-slate-400" />
      <div className="flex flex-1 flex-wrap items-center gap-2.5">{children}</div>
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
    <div role="tablist" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              active
                ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/70"
                : "text-slate-500 hover:text-slate-800"
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
  primary: "bg-teal-600 text-white shadow-sm shadow-teal-950/15 hover:bg-teal-700 hover:shadow-md hover:shadow-teal-950/15",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
  destructive: "border border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100",
  text: "text-teal-700 hover:text-teal-800 hover:underline underline-offset-4",
};

const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4.5 py-2.5 text-sm",
};

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
  const shape = variant === "text" ? "" : "rounded-xl font-semibold";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${shape} ${
        variant === "text" ? "text-sm font-medium" : BUTTON_SIZE_CLASS[size]
      } ${BUTTON_VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {loading ? "…" : children}
    </button>
  );
}

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
      className={`flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
      >
        <MoreIcon className="h-4.5 w-4.5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.14)]"
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
              className={`block w-full px-3.5 py-2.5 text-left text-sm transition disabled:opacity-40 ${
                item.tone === "danger"
                  ? "text-rose-600 hover:bg-rose-50"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
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