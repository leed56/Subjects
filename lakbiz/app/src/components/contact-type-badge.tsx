"use client";

import { ProBadge } from "@/components/ui/pro-shell";
import { contactTypeI18nKey } from "@/lib/contact-type";
import type { ContactType } from "@/lib/types";
import { useLocale } from "@/lib/i18n/locale-provider";

export function ContactTypeBadge({ type }: { type: ContactType }) {
  const { t } = useLocale();
  return (
    <ProBadge tone={type === "company" ? "teal" : "slate"}>
      {t(contactTypeI18nKey(type))}
    </ProBadge>
  );
}
