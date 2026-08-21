"use client";

import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  hideOnMobile?: boolean;
};

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  onRowClick,
  emptyState,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
}) {
  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={
                  onRowClick
                    ? "cursor-pointer transition hover:bg-teal-50/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-500"
                    : "transition hover:bg-slate-50/50"
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-4 text-slate-700 ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 sm:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
              onRowClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            className={`px-4 py-4 ${onRowClick ? "cursor-pointer active:bg-teal-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-500" : ""}`}
          >
            {columns
              .filter((col) => !col.hideOnMobile)
              .map((col, i) => (
                <div key={col.key} className={`flex items-center justify-between gap-4 ${i > 0 ? "mt-2" : ""}`}>
                  {i > 0 && <span className="text-xs font-medium text-slate-400">{col.header}</span>}
                  <span className={i === 0 ? "text-sm font-semibold text-slate-950" : "text-sm text-slate-700"}>
                    {col.render(row)}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
