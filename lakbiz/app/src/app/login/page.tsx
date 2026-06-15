"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n/locale-provider";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AuthFlowError, resendConfirmationEmail } from "@/lib/supabase/auth-actions";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const configured = isSupabaseConfigured();

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
        if (!shopName.trim()) {
          setMessage(t("sub.shop_required"));
          return;
        }
        await signUp({ email, password, shopName, phone });
        setMessage(t("sub.signup_ok"));
        router.push("/dashboard");
      } else {
        await signIn(email, password);
        router.push("/dashboard");
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
    router.push("/dashboard");
  };

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <h1 className="text-2xl font-bold text-slate-900">
          {t("sub.login_title")}
        </h1>
        <p className="mt-2 text-slate-600">
          {configured ? t("sub.login_email_hint") : t("sub.login_subtitle")}
        </p>

        {configured && (
          <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
            {t("sub.db_connected")}
          </p>
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

        <div className="mt-6 flex rounded-lg border border-slate-200 p-1">
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
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
          className="mt-4 w-full rounded-lg border border-slate-300 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t("sub.login_demo")}
        </button>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/settings/billing" className="text-teal-700 underline">
            {t("sub.title")}
          </Link>
        </p>
      </main>
    </div>
  );
}
