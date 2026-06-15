"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";
import { SectorCard } from "@/components/sector-card";
import { sectors } from "@/lib/sectors";

export function LandingSectors() {
  const { t } = useLocale();

  return (
    <section id="sectors" className="border-t border-slate-100 bg-slate-50/80 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">
              {t("home.sectors_eyebrow")}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {t("home.sectors_title")}
            </h2>
            <p className="mt-3 text-base text-slate-600 sm:text-lg">
              {t("home.sectors_desc")}
            </p>
          </div>
          <Link
            href="/sectors"
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-800"
          >
            {t("home.sectors_all")}
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {sectors.map((sector) => (
            <SectorCard key={sector.id} sector={sector} />
          ))}
        </div>
      </div>
    </section>
  );
}
