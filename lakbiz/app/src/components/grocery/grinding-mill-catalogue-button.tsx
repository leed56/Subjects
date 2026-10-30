"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { GRINDING_MILL_CATALOGUE, grindingMillProductsMissing } from "@/lib/grinding-mill-catalogue";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ProductInput } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";

const copy = {
  en: {
    title: "Sri Lankan grinding-mill range",
    detail: "Spices, curry blends and traditional flours. Add editable templates, then set prices and received stock before activating them.",
    button: "Add grinding-mill range",
    ready: "Grinding-mill range added",
    confirm: "Add grinding-mill templates to this shop?",
    confirmationDetail: "editable products will be created in this grocery shop only. They start inactive, with zero price, zero stock and no barcode. Review each item in Stock before selling.",
    confirmAction: "Add templates",
    cancel: "Cancel",
    paused: "Import paused",
    error: "A product could not be saved. Check cloud sync before retrying.",
    done: "Grinding-mill templates added",
  },
  si: {
    title: "ශ්‍රී ලාංකික ඇඹරුම්හල් භාණ්ඩ",
    detail: "කුළුබඩු, තුනපහ සහ දේශීය පිටි. භාණ්ඩ එක් කර විකිණීමට පෙර මිල සහ ලැබුණු තොගය සකසන්න.",
    button: "ඇඹරුම්හල් භාණ්ඩ එක් කරන්න",
    ready: "ඇඹරුම්හල් භාණ්ඩ එක් කර ඇත",
    confirm: "මෙම වෙළඳසැලට ඇඹරුම්හල් භාණ්ඩ එක් කරන්නද?",
    confirmationDetail: "සංස්කරණය කළ හැකි භාණ්ඩ මෙම සිල්ලර වෙළඳසැලට පමණක් එක් වේ. මුලදී ඒවා අක්‍රිය වන අතර මිල, තොගය සහ තීරු කේතය හිස් වේ. විකිණීමට පෙර තොගය තුළ සෑම භාණ්ඩයක්ම පරීක්ෂා කරන්න.",
    confirmAction: "භාණ්ඩ එක් කරන්න",
    cancel: "අවලංගු කරන්න",
    paused: "එක් කිරීම නතර විය",
    error: "භාණ්ඩයක් සුරැකීමට නොහැකි විය. නැවත උත්සාහ කිරීමට පෙර cloud sync පරීක්ෂා කරන්න.",
    done: "ඇඹරුම්හල් භාණ්ඩ එක් කර ඇත",
  },
  ta: {
    title: "இலங்கை அரவை ஆலைப் பொருட்கள்",
    detail: "மசாலா, கறிப் பொடி மற்றும் பாரம்பரிய மாவுகள். பொருட்களைச் சேர்த்து, விற்பனைக்கு முன் விலையையும் இருப்பையும் நிரப்பவும்.",
    button: "அரவை ஆலைப் பொருட்களைச் சேர்",
    ready: "அரவை ஆலைப் பொருட்கள் சேர்க்கப்பட்டன",
    confirm: "இந்தக் கடையில் அரவை ஆலைப் பொருட்களைச் சேர்க்கவா?",
    confirmationDetail: "திருத்தக்கூடிய பொருட்கள் இந்த மளிகைக் கடையில் மட்டுமே சேர்க்கப்படும். தொடக்கத்தில் அவை செயலற்றவை; விலை, இருப்பு, பட்டைக் குறியீடு எதுவும் நிரப்பப்படாது. விற்பனைக்கு முன் ஒவ்வொரு பொருளையும் சரக்கில் சரிபார்க்கவும்.",
    confirmAction: "பொருட்களைச் சேர்",
    cancel: "ரத்து செய்",
    paused: "சேர்ப்பது நிறுத்தப்பட்டது",
    error: "ஒரு பொருளைச் சேமிக்க முடியவில்லை. மீண்டும் முயல்வதற்கு முன் cloud sync-ஐச் சரிபார்க்கவும்.",
    done: "அரவை ஆலைப் பொருட்கள் சேர்க்கப்பட்டன",
  },
} as const;

export function GrindingMillCatalogueButton() {
  const { data, saveProductToCloud } = useAppStore();
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
    () => grindingMillProductsMissing(data?.products.map((product) => product.sku) ?? []),
    [data?.products],
  );

  useEffect(() => {
    if (!saving || queue.length === 0) return;
    const next = queue[0];
    if (inFlightSku.current === next.sku) return;
    inFlightSku.current = next.sku ?? next.name;
    void saveProductToCloud(next).then((result) => {
      inFlightSku.current = null;
      if (!result.ok) {
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
    if (completed > 0) toast({ tone: "success", title: labels.done, description: `${completed} / ${GRINDING_MILL_CATALOGUE.length}` });
  }, [completed, labels, queue.length, saving, toast]);

  if (org.sector !== "grocery" || orgRole !== "owner") return null;

  const start = () => {
    setConfirming(false);
    setError(null);
    setCompleted(0);
    setQueue(missing);
    setSaving(true);
  };

  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 px-4 py-3 shadow-sm" aria-label={labels.title}>
      <div>
        <p className="text-sm font-bold text-slate-900">{labels.title}</p>
        <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-600">{labels.detail}</p>
        {error && <p role="alert" className="mt-1 text-xs font-semibold text-rose-700">{error}</p>}
      </div>
      <button
        type="button"
        disabled={!canWrite || saving || missing.length === 0}
        title={disabledHint ?? undefined}
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
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
