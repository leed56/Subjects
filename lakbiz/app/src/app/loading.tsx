"use client";

import { useLocale } from "@/lib/i18n/locale-provider";

export default function Loading() {
  const { t } = useLocale();

  return (
    <main aria-busy="true" aria-labelledby="route-loading-title" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mb-7">
        <div aria-hidden="true" className="h-3 w-24 animate-pulse rounded-full bg-teal-100" />
        <div aria-hidden="true" className="mt-3 h-8 w-52 max-w-[75%] animate-pulse rounded-lg bg-slate-200" />
        <p id="route-loading-title" role="status" className="mt-3 text-sm font-medium text-slate-500">
          {t("resilience.loading_workspace")}
        </p>
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white/80" />
        ))}
      </div>
      <div aria-hidden="true" className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
        <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </main>
  );
}
