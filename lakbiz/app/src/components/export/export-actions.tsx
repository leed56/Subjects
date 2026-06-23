"use client";

import { useLocale } from "@/lib/i18n/locale-provider";

type ExportActionsProps = {
  onExportCsv: () => void;
  onPrintPdf?: () => void;
  disabled?: boolean;
  compact?: boolean;
};

export function ExportActions({
  onExportCsv,
  onPrintPdf,
  disabled,
  compact,
}: ExportActionsProps) {
  const { t } = useLocale();
  const base =
    compact
      ? "rounded-xl px-3 py-2 text-xs font-black"
      : "rounded-2xl px-4 py-2.5 text-sm font-black";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onExportCsv}
        className={`${base} border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:border-teal-200 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {t("export.csv")}
      </button>
      {onPrintPdf && (
        <button
          type="button"
          disabled={disabled}
          onClick={onPrintPdf}
          className={`${base} border border-indigo-200 bg-indigo-50 text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {t("export.pdf")}
        </button>
      )}
    </div>
  );
}
