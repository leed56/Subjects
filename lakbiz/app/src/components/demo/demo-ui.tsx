"use client";
import type { ReactNode } from "react";
import {
  StockIcon,
  DashboardIcon,
  SalesIcon,
  SuppliersIcon,
  BankingIcon,
  CustomersIcon,
  WorkforceIcon,
  ReportsIcon,
  SettingsIcon,
  PlansIcon,
  ShopIcon,
  AlertTriangleIcon,
  LayersIcon,
  ShieldIcon,
  JobsIcon,
  type IconProps,
} from "@/components/ui/icons";
import type { WorkspaceId } from "@/lib/erp/industry-templates";
import { money } from "@/lib/erp/demo-engine";
export const DEMO_ICONS: Record<
  WorkspaceId,
  (p: IconProps) => React.ReactElement
> = {
  overview: DashboardIcon,
  pos: SalesIcon,
  purchases: SuppliersIcon,
  imports: LayersIcon,
  inventory: StockIcon,
  warehouses: ShopIcon,
  damage: AlertTriangleIcon,
  returns: JobsIcon,
  finance: BankingIcon,
  customers: CustomersIcon,
  loyalty: PlansIcon,
  staff: WorkforceIcon,
  reports: ReportsIcon,
  pulse: DashboardIcon,
  settings: SettingsIcon,
  admin: ShieldIcon,
  templates: LayersIcon,
};
export function DemoMetric({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <article className={`demo-metric ${accent ? "demo-metric-accent" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="demo-overline">{label}</p>
        {icon && <span className="demo-icon-chip">{icon}</span>}
      </div>
      <p className="demo-metric-value">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
    </article>
  );
}
export function DemoSection({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`demo-panel ${className}`}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && <p className="demo-overline mb-1.5">{eyebrow}</p>}
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function DemoPill({
  children,
  tone = "good",
}: {
  children: ReactNode;
  tone?: "good" | "warn" | "bad" | "quiet";
}) {
  return (
    <span className={`demo-pill demo-pill-${tone}`}>
      <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
      {children}
    </span>
  );
}
export function DemoEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
      <StockIcon className="mx-auto mb-3 h-7 w-7 text-slate-400" />
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}
export function RevenueChart({
  points,
}: {
  points: { label: string; value: number }[];
}) {
  const width = 720,
    height = 200,
    pad = 20,
    max = Math.max(...points.map((p) => p.value), 1),
    step = (width - 2 * pad) / Math.max(points.length - 1, 1),
    coords = points.map((p, i) => [
      pad + i * step,
      height - pad - (p.value / max) * (height - 2 * pad),
    ]),
    line = coords.map((p, i) => `${i ? "L" : "M"}${p.join(",")}`).join(" "),
    area = `${line} L${width - pad},${height - pad} L${pad},${height - pad} Z`;
  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Revenue trend: ${points.map((p) => `${p.label} ${money(p.value)}`).join(", ")}`}
      >
        <defs>
          <linearGradient id="demo-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--demo-accent)" stopOpacity=".2" />
            <stop
              offset="100%"
              stopColor="var(--demo-accent)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((n) => (
          <line
            key={n}
            x1={pad}
            x2={width - pad}
            y1={pad + (n * (height - 2 * pad)) / 3}
            y2={pad + (n * (height - 2 * pad)) / 3}
            stroke="#e8edf2"
            strokeDasharray="4 6"
          />
        ))}
        <path d={area} fill="url(#demo-chart-fill)" />
        <path
          d={line}
          stroke="var(--demo-accent)"
          strokeWidth="3"
          fill="none"
          strokeLinejoin="round"
        />
        {coords.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3.5"
            fill="white"
            stroke="var(--demo-accent)"
            strokeWidth="2"
          >
            <title>
              {points[i].label}: {money(points[i].value)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-3 flex justify-between gap-2 text-[10px] text-slate-400">
        <span>{points[0]?.label}</span>
        <span>14 business days · sample transactions</span>
        <span>{points.at(-1)?.label}</span>
      </div>
    </div>
  );
}
export function demoDate(date: string) {
  return new Date(date).toLocaleDateString("en-LK", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
  });
}
export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
}
