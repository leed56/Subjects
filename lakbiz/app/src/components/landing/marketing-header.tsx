"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";

export function MarketingHeader() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "#sectors", label: t("home.sectors_title") },
    { href: "#features", label: t("home.features_title") },
    { href: "/settings/plans", label: t("nav.plans") },
    { href: "/login", label: t("nav.login") },
  ];

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "lak-glass-light border-b border-white/60 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-sm font-bold text-white shadow-lg shadow-teal-900/20">
              L
            </span>
            <div className="leading-tight">
              <span
                className={`block text-lg font-bold tracking-tight ${
                  scrolled ? "text-slate-900" : "text-white"
                }`}
              >
                LakBiz
              </span>
              <span
                className={`hidden text-[10px] font-medium uppercase tracking-widest sm:block ${
                  scrolled ? "text-slate-500" : "text-teal-200/80"
                }`}
              >
                Sri Lanka
              </span>
            </div>
          </Link>

          <nav
            className={`hidden items-center gap-6 text-sm font-medium md:flex ${
              scrolled ? "text-slate-600" : "text-slate-200"
            }`}
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition hover:text-teal-400"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setLocale(locale === "si" ? "en" : "si")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                scrolled
                  ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  : "border border-white/20 text-white/90 hover:bg-white/10"
              }`}
            >
              {t("nav.lang")}
            </button>
            <Link
              href="/login"
              className="hidden rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-teal-900/25 transition hover:bg-teal-500 sm:inline-block"
            >
              {t("home.cta_free")}
            </Link>
            <button
              type="button"
              aria-label="Menu"
              onClick={() => setOpen(true)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl md:hidden ${
                scrolled
                  ? "bg-slate-100 text-slate-800"
                  : "bg-white/10 text-white"
              }`}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[60] md:hidden transition ${
          open ? "visible" : "invisible"
        }`}
      >
        <button
          type="button"
          aria-label="Close menu"
          className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute inset-y-0 right-0 w-[min(100%,20rem)] bg-white shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <span className="font-bold text-slate-900">LakBiz</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
            >
              ✕
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3.5 text-base font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-4 rounded-xl bg-teal-600 px-4 py-3.5 text-center text-base font-semibold text-white"
            >
              {t("home.cta_free")}
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-3.5 text-center text-base font-medium text-slate-700"
            >
              {t("nav.demo")}
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
