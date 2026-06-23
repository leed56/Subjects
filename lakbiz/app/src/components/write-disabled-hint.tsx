"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";

export function WriteDisabledHint({ className = "" }: { className?: string }) {
  const { t } = useLocale();
  const { canWrite, disabledHint } = useWriteAccess();

  if (canWrite || !disabledHint) return null;

  return (
    <p
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 ${className}`}
    >
      {disabledHint}{" "}
      <Link href="/settings/plans" className="font-black underline">
        {t("sub.upgrade_now")}
      </Link>
    </p>
  );
}
