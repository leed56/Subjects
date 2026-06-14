"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n/locale-provider";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState("");

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    if (!isSupabaseConfigured()) {
      setMessage(t("sub.login_soon"));
      return;
    }
    setOtpSent(true);
    setMessage("OTP sent (wire to Supabase Auth).");
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      setMessage(t("sub.login_soon"));
      return;
    }
    setMessage("Verify with Supabase — not wired yet.");
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
        <p className="mt-2 text-slate-600">{t("sub.login_subtitle")}</p>

        {message && (
          <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {message}
          </div>
        )}

        <form onSubmit={otpSent ? handleVerify : handleSendOtp} className="mt-8 space-y-4">
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

          {otpSent && (
            <label className="block text-sm">
              {t("sub.otp_code")}
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
          >
            {otpSent ? t("sub.verify") : t("sub.send_otp")}
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
