import Link from "next/link";
import type { SectorTemplate } from "@/lib/types";

export function SectorCard({ sector }: { sector: SectorTemplate }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-3xl" aria-hidden>
          {sector.icon}
        </span>
        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
          {sector.extraFields.length} extra fields
        </span>
      </div>
      <h3 className="font-semibold text-slate-900">{sector.nameEn}</h3>
      <p className="mt-0.5 text-sm text-slate-500">{sector.nameSi}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {sector.description}
      </p>
      <ul className="mt-3 space-y-1 text-xs text-slate-500">
        {sector.reports.slice(0, 2).map((report) => (
          <li key={report}>• {report}</li>
        ))}
      </ul>
      <Link
        href={`/sectors/${sector.id}`}
        className="mt-4 inline-block text-sm font-medium text-teal-700 hover:text-teal-900"
      >
        View fields →
      </Link>
    </div>
  );
}
