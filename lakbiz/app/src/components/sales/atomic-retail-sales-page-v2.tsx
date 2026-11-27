"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { setBottomBarOccupied } from "@/components/shell/bottom-bar-overlay";
import { ProductConditionBadge } from "@/components/product-condition-badge";
import { BarcodeCameraScanner } from "@/components/product/barcode-camera-scanner";
import { HeldSaleDraftsDialog } from "@/components/sales/held-sale-drafts-dialog";
import { AdvancedSaleSelector, type AdvancedSaleLineState } from "@/components/sales/advanced-sale-selector";
import { GroceryCategoryArt, GroceryProductArt } from "@/components/sales/grocery-product-art";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProStatCard,
} from "@/components/ui/pro-shell";
import { BillsIcon, CostingIcon, SalesIcon } from "@/components/ui/icons";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { LK_BANKS } from "@/lib/banks";
import { customerPrimaryLabel } from "@/lib/contact-type";
import { effectiveUnitPrice } from "@/lib/company-pricing";
import { formatLkr } from "@/lib/format";
import { buildRetailDashboardIntelligence } from "@/lib/dashboard/retail-intelligence";
import { buildQuoteTextFromLines, whatsappShareUrl } from "@/lib/invoice";
import { sendApiWhatsApp } from "@/lib/messaging";
import { useWhatsAppApiConfigured } from "@/lib/messaging/use-sms-api-configured";
import { sectorAllowsApiWhatsApp } from "@/lib/messaging/wasender-sectors";
import { isValidSlMobile } from "@/lib/messaging/phone";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  groceryCategoryLabel,
  groceryProductLabel,
  groceryProductSearchText,
  groceryQuantityLabel,
  groceryUi,
  groceryUnitLabel,
  type GroceryUiKey,
} from "@/lib/grocery-localization";
import { PAYMENT_OPTIONS, paymentLabel } from "@/lib/i18n/payment";
import { buildSaleInventoryAllocationLine } from "@/lib/inventory-sale-allocation";
import {
  clearGroceryTestBills as clearCloudGroceryTestBills,
  deleteGroceryTestBill as deleteCloudGroceryTestBill,
  fetchGroceryTestBills,
  saveGroceryTestBill,
  type GroceryTestBill,
} from "@/lib/grocery-test-bills";
import {
  summarizeSaleTenders,
  validateSaleTenders,
} from "@/lib/sale-tender";
import {
  buildCheckoutTenders,
  type CheckoutTenderKind,
} from "@/lib/retail-tender-checkout";
import { useAppStore } from "@/lib/store/use-app-store";
import {
  deleteSaleDraft,
  saleDraftErrorMessage,
  saveSaleDraft,
  type SaleDraft,
  type SaleDraftPayload,
} from "@/lib/supabase/sale-drafts";
import { saveAppData } from "@/lib/store/storage";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { pullBusinessData } from "@/lib/supabase/business-sync";
import {
  finalizeSaleWithTenders,
  type AtomicSaleLine,
} from "@/lib/supabase/sale-tender-client";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import type { Product, ProductCondition } from "@/lib/types";
import { splitInclusiveTotal } from "@/lib/vat";

type CheckoutPayment = CheckoutTenderKind;
type ConditionFilter = "all" | ProductCondition;

const ADVANCED_RETAIL_SECTORS = new Set(["pharmacy", "mobile_shop", "electronics", "footwear"]);
const FAST_RETAIL_SECTORS = new Set(["pharmacy", "grocery"]);
const SUCCESS_STORAGE_KEY = "lakbiz-atomic-sale-success";

const GROCERY_CATEGORY_CHIPS = [
  { name: "Fruits", matches: ["fruit"] },
  { name: "Vegetables", matches: ["vegetable"] },
  { name: "Meat & Poultry", matches: ["meat", "poultry", "seafood", "frozen"] },
  { name: "Dairy", matches: ["dairy", "milk", "egg"] },
  { name: "Bakery", matches: ["bread", "bakery"] },
  { name: "Rice, Flour & Dry Goods", matches: ["rice", "flour", "grain", "sugar", "salt", "dry"] },
  { name: "Spices & Seasoning", matches: ["spice", "seasoning"] },
  { name: "Coconut Products", matches: ["coconut"] },
  { name: "Beverages", matches: ["beverage", "drink", "juice", "water"] },
  { name: "Household", matches: ["household", "clean", "home"] },
] as const;

function matchesGroceryCategory(product: Product, chip: string): boolean {
  const category = (product.category ?? "").toLowerCase();
  const definition = GROCERY_CATEGORY_CHIPS.find((candidate) => candidate.name === chip);
  return definition ? definition.matches.some((word) => category.includes(word)) : false;
}

function clientId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function productSearchText(product: Product, includeGroceryAliases = false): string {
  const source = [
    product.name,
    product.sku,
    product.category,
    product.customFields.barcode,
    product.customFields.genericName,
    product.customFields.brand,
    product.customFields.strength,
    product.customFields.packSize,
  ]
    .filter(Boolean)
    .map(String)
    .join(" ")
    .toLowerCase();
  return includeGroceryAliases ? `${source} ${groceryProductSearchText(product)}` : source;
}

function boolField(value: unknown): boolean {
  return value === true || (typeof value === "string" && value.trim().toLowerCase() === "true");
}

function groceryTestCopy(locale: string) {
  if (locale === "si") {
    return {
      toggleOn: "පරීක්ෂණ මාදිලිය",
      toggleOff: "පරීක්ෂණ මාදිලියෙන් ඉවත් වන්න",
      banner: "පරීක්ෂණ මාදිලිය · සැබෑ විකිණීමක් නොවේ",
      description: "පරීක්ෂණ බිල්පත් ඔබේ වෙළඳසැලේ පුරනය වී ඇති සියලුම උපාංගවලින් දැකිය හැක. සැබෑ විකුණුම්, තොගය, ගෙවීම් හෝ බදු වාර්තා වෙනස් නොවේ.",
      history: "පරීක්ෂණ බිල්",
      save: "පරීක්ෂණ බිල් සුරකින්න",
      update: "පරීක්ෂණ බිල් යාවත්කාලීන කරන්න",
      edit: "සංස්කරණය",
      remove: "මකන්න",
      clear: "සියල්ල මකන්න",
      empty: "තවම පරීක්ෂණ බිල් නැත.",
      sharedInfo: "වෙළඳසැලේ කණ්ඩායම සමඟ සමමුහුර්ත වේ · සැබෑ ගනුදෙනුවලට ඇතුළත් නොවේ",
      noPayment: "මෙය පරීක්ෂණ බිල්පතක් පමණි. ගනුදෙනුකරු, ගෙවීම, තොගය හෝ සැබෑ ඉන්වොයිසියක් සුරැකෙන්නේ නැත.",
      saved: "පරීක්ෂණ බිල් සුරකින ලදී. සජීවී දත්ත වෙනස් කර නැත.",
      startWithEmpty: "පරීක්ෂණ මාදිලිය ආරම්භ කිරීමට පෙර වත්මන් බිල්පත හිස් කරන්න.",
      finishOrClear: "පරීක්ෂණ මාදිලියෙන් ඉවත් වීමට පෙර පරීක්ෂණ බිල්පත සුරකින්න හෝ හිස් කරන්න.",
      missingProduct: "මෙම පරීක්ෂණ බිල්පතේ භාණ්ඩයක් දැන් ලබාගත නොහැක.",
    };
  }
  if (locale === "ta") {
    return {
      toggleOn: "சோதனை முறை",
      toggleOff: "சோதனை முறையிலிருந்து வெளியேறு",
      banner: "சோதனை முறை · உண்மையான விற்பனை அல்ல",
      description: "சோதனை பில்கள் உங்கள் கடைக் குழுவின் உள்நுழைந்த சாதனங்களில் தெரியும். நேரடி விற்பனை, சரக்கு, பணம் அல்லது VAT மாறாது.",
      history: "சோதனை பில்கள்",
      save: "சோதனை பில் சேமி",
      update: "சோதனை பில்லைப் புதுப்பி",
      edit: "திருத்து",
      remove: "நீக்கு",
      clear: "அனைத்தையும் நீக்கு",
      empty: "இன்னும் சோதனை பில்கள் இல்லை.",
      sharedInfo: "குழுவுடன் ஒத்திசைக்கப்படும் · நேரடி பரிவர்த்தனைகளில் சேராது",
      noPayment: "இது சோதனை பில் மட்டுமே. வாடிக்கையாளர், கட்டணம், சரக்கு அல்லது உண்மையான விலைப்பட்டியல் எதுவும் சேமிக்கப்படாது.",
      saved: "சோதனை பில் சேமிக்கப்பட்டது. நேரடி தரவு மாற்றப்படவில்லை.",
      startWithEmpty: "சோதனை முறையைத் தொடங்கும் முன் தற்போதைய பில்லை காலி செய்யவும்.",
      finishOrClear: "சோதனை முறையிலிருந்து வெளியேறும் முன் சோதனை பில்லை சேமிக்கவும் அல்லது காலி செய்யவும்.",
      missingProduct: "இந்த சோதனை பில்லில் உள்ள ஒரு பொருள் இப்போது கிடைக்கவில்லை.",
    };
  }
  return {
    toggleOn: "Test mode",
    toggleOff: "Exit test mode",
    banner: "TEST MODE · NOT A REAL SALE",
    description: "Test bills sync across your shop’s signed-in devices. They never post to live sales, stock, cash, payments, VAT or reports.",
    history: "Test bills",
    save: "Save test bill",
    update: "Update test bill",
    edit: "Edit",
    remove: "Delete",
    clear: "Clear all",
    empty: "No test bills yet.",
    sharedInfo: "Shared with the shop team · excluded from live transactions",
    noPayment: "This saves a test copy only. No customer, payment, stock movement or real invoice is recorded.",
    saved: "Test bill saved. Live records were not changed.",
    startWithEmpty: "Clear the current bill before entering test mode.",
    finishOrClear: "Save or clear the test cart before exiting test mode.",
    missingProduct: "A product on this test bill is no longer available.",
  };
}


