"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error("LakBiz route error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-2xl items-center px-4 py-10">
      <section role="alert" className="w-full rounded-2xl border border-rose-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">{t("resilience.error_eyebrow")}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{t("resilience.error_title")}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{t("resilience.error_body")}</p>
        {error.digest ? <p className="mt-3 font-mono text-xs text-slate-400">Reference: {error.digest}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-teal-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-teal-700">
            {t("resilience.retry")}
          </button>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {t("resilience.dashboard")}
          </Link>
        </div>
      </section>
    </main>
  );
}
