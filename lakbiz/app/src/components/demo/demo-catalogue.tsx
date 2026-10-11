"use client";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  INDUSTRY_TEMPLATES,
  DEMO_PASSWORD,
  WORKSPACES,
} from "@/lib/erp/industry-templates";
import { SectorIcon } from "@/components/sector-icon";
import { ArrowMark, BrandMark } from "./demo-marks";
import { SearchIcon, CheckIcon } from "@/components/ui/icons";
export function DemoCatalogue() {
  const [search, setSearch] = useState(""),
    [copied, setCopied] = useState(false);
  const templates = INDUSTRY_TEMPLATES.filter((t) =>
    `${t.nameEn} ${t.highlights.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        INDUSTRY_TEMPLATES.map(
          (t) =>
            `${t.nameEn}\n${window.location.origin}${t.demoPath}\nEmail: ${t.demoEmail}\nPassword: ${DEMO_PASSWORD}\n`,
        ).join("\n"),
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div
      className="erp-demo demo-catalogue"
      style={{ "--demo-accent": "#0f9b88" } as CSSProperties}
    >
      <nav className="demo-catalogue-nav">
        <Link href="/demo" className="flex items-center gap-3">
          <BrandMark />
          <span className="text-xl font-semibold tracking-tight">
            LakBiz
            <span className="ml-2 text-xs font-medium text-slate-400">
              Showcase
            </span>
          </span>
        </Link>
        <Link href="/" className="text-sm text-slate-500">
          Back to LakBiz <span aria-hidden>↗</span>
        </Link>
      </nav>
      <main className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-10">
        <section className="demo-catalogue-hero">
          <div>
            <p className="demo-overline text-teal-400">
              A workspace for every ambition
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.12] tracking-[-.05em] sm:text-6xl">
              Your industry.
              <br />
              <span className="text-teal-300">Beautifully in control.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
              Explore {INDUSTRY_TEMPLATES.length} complete sample workspaces.
              From the first purchase to the owner’s next decision, see your
              business in a new light.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#industries" className="demo-primary">
                Explore the industries <ArrowMark />
              </a>
              <button
                type="button"
                onClick={copy}
                className="demo-dark-secondary"
              >
                {copied ? "Demo logins copied" : "Copy all demo logins"}
              </button>
            </div>
            <p className="mt-5 text-xs text-slate-500">
              Public demo credentials · Synthetic data · Browser-local changes
            </p>
          </div>
          <div className="demo-preview-board" aria-hidden>
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-xs text-slate-300">Business overview</span>
              <span className="rounded-full bg-teal-400/10 px-2 py-1 text-[9px] text-teal-300">
                Sample workspace
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-500">NET SALES</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  Rs. 482,650
                </p>
                <p className="mt-2 text-[10px] text-teal-300">
                  Every transaction, connected
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">INVENTORY HEALTH</p>
                <p className="mt-2 text-2xl font-semibold text-white">94.8%</p>
                <p className="mt-2 text-[10px] text-slate-400">
                  Across three sample locations
                </p>
              </div>
            </div>
            <svg viewBox="0 0 420 120" className="my-7 w-full">
              <path
                d="M0 108 L30 87 L60 93 L90 67 L120 76 L150 42 L180 53 L210 30 L240 45 L270 19 L300 35 L330 13 L360 27 L390 6 L420 15"
                stroke="#2dd4bf"
                strokeWidth="3"
                fill="none"
              />
            </svg>
            <div className="grid grid-cols-3 gap-2">
              {[
                "POS & commerce",
                "Inventory & finance",
                "Owner intelligence",
              ].map((t) => (
                <div
                  key={t}
                  className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-[10px] text-slate-400"
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-9 sm:grid-cols-4">
          {[
            [String(INDUSTRY_TEMPLATES.length), "Industry templates"],
            [String(WORKSPACES.length), "Connected workspaces"],
            ["3", "Operating locations"],
            ["1", "Shared operating system"],
          ].map(([n, l]) => (
            <div key={l}>
              <p className="text-3xl font-semibold tracking-tight text-slate-900">
                {n}
              </p>
              <p className="mt-1 text-xs text-slate-500">{l}</p>
            </div>
          ))}
        </div>
        <section id="industries" className="pt-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="demo-overline">Choose your workspace</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Purpose-built. Together.
              </h2>
            </div>
            <label className="relative block w-full sm:w-80">
              <span className="sr-only">Find an industry</span>
              <SearchIcon className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find your industry…"
                className="demo-input pl-10"
              />
            </label>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <article
                key={t.id}
                className="demo-template-card"
                style={{ "--demo-accent": t.accent } as CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <div className="demo-industry-icon">
                    <SectorIcon sectorId={t.id} className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-medium tracking-wider text-slate-400">
                    TEMPLATE {t.version}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">
                  {t.nameEn}
                </h3>
                <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">
                  {t.promise}
                </p>
                <ul className="my-5 space-y-2.5">
                  {t.highlights.map((h) => (
                    <li key={h} className="flex gap-2 text-xs text-slate-600">
                      <CheckIcon className="h-4 w-4 shrink-0 text-teal-600" />
                      {h}
                    </li>
                  ))}
                </ul>
                <div className="demo-credentials">
                  <p className="demo-overline">Public demo login</p>
                  <p className="mt-2 break-all font-mono text-xs text-slate-700">
                    {t.demoEmail}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {DEMO_PASSWORD}
                  </p>
                </div>
                <Link href={t.demoPath} className="demo-template-cta">
                  Open {t.company}
                  <ArrowMark />
                </Link>
              </article>
            ))}
          </div>
          {!templates.length && (
            <p role="status" className="py-16 text-center text-slate-500">
              No matching industries. Try another search.
            </p>
          )}
        </section>
        <section className="demo-catalogue-footer">
          <BrandMark />
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              One platform. A complete business story.
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              POS, purchasing, imports, inventory, warehouses, finance,
              relationships and owner intelligence.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              These public sample logins open demonstration data only. They do
              not authenticate to your live business.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
