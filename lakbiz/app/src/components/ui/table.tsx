"use client";

/** Phase 1 DataTable — desktop table that degrades to stacked cards on
 * mobile (no wide desktop tables getting squeezed onto phones; see the
 * "Avoid" list in the design spec).
 */
import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Hide this column on mobile card view — for secondary/dense fields. */
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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
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
                className={onRowClick ? "cursor-pointer hover:bg-slate-50" : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-slate-800 ${
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

      {/* Mobile stacked cards */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`px-4 py-3 ${onRowClick ? "cursor-pointer active:bg-slate-50" : ""}`}
          >
            {columns
              .filter((col) => !col.hideOnMobile)
              .map((col, i) => (
                <div key={col.key} className={`flex items-center justify-between gap-3 ${i > 0 ? "mt-1.5" : ""}`}>
                  {i > 0 && <span className="text-xs font-medium text-slate-500">{col.header}</span>}
                  <span className={i === 0 ? "text-sm font-semibold text-slate-900" : "text-sm text-slate-700"}>
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
