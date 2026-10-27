"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { GROCERY_MEAT_CATALOGUE, groceryMeatProductsMissing } from "@/lib/grocery-meat-catalogue";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ProductInput } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { importGroceryMeatCatalogue } from "@/lib/supabase/grocery-meat-import";

const copy = {
  en: {
    title: "Chicken, cuts and prepared meats",
    detail: "Nine optional meat products. Confirm each cut, pack, cold-chain handling, price and received stock before selling.",
    button: "Add meat & poultry range",
    ready: "Meat & poultry range added",
    confirm: "Add meat templates to this grocery shop?",
    confirmationDetail: "editable products will be added to this shop only. They start inactive, unpriced, with zero stock and no barcode. The existing Chicken item is unchanged.",
    confirmAction: "Add templates",
    cancel: "Cancel",
    paused: "Import paused",
    error: "A product could not be saved. Check cloud sync before retrying.",
    done: "Meat templates added",
  },
  si: {
    title: "කුකුල් මස් සහ මස් නිෂ්පාදන",
    detail: "විකල්ප භාණ්ඩ නවයක්. විකිණීමට පෙර කැපුම, පැකට්ටුව, ශීත ගබඩාව, මිල සහ ලැබුණු තොගය තහවුරු කරන්න.",
    button: "මස් භාණ්ඩ එක් කරන්න",
    ready: "මස් භාණ්ඩ එක් කර ඇත",
    confirm: "මෙම වෙළඳසැලට මස් භාණ්ඩ එක් කරන්නද?",
    confirmationDetail: "සංස්කරණය කළ හැකි භාණ්ඩ මෙම වෙළඳසැලට පමණක් එක් වේ. මුලදී ඒවා අක්‍රිය වන අතර මිල හා තොගය ශුන්‍ය වේ; තීරු කේතයක් නැත. පවතින කුකුල් මස් භාණ්ඩය වෙනස් නොවේ.",
    confirmAction: "භාණ්ඩ එක් කරන්න",
    cancel: "අවලංගු කරන්න",
    paused: "එක් කිරීම නතර විය",
    error: "භාණ්ඩයක් සුරැකීමට නොහැකි විය. නැවත උත්සාහ කිරීමට පෙර cloud sync පරීක්ෂා කරන්න.",
    done: "මස් භාණ්ඩ එක් කර ඇත",
  },
  ta: {
    title: "கோழி இறைச்சி மற்றும் இறைச்சிப் பொருட்கள்",
    detail: "விருப்பமான ஒன்பது பொருட்கள். விற்பனைக்கு முன் வெட்டு, பொதி, குளிர் சேமிப்பு, விலை, கிடைத்த இருப்பு ஆகியவற்றை உறுதி செய்யவும்.",
    button: "இறைச்சி வகையைச் சேர்",
    ready: "இறைச்சி வகை சேர்க்கப்பட்டது",
    confirm: "இந்த மளிகைக் கடையில் இறைச்சிப் பொருட்களைச் சேர்க்கவா?",
    confirmationDetail: "திருத்தக்கூடிய பொருட்கள் இந்தக் கடையில் மட்டுமே சேர்க்கப்படும். தொடக்கத்தில் அவை செயலற்றவை; விலையும் இருப்பும் பூஜ்ஜியம்; பட்டைக் குறியீடு இல்லை. ஏற்கெனவே உள்ள கோழி இறைச்சிப் பொருள் மாறாது.",
    confirmAction: "பொருட்களைச் சேர்",
    cancel: "ரத்து செய்",
    paused: "சேர்ப்பது நிறுத்தப்பட்டது",
    error: "ஒரு பொருளைச் சேமிக்க முடியவில்லை. மீண்டும் முயல்வதற்கு முன் cloud sync-ஐச் சரிபார்க்கவும்.",
    done: "இறைச்சிப் பொருட்கள் சேர்க்கப்பட்டன",
  },
} as const;

export function GroceryMeatCatalogueButton() {
  const { data, saveProductToCloud, cloudSyncError, offlinePendingSync, syncConflict } = useAppStore();
  const { org, orgRole } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const { locale } = useLocale();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [queue, setQueue] = useState<ProductInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inFlightSku = useRef<string | null>(null);
  const labels = copy[locale];
  const missing = useMemo(
    () => groceryMeatProductsMissing(data?.products.flatMap((product) => [product.sku, typeof product.customFields.templateSku === "string" ? product.customFields.templateSku : undefined]) ?? []),
    [data?.products],
  );

  useEffect(() => {
    if (!saving || queue.length === 0) return;
    const next = queue[0];
    if (inFlightSku.current === next.sku) return;
    inFlightSku.current = next.sku ?? next.name;
    void saveProductToCloud(next).then((result) => {
      inFlightSku.current = null;
      if (!result.ok && result.error !== "Cloud not connected") {
        setError(result.error ?? labels.error);
        setQueue([]);
        setSaving(false);
        toast({ tone: "error", title: labels.paused, description: result.error ?? labels.error });
        return;
      }
      setCompleted((count) => count + 1);
      setQueue((current) => current.slice(1));
    });
  }, [labels, queue, saveProductToCloud, saving, toast]);

  useEffect(() => {
    if (!saving || queue.length !== 0) return;
    setSaving(false);
    if (completed > 0) toast({ tone: "success", title: labels.done, description: `${completed} / ${GROCERY_MEAT_CATALOGUE.length}` });
  }, [completed, labels, queue.length, saving, toast]);

  if (org.sector !== "grocery" || orgRole !== "owner") return null;

  const start = async () => {
    setConfirming(false);
    setError(null);
    setCompleted(0);
    if (org.isAuthenticated) {
      if (!org.id || !navigator.onLine || offlinePendingSync || syncConflict || cloudSyncError) {
        const problem = "Resolve the cloud sync status before importing templates.";
        setError(problem);
        toast({ tone: "error", title: labels.paused, description: problem });
        return;
      }
      setSaving(true);
      try {
        const result = await importGroceryMeatCatalogue(org.id);
        toast({ tone: "success", title: labels.done, description: `${result.added} added · ${result.existing} already present` });
        window.location.reload();
      } catch (cause) {
        const problem = cause instanceof Error ? cause.message : labels.error;
        setError(problem);
        toast({ tone: "error", title: labels.paused, description: problem });
        setSaving(false);
      }
      return;
    }
    setQueue(missing);
    setSaving(true);
  };

  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-white to-orange-50 px-4 py-3 shadow-sm" aria-label={labels.title}>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{labels.title}</p>
        <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-600">{labels.detail}</p>
        {error && <p role="alert" className="mt-1 text-xs font-semibold text-rose-700">{error}</p>}
      </div>
      <button
        type="button"
        disabled={!canWrite || saving || missing.length === 0 || (org.isAuthenticated && (offlinePendingSync || Boolean(syncConflict) || Boolean(cloudSyncError)))}
        title={disabledHint ?? undefined}
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
      >
        {saving ? `${completed} / ${completed + queue.length}` : missing.length === 0 ? labels.ready : `${labels.button} · ${missing.length}`}
      </button>
      <ConfirmDialog
        open={confirming}
        title={labels.confirm}
        description={`${missing.length} ${labels.confirmationDetail}`}
        confirmLabel={labels.confirmAction}
        cancelLabel={labels.cancel}
        onConfirm={start}
        onClose={() => setConfirming(false)}
      />
    </section>
  );
}
