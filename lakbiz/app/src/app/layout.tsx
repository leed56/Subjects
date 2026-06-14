import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Sinhala } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { SubscriptionProvider } from "@/lib/subscription/subscription-provider";
import "./globals.css";

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
};

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
      <body className="min-h-full flex flex-col font-sinhala">
        <LocaleProvider>
          <SubscriptionProvider>{children}</SubscriptionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
