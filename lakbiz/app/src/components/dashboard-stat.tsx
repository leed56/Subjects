interface DashboardStatProps {
  labelEn: string;
  labelSi: string;
  value: string;
  hint?: string;
}

export function DashboardStat({
  labelEn,
  labelSi,
  value,
  hint,
}: DashboardStatProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {labelEn}
      </p>
      <p className="text-xs text-slate-400">{labelSi}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
