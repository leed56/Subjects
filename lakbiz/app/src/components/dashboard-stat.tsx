"use client";

import { useLocale } from "@/lib/i18n/locale-provider";

interface DashboardStatProps {
  labelKey: string;
  value: string;
  hintKey?: string;
}

export function DashboardStat({
  labelKey,
  value,
  hintKey,
}: DashboardStatProps) {
  const { t } = useLocale();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-700 font-sinhala">
        {t(labelKey)}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hintKey && (
        <p className="mt-1 text-xs text-slate-500 font-sinhala">{t(hintKey)}</p>
      )}
    </div>
  );
}
