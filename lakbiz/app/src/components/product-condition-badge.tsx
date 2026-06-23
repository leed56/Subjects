"use client";

import { ProBadge } from "@/components/ui/pro-shell";
import { conditionI18nKey } from "@/lib/product-condition";
import type { ProductCondition } from "@/lib/types";
import { useLocale } from "@/lib/i18n/locale-provider";

export function ProductConditionBadge({ condition }: { condition: ProductCondition }) {
  const { t } = useLocale();
  return (
    <ProBadge tone={condition === "used" ? "amber" : "teal"}>
      {t(conditionI18nKey(condition))}
    </ProBadge>
  );
}
