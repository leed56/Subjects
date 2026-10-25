"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import {
  GROCERY_STARTER_CATALOGUE,
  groceryStarterProductsMissing,
} from "@/lib/grocery-starter-catalogue";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ProductInput } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { useLocale } from "@/lib/i18n/locale-provider";

type GroceryStarterCatalogueButtonProps = {
  className?: string;
  compact?: boolean;
};

/**
 * Explicit, owner-only first-run action. The seed stays a normal product
 * import: it uses the same durable product write path as the Stock form, so
 * prices, barcode searching, stock, checkout and dashboard data all read one
 * source of truth afterwards.
 */
export function GroceryStarterCatalogueButton({
  className = "",
  compact = false,
}: GroceryStarterCatalogueButtonProps) {
  const { data, saveProductToCloud } = useAppStore();
  const { locale } = useLocale();
  const { org, orgRole } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [queue, setQueue] = useState<ProductInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inFlightSku = useRef<string | null>(null);

  const missing = useMemo(
    () => groceryStarterProductsMissing(data?.products.map((product) => product.sku) ?? []),
    [data?.products],
  );
  const isOwner = orgRole === "owner";

  useEffect(() => {
    if (!saving || queue.length === 0) return;
    const next = queue[0];
    // saveProductToCloud updates the provider between products. Keep a small
    // per-SKU lock so that rerender never starts a second write for the same
    // catalogue item while that update is propagating.
    const itemKey = next.sku ?? next.name;
    if (inFlightSku.current === itemKey) return;
    inFlightSku.current = itemKey;

    void saveProductToCloud(next).then((result) => {
      inFlightSku.current = null;
      // Demo/local workspaces persist their catalogue first and report that
      // cloud is unavailable afterwards. That local record is valid and will
      // sync once a workspace is connected, so it should not abort the import.
      if (!result.ok && result.error !== "Cloud not connected") {
        setError(result.error ?? (locale === "si" ? "LakBiz හට නාමාවලිය සුරැකිය නොහැක." : locale === "ta" ? "LakBiz பட்டியலைச் சேமிக்க முடியவில்லை." : "LakBiz could not save the catalogue."));
        setQueue([]);
        setSaving(false);
        toast({
          tone: "error",
          title: locale === "si" ? "ආරම්භක නාමාවලිය නවතා ඇත" : locale === "ta" ? "தொடக்கப் பட்டியல் இடைநிறுத்தப்பட்டது" : "Starter catalogue paused",
          description: result.error ?? (locale === "si" ? "සුරැකීමේ ගැටලුව විසඳා නැවත උත්සාහ කරන්න." : locale === "ta" ? "சேமிப்புச் சிக்கலைத் தீர்த்து மீண்டும் முயற்சிக்கவும்." : "Please resolve the save issue and try again."),
        });
        return;
      }
      setCompleted((count) => count + 1);
      setQueue((currentQueue) => currentQueue.slice(1));
    });
  }, [data?.products, locale, queue, saveProductToCloud, saving, toast]);

  useEffect(() => {
    if (!saving || queue.length !== 0) return;
    setSaving(false);
    if (completed > 0) {
      toast({
        tone: "success",
        title: locale === "si" ? "සිල්ලර ආරම්භක නාමාවලිය සූදානම්" : locale === "ta" ? "மளிகை தொடக்கப் பட்டியல் தயாராக உள்ளது" : "Grocery starter catalogue is ready",
        description: locale === "si" ? `සංස්කරණය කළ හැකි භාණ්ඩ ${completed}ක් දැන් තොගය සහ POS / බිල්පත් තුළ ඇත.` : locale === "ta" ? `திருத்தக்கூடிய ${completed} பொருட்கள் இப்போது சரக்கு மற்றும் POS / பில்லிங்கில் உள்ளன.` : `${completed} editable products are now available in Stock and POS / Billing.`,
      });
    }
  }, [completed, locale, queue.length, saving, toast]);

  if (org.sector !== "grocery") return null;

  if (!isOwner) {
    return (
      <p className={`text-xs font-semibold text-slate-500 ${className}`}>
        {locale === "si" ? "ඔබේ වැඩබිම් හිමිකරුට ආරම්භක සිල්ලර නාමාවලිය එක් කළ හැක." : locale === "ta" ? "உங்கள் பணியிட உரிமையாளர் தொடக்க மளிகைப் பட்டியலை ஏற்றலாம்." : "Your workspace owner can load the starter grocery catalogue."}
      </p>
    );
  }

  const addCatalogue = () => {
    if (missing.length === 0) {
        toast({ tone: "info", title: locale === "si" ? "ආරම්භක නාමාවලිය දැනටමත් එක් කර ඇත" : locale === "ta" ? "தொடக்கப் பட்டியல் ஏற்கனவே ஏற்றப்பட்டுள்ளது" : "Starter catalogue already loaded", description: locale === "si" ? "තොගය තුළ මිල, තොග, තීරු කේත සහ පින්තූර කළමනාකරණය කරන්න." : locale === "ta" ? "சரக்கில் விலை, கையிருப்பு, பட்டைக் குறியீடு மற்றும் படங்களை நிர்வகிக்கவும்." : "Manage prices, stock, barcodes and product images in Stock." });
      return;
    }
    setError(null);
    setCompleted(0);
    setQueue(missing);
    setSaving(true);
    setConfirming(false);
  };

  const label = saving
    ? `${locale === "si" ? "එක් කරමින්" : locale === "ta" ? "சேர்க்கிறது" : "Adding"} ${Math.min(completed + 1, completed + queue.length)} / ${completed + queue.length}`
    : missing.length === 0
      ? (locale === "si" ? "ආරම්භක නාමාවලිය සූදානම්" : locale === "ta" ? "தொடக்கப் பட்டியல் தயார்" : "Starter catalogue ready")
      : compact
        ? `${missing.length} ${locale === "si" ? "ආරම්භක භාණ්ඩ එක් කරන්න" : locale === "ta" ? "தொடக்கப் பொருட்களைச் சேர்" : "starter products"}`
        : locale === "si" ? "ආරම්භක සිල්ලර නාමාවලිය එක් කරන්න" : locale === "ta" ? "தொடக்க மளிகைப் பட்டியலைச் சேர்" : "Add starter grocery catalogue";

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <button
          type="button"
          disabled={saving || !canWrite}
          title={disabledHint ?? undefined}
          onClick={() => setConfirming(true)}
          data-testid="grocery-starter-catalogue-button"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(13,148,136,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {saving ? (locale === "si" ? "භාණ්ඩ සූදානම් කරමින්…" : locale === "ta" ? "பொருட்கள் தயாராகின்றன…" : "Preparing products…") : "✦ "}{label}
        </button>
        {saving && <span className="text-xs font-bold text-teal-700">{completed} / {completed + queue.length} {locale === "si" ? "සුරකින ලදී" : locale === "ta" ? "சேமிக்கப்பட்டது" : "saved"}</span>}
        {error && <span role="alert" className="text-xs font-semibold text-rose-700">{error}</span>}
      </div>
      <ConfirmDialog
        open={confirming}
        title={locale === "si" ? "ශ්‍රී ලංකා ආරම්භක සිල්ලර නාමාවලිය එක් කරන්නද?" : locale === "ta" ? "இலங்கை தொடக்க மளிகைப் பட்டியலைச் சேர்க்கவா?" : "Add the Sri Lankan grocery starter catalogue?"}
        description={locale === "si" ? `මෙය LKR විකුණුම් මිල, තොග, SKU සහ තීරු කේත සමඟ සංස්කරණය කළ හැකි භාණ්ඩ ${missing.length || GROCERY_STARTER_CATALOGUE.length}ක් එක් කරයි. ඔබ නාමාවලිය එක් කරන්න තෝරන තෙක් කිසිවක් එක් නොවේ.` : locale === "ta" ? `இது LKR விலை, சரக்கு, SKU மற்றும் பட்டைக் குறியீட்டுடன் திருத்தக்கூடிய ${missing.length || GROCERY_STARTER_CATALOGUE.length} பொருட்களைச் சேர்க்கும். பட்டியலைச் சேர் என்பதைத் தேர்வதற்கு முன் எதுவும் சேர்க்கப்படாது.` : `This adds ${missing.length || GROCERY_STARTER_CATALOGUE.length} editable products with LKR selling prices, stock, SKUs and barcodes. Nothing is added until you choose Add catalogue.`}
        confirmLabel={locale === "si" ? "නාමාවලිය එක් කරන්න" : locale === "ta" ? "பட்டியலைச் சேர்" : "Add catalogue"}
        onConfirm={addCatalogue}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
