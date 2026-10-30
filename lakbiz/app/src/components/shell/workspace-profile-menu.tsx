"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ChevronDownIcon, SignOutIcon } from "@/components/ui/icons";
import { initialsFor } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const profileCopy = {
  en: { workspace: "Workspace profile", details: "Account details", demo: "Demo workspace" },
  si: { workspace: "වෙළඳසැල් පැතිකඩ", details: "ගිණුම් විස්තර", demo: "Demo වැඩබිම" },
  ta: { workspace: "கடை சுயவிவரம்", details: "கணக்கு விவரங்கள்", demo: "Demo பணியிடம்" },
} as const;

/** A compact shop identity control with account details revealed on demand. */
export function WorkspaceProfileMenu({ appearance = "dark" }: { appearance?: "dark" | "light" }) {
  const { user, logout } = useAuth();
  const { org, isPlatformAdmin } = useSubscription();
  const { locale, t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const dark = appearance === "dark";
  const roleLabel = isPlatformAdmin ? t("admin.nav") : t(`team.role_${org.role}`);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setExpanded(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setExpanded(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded]);

  const handleLogout = async () => {
    setExpanded(false);
    await logout();
    window.location.href = "/login";
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${org.name} · ${profileCopy[locale].workspace}`}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
        className={`flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${dark ? "border-white/[0.07] bg-white/[0.035] text-white hover:border-white/[0.12] hover:bg-white/[0.065]" : "border-slate-200 bg-white text-slate-950 shadow-sm hover:border-teal-200 hover:bg-teal-50/40"}`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-1 ring-inset ${dark ? "bg-gradient-to-br from-teal-400/25 to-blue-500/20 text-teal-100 ring-teal-200/10" : "bg-gradient-to-br from-teal-100 to-cyan-100 text-teal-800 ring-teal-200/70"}`}>
          {initialsFor(org.name, user?.email)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={org.name}>{org.name}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""} ${dark ? "text-slate-400" : "text-slate-500"}`} />
      </button>

      {expanded && (
        <section
          id={panelId}
          aria-label={profileCopy[locale].details}
          className={`absolute bottom-full left-0 right-0 z-50 mb-2 max-h-[min(24rem,calc(100dvh-7rem))] overflow-y-auto rounded-2xl border p-3 shadow-[0_20px_55px_rgba(2,8,23,0.28)] backdrop-blur-xl ${dark ? "border-white/10 bg-[#111e32]/[0.98] text-white" : "border-slate-200 bg-white/[0.98] text-slate-950"}`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${dark ? "bg-teal-400/15 text-teal-200" : "bg-teal-100 text-teal-800"}`}>
              {initialsFor(org.name, user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${dark ? "text-white" : "text-slate-950"}`} title={org.name}>{org.name}</p>
              <p className={`mt-0.5 truncate text-[11px] ${dark ? "text-slate-400" : "text-slate-500"}`} title={user?.email ?? undefined}>
                {user?.email ?? profileCopy[locale].demo}
              </p>
            </div>
          </div>
          <div className={`mt-3 flex items-center justify-between gap-2 border-t pt-3 ${dark ? "border-white/[0.08]" : "border-slate-100"}`}>
            <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${dark ? "text-slate-500" : "text-slate-400"}`}>{profileCopy[locale].workspace}</span>
            <span className={`max-w-[58%] truncate rounded-full px-2 py-1 text-[10px] font-bold ${dark ? "bg-teal-400/10 text-teal-200" : "bg-teal-50 text-teal-800"}`} title={roleLabel}>{roleLabel}</span>
          </div>
          {user ? (
            <button
              type="button"
              onClick={() => void handleLogout()}
              className={`mt-3 flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${dark ? "text-rose-300 hover:bg-rose-400/10" : "text-rose-700 hover:bg-rose-50"}`}
            >
              <SignOutIcon className="h-4 w-4" />
              {t("sub.sign_out")}
            </button>
          ) : (
            <Link href="/login" onClick={() => setExpanded(false)} className={`mt-3 flex min-h-10 w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition ${dark ? "bg-teal-400/15 text-teal-100 hover:bg-teal-400/20" : "bg-teal-600 text-white hover:bg-teal-700"}`}>
              {t("sub.sign_in")}
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
