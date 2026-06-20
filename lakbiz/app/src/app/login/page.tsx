"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { SignedInBanner, SignOutButton } from "@/components/sign-out-button";
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

const DEMO_ORG_KEY = "lakbiz-org-demo";

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
  const adminOnly = process.env.NEXT_PUBLIC_ADMIN_ONLY === "true";

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

  const continueDemo = () => {
    if (mode === "signup") {
      try {
        localStorage.setItem(
          DEMO_ORG_KEY,
          JSON.stringify({
            id: null,
            name: shopName.trim() || "Demo Shop",
            sector,
            isAuthenticated: false,
          }),
        );
      } catch {
        /* ignore */
      }
    }
    router.push("/dashboard");
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

        {adminLogin && user && !authLoading && (
          <SignedInBanner adminMode redirectAfterSignOut="/login?next=/admin" />
        )}

        {!adminLogin && user && !authLoading && (
          <SignedInBanner redirectAfterSignOut="/login" />
        )}

        {message && (
          <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
          <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            Shops are created by the platform admin. Sign in with the credentials you
            received.
          </p>
        )}

        <div className={`mt-6 flex rounded-lg border border-slate-200 p-1 ${adminOnly || adminLogin ? "hidden" : ""}`}>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-md py-2 text-sm ${
              mode === "signin" ? "bg-teal-700 text-white" : "text-slate-600"
            }`}
          >
            {t("sub.sign_in")}
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-md py-2 text-sm ${
              mode === "signup" ? "bg-teal-700 text-white" : "text-slate-600"
            }`}
          >
            {t("sub.create_shop")}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <>
              <SectorPicker value={sector} onChange={setSector} />
              <label className="block text-sm">
                {t("sub.shop_name")} *
                <input
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                {t("sub.phone")}
                <input
                  type="tel"
                  placeholder="07X XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </>
          )}
          <label className="block text-sm">
            {t("sub.email")} *
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                adminLogin
                  ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
                  : "border-slate-300"
              }`}
              placeholder={adminLogin ? "admin@lakbiz.lk" : undefined}
            />
          </label>
          <label className="block text-sm">
            {t("sub.password")} *
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                adminLogin
                  ? "border-slate-700 bg-slate-900 text-white"
                  : "border-slate-300"
              }`}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
              adminLogin
                ? "bg-teal-600 hover:bg-teal-500"
                : "bg-teal-700 hover:bg-teal-800"
            }`}
          >
            {loading
              ? "..."
              : mode === "signup"
                ? t("sub.create_account")
                : t("sub.sign_in")}
          </button>
        </form>

        <button
          type="button"
          onClick={continueDemo}
          className={`mt-4 w-full rounded-lg border border-slate-300 py-2.5 text-sm text-slate-700 hover:bg-slate-50 ${adminLogin ? "hidden" : ""}`}
        >
          {t("sub.login_demo")}
        </button>

        <p className="mt-6 text-center text-xs text-slate-500">
          {!adminLogin ? (
            <>
              <Link href="/login?next=/admin" className="text-teal-700 underline">
                {t("admin.login_title")}
              </Link>
              {" · "}
              <Link href="/settings/billing" className="text-teal-700 underline">
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
