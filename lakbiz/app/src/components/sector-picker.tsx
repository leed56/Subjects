"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import { sectors } from "@/lib/sectors";
import type { SectorId } from "@/lib/types";

const ACCENTS: Record<string, string> = {
  grocery: "border-emerald-300 bg-emerald-50 ring-emerald-500",
  electronics: "border-sky-300 bg-sky-50 ring-sky-500",
  electricals: "border-amber-300 bg-amber-50 ring-amber-500",
  spare_parts: "border-slate-300 bg-slate-50 ring-slate-500",
  ac_hvac: "border-cyan-300 bg-cyan-50 ring-cyan-500",
  car_sales: "border-violet-300 bg-violet-50 ring-violet-500",
};

interface SectorPickerProps {
  value: SectorId;
  onChange: (sector: SectorId) => void;
}

export function SectorPicker({ value, onChange }: SectorPickerProps) {
  const { locale, t } = useLocale();

  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-slate-700">
        {t("sub.pick_sector")} *
      </legend>
      <p className="mb-3 text-xs text-slate-500">{t("sub.pick_sector_hint")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sectors.map((sector) => {
          const selected = value === sector.id;
          const name = locale === "si" ? sector.nameSi : sector.nameEn;
          const accent = ACCENTS[sector.id] ?? "border-teal-300 bg-teal-50 ring-teal-500";

          return (
            <button
              key={sector.id}
              type="button"
              onClick={() => onChange(sector.id)}
              className={`rounded-xl border p-3 text-left transition-all ${
                selected
                  ? `ring-2 ${accent}`
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="text-xl">{sector.icon}</span>
              <span className="mt-1 block text-xs font-semibold leading-snug text-slate-900">
                {name}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