export function AtomicRetailSalesPageV2() {
  const { data, ready } = useAppStore();
  const { t, locale } = useLocale();
  const { org, orgRole, canSeeFinancials, can } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const si = locale === "si";
  const fastRetail = FAST_RETAIL_SECTORS.has(org.sector);
  const groceryPos = org.sector === "grocery";
  const advancedRetail = ADVANCED_RETAIL_SECTORS.has(org.sector);
  const conditionRelevant = !fastRetail;
  const grocery = (key: GroceryUiKey) => groceryUi(locale, key);
  const testCopy = groceryTestCopy(locale);

  // The quote share button here was a plain wa.me deep link only — always
  // opens WhatsApp with the text pre-filled, but never actually sends.
  // canApiWhatsApp mirrors message-composer.tsx's exact gate (same sector
  // allowlist + bulk_messaging plan check) so this button only offers real
  // API sending where it's actually wired up server-side. In practice this
  // page only renders for pharmacy/grocery/advanced-retail sectors, so
  // today that's just pharmacy — see wasender-sectors.ts.
  const whatsappApiConfigured = useWhatsAppApiConfigured();
  const canApiWhatsApp = whatsappApiConfigured === true && can("bulk_messaging") && sectorAllowsApiWhatsApp(org.sector);
  const [sendingQuoteApi, setSendingQuoteApi] = useState(false);
  // Reported: a failed send (e.g. a rejected/invalid provider API key)
  // rendered as raw unstyled text -- "invalid API key" straight from
  // WasenderAPI's own response, no icon/border/action, reading like a
  // debug string that leaked into production. The button above only
  // ever shows once canApiWhatsApp is already true (config+plan+sector
  // all pre-checked client-side), so any error that reaches this state
  // is realistically always a provider/config-level failure, not a
  // validation one -- worth a real actionable warning box every time,
  // not just a generic error string.
  const [quoteApiFeedback, setQuoteApiFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOrder, setCartOrder] = useState<string[]>([]);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testModeReady, setTestModeReady] = useState(false);
  const [testBills, setTestBills] = useState<GroceryTestBill[]>([]);
  const [editingTestBillId, setEditingTestBillId] = useState<string | null>(null);
  const [showTestBills, setShowTestBills] = useState(false);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [inventoryStates, setInventoryStates] = useState<Record<string, AdvancedSaleLineState>>({});
  const [search, setSearch] = useState("");
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [resultLimit, setResultLimit] = useState(30);
  const [discount, setDiscount] = useState(0);
  const [cashReceived, setCashReceived] = useState<number | "">("");
  const [payment, setPayment] = useState<CheckoutPayment>("cash");
  const [splitPayment, setSplitPayment] = useState(false);
  const [secondaryPayment, setSecondaryPayment] = useState<CheckoutPayment>("card");
  const [secondaryAmount, setSecondaryAmount] = useState<number | "">("");
  const [customerId, setCustomerId] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState(LK_BANKS[0]);
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [postDated, setPostDated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [lastBillId, setLastBillId] = useState<string | null>(null);
  const [pendingSaleId, setPendingSaleId] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const closeHeldBills = useCallback(() => setDraftDialogOpen(false), []);

  useEffect(() => {
    if (!mobileCartOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileCartOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileCartOpen]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SUCCESS_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { saleId?: string; billNo?: string; paymentMethod?: string; draftCleanupFailed?: boolean };
      sessionStorage.removeItem(SUCCESS_STORAGE_KEY);
      if (saved.saleId) setLastBillId(saved.saleId);
      const paymentNote = saved.paymentMethod === "mixed"
        ? groceryPos ? ` · ${groceryUi(locale, "splitPayment")}` : (si ? " · බෙදා ගෙවීම" : " · Split payment")
        : "";
      const billSuffix = saved.billNo ? " · " + saved.billNo : "";
      const completionMessage = groceryPos
        ? groceryUi(locale, "completedBill") + billSuffix + paymentNote + ". " +
          (locale === "si" ? "තොගය සහ ගෙවීම එකම ගනුදෙනුවක සුරකින ලදී." : locale === "ta" ? "கட்டணமும் சரக்கும் ஒரே பரிவர்த்தனையில் பதிவு செய்யப்பட்டன." : "Payment and inventory were committed in one transaction.")
        : si
          ? "විකිණීම සම්පූර්ණයි" + billSuffix + paymentNote + ". තොගය සහ ගෙවීම එකම transaction එකක සුරකින ලදී."
          : "Sale completed" + billSuffix + paymentNote + ". Payment and inventory were committed in one transaction.";
      const cleanupMessage = saved.draftCleanupFailed
        ? locale === "si"
          ? " ගෙවීමට පෙර සුරැකූ පිටපත තවමත් පවතී; නැවත විකිණීමට පෙර එය රඳවාගත් බිල්පත් වලින් මකන්න."
          : locale === "ta"
            ? " சேமித்த வரைவு இன்னும் உள்ளது; மீண்டும் விற்பனை செய்வதற்கு முன் அதை சேமித்த பில்களில் இருந்து நீக்கவும்."
            : " The saved draft is still present; remove it from Held bills before selling it again."
        : "";
      setMessage([completionMessage, cleanupMessage].filter(Boolean).join(" "));
    } catch {
      sessionStorage.removeItem(SUCCESS_STORAGE_KEY);
    }
  }, [groceryPos, locale, si]);

  useEffect(() => {
    let current = true;
    setTestModeReady(false);
    setTestMode(false);
    setEditingTestBillId(null);
    setShowTestBills(false);
    setTestBills([]);
    if (!groceryPos || !org.id) {
      setTestModeReady(true);
      return () => { current = false; };
    }
    void fetchGroceryTestBills(org.id).then(({ data: bills, error }) => {
      if (!current) return;
      if (error) {
        setMessage(`Test history could not load from the shop cloud: ${error}`);
        return;
      }
      setTestBills(bills);
      setTestModeReady(true);
    }).catch((error: unknown) => {
      if (!current) return;
      setMessage(error instanceof Error ? error.message : "Test history could not load from the shop cloud.");
    });
    return () => { current = false; };
  }, [groceryPos, org.id]);

  const groceryLiveMetrics = useMemo(() => {
    if (!groceryPos || !data) return null;
    const referenceDate = new Date();
    const intelligence = buildRetailDashboardIntelligence(data, "grocery", canSeeFinancials, [], referenceDate, "7d");
    const todayKey = referenceDate.toISOString().slice(0, 10);
    const itemsSold = data.sales
      .filter((sale) => sale.date.startsWith(todayKey))
      .reduce((total, sale) => total + sale.lines.reduce((lineTotal, line) => lineTotal + line.qty, 0), 0);
    return { intelligence, itemsSold };
  }, [canSeeFinancials, data, groceryPos]);
  const lines = useMemo(() => {
    if (!data) return [];
    const order = new Map(cartOrder.map((productId, index) => [productId, index] as const));
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = data.products.find((row) => row.id === productId)!;
        const selectedPrice = effectiveUnitPrice(
          product,
          customerId,
          data,
          groceryPos && orgRole !== "owner" && orgRole !== "manager" ? undefined : priceOverrides[productId],
        );
        const unitPrice = groceryPos && selectedPrice <= 0 ? product.sellPrice : selectedPrice;
        return { product, qty, unitPrice };
      })
      .sort((left, right) => (order.get(left.product.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.product.id) ?? Number.MAX_SAFE_INTEGER));
  }, [cart, cartOrder, priceOverrides, data, customerId, groceryPos, orgRole]);

  // Tell the shared mobile bottom nav to step aside only while our own
  // fixed settlement bar is actually showing (lines non-empty) — see
  // bottom-bar-overlay.ts.
  useEffect(() => {
    setBottomBarOccupied(lines.length > 0);
    return () => setBottomBarOccupied(false);
  }, [lines.length]);

  const gross = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const discountClamped = Math.min(Math.max(0, discount), gross);
  const netTotal = gross - discountClamped;
  const billVat = data?.business.vatRegistered ? splitInclusiveTotal(netTotal) : null;
  const cartCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const secondaryAmountValue = secondaryAmount === "" ? 0 : Math.max(0, Number(secondaryAmount));
  const primaryTenderPreview = splitPayment
    ? Math.max(0, netTotal - secondaryAmountValue)
    : netTotal;
  const cashTenderPreview =
    (payment === "cash" ? primaryTenderPreview : 0) +
    (splitPayment && secondaryPayment === "cash" ? secondaryAmountValue : 0);
  const changeDue = cashReceived === "" ? 0 : Math.max(0, Number(cashReceived) - cashTenderPreview);
  const paymentSummaryLabel = splitPayment
    ? (groceryPos ? grocery("splitPayment") : si ? "බෙදා ගෙවීම" : "Split payment")
    : paymentLabel(t, payment);
  const identityBlocked = advancedRetail && lines.some((line) => {
    const state = inventoryStates[line.product.id];
    return !state || state.loading || !state.ready || state.degraded;
  });

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain><ProLoadingState label={t("common.loading")} /></ProMain>
      </AppShell>
    );
  }

  const selectedCustomer = customerId
    ? data.customers.find((customer) => customer.id === customerId)
    : undefined;
  const buyerName = selectedCustomer?.name ?? walkInName.trim();
  // WhatsApp recipient for the quote: a saved customer's phone, or (since
  // most sales here are walk-ins with no account) whatever the cashier
  // typed into the walk-in phone field below — same number either way,
  // so the deep link and the API auto-send both target the actual buyer
  // instead of only ever working when a saved customer is picked.
  const recipientPhone = selectedCustomer?.phone ?? (walkInPhone.trim() || undefined);
  const quoteText = buildQuoteTextFromLines(
    lines.map((line) => ({
      productName: line.product.name,
      qty: line.qty,
      unitPrice: line.unitPrice,
    })),
    netTotal,
    data.business,
    { customerName: buyerName || undefined, discount: discountClamped, t },
  );
  const quoteWaUrl = whatsappShareUrl(quoteText, recipientPhone);

  const handleSendQuoteApi = async () => {
    if (sendingQuoteApi || !isValidSlMobile(recipientPhone)) return;
    setSendingQuoteApi(true);
    setQuoteApiFeedback(null);
    const result = await sendApiWhatsApp({
      phone: recipientPhone!,
      message: quoteText,
      templateId: "sales_quote",
      contextType: "custom",
      recipientName: buyerName || undefined,
    });
    setSendingQuoteApi(false);
    setQuoteApiFeedback({
      ok: result.ok,
      message: result.ok ? t("msg.api_sent_ok") : (result.error ?? t("msg.sent_fail")),
    });
  };

  const saveCurrentDraft = async (): Promise<boolean> => {
    if (draftSaving || lines.length === 0) return false;
    if (!org.id) {
      setMessage(locale === "si" ? "Shop එක සූදානම් වූ පසු බිල්පත රඳවාගන්න." : locale === "ta" ? "கடை தயாரான பிறகு பில்லை சேமிக்கவும்." : "The shop is not ready to save this bill yet.");
      return false;
    }
    setDraftSaving(true);
    setMessage("");
    const title = (buyerName || lines[0]?.product.name || (locale === "si" ? "නව බිල්පත" : locale === "ta" ? "புதிய பில்" : "New bill")).trim().slice(0, 100);
    const payload: SaleDraftPayload = {
      cart,
      priceOverrides,
      inventoryStates,
      discount: discountClamped,
      cashReceived,
      payment,
      splitPayment,
      secondaryPayment,
      secondaryAmount,
      customerId,
      walkInName,
      walkInPhone,
      chequeNo,
      chequeBank,
      chequeDate,
      postDated,
      pendingSaleId,
      snapshotTotal: netTotal,
    };
    let result: Awaited<ReturnType<typeof saveSaleDraft>>;
    try {
      result = await saveSaleDraft(org.id, activeDraftId, title, payload);
    } catch {
      setDraftSaving(false);
      setMessage(saleDraftErrorMessage(locale, "failed"));
      return false;
    }
    setDraftSaving(false);
    if (!result.ok) {
      setMessage(saleDraftErrorMessage(locale, result.code));
      return false;
    }
    setActiveDraftId(result.data.id);
    setMessage(locale === "si"
      ? "ගෙවීමට පෙර බිල්පත සුරැකුණා. මෙම shop එකේ වෙනත් උපාංගයකින් එය නැවත විවෘත කළ හැක."
      : locale === "ta"
        ? "பணம் செலுத்துவதற்கு முன் பில் சேமிக்கப்பட்டது. இந்தக் கடையின் மற்றொரு சாதனத்தில் மீண்டும் திறக்கலாம்."
        : "Bill held. It can be reopened on another device for this shop.");
    return true;
  };

  const resetBill = () => {
    setMobileCartOpen(false);
    setCart({});
    setCartOrder([]);
    setPriceOverrides({});
    setInventoryStates({});
    setDiscount(0);
    setCashReceived("");
    setPayment("cash");
    setSplitPayment(false);
    setSecondaryPayment("card");
    setSecondaryAmount("");
    setCustomerId("");
    setWalkInName("");
    setWalkInPhone("");
    setChequeNo("");
    setChequeBank(LK_BANKS[0]);
    setChequeDate(new Date().toISOString().slice(0, 10));
    setPostDated(false);
    setPendingSaleId(null);
    setActiveDraftId(null);
    setMessage("");
  };

  const startNewBill = async () => {
    const hadCurrentBill = lines.length > 0;
    if (hadCurrentBill && !(await saveCurrentDraft())) return;
    resetBill();
    if (hadCurrentBill) {
      setMessage(locale === "si" ? "වත්මන් බිල්පත රඳවාගත් බිල්පත් තුළ සුරැකුණා." : locale === "ta" ? "தற்போதைய பில் சேமிக்கப்பட்ட பில்களில் பாதுகாக்கப்பட்டது." : "Current bill saved to Held bills.");
    }
  };

  const startNewGroceryBill = async () => {
    if (!testMode) {
      await startNewBill();
      return;
    }
    if (lines.length > 0 && !window.confirm("Discard this unsaved test cart and start a new test bill?")) return;
    resetBill();
    setEditingTestBillId(null);
    setShowTestBills(false);
  };

  const openHeldBills = async () => {
    if (lines.length > 0 && !(await saveCurrentDraft())) return;
    setDraftDialogOpen(true);
  };

  const resumeHeldBill = (draft: SaleDraft) => {
    const restoredCart: Record<string, number> = {};
    let missingProduct = false;
    let overCurrentStock = false;
    for (const [productId, qty] of Object.entries(draft.payload.cart)) {
      const product = data.products.find((row) => row.id === productId);
      if (!product) {
        missingProduct = true;
        continue;
      }
      restoredCart[productId] = qty;
      if (qty > product.stockQty) overCurrentStock = true;
    }
    const validIds = new Set(Object.keys(restoredCart));
    const overrides = Object.fromEntries(
      Object.entries(draft.payload.priceOverrides).filter(([id]) => validIds.has(id)),
    );
    const inventory = Object.fromEntries(
      Object.entries(draft.payload.inventoryStates).filter(([id]) => validIds.has(id)),
    ) as Record<string, AdvancedSaleLineState>;
    setCart(restoredCart);
    setCartOrder(Object.keys(restoredCart));
    setPriceOverrides(overrides);
    setInventoryStates(inventory);
    setDiscount(draft.payload.discount);
    setCashReceived(draft.payload.cashReceived);
    setPayment(draft.payload.payment as CheckoutPayment);
    setSplitPayment(draft.payload.splitPayment);
    setSecondaryPayment(draft.payload.secondaryPayment as CheckoutPayment);
    setSecondaryAmount(draft.payload.secondaryAmount);
    setCustomerId(data.customers.some((row) => row.id === draft.payload.customerId) ? draft.payload.customerId : "");
    setWalkInName(draft.payload.walkInName);
    setWalkInPhone(draft.payload.walkInPhone);
    setChequeNo(draft.payload.chequeNo);
    setChequeBank(draft.payload.chequeBank || LK_BANKS[0]);
    setChequeDate(draft.payload.chequeDate || new Date().toISOString().slice(0, 10));
    setPostDated(draft.payload.postDated);
    setPendingSaleId(draft.payload.pendingSaleId);
    setActiveDraftId(draft.id);
    setDraftDialogOpen(false);
    setSearch("");
    setCategoryFilter("all");
    setResultLimit(30);
    setMessage(missingProduct
      ? locale === "si" ? "සමහර භාණ්ඩ දැන් නැති නිසා ඉවත් කර ඇත. ගෙවීමට පෙර බිල්පත පරීක්ෂා කරන්න." : locale === "ta" ? "சில பொருட்கள் இனி இல்லை; கட்டணம் செலுத்துவதற்கு முன் பில்லை சரிபார்க்கவும்." : "Some products are no longer available. Review the bill before checkout."
      : overCurrentStock
        ? locale === "si" ? "භාණ්ඩයක තොගය රඳවාගත් විට තිබූ ප්‍රමාණයට වඩා අඩුයි. ගෙවීමට පෙර ප්‍රමාණය පරීක්ෂා කරන්න." : locale === "ta" ? "சில பொருட்களின் இருப்பு குறைந்துள்ளது. பணம் செலுத்தும் முன் அளவைச் சரிபார்க்கவும்." : "Current stock is lower than when this bill was held. Review quantities before checkout."
        : locale === "si" ? "රඳවාගත් බිල්පත නැවත විවෘත කළා. අවශ්‍ය වෙනස්කම් කර පසුව ගෙවීම සම්පූර්ණ කරන්න." : locale === "ta" ? "சேமித்த பில் மீண்டும் திறக்கப்பட்டது. திருத்திய பின் கட்டணத்தை முடிக்கவும்." : "Held bill reopened. Edit it, then complete checkout when ready.");
  };

  const inStock = data.products.filter((product) =>
    product.active && (testMode || product.stockQty > 0) && (!groceryPos || product.sellPrice > 0)
  );
  const query = search.trim().toLowerCase();
  const searched = query ? inStock.filter((product) => productSearchText(product, groceryPos).includes(query)) : inStock;
  const categoryFiltered = fastRetail && categoryFilter !== "all"
    ? searched.filter((product) => groceryPos ? matchesGroceryCategory(product, categoryFilter) : product.category === categoryFilter)
    : searched;
  const filtered = !conditionRelevant || conditionFilter === "all"
    ? categoryFiltered
    : categoryFiltered.filter((product) => product.condition === conditionFilter);
  const categoryCounts = new Map<string, number>();
  if (fastRetail) {
    for (const product of inStock) {
      const category = product.category || "General";
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const categories = groceryPos
    ? GROCERY_CATEGORY_CHIPS.map((chip) => ({
        name: chip.name,
        count: inStock.filter((product) => matchesGroceryCategory(product, chip.name)).length,
      }))
    : Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 12);
  const visibleProducts = fastRetail ? filtered.slice(0, resultLimit) : filtered;
  const exactMatch = query
    ? filtered.find((product) =>
        (product.sku ?? "").trim().toLowerCase() === query ||
        String(product.customFields.barcode ?? "").trim().toLowerCase() === query,
      )
    : undefined;
  const quickAddCandidate = exactMatch ?? filtered[0];

  const customerOptionText = (customer: (typeof data.customers)[number]) =>
    `${customerPrimaryLabel(customer)}${customer.creditBalance > 0 ? ` (${t("sales.owes")} ${formatLkr(customer.creditBalance)})` : ""}`;

  const setQty = (productId: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, Number.isFinite(qty) ? qty : 0));
    setCart((current) => ({ ...current, [productId]: clamped }));
    setCartOrder((current) => clamped <= 0
      ? current.filter((id) => id !== productId)
      : current.includes(productId) ? current : [...current, productId]);
    setPendingSaleId(null);
    if (clamped <= 0) {
      setInventoryStates((current) => {
        if (!current[productId]) return current;
        const next = { ...current };
        delete next[productId];
        return next;
      });
    }
  };

  const addOne = (product: Product) => {
    setQty(product.id, (cart[product.id] ?? 0) + 1, testMode ? Number.MAX_SAFE_INTEGER : product.stockQty);
    setCartOrder((current) => [product.id, ...current.filter((id) => id !== product.id)]);
    if (fastRetail) {
      setSearch("");
      setCategoryFilter("all");
      setResultLimit(30);
    }
  };

  const toggleGroceryTestMode = () => {
    if (!org.id || !groceryPos || !testModeReady || !canWrite) return;
    if (!testMode && activeDraftId) {
      setMessage("Finish or close the active held bill before entering test mode.");
      return;
    }
    if (lines.length > 0) {
      setMessage(testMode ? testCopy.finishOrClear : testCopy.startWithEmpty);
      return;
    }
    if (testMode && !window.confirm("Exit test mode? The next checkout will create a real invoice and update live stock and payments.")) return;
    setTestMode((current) => !current);
    setEditingTestBillId(null);
    setLastBillId(null);
    setDraftDialogOpen(false);
    setMessage("");
  };

  const editGroceryTestBill = (bill: GroceryTestBill) => {
    if (!data || bill.lines.some((line) => !data.products.some((product) => product.id === line.productId))) {
      setMessage(testCopy.missingProduct);
      return;
    }
    if (lines.length > 0 && !window.confirm("Discard the current unsaved test cart and edit this saved test bill?")) return;
    resetBill();
    setTestMode(true);
    setCart(Object.fromEntries(bill.lines.map((line) => [line.productId, line.qty])));
    setCartOrder(bill.lines.map((line) => line.productId));
    setPriceOverrides(Object.fromEntries(bill.lines.map((line) => [line.productId, line.unitPrice])));
    setDiscount(bill.discount);
    setEditingTestBillId(bill.id);
    setShowTestBills(false);
    setLastBillId(null);
    setMessage(`${testCopy.edit} · ${bill.billNo}`);
    document.getElementById("grocery-pos-search")?.focus();
  };

  const deleteTestBill = async (bill: GroceryTestBill) => {
    if (!org.id || !window.confirm(`Delete test bill ${bill.billNo}? This only removes the shop's test copy.`)) return;
    setSaving(true);
    const result = await deleteCloudGroceryTestBill(org.id, bill.id).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : "The test bill could not be deleted.",
    }));
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setTestBills((current) => current.filter((row) => row.id !== bill.id));
    if (editingTestBillId === bill.id) {
      resetBill();
      setEditingTestBillId(null);
    }
    setMessage(`${testCopy.remove} · ${bill.billNo}`);
  };

  const clearAllTestBills = async () => {
    if (!org.id || !window.confirm("Clear all test bills shared by this shop? Live sales and stock are not affected.")) return;
    setSaving(true);
    const result = await clearCloudGroceryTestBills(org.id).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : "Test bills could not be cleared.",
    }));
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setTestBills([]);
    if (editingTestBillId) {
      resetBill();
      setEditingTestBillId(null);
    }
    setMessage("");
  };

  const handlePosBarcodeDetected = (barcode: string) => {
    const normalized = barcode.trim().toLowerCase();
    const product = inStock.find((row) =>
      (row.sku ?? "").trim().toLowerCase() === normalized ||
      String(row.customFields.barcode ?? "").trim().toLowerCase() === normalized,
    );
    setBarcodeScannerOpen(false);
    if (product) {
      setMessage("");
      addOne(product);
      if (window.matchMedia("(max-width: 1279px)").matches) setMobileCartOpen(true);
      return;
    }

    setCategoryFilter("all");
    setSearch(barcode);
    setResultLimit(30);
    setMessage(locale === "si"
      ? `තීරු කේතය ${barcode} කියවුණා. එයට ගැළපෙන සක්‍රිය භාණ්ඩයක් නැහැ. Stock හි එම භාණ්ඩයට මෙම කේතය එක් කරන්න.`
      : locale === "ta"
        ? `பார்கோடு ${barcode} வாசிக்கப்பட்டது. இதற்குப் பொருந்தும் செயலில் உள்ள பொருள் இல்லை. Stock-இல் அந்தப் பொருளுக்கு இந்தக் குறியீட்டைச் சேர்க்கவும்.`
        : `Scanned ${barcode}, but no active product matches it. Add this code to the product in Stock.`);
  };

  const resetPricingForCustomer = (id: string) => {
    setCustomerId(id);
    setPriceOverrides({});
    setPendingSaleId(null);
    const customer = data.customers.find((row) => row.id === id);
    setWalkInName(customer?.name ?? "");
    setWalkInPhone(customer?.phone ?? "");
  };

  const buildAtomicLines = (): AtomicSaleLine[] => lines.map((line, index) => {
    const base: AtomicSaleLine = {
      productId: line.product.id,
      qty: line.qty,
      unitPrice: line.unitPrice,
      lineOrder: index,
    };
    if (!advancedRetail) return base;
    const state = inventoryStates[line.product.id];
    if (!state || state.mode === "simple") return base;
    const allocation = buildSaleInventoryAllocationLine(
      line.product.id,
      line.qty,
      state.mode,
      state.selection,
    );
    if (!allocation) return base;
    return {
      ...base,
      ...(allocation.variantId ? { variantId: allocation.variantId } : {}),
      ...(allocation.unitIds?.length ? { unitIds: allocation.unitIds } : {}),
    };
  });

  const handleSale = async () => {
    if (saving || lines.length === 0) return;
    if (!org.id) {
      setMessage("Organization is not ready for checkout.");
      return;
    }
    if (netTotal <= 0) {
      setMessage(si ? "විකිණීමේ මුළු වටිනාකම ශූන්‍යයට වඩා වැඩි විය යුතුයි." : "Sale total must be greater than zero.");
      return;
    }
    if (identityBlocked) {
      setMessage(
        si
          ? "Checkout කිරීමට පෙර prescription / batch / variant / IMEI තේරීම් සම්පූර්ණ කරන්න."
          : "Complete prescription, batch, variant or IMEI requirements before checkout.",
      );
      return;
    }

    if (groceryPos && testMode) {
      if (!testModeReady) {
        setMessage("Test history is still loading. Please wait and try again.");
        return;
      }
      const previous = testBills.find((bill) => bill.id === editingTestBillId);
      if (!previous && testBills.length >= 100) {
        setMessage("This shop already has 100 test bills in recent history. Clear test history before creating more.");
        return;
      }
      const timestamp = new Date().toISOString();
      const billNo = previous?.billNo ?? `TEST-${timestamp.replace(/\D/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      setSaving(true);
      const saved = await saveGroceryTestBill(org.id, {
        ...(previous ? { id: previous.id } : {}),
        billNo,
        lines: lines.map((line) => ({
          productId: line.product.id,
          productName: line.product.name,
          qty: line.qty,
          unitPrice: line.unitPrice,
        })),
        discount: discountClamped,
        total: netTotal,
      }).catch((error: unknown) => ({
        data: null,
        error: error instanceof Error ? error.message : "Test bill could not be saved to the shop cloud.",
      }));
      setSaving(false);
      if (saved.error || !saved.data) {
        setMessage(saved.error ?? "Test bill could not be saved to the shop cloud.");
        return;
      }
      setTestBills((current) => previous
        ? current.map((bill) => bill.id === previous.id ? saved.data! : bill)
        : [saved.data!, ...current].slice(0, 100));
      resetBill();
      setEditingTestBillId(null);
      setShowTestBills(true);
      setMessage(`${testCopy.saved} · ${billNo}`);
      return;
    }

    const saleId = pendingSaleId ?? clientId("sale");
    const tenderPlan = buildCheckoutTenders({
      saleTotal: netTotal,
      primaryKind: payment,
      primaryId: `${saleId}-tender-1`,
      split: splitPayment,
      secondaryKind: secondaryPayment,
      secondaryAmount: secondaryAmountValue,
      secondaryId: `${saleId}-tender-2`,
      cheque: {
        chequeNo,
        chequeBank,
        chequeDate,
        postDated,
      },
    });
    if (tenderPlan.error) {
      setMessage(tenderPlan.error);
      return;
    }

    if (
      tenderPlan.cashTenderAmount > 0 &&
      cashReceived !== "" &&
      Number(cashReceived) < tenderPlan.cashTenderAmount
    ) {
      setMessage(si ? "ලැබුණු මුදල cash කොටසට වඩා අඩුයි." : "Cash received is below the cash portion of the sale.");
      return;
    }
    if (tenderPlan.creditTenderAmount > 0 && !customerId) {
      setMessage(t("sales.credit_need_customer"));
      return;
    }
    if (tenderPlan.creditTenderAmount > 0 && selectedCustomer?.creditLimit != null) {
      const nextBalance = selectedCustomer.creditBalance + tenderPlan.creditTenderAmount;
      if (nextBalance > selectedCustomer.creditLimit) {
        setMessage(
          t("sales.credit_limit_exceeded")
            .replace("{{limit}}", formatLkr(selectedCustomer.creditLimit))
            .replace("{{balance}}", formatLkr(nextBalance)),
        );
        return;
      }
    }

    let atomicLines: AtomicSaleLine[];
    try {
      atomicLines = buildAtomicLines();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inventory selection is incomplete.");
      return;
    }

    const validation = validateSaleTenders(tenderPlan.tenders, {
      saleTotal: netTotal,
      hasCustomerAccount: Boolean(customerId),
    });
    if (validation.length) {
      setMessage(validation[0]);
      return;
    }

    const tenderSummary = summarizeSaleTenders(netTotal, tenderPlan.tenders);
    if (!tenderSummary.settled || tenderSummary.changeDue > 0) {
      setMessage("Payment allocation does not settle the invoice exactly.");
      return;
    }

    if (!pendingSaleId) setPendingSaleId(saleId);
    setSaving(true);
    setMessage("");

    const result = await finalizeSaleWithTenders(org.id, {
      saleId,
      customerId: customerId || undefined,
      customerName: buyerName || undefined,
      discount: discountClamped,
      lines: atomicLines,
      tenders: tenderPlan.tenders,
    });

    if (!result.ok || !result.saleId) {
      setSaving(false);
      setMessage(result.error ?? t("sales.failed"));
      return;
    }

    const fresh = await pullBusinessData(org.id, data.business).catch(() => null);
    if (fresh) {
      const committedSale = fresh.sales.find((sale) => sale.id === result.saleId);
      if (committedSale && result.paymentMethod === "mixed") {
        // pullBusinessData currently normalizes legacy payment methods. Preserve
        // the authoritative v3 finalizer response for this newly committed sale
        // so the immediate receipt/recent-sales reload is truthful.
        committedSale.paymentMethod = "mixed";
      }
      saveAppData(fresh, org.id);
    }
    let draftCleanupFailed = false;
    if (activeDraftId) {
      try {
        const cleanup = await deleteSaleDraft(org.id, activeDraftId);
        draftCleanupFailed = !cleanup.ok;
      } catch {
        draftCleanupFailed = true;
      }
    }
    sessionStorage.setItem(
      SUCCESS_STORAGE_KEY,
      JSON.stringify({
        saleId: result.saleId,
        billNo: result.billNo,
        paymentMethod: result.paymentMethod ?? tenderPlan.paymentMethod,
        draftCleanupFailed,
      }),
    );
    window.location.replace("/sales");
  };

  return (
    <AppShell>
      <ProMain className={groceryPos ? "max-w-[1600px] py-4 sm:py-5 lg:px-5 lg:py-5" : ""}>
        {groceryPos ? (
          <section className="overflow-hidden rounded-[24px] border border-blue-100 bg-[radial-gradient(circle_at_92%_16%,rgba(129,140,248,0.24),transparent_28%),radial-gradient(circle_at_8%_100%,rgba(16,185,129,0.16),transparent_25%),linear-gradient(115deg,#f8fbff_0%,#edf5ff_56%,#faf5ff_100%)] p-4 shadow-[0_18px_44px_rgba(59,130,246,0.10)] sm:p-5">
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
              <div className="flex min-w-0 flex-1 gap-2">
              <label className="relative block min-w-0 flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-blue-500">⌕</span>
                <input
                  id="grocery-pos-search"
                  type="search"
                  value={search}
                  autoFocus
                  autoComplete="off"
                  onChange={(event) => { setSearch(event.target.value); setResultLimit(30); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && quickAddCandidate) {
                      event.preventDefault();
                      addOne(quickAddCandidate);
                    }
                    if (event.key === "Escape") setSearch("");
                  }}
                  placeholder={grocery("searchPlaceholder")}
                  className="h-12 w-full rounded-2xl border border-white/80 bg-white/90 pl-11 pr-4 text-sm font-semibold text-slate-900 shadow-[0_8px_24px_rgba(37,99,235,0.09)] outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <button
                type="button"
                onClick={() => setBarcodeScannerOpen(true)}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                aria-label={locale === "si" ? "Barcode ස්කෑන් කරන්න" : locale === "ta" ? "பார்கோடை ஸ்கேன் செய்" : "Scan barcode with camera"}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 0 1 1-1h2m10 0h2a1 1 0 0 1 1 1v2M4 17v2a1 1 0 0 0 1 1h2m10 0h2a1 1 0 0 0 1-1v-2M8 8v8m3-8v8m3-8v8m3-8v8" />
                </svg>
                {locale === "si" ? "ස්කෑන්" : locale === "ta" ? "ஸ்கேன்" : "Scan"}
              </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button type="button" onClick={() => void startNewGroceryBill()} disabled={draftSaving} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 text-xs font-bold text-white shadow-[0_10px_20px_rgba(16,185,129,0.22)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"><span className="text-base">＋</span>{grocery("newBill")}</button>
                <button type="button" onClick={toggleGroceryTestMode} disabled={!canWrite || !testModeReady} aria-pressed={testMode} className={`inline-flex h-12 items-center justify-center rounded-2xl border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${testMode ? "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200" : "border-amber-200 bg-white/75 text-amber-800 hover:bg-amber-50"}`}>{testMode ? testCopy.toggleOff : testCopy.toggleOn}</button>
                {testMode && <button type="button" onClick={() => setShowTestBills((current) => !current)} className="inline-flex h-12 items-center justify-center rounded-2xl border border-amber-200 bg-white/85 px-3 text-xs font-bold text-amber-900 transition hover:bg-amber-50">{testCopy.history} · {testBills.length}</button>}
                {!testMode && (
                <button type="button" onClick={() => void saveCurrentDraft()} disabled={draftSaving || lines.length === 0 || !canWrite} title={lines.length === 0 ? (locale === "si" ? "සුරැකීමට පෙර බිල්පතට භාණ්ඩ එක් කරන්න" : locale === "ta" ? "சேமிப்பதற்கு முன் பொருட்களை சேர்க்கவும்" : "Add products before holding a bill") : undefined} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-3 text-xs font-bold text-slate-700 transition hover:border-teal-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{draftSaving ? (locale === "si" ? "සුරකිමින්…" : locale === "ta" ? "சேமிக்கிறது…" : "Saving…") : grocery("holdBill")}</button>
                )}
{!testMode && (
                <button type="button" onClick={() => void openHeldBills()} disabled={draftSaving || !canWrite} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{grocery("recallBill")}</button>
                )}
                <button type="button" onClick={() => document.getElementById("grocery-pos-search")?.focus()} className="inline-flex h-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50/90 px-3 text-xs font-bold text-violet-700 transition hover:bg-violet-100">{grocery("priceCheck")}</button>
                <Link href="/stock" className="col-span-2 inline-flex h-10 items-center justify-center rounded-xl border border-blue-100 bg-white/75 px-3 text-xs font-bold text-blue-700 transition hover:bg-white sm:col-span-1 sm:h-12">{grocery("inventory")}</Link>
              </div>
            </div>
          </section>
        ) : <ProPageHeader
          eyebrow={org.sector === "pharmacy" ? (si ? "ආරක්ෂිත Pharmacy POS" : "Protected Pharmacy POS") : t("sales.pos_eyebrow")}
          title={t("sales.title")}
          description={org.sector === "pharmacy" ? (si ? "Prescription, FEFO batch සහ ගෙවීම එකම checkout transaction එකක පාලනය කරයි." : "Prescription checks, FEFO batch allocation and payment commit in one checkout transaction.") : (si ? "ගෙවීම සහ තොගය එකම checkout transaction එකක සුරකියි." : "Payment and stock commit together in one checkout transaction.")}
          actions={<><ProBadge tone="emerald">Atomic checkout</ProBadge><ProButton href="/stock" variant="secondary">{t("sales.add_stock_link")}</ProButton>{lastBillId && <ProButton href={`/bills/${lastBillId}`} variant="dark">{t("sales.view_bill")}</ProButton>}</>}
        />}

        {groceryPos && lines.length > 0 && (
          <section
            id="grocery-mobile-cart-preview"
            className="mt-4 scroll-mt-24 lg:hidden"
            aria-label={locale === "si" ? "ස්කෑන් කළ භාණ්ඩ" : locale === "ta" ? "ஸ்கேன் செய்த பொருட்கள்" : "Latest scanned items"}
            aria-live="polite"
          >
            <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(120deg,#f0fdf9_0%,#ffffff_52%,#f1f5ff_100%)] p-3.5 shadow-[0_12px_28px_rgba(15,118,110,0.10)] sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    {locale === "si" ? "ස්කෑන් කළ භාණ්ඩ" : locale === "ta" ? "ஸ்கேன் செய்த பொருட்கள்" : "Latest scanned items"}
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-slate-950">
                    {cartCount} {locale === "si" ? "භාණ්ඩ" : locale === "ta" ? "பொருட்கள்" : cartCount === 1 ? "item" : "items"} · {formatLkr(netTotal)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBarcodeScannerOpen(true)}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
                >
                  <span aria-hidden="true">⌗</span>
                  {locale === "si" ? "තවත් ස්කෑන්" : locale === "ta" ? "அடுத்ததை ஸ்கேன்" : "Scan next"}
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {lines.slice(0, 3).map((line, index) => (
                  <div key={line.product.id} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/90 bg-white/85 p-2 shadow-sm">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                      <GroceryProductArt
                        name={line.product.name}
                        category={line.product.category}
                        imageUrl={typeof line.product.customFields.imageUrl === "string" ? line.product.customFields.imageUrl : undefined}
                        className="h-full w-full p-1"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="min-w-0 flex-1 truncate text-xs font-extrabold text-slate-900">{groceryProductLabel(line.product, locale)}</p>
                        {index === 0 && <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-700">{locale === "si" ? "දැන් එක් කළා" : locale === "ta" ? "இப்போது சேர்க்கப்பட்டது" : "Just added"}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                        {groceryQuantityLabel(line.qty, line.product.customFields.unitVariant ?? line.product.customFields.unit, locale)}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-xs font-extrabold text-slate-900">{formatLkr(line.unitPrice * line.qty)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                {lines.length > 3 && (
                  <p className="text-[11px] font-semibold text-slate-500">
                    {locale === "si" ? `තවත් ${lines.length - 3}ක්` : locale === "ta" ? `மேலும் ${lines.length - 3}` : `+ ${lines.length - 3} more in bill`}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => document.getElementById("grocery-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="ml-auto inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800"
                >
                  {locale === "si" ? "බිල්පත බලන්න" : locale === "ta" ? "பில்லைப் பார்க்க" : "Review bill"}
                </button>
              </div>
            </div>
          </section>
        )}

        {barcodeScannerOpen && <BarcodeCameraScanner locale={locale} onDetected={handlePosBarcodeDetected} onClose={() => setBarcodeScannerOpen(false)} />}

        <WriteDisabledHint className="mb-5" />

        {testMode && groceryPos && (
          <section className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm" aria-live="polite">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900" aria-hidden="true">✓</span>
              <div>
                <h2 className="text-sm font-extrabold tracking-wide text-amber-950">{testCopy.banner}</h2>
                <p className="mt-1 text-xs leading-5 text-amber-900">{testCopy.description}</p>
              </div>
            </div>
          </section>
        )}
        {testMode && groceryPos && showTestBills && (
          <section className="mb-5 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm" aria-label={testCopy.history}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-950">{testCopy.history} <span className="text-amber-700">· {testBills.length}</span></h2>
                <p className="mt-1 text-xs text-slate-500">{testCopy.sharedInfo}</p>
              </div>
              <button type="button" onClick={() => void clearAllTestBills()} disabled={saving || testBills.length === 0} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">{testCopy.clear}</button>
            </div>
            {testBills.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">{testCopy.empty}</p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {testBills.map((bill) => (
                  <article key={bill.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-extrabold text-amber-800">{bill.billNo}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(bill.createdAt).toLocaleString(locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK")}</p>
                      <p className="mt-1 break-words text-xs text-slate-700">{bill.lines.map((line) => `${line.productName} × ${line.qty}`).join(" · ")}</p>
                      <p className="mt-1 font-mono text-sm font-extrabold text-slate-950">{formatLkr(bill.total)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" disabled={saving} onClick={() => editGroceryTestBill(bill)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">{testCopy.edit}</button>
                      <button type="button" disabled={saving} onClick={() => void deleteTestBill(bill)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60">{testCopy.remove}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">
            {message}
            {lastBillId && (
              <Link href={`/bills/${lastBillId}`} className="ml-2 font-bold underline">
                {t("sales.view_bill")}
              </Link>
            )}
          </div>
        )}

        <section className={`mt-4 grid gap-3 ${groceryPos ? "grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"}`}>
          {groceryPos && groceryLiveMetrics ? (
            <>
              <ProStatCard
                label={grocery("todaySales")}
                value={formatLkr(groceryLiveMetrics.intelligence.todaySales)}
                hint={groceryLiveMetrics.intelligence.todaySalesChangePct == null
                  ? groceryLiveMetrics.intelligence.todayTransactions > 0 ? grocery("completedToday") : grocery("noBillsYet")
                  : `${groceryLiveMetrics.intelligence.todaySalesChangePct >= 0 ? "▲" : "▼"} ${Math.abs(groceryLiveMetrics.intelligence.todaySalesChangePct).toFixed(0)}% ${locale === "si" ? "ඊයේට වඩා" : locale === "ta" ? "நேற்றை விட" : "vs yesterday"}`}
                icon={<SalesIcon className="h-5 w-5" />}
                tone="teal"
              />
              <ProStatCard
                label={grocery("billsGenerated")}
                value={String(groceryLiveMetrics.intelligence.todayTransactions)}
                hint={grocery("completedToday")}
                icon={<BillsIcon className="h-5 w-5" />}
                tone="slate"
              />
              <ProStatCard
                label={grocery("averageBill")}
                value={formatLkr(groceryLiveMetrics.intelligence.averageBasket)}
                hint={grocery("fromCheckout")}
                icon={<CostingIcon className="h-5 w-5" />}
                tone="emerald"
              />
              <ProStatCard
                label={grocery("itemsSold")}
                value={String(groceryLiveMetrics.itemsSold)}
                hint={grocery("todayBills")}
                icon={<SalesIcon className="h-5 w-5" />}
                tone="slate"
              />
            </>
          ) : (
            <>
              <ProStatCard
                label={t("sales.cart_items")}
                value={String(cartCount)}
                hint={lines.length ? `${lines.length} ${t("sales.product_lines")}` : t("sales.no_selected")}
                icon={<SalesIcon className="h-5 w-5" />}
                tone="teal"
              />
              <ProStatCard
                label={t("sales.gross")}
                value={formatLkr(gross)}
                hint={discountClamped > 0 ? `${t("sales.discount")} ${formatLkr(discountClamped)}` : t("sales.before_discount")}
                icon={<BillsIcon className="h-5 w-5" />}
                tone="slate"
              />
              <ProStatCard
                label={t("common.total")}
                value={formatLkr(netTotal)}
                hint={paymentSummaryLabel}
                icon={<CostingIcon className="h-5 w-5" />}
                tone="emerald"
              />
            </>
          )}
        </section>



        {inStock.length === 0 ? (
          <section className="mt-6">
            {groceryPos ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.14),transparent_34%),linear-gradient(105deg,#f8fbff,#ffffff_54%,#eef6ff)] px-5 py-4 shadow-[0_10px_28px_rgba(59,130,246,0.07)] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">{locale === "si" ? "නාමාවලිය සූදානම්" : locale === "ta" ? "பட்டியல் தயார்" : "Catalogue ready"}</span>
                  <h2 className="mt-1 text-base font-bold tracking-[-0.025em] text-slate-950">{locale === "si" ? "ආරම්භක භාණ්ඩ Stock හි ඇත" : locale === "ta" ? "தொடக்கப் பொருட்கள் கையிருப்பில் உள்ளன" : "Starter products are in Stock"}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{locale === "si" ? "විකිණීමට පෙර සැබෑ මිල, barcode සහ ලැබුණු තොගය ඇතුළත් කර සක්‍රිය කරන්න." : locale === "ta" ? "விற்பனைக்கு முன் உண்மையான விலை, barcode மற்றும் பெற்ற சரக்கை உள்ளிட்டு செயல்படுத்தவும்." : "Enter real prices, barcodes and received stock in Stock before activating these items for sale."}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <ProButton href="/stock" variant="secondary">{t("sales.add_stock_link")}</ProButton>
                </div>
              </div>
            ) : (
              <ProCard>
                <ProEmptyState
                  title={t("sales.no_stock")}
                  description={t("sales.add_stock_first_desc")}
                  action={<ProButton href="/stock">{t("sales.add_stock_link")}</ProButton>}
                />
              </ProCard>
            )}
          </section>
        ) : (
          <section className={`mt-5 grid gap-5 ${groceryPos ? "lg:grid-cols-[minmax(0,1fr)_minmax(340px,390px)]" : "xl:grid-cols-[1.45fr_0.85fr]"}`}>
            <div className="min-w-0 space-y-4">
              <ProCard
                title={t("sales.products_title")}
                eyebrow={t("sales.fast_checkout_eyebrow")}
                action={<ProBadge tone="emerald">{inStock.length} {groceryPos ? grocery("available") : "available"}</ProBadge>}
              >
                {!groceryPos && <div className="relative">
                  <input
                    type="search"
                    value={search}
                    autoFocus={fastRetail}
                    autoComplete="off"
                    onChange={(event) => {
                      setSearch(event.target.value);
                      if (fastRetail) setResultLimit(30);
                    }}
                    onKeyDown={(event) => {
                      if (!fastRetail) return;
                      if (event.key === "Enter" && quickAddCandidate) {
                        event.preventDefault();
                        addOne(quickAddCandidate);
                      }
                      if (event.key === "Escape") setSearch("");
                    }}
                    placeholder={
                      org.sector === "pharmacy"
                        ? (si ? "ඖෂධය, generic නම, brand, strength, code හෝ barcode…" : "Search medicine, generic, brand, strength, code or barcode…")
                        : fastRetail
                          ? (si ? "Barcode scan කරන්න හෝ භාණ්ඩය, brand හෝ code සොයන්න…" : "Scan barcode or search product, brand or code…")
                          : t("sales.search_placeholder")
                    }
                    className={`h-12 w-full rounded-xl border px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white ${groceryPos ? "border-blue-100 bg-blue-50/55 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" : "border-slate-200 bg-slate-50 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"}`}
                  />
                </div>}

                {fastRetail && (
                  <div className={`flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${groceryPos ? "" : "mt-3"}`}>
                    <button
                      type="button"
                      onClick={() => { setCategoryFilter("all"); setResultLimit(30); }}
                      className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${categoryFilter === "all" ? groceryPos ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md shadow-blue-200" : "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                    >
                      {groceryPos ? grocery("allProducts") : si ? "සියල්ල" : "All"} <span className="opacity-70">{inStock.length}</span>
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.name}
                        type="button"
                        onClick={() => { setCategoryFilter(category.name); setResultLimit(30); }}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${categoryFilter === category.name ? groceryPos ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md shadow-blue-200" : "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                      >
                        {groceryPos && <GroceryCategoryArt label={category.name} className="h-5 w-5" />}
                        {groceryPos ? groceryCategoryLabel(category.name, locale) : category.name} <span className="opacity-70">{category.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {conditionRelevant && (
                  <div className="mt-3 flex gap-2">
                    {(["all", "new", "used"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setConditionFilter(value)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${conditionFilter === value ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        {value === "all" ? t("stock.filter_all") : value === "new" ? t("stock.condition_new") : t("stock.condition_used")}
                      </button>
                    ))}
                  </div>
                )}
              </ProCard>

                {filtered.length === 0 ? (
                  <ProCard><ProEmptyState title={groceryPos ? categoryFilter === "all" ? grocery("noMatchingProducts") : grocery("emptyCategory") : t("sales.no_match")} description={groceryPos ? grocery("emptyCategoryHint") : t("sales.search_no_match_desc")} /></ProCard>
              ) : (
                <div className={fastRetail ? groceryPos ? "grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" : "grid gap-2 md:grid-cols-2 2xl:grid-cols-3" : "grid gap-3 md:grid-cols-2"}>
                  {visibleProducts.map((product) => {
                    const qty = cart[product.id] ?? 0;
                    const selected = qty > 0;
                    const selectedPrice = effectiveUnitPrice(product, customerId, data,
                      groceryPos && orgRole !== "owner" && orgRole !== "manager" ? undefined : priceOverrides[product.id]);
                    const unitPrice = groceryPos && selectedPrice <= 0 ? product.sellPrice : selectedPrice;
                    const rx = org.sector === "pharmacy" && boolField(product.customFields.requiresPrescription);
                    return (
                      <article
                        key={product.id}
                        className={`min-w-0 overflow-hidden rounded-2xl border bg-white transition ${groceryPos ? "shadow-[0_10px_26px_rgba(15,23,42,0.07)] hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_30px_rgba(37,99,235,0.13)]" : "p-4"} ${selected ? "border-teal-300 ring-2 ring-teal-100" : "border-slate-200 hover:border-teal-200"}`}
                      >
                        {groceryPos && (
                          <div className="relative h-24 overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#eff6ff_62%,#eef2ff_100%)]">
                            <GroceryProductArt name={product.name} sku={product.sku} barcode={typeof product.customFields.barcode === "string" ? product.customFields.barcode : undefined} category={product.category} imageUrl={typeof product.customFields.imageUrl === "string" ? product.customFields.imageUrl : undefined} className="h-full w-full" />
                            <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold text-slate-600 shadow-sm" title={groceryCategoryLabel(product.category, locale) || "Grocery"}>{groceryCategoryLabel(product.category, locale) || "Grocery"}</span>
                          </div>
                        )}
                        <div className={`${groceryPos ? "space-y-2 p-3" : "flex items-start justify-between gap-3"}`}>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className={`text-sm font-bold text-slate-950 ${groceryPos ? "break-normal leading-6 [overflow-wrap:normal]" : "truncate"}`}>{groceryPos ? groceryProductLabel(product, locale) : product.name}</h2>
                              {conditionRelevant && <ProductConditionBadge condition={product.condition} />}
                              {rx && <ProBadge tone="amber">Rx</ProBadge>}
                            </div>
                            <p className={`mt-1 text-xs font-semibold text-slate-500 ${groceryPos ? "break-normal leading-5 [overflow-wrap:normal]" : ""}`}>
                              {groceryPos
                                ? groceryUnitLabel(product.customFields.unitVariant ?? product.customFields.unit ?? "1 unit", locale)
                                : <>{product.sku ? `${product.sku} · ` : ""}{product.category || "General"}</>}
                            </p>
                            {org.sector === "pharmacy" && (
                              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
                                {[product.customFields.genericName, product.customFields.strength, product.customFields.brand, product.customFields.packSize]
                                  .filter(Boolean).map(String).join(" · ") || (si ? "Batch පාලිත තොග" : "Batch-controlled stock")}
                              </p>
                            )}
                          </div>
                          <div className={groceryPos ? "" : "shrink-0 text-right"}>
                            {groceryPos ? (
                              <p className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold leading-5 [overflow-wrap:normal] ${product.stockQty <= (product.reorderLevel ?? 0) ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{product.stockQty} {grocery("inStock")}</p>
                            ) : (
                              <>
                                <p className="text-sm font-bold text-slate-950">{formatLkr(unitPrice)}</p>
                                <p className="mt-1 text-[10px] font-semibold text-slate-400">{product.stockQty} in stock</p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className={`flex items-center justify-between gap-3 ${groceryPos ? "border-t border-slate-100 px-3 pb-3 pt-2.5" : "mt-4"}`}>
                          {groceryPos ? (
                            <>
                              <span className="font-mono text-base font-extrabold text-slate-950">{formatLkr(unitPrice)}</span>
                              <button
                                type="button"
                                aria-label={`${grocery("add")} ${groceryProductLabel(product, locale)}`}
                                onClick={() => addOne(product)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-xl font-semibold text-white shadow-[0_8px_16px_rgba(59,130,246,0.26)] transition hover:brightness-110 active:scale-95"
                              >+
                              </button>
                            </>
                          ) : <>
                          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            <button
                              type="button"
                              aria-label={`Decrease ${product.name}`}
                              onClick={() => setQty(product.id, qty - 1, product.stockQty)}
                              className="flex h-10 w-10 items-center justify-center text-lg font-bold text-slate-600 hover:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400"
                            >−</button>
                            <input
                              aria-label={`${product.name} quantity`}
                              type="number"
                              min={0}
                              max={product.stockQty}
                              step="any"
                              value={qty || ""}
                              onChange={(event) => setQty(product.id, Number(event.target.value), product.stockQty)}
                              className="h-10 w-14 border-x border-slate-200 bg-white text-center text-sm font-bold outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400"
                            />
                            <button
                              type="button"
                              aria-label={`Increase ${product.name}`}
                              onClick={() => setQty(product.id, qty + 1, product.stockQty)}
                              className="flex h-10 w-10 items-center justify-center text-lg font-bold text-teal-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400"
                            >+</button>
                          </div>
                          <span className="font-mono text-sm font-bold text-teal-700">{formatLkr(unitPrice * qty)}</span>
                          </>}
                        </div>
                      </article>
                    );
                  })}
                  {fastRetail && filtered.length > visibleProducts.length && (
                    <button
                      type="button"
                      onClick={() => setResultLimit((value) => value + 30)}
                      className="min-h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-left hover:border-teal-300 hover:bg-teal-50"
                    >
                      <span className="block text-sm font-bold text-slate-800">{groceryPos ? grocery("showMore") : si ? "තවත් භාණ්ඩ පෙන්වන්න" : "Show more products"}</span>
                      <span className="mt-1 block text-xs text-slate-500">{visibleProducts.length} / {filtered.length}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <aside id={groceryPos ? "grocery-checkout" : undefined} className="scroll-mt-24 space-y-4 lg:sticky lg:top-5 lg:self-start">
              <ProCard title={groceryPos ? grocery("cart") : t("sales.cart_title")} eyebrow={groceryPos ? grocery("checkout") : t("sales.checkout_eyebrow")}>
                {lines.length === 0 ? (
                  <ProEmptyState title={groceryPos ? grocery("noItemsSelected") : t("sales.no_selected")} description={groceryPos ? grocery("chooseProducts") : t("sales.choose_products_desc")} />
                ) : (
                  <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
                    {lines.map((line) => (
                      <div key={line.product.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 gap-2.5">
                            {groceryPos && (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50">
                                <GroceryProductArt
                                  name={line.product.name}
                                  sku={line.product.sku}
                                  barcode={typeof line.product.customFields.barcode === "string" ? line.product.customFields.barcode : undefined}
                                  category={line.product.category}
                                  imageUrl={typeof line.product.customFields.imageUrl === "string" ? line.product.customFields.imageUrl : undefined}
                                  className="h-full w-full p-1"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-950">{groceryPos ? groceryProductLabel(line.product, locale) : line.product.name}</p>
                              {groceryPos ? (
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                                    <button type="button" aria-label={`${grocery("decrease")} ${groceryProductLabel(line.product, locale)}`} onClick={() => setQty(line.product.id, line.qty - 1, line.product.stockQty)} className="flex h-7 w-7 items-center justify-center text-sm font-bold text-slate-600 hover:bg-slate-50">−</button>
                                    <span className="flex h-7 min-w-8 items-center justify-center border-x border-slate-200 px-1 text-xs font-bold text-slate-900">{line.qty}</span>
                                    <button type="button" aria-label={`${grocery("increase")} ${groceryProductLabel(line.product, locale)}`} onClick={() => setQty(line.product.id, line.qty + 1, testMode ? Number.MAX_SAFE_INTEGER : line.product.stockQty)} className="flex h-7 w-7 items-center justify-center text-sm font-bold text-teal-700 hover:bg-teal-50">+</button>
                                  </div>
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    {groceryQuantityLabel(line.qty, line.product.customFields.unitVariant ?? line.product.customFields.unit, locale)}
                                  </span>
                                </div>
                              ) : <p className="mt-0.5 text-xs font-semibold text-slate-500">× {line.qty}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <p className="shrink-0 font-mono text-sm font-bold text-slate-950">{formatLkr(line.unitPrice * line.qty)}</p>
                            {groceryPos && <button type="button" aria-label={`${grocery("removeItem")} ${groceryProductLabel(line.product, locale)}`} onClick={() => setQty(line.product.id, 0, line.product.stockQty)} className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">×</button>}
                          </div>
                        </div>
                        {(!groceryPos || orgRole === "owner" || orgRole === "manager") && <label className="mt-3 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                          {t("sales.unit_price")}
                          <input
                            type="number"
                            min={groceryPos ? 0.01 : 0}
                            step="any"
                            value={line.unitPrice}
                            onChange={(event) => {
                              setPriceOverrides((current) => ({ ...current, [line.product.id]: Math.max(groceryPos ? 0.01 : 0, Number(event.target.value)) }));
                              setPendingSaleId(null);
                            }}
                            className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-xs font-bold text-slate-700 outline-none focus:border-teal-300"
                          />
                        </label>}
                        {advancedRetail && (
                          <AdvancedSaleSelector
                            productId={line.product.id}
                            qty={line.qty}
                            value={inventoryStates[line.product.id]?.selection}
                            onChange={(next) => setInventoryStates((current) => ({ ...current, [line.product.id]: next }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 space-y-3 border-t border-slate-200 pt-5 text-sm font-semibold text-slate-600">
                  <div className="flex justify-between"><span>{t("sales.gross")}</span><span className="font-mono font-bold text-slate-950">{formatLkr(gross)}</span></div>
                  <label className="flex items-center justify-between gap-2">
                    <span>{t("sales.discount")}</span>
                    <input
                      type="number"
                      min={0}
                      max={gross}
                      value={discount || ""}
                      onChange={(event) => { setDiscount(Number(event.target.value)); setPendingSaleId(null); }}
                      className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-bold text-slate-900 outline-none focus:border-teal-300"
                    />
                  </label>
                  {billVat && (
                    <div className={`rounded-lg px-3 py-2.5 text-xs ${groceryPos ? "border border-violet-100 bg-violet-50 text-slate-700" : "bg-slate-900 text-slate-200"}`}>
                      <div className="flex justify-between"><span>{t("vat.taxable")}</span><span className="font-mono">{formatLkr(billVat.subtotal)}</span></div>
                      <div className={`mt-1 flex justify-between ${groceryPos ? "text-violet-700" : "text-teal-300"}`}><span>{t("vat.output_vat")} (18%)</span><span className="font-mono font-bold">{formatLkr(billVat.vat)}</span></div>
                    </div>
                  )}
                </div>

                <div className={`mt-5 rounded-xl p-4 ${groceryPos ? "border border-blue-100 bg-gradient-to-r from-sky-50 via-indigo-50 to-violet-50 text-slate-950 shadow-[0_10px_22px_rgba(59,130,246,0.08)]" : "bg-slate-950 text-white"}`}>
                  <p className={`text-xs font-bold uppercase tracking-[0.16em] ${groceryPos ? "text-blue-700" : "text-teal-300"}`}>{t("common.total")}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">{formatLkr(netTotal)}</p>
                </div>

                {!testMode && (
                  <div className="mt-5 space-y-4">
                  <label className="block text-sm font-bold text-slate-700">
                    {t("common.customer")}
                    <select
                      value={customerId}
                      onChange={(event) => resetPricingForCustomer(event.target.value)}
                      className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-300"
                    >
                      <option value="">{t("sales.walk_in_label")}</option>
                      {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customerOptionText(customer)}</option>)}
                    </select>
                  </label>

                  {!customerId && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-bold text-slate-700">
                        {t("sales.walkin_name")}
                        <input
                          value={walkInName}
                          onChange={(event) => { setWalkInName(event.target.value); setPendingSaleId(null); }}
                          className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300"
                        />
                      </label>
                      <label className="block text-sm font-bold text-slate-700">
                        {t("sales.walkin_phone")}
                        <input
                          type="tel"
                          inputMode="tel"
                          placeholder="07X XXX XXXX"
                          value={walkInPhone}
                          onChange={(event) => { setWalkInPhone(event.target.value); setPendingSaleId(null); }}
                          className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300"
                        />
                        {walkInPhone.trim() !== "" && !isValidSlMobile(walkInPhone) && (
                          <span className="mt-1 block text-xs font-semibold text-amber-600">{t("msg.phone_invalid")}</span>
                        )}
                      </label>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-bold text-slate-700">{t("common.payment")}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(PAYMENT_OPTIONS as CheckoutPayment[]).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            setPayment(method);
                            if (splitPayment && secondaryPayment === method) {
                              const alternate = (PAYMENT_OPTIONS as CheckoutPayment[]).find((item) => item !== method) ?? "cash";
                              setSecondaryPayment(alternate);
                            }
                            setPendingSaleId(null);
                          }}
                          className={`rounded-lg border px-3 py-3 text-sm font-bold transition ${payment === method ? "border-teal-300 bg-teal-50 text-teal-800 ring-2 ring-teal-100" : "border-slate-200 bg-white text-slate-600 hover:border-teal-200"}`}
                        >
                          {paymentLabel(t, method)}
                        </button>
                      ))}
                    </div>

                    <label className={`mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition ${splitPayment ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-slate-50"}`}>
                      <div>
                        <span className="block text-sm font-bold text-slate-800">{groceryPos ? grocery("splitPayment") : si ? "ගෙවීම දෙකට බෙදන්න" : "Split payment"}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{si ? "උදා: cash + card, cash + credit" : "For example cash + card or cash + customer credit"}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={splitPayment}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setSplitPayment(enabled);
                          if (enabled) {
                            if (secondaryPayment === payment) {
                              const alternate = (PAYMENT_OPTIONS as CheckoutPayment[]).find((item) => item !== payment) ?? "card";
                              setSecondaryPayment(alternate);
                            }
                            if (secondaryAmount === "" || Number(secondaryAmount) <= 0 || Number(secondaryAmount) >= netTotal) {
                              setSecondaryAmount(netTotal > 0 ? Math.round((netTotal / 2) * 100) / 100 : "");
                            }
                          }
                          setPendingSaleId(null);
                        }}
                        className="h-5 w-5 accent-teal-600"
                      />
                    </label>
                  </div>

                  {splitPayment && (
                    <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">{si ? "දෙවන ගෙවීම" : "Second payment"}</p>
                          <p className="mt-1 text-xs text-slate-500">{si ? "මෙම මුදල දෙවන ක්‍රමයට යයි. ඉතිරිය පළමු ක්‍රමයට." : "This amount uses the second method; the balance stays on the first."}</p>
                        </div>
                        <ProBadge tone="emerald">Mixed</ProBadge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(PAYMENT_OPTIONS as CheckoutPayment[])
                          .filter((method) => method !== payment)
                          .map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => { setSecondaryPayment(method); setPendingSaleId(null); }}
                              className={`rounded-lg border px-3 py-2.5 text-xs font-bold transition ${secondaryPayment === method ? "border-teal-300 bg-white text-teal-800 ring-2 ring-teal-100" : "border-slate-200 bg-white/70 text-slate-600 hover:border-teal-200"}`}
                            >
                              {paymentLabel(t, method)}
                            </button>
                          ))}
                      </div>

                      <label className="mt-3 block text-xs font-bold text-slate-600">
                        {si ? "දෙවන ගෙවීම් මුදල" : "Second payment amount"}
                        <input
                          type="number"
                          min={0.01}
                          max={Math.max(0.01, netTotal - 0.01)}
                          step="any"
                          value={secondaryAmount}
                          onChange={(event) => {
                            setSecondaryAmount(event.target.value === "" ? "" : Number(event.target.value));
                            setPendingSaleId(null);
                          }}
                          className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm font-bold text-slate-900 outline-none focus:border-teal-300"
                        />
                      </label>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                          <p className="font-semibold text-slate-500">{paymentLabel(t, payment)}</p>
                          <p className="mt-1 font-mono text-sm font-bold text-slate-900">{formatLkr(primaryTenderPreview)}</p>
                        </div>
                        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                          <p className="font-semibold text-slate-500">{paymentLabel(t, secondaryPayment)}</p>
                          <p className="mt-1 font-mono text-sm font-bold text-slate-900">{formatLkr(secondaryAmountValue)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {cashTenderPreview > 0 && netTotal > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>{si ? "Cash කොටස" : "Cash portion"}</span>
                        <span className="font-mono text-slate-800">{formatLkr(cashTenderPreview)}</span>
                      </div>
                      <label className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
                        <span>{t("sales.cash_received")}</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={cashReceived}
                          onChange={(event) => setCashReceived(event.target.value === "" ? "" : Number(event.target.value))}
                          className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-bold outline-none focus:border-teal-300"
                        />
                      </label>
                      {cashReceived !== "" && (
                        <div className="mt-3 flex justify-between text-sm font-bold text-teal-800"><span>{t("sales.change_due")}</span><span className="font-mono">{formatLkr(changeDue)}</span></div>
                      )}
                    </div>
                  )}

                  {(payment === "cheque" || (splitPayment && secondaryPayment === "cheque")) && (
                    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                      <label className="text-xs font-bold text-slate-600">Cheque no.
                        <input value={chequeNo} onChange={(event) => { setChequeNo(event.target.value); setPendingSaleId(null); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-300" />
                      </label>
                      <label className="text-xs font-bold text-slate-600">Bank
                        <select value={chequeBank} onChange={(event) => { setChequeBank(event.target.value); setPendingSaleId(null); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-300">
                          {LK_BANKS.map((bank) => <option key={bank}>{bank}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-bold text-slate-600">Cheque date
                        <input type="date" value={chequeDate} onChange={(event) => { setChequeDate(event.target.value); setPendingSaleId(null); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-300" />
                      </label>
                      <label className="flex min-h-10 items-center gap-2 self-end rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                        <input type="checkbox" checked={postDated} onChange={(event) => { setPostDated(event.target.checked); setPendingSaleId(null); }} /> Post-dated
                      </label>
                    </div>
                  )}

                  {lines.length > 0 && !testMode && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <a
                          href={quoteWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                        >
                          {t("bills.quote_whatsapp")}
                        </a>
                        {/* Was always just this one deep link — opens
                            WhatsApp with the quote pre-filled, but someone
                            still has to press Send by hand. When the real
                            WhatsApp API is available for this org, offer an
                            actual auto-send too instead of only the manual
                            open-and-send flow. */}
                        {canApiWhatsApp && (
                          <button
                            type="button"
                            disabled={sendingQuoteApi || !isValidSlMobile(recipientPhone)}
                            title={!isValidSlMobile(recipientPhone) ? t("msg.phone_invalid") : undefined}
                            onClick={() => void handleSendQuoteApi()}
                            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-4 text-sm font-bold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            🚀 {sendingQuoteApi ? t("msg.sending") : t("msg.send_api_whatsapp")}
                          </button>
                        )}
                      </div>
                      {quoteApiFeedback && (
                        quoteApiFeedback.ok ? (
                          <p className="text-center text-xs font-semibold text-emerald-700">{quoteApiFeedback.message}</p>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
                            <p className="font-semibold">{quoteApiFeedback.message}</p>
                            <Link
                              href="/settings/notifications"
                              className="mt-1 inline-block font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
                            >
                              {t("msg.configure_whatsapp_link")}
                            </Link>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={lines.length === 0 || !canWrite || saving || identityBlocked || netTotal <= 0}
                    title={!canWrite ? (disabledHint ?? undefined) : identityBlocked ? (si ? "Prescription / batch / variant / IMEI අවශ්‍යතා සම්පූර්ණ කරන්න" : "Complete prescription / inventory requirements") : undefined}
                    onClick={() => void handleSale()}
                    className="w-full rounded-lg bg-teal-600 py-4 text-sm font-bold text-white shadow-[0_8px_20px_rgba(13,148,136,0.2)] transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? t("common.saving") : identityBlocked ? (si ? "Checkout අවශ්‍යතා සම්පූර්ණ කරන්න" : "Complete checkout requirements") : groceryPos && testMode ? (editingTestBillId ? testCopy.update : testCopy.save) : groceryPos ? grocery("completed") : splitPayment ? (si ? "බෙදා ගෙවීමෙන් විකිණීම සම්පූර්ණ කරන්න" : "Complete split-payment sale") : t("sales.complete")}
                  </button>
                </div>
                )}
                {testMode && (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold leading-6 text-amber-950">{testCopy.noPayment}</p>
                    <button
                      type="button"
                      disabled={lines.length === 0 || !canWrite || saving || netTotal <= 0}
                      onClick={() => void handleSale()}
                      className="mt-3 w-full rounded-xl bg-amber-700 py-3.5 text-sm font-bold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? t("common.saving") : editingTestBillId ? testCopy.update : testCopy.save}
                    </button>
                  </div>
                )}
              </ProCard>
            </aside>
          </section>
        )}

        {data.sales.length > 0 && (
          <section className="mt-6">
            <ProCard title={t("sales.recent")} action={<ProBadge tone="slate">Latest 10</ProBadge>}>
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t("common.date")}</th>
                      <th className="px-4 py-3">{t("common.customer")}</th>
                      <th className="px-4 py-3">{t("common.payment")}</th>
                      <th className="px-4 py-3">{t("common.total")}</th>
                      {canSeeFinancials && <th className="px-4 py-3">{t("sales.profit")}</th>}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.slice(0, 10).map((sale) => (
                      <tr key={sale.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-600">{new Date(sale.date).toLocaleString("en-LK")}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{sale.customerName || "—"}</td>
                        <td className="px-4 py-3"><ProBadge tone="slate">{sale.paymentMethod === "mixed" ? (si ? "බෙදා ගෙවීම" : "Mixed") : paymentLabel(t, sale.paymentMethod)}</ProBadge></td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{formatLkr(sale.total)}</td>
                        {canSeeFinancials && <td className="px-4 py-3 font-mono font-bold text-teal-700">{formatLkr(sale.profit)}</td>}
                        <td className="px-4 py-3 text-right"><Link href={`/bills/${sale.id}`} className="font-bold text-teal-700 hover:underline">{t("sales.bill")}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ProCard>
          </section>
        )}
      </ProMain>

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-xl safe-area-pb xl:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            {groceryPos ? (
              <button
                type="button"
                onClick={() => setMobileCartOpen(true)}
                aria-label={locale === "si" ? "බිල්පත් අයිතම බලන්න" : locale === "ta" ? "பில் பொருட்களைப் பார்க்க" : "View bill items"}
                className="min-w-0 flex-1 rounded-xl py-1 text-left transition hover:bg-slate-50 active:scale-[0.99]"
              >
                {lines[0] && <p className="max-w-[52vw] truncate text-[11px] font-bold text-slate-600">{groceryProductLabel(lines[0].product, locale)}</p>}
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{cartCount} {locale === "si" ? "භාණ්ඩ" : locale === "ta" ? "பொருட்கள்" : cartCount === 1 ? "item" : "items"} · {locale === "si" ? "භාණ්ඩ බලන්න" : locale === "ta" ? "பொருட்களைப் பார்க்க" : "View items"}</p>
                <p className="text-lg font-bold text-slate-950">{formatLkr(netTotal)}</p>
                {splitPayment && <p className="text-[10px] font-bold tracking-wide text-teal-600">{si ? "බෙදා ගෙවීම" : "Split payment"}</p>}
              </button>
            ) : (
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{cartCount} items</p>
                <p className="text-lg font-bold text-slate-950">{formatLkr(netTotal)}</p>
                {splitPayment && <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600">{si ? "බෙදා ගෙවීම" : "Split payment"}</p>}
              </div>
            )}
            <button
              type="button"
              disabled={!canWrite || saving || identityBlocked || netTotal <= 0}
              onClick={() => void handleSale()}
              className="rounded-lg bg-teal-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? t("common.saving") : identityBlocked ? (si ? "අවශ්‍යතා" : "Requirements") : groceryPos && testMode ? (editingTestBillId ? testCopy.update : testCopy.save) : t("sales.complete")}
            </button>
          </div>
        </div>
      )}
      {mobileCartOpen && groceryPos && lines.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center xl:hidden">
          <button
            type="button"
            aria-label={locale === "si" ? "වසා දමන්න" : locale === "ta" ? "மூடு" : "Close cart"}
            onClick={() => setMobileCartOpen(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-cart-title"
            className="relative z-10 flex max-h-[82dvh] w-full max-w-2xl flex-col rounded-t-[28px] border border-slate-200 bg-white shadow-[0_-18px_55px_rgba(15,23,42,0.2)] safe-area-pb"
          >
            <div className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-200" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{locale === "si" ? "වත්මන් බිල්පත" : locale === "ta" ? "தற்போதைய பில்" : "CURRENT BILL"}</p>
                  <h2 id="mobile-cart-title" className="mt-1 text-xl font-extrabold text-slate-950">
                    {locale === "si" ? "භාණ්ඩ ලැයිස්තුව" : locale === "ta" ? "பொருள் பட்டியல்" : "Your items"}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {cartCount} {locale === "si" ? "භාණ්ඩ" : locale === "ta" ? "பொருட்கள்" : cartCount === 1 ? "item" : "items"} · {formatLkr(netTotal)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileCartOpen(false)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  {locale === "si" ? "වසා දමන්න" : locale === "ta" ? "மூடு" : "Close"}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3">
              {lines.map((line) => {
                const productName = groceryProductLabel(line.product, locale);
                const unit = line.product.customFields.unitVariant ?? line.product.customFields.unit;
                const maxQty = testMode ? Number.MAX_SAFE_INTEGER : line.product.stockQty;
                return (
                  <article key={line.product.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-50">
                      <GroceryProductArt
                        name={line.product.name}
                        category={line.product.category}
                        imageUrl={typeof line.product.customFields.imageUrl === "string" ? line.product.customFields.imageUrl : undefined}
                        className="h-full w-full p-1"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-slate-950">{productName}</p>
                      <p className="mt-1 truncate text-xs font-medium text-slate-500">{groceryQuantityLabel(line.qty, unit, locale)} · {formatLkr(line.unitPrice)} {locale === "si" ? "එකකට" : locale === "ta" ? "ஒன்றுக்கு" : "each"}</p>
                      <p className="mt-1 font-mono text-sm font-extrabold text-slate-900">{formatLkr(line.unitPrice * line.qty)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={locale === "si" ? `${productName} ප්‍රමාණය අඩු කරන්න` : locale === "ta" ? `${productName} அளவைக் குறை` : `Decrease ${productName} quantity`}
                        onClick={() => setQty(line.product.id, line.qty - 1, maxQty)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-bold text-slate-700 hover:bg-slate-50"
                      >−</button>
                      <button
                        type="button"
                        aria-label={locale === "si" ? `${productName} ප්‍රමාණය වැඩි කරන්න` : locale === "ta" ? `${productName} அளவை அதிகரி` : `Increase ${productName} quantity`}
                        disabled={line.qty >= maxQty}
                        onClick={() => setQty(line.product.id, line.qty + 1, maxQty)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >+</button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">{locale === "si" ? "මුළු එකතුව" : locale === "ta" ? "மொத்தம்" : "Total"}</span>
                <span className="font-mono text-xl font-extrabold text-slate-950">{formatLkr(netTotal)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setMobileCartOpen(false); setBarcodeScannerOpen(true); }}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-extrabold text-emerald-800 hover:bg-emerald-100"
                >
                  {locale === "si" ? "තවත් ස්කෑන්" : locale === "ta" ? "அடுத்ததை ஸ்கேன்" : "Scan next"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileCartOpen(false);
                    window.setTimeout(() => document.getElementById("grocery-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                  }}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-extrabold text-white hover:bg-slate-800"
                >
                  {locale === "si" ? "බිල්පත බලන්න" : locale === "ta" ? "பில்லைப் பார்க்க" : "Review bill"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {draftDialogOpen && org.id && data && (
        <HeldSaleDraftsDialog
          organizationId={org.id}
          locale={locale}
          onClose={closeHeldBills}
          onResume={resumeHeldBill}
        />
      )}
    </AppShell>
  );
}
