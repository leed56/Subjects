"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { SectorTemplate } from "@/lib/types";

const ACCENTS: Record<string, string> = {
  grocery: "bg-emerald-100 text-emerald-700",
  electronics: "bg-sky-100 text-sky-700",
  electricals: "bg-amber-100 text-amber-700",
  spare_parts: "bg-slate-100 text-slate-700",
  ac_hvac: "bg-cyan-100 text-cyan-700",
  car_sales: "bg-violet-100 text-violet-700",
};

interface SectorCardProps {
  sector: SectorTemplate;
}

export function SectorCard({ sector }: SectorCardProps) {
  const { locale, t } = useLocale();
  const name = locale === "si" ? sector.nameSi : sector.nameEn;
  const accent = ACCENTS[sector.id] ?? "bg-teal-100 text-teal-700";

  return (
    <Link
      href={`/sectors/${sector.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/10 active:scale-[0.99] sm:p-6"
    >
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${accent} shadow-sm transition-transform duration-300 group-hover:scale-105`}
      >
        {sector.icon}
      </div>
      <h3 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
        {name}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
        {sector.description}
      </p>
      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-teal-600 transition-colors group-hover:text-teal-700">
        <span>{t("home.explore")}</span>
        <svg
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </Link>
  );
}
