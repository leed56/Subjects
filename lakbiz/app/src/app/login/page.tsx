"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { SignOutButton } from "@/components/sign-out-button";
import { useLocale } from "@/lib/i18n/locale-provider";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  AuthFlowError,
  isPlatformAdminClient,
  resendConfirmationEmail,
} from "@/lib/supabase/auth-actions";
import { createBrowserClient } from "@/lib/supabase/client";
import { SectorPicker } from "@/components/sector-picker";
import type { SectorId } from "@/lib/types";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [sector, setSector] = useState<SectorId>("grocery");
  const [message, setMessage] = useState("");
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminLogin, setAdminLogin] = useState(false);

  const configured = isSupabaseConfigured();
  // Shop/sector provisioning is exclusively a platform-admin operation.
  const adminOnly = true;

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    setAdminLogin(next === "/admin");
  }, []);

  useEffect(() => {
    if (!adminLogin || !configured || authLoading) return;
    if (!user) return;
    const supabase = createBrowserClient();
    if (!supabase) return;

    void isPlatformAdminClient(supabase).then((isAdmin) => {
      if (isAdmin) window.location.replace("/admin");
    });
  }, [adminLogin, configured, authLoading, user]);

  const safeNextPath = (): string | null => {
    if (typeof window === "undefined") return null;
    const next = new URLSearchParams(window.location.search).get("next");
    if (!next?.startsWith("/") || next.startsWith("//")) return null;
    return next;
  };

  // Part 19 — gates the compact "You're already signed in" card (and
  // hides the sign-in/sign-up form beneath it) whenever there's a real
  // signed-in user and the auth state has actually resolved. Always
  // false during SSR/first hydration (user/authLoading come from context
  // that only resolves client-side), so `continueDestination`'s
  // window.location.search read below never causes a hydration mismatch.
  const alreadySignedIn = !!user && !authLoading;
  const continueDestination = safeNextPath() ?? "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) {
      setMessage(t("sub.login_soon"));
      return;
    }
    setLoading(true);
    setMessage("");
    setNeedsEmailConfirm(false);
    try {
      if (mode === "signup") {
        if (adminOnly) {
          setMessage("Public signup is disabled. Contact your LakBiz administrator.");
          return;
        }
        if (!shopName.trim()) {
          setMessage(t("sub.shop_required"));
          return;
        }
        await signUp({ email, password, shopName, phone, sector });
        setMessage(t("sub.signup_ok"));
        router.push("/dashboard");
      } else {
        await signIn(email, password);
        const supabase = createBrowserClient();
        const isAdmin =
          !!supabase && (await isPlatformAdminClient(supabase));
        const nextPath = safeNextPath();

        if (nextPath === "/admin" && !isAdmin) {
          setMessage(t("admin.not_platform_admin"));
          return;
        }

        const destination = nextPath ?? (isAdmin ? "/admin" : "/dashboard");
        window.location.assign(destination);
        return;
      }
    } catch (err) {
      if (err instanceof AuthFlowError && err.code === "email_confirmation") {
        setNeedsEmailConfirm(true);
        setMessage(err.message);
      } else if (err instanceof Error) {
        setMessage(err.message);
      } else {
        setMessage("Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setMessage(t("sub.email_required"));
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await resendConfirmationEmail(email.trim());
      setNeedsEmailConfirm(true);
      setMessage(t("sub.resend_ok"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-full ${adminLogin ? "bg-slate-950" : "bg-slate-50"}`}>
      {adminLogin ? (
        <header className="border-b border-slate-800 bg-slate-950 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-teal-400">
                LakBiz Platform
              </p>
              <p className="text-lg font-bold">{t("admin.login_title")}</p>
            </div>
            <SignOutButton
              redirectTo="/login?next=/admin"
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-red-300 hover:bg-slate-700"
            />
          </div>
        </header>
      ) : (
        <SiteHeader sticky={false} />
      )}
      <main className={`mx-auto flex flex-col px-4 py-10 sm:py-16 ${mode === "signup" && !adminLogin ? "max-w-2xl" : "max-w-md"}`}>
        <div className="text-center">
          {!adminLogin && (
            <>
              <h1 className="text-2xl font-bold text-slate-900">{t("sub.login_title")}</h1>
              <p className="mt-2 text-slate-600">
                {configured ? t("sub.login_email_hint") : t("sub.login_subtitle")}
              </p>
            </>
          )}

          {adminLogin && (
            <>
              <h1 className="text-2xl font-bold text-white">{t("admin.login_title")}</h1>
              <p className="mt-2 text-slate-400">{t("admin.login_hint")}</p>
            </>
          )}
        </div>

        {/* Global premium UI phase, Part 19/35 — root cause: this branch
         * used to render <SignedInBanner> (no timer, no auto-redirect)
         * ABOVE the still-fully-rendered sign-in/sign-up form, forever.
         * Visiting /login while already authenticated now shows this
         * compact card ONLY — the tabs/form below are skipped entirely
         * (`alreadySignedIn` gates the whole card at the bottom of this
         * block) — matching "show a clean compact state immediately...
         * do not show a full login form unnecessarily below it." The
         * post-submit sign-in path already navigates immediately via
         * window.location.assign with no lingering message; unaffected
         * by this change. */}
        {alreadySignedIn && (
          <div
            className={`mt-6 rounded-xl border p-6 text-center sm:p-7 ${
              adminLogin ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
            }`}
          >
            <p className={`text-base font-semibold ${adminLogin ? "text-white" : "text-slate-900"}`}>
              {t("auth.already_signed_in")}
            </p>
            <p className={`mt-1 text-sm ${adminLogin ? "text-slate-400" : "text-slate-500"}`}>
              {user?.email}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => window.location.assign(continueDestination)}
                className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white ${
                  adminLogin ? "bg-teal-600 hover:bg-teal-500" : "bg-teal-700 hover:bg-teal-800"
                }`}
              >
                {t("auth.continue_dashboard")}
              </button>
              <SignOutButton
                redirectTo={adminLogin ? "/login?next=/admin" : "/login"}
                label={t("auth.sign_out_other")}
                className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold ${
                  adminLogin
                    ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              />
            </div>
          </div>
        )}

        {/* Centered auth card — the login form no longer floats directly on
            the page background, matching the rest of the redesigned
            surfaces (docs/UI_POLISH_AUDIT.md Part 12). Skipped entirely
            while already signed in — see the compact card above. */}
        {!alreadySignedIn && (
        <div
          className={`mt-6 rounded-xl border p-6 shadow-sm sm:p-7 ${
            adminLogin ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          {message && (
            <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {message}
              {needsEmailConfirm && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || !email.trim()}
                  className="mt-3 block w-full rounded-lg border border-amber-300 bg-white py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                >
                  {t("sub.resend_email")}
                </button>
              )}
            </div>
          )}

          {adminOnly && (
            <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
              Shops are created by the platform admin. Sign in with the credentials you
              received.
            </p>
          )}

          {!(adminOnly || adminLogin) && (
            <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  mode === "signin" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("sub.sign_in")}
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  mode === "signup" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("sub.create_shop")}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <SectorPicker value={sector} onChange={setSector} />
                <label className="block text-sm">
                  {t("sub.shop_name")} *
                  <input
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </label>
                <label className="block text-sm">
                  {t("sub.phone")}
                  <input
                    type="tel"
                    placeholder="07X XXX XXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </label>
              </>
            )}
            <label className={`block text-sm ${adminLogin ? "text-slate-300" : ""}`}>
              {t("sub.email")} *
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`mt-1 w-full rounded-lg border px-3 py-2.5 ${
                  adminLogin
                    ? "border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                    : "border-slate-300"
                }`}
                placeholder={adminLogin ? "admin@lakbiz.lk" : undefined}
              />
            </label>
            <label className={`block text-sm ${adminLogin ? "text-slate-300" : ""}`}>
              {t("sub.password")} *
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`mt-1 w-full rounded-lg border px-3 py-2.5 ${
                  adminLogin
                    ? "border-slate-700 bg-slate-950 text-white"
                    : "border-slate-300"
                }`}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                adminLogin
                  ? "bg-teal-600 hover:bg-teal-500"
                  : "bg-teal-700 hover:bg-teal-800"
              }`}
            >
              {loading
                ? t("auth.signing_in")
                : mode === "signup"
                  ? t("sub.create_account")
                  : t("sub.sign_in")}
            </button>
          </form>
        </div>
        )}

        {!adminLogin && !alreadySignedIn && (
          <p className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-600">
            Need access? Contact LakBiz to receive your login details.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          {!adminLogin ? (
            <>
              <Link href="/login?next=/admin" className="text-teal-700 underline">
                {t("admin.login_title")}
              </Link>
              {" · "}
              <Link href="/settings/plans" className="text-teal-700 underline">
                {t("sub.title")}
              </Link>
            </>
          ) : (
            <Link href="/login" className="text-teal-400 underline">
              {t("sub.login_title")}
            </Link>
          )}
        </p>
      </main>
    </div>
  );
}
