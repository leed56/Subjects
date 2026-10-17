import type { ReactNode } from "react";
import { DashboardIcon } from "@/components/ui/icons";

export type WorkspaceTone = "blue" | "teal" | "emerald" | "amber" | "rose" | "slate";

/** Presentation only: callers supply authoritative values and period/context. */
export function WorkspaceMetric({
  label, value, hint, icon, tone = "blue", className = "", ui = "metric-card",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: WorkspaceTone;
  className?: string;
  ui?: string;
}) {
  // Prefer thousands-group boundaries for large values; textContent and
  // accessible value stay exact. Normal mobile amounts keep their decimals.
  const currency = value.match(/^([−-]?(?:LKR|Rs\.)\s+)(.+)$/);
  const groups = (currency?.[2] ?? value).split(/(?<=,)/);
  const displayValue = groups.map((group, index) => (
    <span key={index}>{group}{index < groups.length - 1 && <wbr />}</span>
  ));
  return (
    <article data-ui={ui} data-tone={tone} className={`workspace-metric ${className}`}>
      <div className="workspace-metric-heading">
        <p className="workspace-metric-label">{label}</p>
        <span className="workspace-metric-icon" aria-hidden="true">
          {icon ?? <DashboardIcon className="h-5 w-5" />}
        </span>
      </div>
      <p className={`workspace-metric-value ${currency ? "workspace-metric-value-currency" : ""}`}>
        {currency ? <><span>{currency[1]}</span><span className="workspace-metric-number">{displayValue}</span></> : displayValue}
      </p>
      {hint && <p className="workspace-metric-hint">{hint}</p>}
    </article>
  );
}

export function WorkspacePanel({
  title, eyebrow, action, children, className = "", ui = "panel",
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  ui?: string;
}) {
  return (
    <section data-ui={ui} className={`workspace-panel ${className}`}>
      {(title || eyebrow || action) && (
        <div className="workspace-panel-heading">
          <div className="min-w-0">
            {eyebrow && <p className="workspace-panel-eyebrow">{eyebrow}</p>}
            {title && <h2 className="workspace-panel-title">{title}</h2>}
          </div>
          {action && <div className="workspace-panel-actions">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
