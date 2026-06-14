"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SectorCard } from "@/components/sector-card";
import { useLocale } from "@/lib/i18n/locale-provider";
import { sectors, bankingModules } from "@/lib/sectors";

export default function Home() {
  const { t } = useLocale();

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="rounded-2xl bg-gradient-to-br from-teal-800 to-teal-950 px-8 py-12 text-white">
          <p className="text-sm font-medium text-teal-200">{t("home.badge")}</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-bold leading-tight">
            {t("home.hero")}
          </h1>
          <p className="mt-2 text-lg text-teal-100">{t("home.tagline")}</p>
          <p className="mt-4 max-w-2xl text-teal-100">{t("home.desc")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/stock"
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-teal-900 hover:bg-teal-50"
            >
              {t("home.add_stock")}
            </Link>
            <Link
              href="/sales"
              className="rounded-lg border border-teal-400 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {t("home.new_sale")}
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-teal-400 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {t("home.dashboard")}
            </Link>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-slate-900">
            {t("home.sectors_title")}
          </h2>
          <p className="mt-1 text-slate-600">{t("home.sectors_desc")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((sector) => (
              <SectorCard key={sector.id} sector={sector} />
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🏦</span>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {bankingModules.nameEn}
              </h2>
              <p className="text-sm text-slate-500">{bankingModules.nameSi}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {bankingModules.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <Link
                href="/banking"
                className="mt-4 inline-block text-sm font-medium text-teal-700"
              >
                {t("home.banking_link")}
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-teal-200 bg-teal-50 p-6">
          <h2 className="font-semibold text-teal-900">{t("home.try_title")}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-teal-900">
            <li>
              <Link href="/stock" className="underline font-medium">
                {t("nav.stock")}
              </Link>{" "}
              — {t("home.try_stock")}
            </li>
            <li>
              <Link href="/sales" className="underline font-medium">
                {t("nav.sales")}
              </Link>{" "}
              — {t("home.try_sales")}
            </li>
            <li>
              <Link href="/dashboard" className="underline font-medium">
                {t("nav.dashboard")}
              </Link>{" "}
              — {t("home.try_dashboard")}
            </li>
          </ol>
          <p className="mt-3 text-xs text-teal-800">{t("home.data_note")}</p>
        </section>
      </main>
    </div>
  );
}
