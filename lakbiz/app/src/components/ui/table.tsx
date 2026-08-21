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
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fcfdff_100%)] shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-[#f3f7fa]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/90">
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
                    ? "cursor-pointer transition duration-150 hover:bg-teal-50/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-500"
                    : "transition duration-150 hover:bg-slate-50/70"
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-[1.05rem] text-slate-700 ${
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
            className={`bg-white px-4 py-4 ${onRowClick ? "cursor-pointer active:bg-teal-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-500" : ""}`}
          >
            {columns
              .filter((col) => !col.hideOnMobile)
              .map((col, i) => (
                <div key={col.key} className={`flex items-center justify-between gap-4 ${i > 0 ? "mt-2.5" : ""}`}>
                  {i > 0 && <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{col.header}</span>}
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
