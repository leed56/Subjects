import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Sinhala } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { AuthProvider } from "@/components/auth-provider";
import { PlatformAdminRedirect } from "@/components/platform-admin-redirect";
import { ShopRouteGuard } from "@/components/shop-route-guard";
import { AppStoreProvider } from "@/lib/store/app-store-provider";
import { SubscriptionProvider } from "@/lib/subscription/subscription-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";
import "./premium-ops.css";
import "./premium-ops-final.css";
import "./premium-ops-realistic.css";
import "./premium-job-detail.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSinhala = Noto_Sans_Sinhala({
  variable: "--font-sinhala",
  subsets: ["sinhala"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LakBiz — ශ්‍රී ලංකා තොග සහ ගිණුම්",
  description:
    "තොග, විකුණුම්, බැංකු — සිල්ලර, AC, වාහන ව්‍යාපාර සඳහා",
  applicationName: "LakBiz",
  appleWebApp: {
    capable: true,
    title: "LakBiz",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

function publicSupabaseHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="si"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSinhala.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col font-sinhala"
        data-lakbiz-build-sha={process.env.VERCEL_GIT_COMMIT_SHA ?? ""}
        data-lakbiz-supabase-host={publicSupabaseHost()}
      >
        <LocaleProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <ToastProvider>
                <PlatformAdminRedirect />
                <ShopRouteGuard />
                <AppStoreProvider>{children}</AppStoreProvider>
              </ToastProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
