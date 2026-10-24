import type { ReactNode } from "react";

/**
 * Shared compact heading for operational Grocery routes. It deliberately
 * carries context and actions without becoming a large decorative hero, so
 * the catalogue, supplier register and accounting work remain above the fold.
 */
export function GroceryWorkspaceHeader({
  eyebrow,
  title,
  description,
  actions,
  detail,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <section className="relative mb-5 overflow-hidden rounded-[22px] border border-slate-200 bg-[radial-gradient(circle_at_100%_0%,rgba(99,102,241,0.14),transparent_31%),radial-gradient(circle_at_3%_100%,rgba(20,184,166,0.10),transparent_30%),linear-gradient(120deg,#ffffff_0%,#f7fbff_58%,#f8f7ff_100%)] px-5 py-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:px-6">
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-teal-700">{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.045em] text-slate-950 sm:text-3xl">{title}</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          {detail && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">{detail}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}
