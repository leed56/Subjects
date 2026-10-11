"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  WORKSPACES,
  INDUSTRY_TEMPLATES,
  DEMO_PASSWORD,
  validateDemoLogin,
  demoCanUse,
  type DemoRole,
  type IndustryTemplate,
  type WorkspaceId,
} from "@/lib/erp/industry-templates";
import { executeDemoCommand } from "@/lib/erp/demo-engine";
import { createDemoState } from "@/lib/erp/demo-data";
import {
  readDemoState,
  saveDemoState,
  hasDemoSession,
  startDemoSession,
  endDemoSession,
} from "@/lib/erp/demo-storage";
import type { DemoCommand, DemoState } from "@/lib/erp/demo-types";
import {
  MenuIcon,
  SearchIcon,
  SignOutIcon,
  ShieldIcon,
  BellIcon,
  ShopIcon,
} from "@/components/ui/icons";
import { SectorIcon } from "@/components/sector-icon";
import { BrandMark, ArrowMark } from "./demo-marks";
import { DEMO_ICONS, DemoEmpty } from "./demo-ui";
import { ReferenceBanner } from "./reference-visuals";
import { DemoScreens } from "./demo-screens";
import { DemoActionDrawer, type DemoAction } from "./demo-action-drawer";

export function DemoWorkspace({
  template,
  workspace,
}: {
  template: IndustryTemplate;
  workspace: WorkspaceId;
}) {
  const [data, setData] = useState<DemoState | null>(null),
    [signedIn, setSignedIn] = useState(false),
    [ready, setReady] = useState(false),
    [role, setRole] = useState<DemoRole>("owner"),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [action, setAction] = useState<DemoAction | null>(null);
  const current = useRef<DemoState | null>(null),
    [email, setEmail] = useState(template.demoEmail),
    [password, setPassword] = useState("");
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const state = readDemoState(template.id);
      current.current = state;
      setData(state);
      setSignedIn(hasDemoSession(template.id));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [template.id]);
  function login(e: React.FormEvent) {
    e.preventDefault();
    if (!validateDemoLogin(template.id, email, password)) {
      setError("Use the public sample email and password shown below.");
      return;
    }
    enter();
  }
  function enter() {
    try {
      startDemoSession(template.id);
    } catch {
      /* This browser may disallow sample-session persistence. */
    }
    setSignedIn(true);
    setPassword("");
    setError("");
  }
  function run(command: DemoCommand) {
    if (!current.current) return false;
    try {
      const next = executeDemoCommand(
        current.current,
        command,
        role,
        new Date(),
        crypto.randomUUID(),
      );
      current.current = next;
      setData(next);
      setError("");
      try {
        saveDemoState(next);
        setNotice("Sample transaction recorded. Related views are updated.");
      } catch {
        setNotice(
          "Sample transaction recorded for this visit. Browser storage is unavailable.",
        );
      }
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The sample transaction could not be recorded.",
      );
      return false;
    }
  }
  function reset() {
    const next = createDemoState(template.id);
    current.current = next;
    setData(next);
    try {
      saveDemoState(next);
    } catch {}
    setNotice("This industry’s sample data has been reset.");
    setError("");
    setAction(null);
  }
  function logout() {
    try {
      endDemoSession(template.id);
    } catch {}
    setSignedIn(false);
    setRole("owner");
    setAction(null);
    setNotice("");
  }
  const style = { "--demo-accent": template.accent } as CSSProperties;
  if (!ready)
    return (
      <div
        className="erp-demo flex min-h-screen items-center justify-center"
        style={style}
      >
        <p role="status" className="text-sm text-slate-500">
          Preparing your sample workspace…
        </p>
      </div>
    );
  if (!signedIn || !data)
    return (
      <div className="erp-demo demo-login" style={style}>
        <div className="demo-login-story">
          <Link href="/demo" className="flex items-center gap-3 text-white">
            <BrandMark />
            <span className="text-xl font-semibold tracking-tight">LakBiz</span>
          </Link>
          <div className="my-auto py-16">
            <div className="demo-industry-icon mb-8">
              <SectorIcon sectorId={template.id} className="h-7 w-7" />
            </div>
            <p className="demo-overline text-slate-400">{template.nameEn}</p>
            <h1 className="mt-5 max-w-lg text-4xl font-semibold leading-tight tracking-[-.04em] text-white sm:text-5xl">
              {template.promise}
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
              {template.company} brings the complete business story together.
              Explore every page with realistic sample data.
            </p>
            <div className="mt-8 space-y-3">
              {template.highlights.map((h) => (
                <p
                  key={h}
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                  {h}
                </p>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Retail POS · Business ERP · Owner Mobile · SaaS Admin
          </p>
        </div>
        <main className="demo-login-form">
          <Link href="/demo" className="mb-12 text-xs text-slate-500">
            ← All industry demos
          </Link>
          <p className="demo-overline">Welcome to the showcase</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            A better view of your business.
          </h2>
          <p className="mb-8 mt-3 text-sm leading-6 text-slate-500">
            Sign in to this public sample workspace. All names, inventory and
            transactions are fictional.
          </p>
          <form onSubmit={login} className="space-y-5">
            <label className="demo-field">
              Demo email
              <input
                type="email"
                value={email}
                autoComplete="off"
                onChange={(e) => setEmail(e.target.value)}
                className="demo-input"
                required
              />
            </label>
            <label className="demo-field">
              Demo password
              <input
                type="password"
                value={password}
                autoComplete="off"
                onChange={(e) => setPassword(e.target.value)}
                className="demo-input"
                required
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {error}
              </p>
            )}
            <button type="submit" className="demo-primary w-full">
              Open sample workspace
              <ArrowMark />
            </button>
          </form>
          <div className="demo-credentials mt-7">
            <p className="demo-overline">Public demo credentials</p>
            <p className="mt-3 break-all font-mono text-xs text-slate-700">
              {template.demoEmail}
            </p>
            <p className="mt-2 font-mono text-xs text-slate-700">
              {DEMO_PASSWORD}
            </p>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              These credentials are shared for demonstrations and give access
              only to mock data.
            </p>
          </div>
          <button
            type="button"
            className="mt-5 w-full text-sm font-semibold text-teal-700"
            onClick={enter}
          >
            Enter with the sample account →
          </button>
        </main>
      </div>
    );
  const page = WORKSPACES.find((w) => w.id === workspace)!;
  const navItems = WORKSPACES.filter((w) => demoCanUse(role, w.id));
  return (
    <div className="erp-demo demo-app" style={style}>
      <a
        href="#demo-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <aside className={`demo-sidebar ${menu ? "demo-sidebar-open" : ""}`}>
        <Link href="/demo" className="demo-brand">
          <BrandMark />
          <span>
            <span className="block text-xl font-semibold tracking-tight text-slate-900">
              LakBiz
            </span>
            <span className="mt-1 block text-[10px] tracking-[.16em] text-slate-500">
              INDUSTRY WORKSPACE
            </span>
          </span>
        </Link>
        <div className="demo-tenant">
          <div className="demo-tenant-icon">
            <SectorIcon sectorId={template.id} className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-800">
              {data.settings.name}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">{template.nameEn}</p>
          </div>
        </div>
        <nav className="demo-navigation" aria-label="Demo workspace">
          {navItems.map((w, i) => {
            const Icon = DEMO_ICONS[w.id],
              newGroup = i === 0 || navItems[i - 1].group !== w.group;
            return (
              <div key={w.id}>
                {newGroup && <p className="demo-nav-group">{w.group}</p>}
                <Link
                  href={`${template.demoPath}/${w.id}`}
                  aria-current={workspace === w.id ? "page" : undefined}
                  className={`demo-nav-link ${workspace === w.id ? "demo-nav-active" : ""}`}
                  onClick={() => {
                    setMenu(false);
                    setSearch("");
                    setError("");
                    setNotice("");
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {w.label}
                  {workspace === w.id && (
                    <span className="ml-auto h-1 w-1 rounded-full bg-teal-300" />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="reference-industry-switcher">
          <p>Business type</p>
          {INDUSTRY_TEMPLATES.filter((t) =>
            [template.id, "pharmacy", "cosmetics", "textile"].includes(t.id),
          ).map((t) => (
            <Link
              key={t.id}
              href={t.demoPath}
              aria-current={t.id === template.id ? "true" : undefined}
            >
              <SectorIcon sectorId={t.id} className="h-5 w-5" />
              <span>
                <strong>{t.nameEn}</strong>
                <small>{t.company}</small>
              </span>
              {t.id === template.id && (
                <span className="reference-selected-check">✓</span>
              )}
            </Link>
          ))}
          <Link href="/demo" className="reference-all-industries">
            All 14 industries →
          </Link>
        </div>
        <div className="demo-sidebar-bottom">
          <span className="demo-pill demo-pill-good">
            Public sample workspace
          </span>
          <p className="mt-3 text-[10px] leading-5 text-slate-500">
            Mock data only. Your demo changes stay in this browser.
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex min-h-10 items-center gap-2 text-xs text-slate-400"
          >
            <SignOutIcon className="h-4 w-4" />
            Leave workspace
          </button>
        </div>
      </aside>
      {menu && (
        <button
          type="button"
          className="demo-menu-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="demo-canvas">
        <header className="demo-topbar">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
              className="demo-menu-button"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <label className="reference-global-search">
              <SearchIcon className="h-4 w-4" />
              <span className="sr-only">Find workspace or product</span>
              <input
                type="search"
                placeholder="Search workspaces, products or records…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/demo"
              className="hidden text-xs text-slate-500 sm:block"
            >
              Switch industry
            </Link>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldIcon className="hidden h-4 w-4 sm:block" />
              <span className="sr-only">Preview role</span>
              <select
                aria-label="Preview role"
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs capitalize text-slate-700"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as DemoRole);
                  setAction(null);
                  setError("");
                }}
              >
                <option value="owner">Owner view</option>
                <option value="manager">Manager view</option>
                <option value="cashier">Cashier view</option>
              </select>
            </label>
            <Link
              href={`${template.demoPath}/inventory`}
              className="reference-header-branch"
            >
              <ShopIcon className="h-5 w-5" />
              <span>
                <strong>Main branch</strong>
                <small>{data.warehouses[0].city} · Sri Lanka</small>
              </span>
            </Link>
            <Link
              href={`${template.demoPath}/inventory`}
              aria-label="View stock inspection alerts"
              className="reference-alert-bell"
            >
              <BellIcon className="h-5 w-5" />
              <span>{data.products.filter((p) => p.blocked).length}</span>
            </Link>
            <span className="demo-avatar">DO</span>
          </div>
        </header>
        <div className="demo-sample-strip">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Client showcase · {template.nameEn} · synthetic data
          </span>
          <button
            type="button"
            onClick={() => setAction({ type: "reset" })}
            className="text-xs font-semibold text-slate-500"
          >
            Reset demo
          </button>
        </div>
        <main
          id="demo-content"
          tabIndex={-1}
          className={`demo-main ${workspace === "pulse" ? "demo-pulse-main" : ""}`}
        >
          {workspace !== "pulse" && (
            <ReferenceBanner
              template={template}
              title={
                workspace === "overview"
                  ? "Good morning, Owner"
                  : workspace === "inventory"
                    ? "Inventory & Imports"
                    : page.label
              }
              description={
                workspace === "overview"
                  ? "Here’s what’s happening across your stores today."
                  : page.description
              }
              imports={workspace === "inventory" || workspace === "imports"}
            />
          )}
          {search.trim() && (
            <div className="reference-search-results mb-5">
              <span className="text-xs text-slate-500">
                Matching workspaces
              </span>
              {navItems
                .filter((w) =>
                  `${w.label} ${w.description}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((w) => (
                  <Link
                    key={w.id}
                    href={`${template.demoPath}/${w.id}`}
                    onClick={() => setSearch("")}
                  >
                    {w.label} →
                  </Link>
                ))}
              <button type="button" onClick={() => setSearch("")}>
                Clear search
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="demo-notice mb-6">
              {notice}
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
          {demoCanUse(role, workspace) ? (
            <DemoScreens
              key={`${workspace}-${role}`}
              workspace={workspace}
              data={data}
              template={template}
              role={role}
              search={search}
              run={run}
              open={setAction}
            />
          ) : (
            <DemoEmpty
              title="Owner workspace"
              description="Switch back to Owner view to explore this workspace. Operational roles do not have access to internal finance or platform controls."
            />
          )}
        </main>
        <footer className="demo-workspace-footer">
          <span>LakBiz · Designed around your business</span>
          <span>Template {template.version} · LKR · Asia/Colombo</span>
        </footer>
      </div>
      <DemoActionDrawer
        key={action ? JSON.stringify(action) : "closed"}
        action={action}
        data={data}
        template={template}
        role={role}
        run={run}
        close={() => {
          setAction(null);
          setError("");
        }}
        reset={reset}
      />
    </div>
  );
}
