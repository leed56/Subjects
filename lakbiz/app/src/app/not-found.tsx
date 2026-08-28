"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";

export default function NotFound() {
  const { t } = useLocale();

  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-2xl items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">{t("resilience.not_found_title")}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{t("resilience.not_found_body")}</p>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-teal-600 px-5 text-sm font-bold text-white hover:bg-teal-700">
          {t("resilience.dashboard")}
        </Link>
      </section>
    </main>
  );
}
