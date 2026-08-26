"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { setBottomBarOccupied } from "@/components/shell/bottom-bar-overlay";
import { ProBadge, ProButton, ProCard, ProEmptyState, ProLoadingState, ProMain, ProPageHeader } from "@/components/ui/pro-shell";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { buildCheckoutTenders, type CheckoutTenderKind } from "@/lib/retail-tender-checkout";
import { validateSaleTenders } from "@/lib/sale-tender";
import { saveAppData } from "@/lib/store/storage";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { pullBusinessData } from "@/lib/supabase/business-sync";
import { fetchTextileReservations, type TextileReservation } from "@/lib/supabase/textile-cutting-client";
import { fetchTextileRolls, finalizeTextileSale, type TextileRollRecord, type TextileSaleAllocationDraft } from "@/lib/supabase/textile-roll-client";
import { textileUnitPrice, type TextileSaleChannel } from "@/lib/textile-pricing";

type CartLine = TextileSaleAllocationDraft & { id: string; productId: string; productName: string; rollNo: string; unit: "metre" | "yard"; priceSource: string };
const field = "text-xs font-semibold text-slate-600";
const input = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50";

const TEXTILE_POS_COPY = {
  en: {
    loading: "Loading Textile POS…", eyebrow: "Textile POS", title: "Wholesale & retail fabric sale",
    description: "Sell a complete roll or an exact measured cut. Invoice, payment and roll balance commit in one transaction.", atomic: "Atomic roll checkout", rolls: "Fabric rolls",
    noRolls: "No physical rolls available", noRollsHint: "Receive fabric rolls before creating a measured Textile sale.", receive: "Receive first roll",
    build: "Build sale line", selection: "Roll selection", mode: "Textile sale mode", retail: "Retail cut", wholesale: "Wholesale cut", full: "Full roll", fullBlocked: "Reserved material prevents full-roll sale",
    reservedOrder: "Reserved order (optional)", walkInSale: "New walk-in / unreserved sale", unrecorded: "unrecorded", scan: "Scan or search roll", scanHint: "Roll number, barcode or dye lot",
    fabric: "Fabric", allFabrics: "All fabrics", physicalRoll: "Physical roll *", selectRoll: "Select roll", noMatch: "No matching sellable rolls", dye: "Dye", shade: "Shade", available: "available",
    customer: "Customer", walkInCustomer: "Walk-in customer", company: "Company", walkInName: "Walk-in name", fullQty: "Full-roll quantity", measuredQty: "Measured quantity", managerPrice: "Manager price override",
    appliedPrice: "Applied unit price", addAllocation: "Add roll allocation", allocated: "Allocated rolls", cart: "Sale cart", line: "line", lines: "lines", noCuts: "No roll cuts added.", remove: "Remove",
    paymentCheckout: "Payment & checkout", settlement: "Settlement", discount: "Invoice discount", primaryPayment: "Primary payment", split: "Split payment", secondPayment: "Second payment", secondAmount: "Second amount",
    chequeNo: "Cheque number", bank: "Bank", chequeDate: "Cheque date", postDated: "Post-dated cheque", amountDue: "Amount due", finalizing: "Finalizing…", finalize: "Finalize Textile sale",
    atomicHint: "The invoice is created only if every selected roll can be deducted at checkout time.", allocations: "roll allocations", reviewPayment: "Review payment", reviewSales: "Need to review completed sales?", openBills: "Open bills",
    invalidQty: "Select a roll and enter a valid measured quantity.", onlyAvailable: "Only {quantity} {unit} is available on this roll.", creditLimit: "Customer credit limit would be exceeded.", checkoutFailed: "Textile checkout failed.",
    completed: "Sale completed", completedHint: "Invoice, payment and physical rolls committed together.", removeLabel: "Remove {fabric}, roll {roll}",
    cash: "Cash", card: "Card", bankTransfer: "Bank transfer", cheque: "Cheque", credit: "Credit", manual: "Manager price", customerPrice: "Customer price", wholesalePrice: "Wholesale price", retailPrice: "Retail price",
    metre: "metre", yard: "yard", retailCut: "retail cut", wholesaleCut: "wholesale cut", fullRollMode: "full roll",
  },
  si: {
    loading: "රෙදිපිළි POS පූරණය වෙමින්…", eyebrow: "රෙදිපිළි POS", title: "තොග සහ සිල්ලර රෙදි අලෙවිය",
    description: "සම්පූර්ණ රෝලක් හෝ නිශ්චිතව මැනූ කොටසක් විකුණන්න. ඉන්වොයිසිය, ගෙවීම සහ රෝල් ශේෂය එකම ගනුදෙනුවකින් සුරැකේ.", atomic: "ආරක්ෂිත රෝල් checkout", rolls: "රෙදි රෝල්",
    noRolls: "විකිණීමට රෙදි රෝල් නැත", noRollsHint: "මැනූ රෙදි අලෙවියක් කිරීමට පෙර රෝල් භාරගන්න.", receive: "පළමු රෝල භාරගන්න",
    build: "විකුණුම් අයිතමය සකසන්න", selection: "රෝල තේරීම", mode: "රෙදි අලෙවි ක්‍රමය", retail: "සිල්ලර කැපුම", wholesale: "තොග කැපුම", full: "සම්පූර්ණ රෝල", fullBlocked: "වෙන් කළ රෙදි ඇති නිසා සම්පූර්ණ රෝල විකිණිය නොහැක",
    reservedOrder: "වෙන් කළ ඇණවුම (විකල්ප)", walkInSale: "නව සෘජු / වෙන් නොකළ අලෙවිය", unrecorded: "සටහන් කර නැත", scan: "රෝල scan කරන්න හෝ සොයන්න", scanHint: "රෝල් අංකය, barcode හෝ dye lot",
    fabric: "රෙදි වර්ගය", allFabrics: "සියලු රෙදි", physicalRoll: "භෞතික රෝල *", selectRoll: "රෝල තෝරන්න", noMatch: "ගැළපෙන විකිණිය හැකි රෝල් නැත", dye: "Dye lot", shade: "වර්ණ සෙවන", available: "ලබා ගත හැක",
    customer: "ගනුදෙනුකරු", walkInCustomer: "සෘජු ගනුදෙනුකරු", company: "සමාගම", walkInName: "ගනුදෙනුකරුගේ නම", fullQty: "සම්පූර්ණ රෝල් ප්‍රමාණය", measuredQty: "මැනූ ප්‍රමාණය", managerPrice: "කළමනාකරුගේ මිල වෙනස් කිරීම",
    appliedPrice: "අදාළ ඒකක මිල", addAllocation: "රෝල් කොටස එකතු කරන්න", allocated: "වෙන් කළ රෝල්", cart: "විකුණුම් කරත්තය", line: "අයිතමය", lines: "අයිතම", noCuts: "රෝල් කැපුම් එකතු කර නැත.", remove: "ඉවත් කරන්න",
    paymentCheckout: "ගෙවීම සහ checkout", settlement: "ගෙවීම් විස්තර", discount: "ඉන්වොයිස් වට්ටම", primaryPayment: "ප්‍රධාන ගෙවීම", split: "ගෙවීම බෙදන්න", secondPayment: "දෙවන ගෙවීම", secondAmount: "දෙවන මුදල",
    chequeNo: "චෙක් අංකය", bank: "බැංකුව", chequeDate: "චෙක් දිනය", postDated: "ඉදිරි දින චෙක්පත", amountDue: "ගෙවිය යුතු මුදල", finalizing: "අවසන් කරමින්…", finalize: "රෙදි අලෙවිය අවසන් කරන්න",
    atomicHint: "තෝරාගත් සෑම රෝලකින්ම නිවැරදි ප්‍රමාණය අඩු කළ හැකි නම් පමණක් ඉන්වොයිසිය සාදයි.", allocations: "රෝල් කොටස්", reviewPayment: "ගෙවීම පරීක්ෂා කරන්න", reviewSales: "සම්පූර්ණ කළ විකුණුම් බලන්නද?", openBills: "බිල්පත් විවෘත කරන්න",
    invalidQty: "රෝලක් තෝරා වලංගු මැනූ ප්‍රමාණයක් ඇතුළත් කරන්න.", onlyAvailable: "මෙම රෝලේ {quantity} {unit} පමණක් ඇත.", creditLimit: "ගනුදෙනුකරුගේ ණය සීමාව ඉක්මවයි.", checkoutFailed: "රෙදි අලෙවිය අවසන් කළ නොහැකි විය.",
    completed: "විකුණුම සම්පූර්ණයි", completedHint: "ඉන්වොයිසිය, ගෙවීම සහ භෞතික රෝල් එකවර සුරැකිණි.", removeLabel: "{fabric}, රෝල {roll} ඉවත් කරන්න", cash: "මුදල්", card: "කාඩ්", bankTransfer: "බැංකු මාරුව", cheque: "චෙක්", credit: "ණය", manual: "කළමනාකරුගේ මිල", customerPrice: "ගනුදෙනුකරුගේ මිල", wholesalePrice: "තොග මිල", retailPrice: "සිල්ලර මිල",
    metre: "මීටර්", yard: "යාර", retailCut: "සිල්ලර කැපුම", wholesaleCut: "තොග කැපුම", fullRollMode: "සම්පූර්ණ රෝල",
  },
  ta: {
    loading: "துணி POS ஏற்றப்படுகிறது…", eyebrow: "துணி POS", title: "மொத்த & சில்லறை துணி விற்பனை",
    description: "முழு Roll ஒன்றை அல்லது துல்லியமாக அளவிடப்பட்ட வெட்டை விற்கவும். இன்வாய்ஸ், கட்டணம் மற்றும் Roll இருப்பு ஒரே பரிவர்த்தனையில் உறுதிப்படுத்தப்படும்.", atomic: "பாதுகாப்பான Roll checkout", rolls: "துணி Rolls",
    noRolls: "விற்பனைக்கு துணி Rolls இல்லை", noRollsHint: "அளவிடப்பட்ட துணி விற்பனையை உருவாக்குவதற்கு முன் துணி Rolls-ஐப் பெறவும்.", receive: "முதல் Roll-ஐப் பெறவும்",
    build: "விற்பனை வரியை உருவாக்கு", selection: "Roll தேர்வு", mode: "துணி விற்பனை முறை", retail: "சில்லறை வெட்டு", wholesale: "மொத்த வெட்டு", full: "முழு Roll", fullBlocked: "ஒதுக்கப்பட்ட பொருள் முழு-Roll விற்பனையைத் தடுக்கிறது",
    reservedOrder: "ஒதுக்கப்பட்ட ஆர்டர் (விருப்பத்தேர்வு)", walkInSale: "புதிய நேரடி / ஒதுக்கப்படாத விற்பனை", unrecorded: "பதிவு செய்யப்படவில்லை", scan: "Roll-ஐ ஸ்கேன் செய் அல்லது தேடு", scanHint: "Roll எண், பார்கோடு அல்லது dye lot",
    fabric: "துணி", allFabrics: "அனைத்து துணிகளும்", physicalRoll: "பருநிலை Roll *", selectRoll: "Roll-ஐத் தேர்ந்தெடுக்கவும்", noMatch: "பொருந்தும் விற்கக்கூடிய Rolls இல்லை", dye: "Dye lot", shade: "நிறச்சாயல்", available: "கிடைக்கிறது",
    customer: "வாடிக்கையாளர்", walkInCustomer: "நேரடி வாடிக்கையாளர்", company: "நிறுவனம்", walkInName: "வாடிக்கையாளர் பெயர்", fullQty: "முழு-Roll அளவு", measuredQty: "அளவிடப்பட்ட அளவு", managerPrice: "மேலாளர் விலை மாற்றம்",
    appliedPrice: "பயன்படுத்தப்பட்ட அலகு விலை", addAllocation: "Roll ஒதுக்கீட்டைச் சேர்", allocated: "ஒதுக்கப்பட்ட Rolls", cart: "விற்பனை கூடை", line: "வரி", lines: "வரிகள்", noCuts: "Roll வெட்டுகள் எதுவும் சேர்க்கப்படவில்லை.", remove: "அகற்று",
    paymentCheckout: "கட்டணம் & checkout", settlement: "தீர்வு", discount: "இன்வாய்ஸ் தள்ளுபடி", primaryPayment: "முதன்மை கட்டணம்", split: "பிரிக்கப்பட்ட கட்டணம்", secondPayment: "இரண்டாவது கட்டணம்", secondAmount: "இரண்டாவது தொகை",
    chequeNo: "காசோலை எண்", bank: "வங்கி", chequeDate: "காசோலை தேதி", postDated: "பிந்தைய தேதி காசோலை", amountDue: "செலுத்த வேண்டிய தொகை", finalizing: "இறுதி செய்கிறது…", finalize: "துணி விற்பனையை முடிக்கவும்",
    atomicHint: "தேர்ந்தெடுக்கப்பட்ட ஒவ்வொரு Roll-ஐயும் checkout நேரத்தில் கழிக்க முடிந்தால் மட்டுமே இன்வாய்ஸ் உருவாக்கப்படும்.", allocations: "Roll ஒதுக்கீடுகள்", reviewPayment: "கட்டணத்தை மறுபரிசீலனை செய்", reviewSales: "முடிந்த விற்பனைகளை மறுபரிசீலனை செய்ய வேண்டுமா?", openBills: "பில்களைத் திற",
    invalidQty: "ஒரு Roll-ஐத் தேர்ந்தெடுத்து சரியான அளவிடப்பட்ட அளவை உள்ளிடவும்.", onlyAvailable: "இந்த Roll-இல் {quantity} {unit} மட்டுமே உள்ளது.", creditLimit: "வாடிக்கையாளர் கடன் வரம்பு மீறப்படும்.", checkoutFailed: "துணி checkout தோல்வியடைந்தது.",
    completed: "விற்பனை முடிந்தது", completedHint: "இன்வாய்ஸ், கட்டணம் மற்றும் பருநிலை Rolls ஒன்றாக உறுதிப்படுத்தப்பட்டன.", removeLabel: "{fabric}, roll {roll} ஐ அகற்று",
    cash: "பணம்", card: "அட்டை", bankTransfer: "வங்கி பரிமாற்றம்", cheque: "காசோலை", credit: "கடன்", manual: "மேலாளர் விலை", customerPrice: "வாடிக்கையாளர் விலை", wholesalePrice: "மொத்த விலை", retailPrice: "சில்லறை விலை",
    metre: "மீட்டர்", yard: "யார்டு", retailCut: "சில்லறை வெட்டு", wholesaleCut: "மொத்த வெட்டு", fullRollMode: "முழு Roll",
  },
} as const;

function clientId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function productByIdSafe(products: Array<{ id: string; name: string }>, productId: string, fallback: string): string {
  return products.find((product) => product.id === productId)?.name ?? fallback;
}

const SINHALA_TENDER_ERRORS: Record<string, string> = {
  "Sale total must be greater than zero.": "විකුණුම් එකතුව බිංදුවට වඩා වැඩි විය යුතුය.",
  "Choose two different payment methods for a split payment.": "බෙදුණු ගෙවීම සඳහා වෙනස් ගෙවීම් ක්‍රම දෙකක් තෝරන්න.",
  "Split payment amount must be greater than zero and below the invoice total.": "දෙවන ගෙවීම බිංදුවට වඩා වැඩි සහ ඉන්වොයිස් එකතුවට වඩා අඩු විය යුතුය.",
  "Add at least one payment tender.": "අවම වශයෙන් එක් ගෙවීමක් එකතු කරන්න.",
  "Each payment tender must have a unique id.": "සෑම ගෙවීමකටම අනන්‍ය අංකයක් අවශ්‍යයි.",
  "Every payment tender must have a positive amount.": "සෑම ගෙවීමකම මුදල බිංදුවට වඩා වැඩි විය යුතුය.",
  "Credit payment requires a customer account.": "ණය ගෙවීම සඳහා ලියාපදිංචි ගනුදෙනුකරුවෙකු අවශ්‍යයි.",
  "Cheque payment requires cheque number, bank and date.": "චෙක් ගෙවීම සඳහා චෙක් අංකය, බැංකුව සහ දිනය අවශ්‍යයි.",
  "Payment allocation does not cover the full sale total.": "ගෙවීම් එකතුව සම්පූර්ණ විකුණුම් මුදල ආවරණය නොකරයි.",
  "Payment allocation exceeds the sale total.": "ගෙවීම් එකතුව විකුණුම් මුදල ඉක්මවයි.",
};

const TAMIL_TENDER_ERRORS: Record<string, string> = {
  "Sale total must be greater than zero.": "விற்பனை மொத்தம் பூஜ்ஜியத்தை விட அதிகமாக இருக்க வேண்டும்.",
  "Choose two different payment methods for a split payment.": "பிரிக்கப்பட்ட கட்டணத்திற்கு இரண்டு வெவ்வேறு கட்டண முறைகளைத் தேர்ந்தெடுக்கவும்.",
  "Split payment amount must be greater than zero and below the invoice total.": "இரண்டாவது கட்டணத் தொகை பூஜ்ஜியத்தை விட அதிகமாகவும் இன்வாய்ஸ் மொத்தத்தை விடக் குறைவாகவும் இருக்க வேண்டும்.",
  "Add at least one payment tender.": "குறைந்தது ஒரு கட்டணத்தையாவது சேர்க்கவும்.",
  "Each payment tender must have a unique id.": "ஒவ்வொரு கட்டணத்திற்கும் தனித்துவமான ஐடி இருக்க வேண்டும்.",
  "Every payment tender must have a positive amount.": "ஒவ்வொரு கட்டணத் தொகையும் பூஜ்ஜியத்தை விட அதிகமாக இருக்க வேண்டும்.",
  "Credit payment requires a customer account.": "கடன் கட்டணத்திற்கு பதிவுசெய்யப்பட்ட வாடிக்கையாளர் கணக்கு தேவை.",
  "Cheque payment requires cheque number, bank and date.": "காசோலை கட்டணத்திற்கு காசோலை எண், வங்கி மற்றும் தேதி தேவை.",
  "Payment allocation does not cover the full sale total.": "கட்டண ஒதுக்கீடு முழு விற்பனைத் தொகையையும் ஈடுசெய்யவில்லை.",
  "Payment allocation exceeds the sale total.": "கட்டண ஒதுக்கீடு விற்பனைத் தொகையை மீறுகிறது.",
};

export function TextileSalesPage() {
  const { locale } = useLocale();
  const copy = TEXTILE_POS_COPY[locale];
  const tenderLabel = (kind: string) => ({ cash: copy.cash, card: copy.card, bank_transfer: copy.bankTransfer, cheque: copy.cheque, credit: copy.credit }[kind] ?? kind);
  const tenderError = (error: string) =>
    locale === "si" ? SINHALA_TENDER_ERRORS[error] ?? error : locale === "ta" ? TAMIL_TENDER_ERRORS[error] ?? error : error;
  const priceSourceLabel = (source?: string) => ({ manual: copy.manual, customer: copy.customerPrice, wholesale: copy.wholesalePrice, retail: copy.retailPrice }[source ?? ""] ?? copy.selectRoll);
  const saleModeLabel = (mode: string) => ({ retail_cut: copy.retailCut, wholesale_cut: copy.wholesaleCut, full_roll: copy.fullRollMode }[mode] ?? mode.replaceAll("_", " "));
  const unitLabel = (unit: "metre" | "yard") => unit === "metre" ? copy.metre : copy.yard;
  const { data, ready } = useAppStore();
  const { org } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const [rolls, setRolls] = useState<TextileRollRecord[]>([]);
  const [reservations, setReservations] = useState<TextileReservation[]>([]);
  const [loadingRolls, setLoadingRolls] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [channel, setChannel] = useState<TextileSaleChannel>("retail");
  const [productId, setProductId] = useState("");
  const [rollId, setRollId] = useState("");
  const [rollSearch, setRollSearch] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fullRoll, setFullRoll] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  // Tell the shared mobile bottom nav to step aside only while our own
  // fixed settlement bar is actually showing (cart non-empty) — see
  // bottom-bar-overlay.ts.
  useEffect(() => {
    setBottomBarOccupied(cart.length > 0);
    return () => setBottomBarOccupied(false);
  }, [cart.length]);
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<CheckoutTenderKind>("cash");
  const [split, setSplit] = useState(false);
  const [secondaryPayment, setSecondaryPayment] = useState<CheckoutTenderKind>("card");
  const [secondaryAmount, setSecondaryAmount] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState(LK_BANKS[0]);
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [postDated, setPostDated] = useState(false);
  const canOverride = org.role === "owner" || org.role === "manager";

  useEffect(() => {
    if (!org.id) return;
    let cancelled = false;
    setLoadingRolls(true);
    void Promise.all([fetchTextileRolls(org.id, false), fetchTextileReservations(org.id, true)]).then(([result, reservationResult]) => {
      if (cancelled) return;
      setLoadingRolls(false);
      if (result.error) setMessage(result.error);
      else if (reservationResult.error) setMessage(reservationResult.error);
      else { setRolls(result.data); setReservations(reservationResult.data); }
    });
    return () => { cancelled = true; };
  }, [org.id]);

  const products = useMemo(() => (data?.products ?? []).filter((p) => p.active && p.sectorId === "textile"), [data?.products]);
  const sellableRolls = rolls.filter((r) => r.custodyStatus === "available" && !["quarantined", "returned", "exhausted"].includes(r.status) && r.remainingLength - r.reservedLength > 0 && (!productId || r.productId === productId));
  const normalizedRollSearch = rollSearch.trim().toLowerCase();
  const visibleSellableRolls = normalizedRollSearch
    ? sellableRolls.filter((roll) =>
        roll.rollNo.toLowerCase().includes(normalizedRollSearch) ||
        (roll.barcode ?? "").toLowerCase().includes(normalizedRollSearch) ||
        (roll.dyeLot ?? "").toLowerCase().includes(normalizedRollSearch),
      )
    : sellableRolls;
  const selectedReservation = reservations.find((row) => row.id === reservationId);
  const selectedRoll = rolls.find((r) => r.id === rollId && (selectedReservation ? r.id === selectedReservation.rollId : sellableRolls.some((sellable) => sellable.id === r.id)));
  const selectedProduct = products.find((p) => p.id === (productId || selectedRoll?.productId));
  const available = selectedReservation?.quantity ?? (selectedRoll ? selectedRoll.remainingLength - selectedRoll.reservedLength : 0);
  const saleQty = fullRoll ? available : Number(quantity || 0);
  const priceResolution = selectedProduct && data ? textileUnitPrice({
    product: selectedProduct,
    quantity: saleQty,
    channel: fullRoll ? "wholesale" : channel,
    customerId: customerId || undefined,
    data,
    manualOverride: manualPrice === "" ? undefined : Number(manualPrice),
    canOverride,
  }) : null;

  useEffect(() => {
    if (!reservationId && productId && !sellableRolls.some((r) => r.id === rollId)) setRollId("");
  }, [productId, rollId, sellableRolls, reservationId]);

  const gross = cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discountValue = Math.min(Math.max(0, Number(discount) || 0), gross);
  const total = Math.round((gross - discountValue + Number.EPSILON) * 100) / 100;

  function addLine() {
    if (!selectedRoll || !selectedProduct || !priceResolution || saleQty <= 0) return setMessage(copy.invalidQty);
    const already = cart.filter((line) => line.rollId === selectedRoll.id).reduce((sum, line) => sum + line.quantity, 0);
    if (saleQty + already > available) return setMessage(copy.onlyAvailable.replace("{quantity}", available.toFixed(3)).replace("{unit}", selectedRoll.lengthUnit));
    setCart((current) => [...current, {
      id: clientId("line"), rollId: selectedRoll.id, productId: selectedProduct.id,
      productName: selectedProduct.name, rollNo: selectedRoll.rollNo,
      quantity: saleQty, unitPrice: priceResolution.price,
      saleMode: fullRoll ? "full_roll" : channel === "wholesale" ? "wholesale_cut" : "retail_cut",
      unit: selectedRoll.lengthUnit, priceSource: priceResolution.source, reservationId: selectedReservation?.id,
    }]);
    setQuantity(""); setManualPrice(""); setFullRoll(false); setReservationId(""); setRollSearch(""); setMessage("");
  }

  async function checkout() {
    if (!data || !org.id || !canWrite || cart.length === 0 || total <= 0) return;
    const saleId = clientId("sale");
    const plan = buildCheckoutTenders({
      saleTotal: total, primaryKind: payment, primaryId: `${saleId}-t1`, split,
      secondaryKind: secondaryPayment, secondaryAmount: Number(secondaryAmount || 0), secondaryId: `${saleId}-t2`,
      cheque: { chequeNo, chequeBank, chequeDate, postDated },
    });
    if (plan.error) return setMessage(tenderError(plan.error));
    const errors = validateSaleTenders(plan.tenders, { saleTotal: total, hasCustomerAccount: Boolean(customerId) });
    if (errors.length) return setMessage(tenderError(errors[0]));
    const customer = data.customers.find((row) => row.id === customerId);
    if (plan.creditTenderAmount > 0 && customer?.creditLimit != null && customer.creditBalance + plan.creditTenderAmount > customer.creditLimit) {
      return setMessage(copy.creditLimit);
    }
    setSaving(true); setMessage("");
    const result = await finalizeTextileSale(org.id, {
      saleId, customerId: customerId || undefined, customerName: customer?.name ?? walkInName,
      discount: discountValue,
      allocations: cart.map(({ rollId: id, quantity: qty, unitPrice, saleMode, reservationId: reserved }) => ({ rollId: id, quantity: qty, unitPrice, saleMode, reservationId: reserved })),
      tenders: plan.tenders,
    });
    if (!result.ok || !result.saleId) { setSaving(false); return setMessage(result.error ?? copy.checkoutFailed); }
    const fresh = await pullBusinessData(org.id, data.business).catch(() => null);
    if (fresh) saveAppData(fresh, org.id);
    sessionStorage.setItem("lakbiz-textile-sale-success", JSON.stringify({ billNo: result.billNo, saleId: result.saleId }));
    window.location.replace("/sales");
  }

  useEffect(() => {
    const raw = sessionStorage.getItem("lakbiz-textile-sale-success");
    if (!raw) return;
    sessionStorage.removeItem("lakbiz-textile-sale-success");
    const saved = JSON.parse(raw) as { billNo?: string; saleId?: string };
    setMessage(`${copy.completed}${saved.billNo ? ` · ${saved.billNo}` : ""}. ${copy.completedHint}`);
  }, [copy.completed, copy.completedHint]);

  if (!ready || !data || loadingRolls) return <AppShell><ProMain><ProLoadingState label={copy.loading} /></ProMain></AppShell>;

  const chequeUsed = payment === "cheque" || (split && secondaryPayment === "cheque");
  return <AppShell><ProMain>
    <ProPageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} actions={<><ProBadge tone="emerald">{copy.atomic}</ProBadge><ProButton href="/stock/rolls" variant="secondary">{copy.rolls}</ProButton></>} />
    <WriteDisabledHint className="mb-5" />
    {message && <div role={message.startsWith(copy.completed) ? "status" : "alert"} className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${message.startsWith(copy.completed) ? "border-teal-200 bg-teal-50 text-teal-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>{message}</div>}

    {rolls.length === 0 ? <ProCard><ProEmptyState title={copy.noRolls} description={copy.noRollsHint} action={<ProButton href="/stock/rolls">{copy.receive}</ProButton>} /></ProCard> :
    <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <div className="space-y-5">
        <ProCard title={copy.build} eyebrow={copy.selection}>
          <div className="mb-5 grid grid-cols-3 gap-2" aria-label={copy.mode}>
            <button type="button" aria-pressed={!fullRoll && channel === "retail"} className={`min-h-11 rounded-xl px-2 py-2 text-sm font-semibold ${!fullRoll && channel === "retail" ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`} onClick={() => { setFullRoll(false); setChannel("retail"); }}>{copy.retail}</button>
            <button type="button" aria-pressed={!fullRoll && channel === "wholesale"} className={`min-h-11 rounded-xl px-2 py-2 text-sm font-semibold ${!fullRoll && channel === "wholesale" ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`} onClick={() => { setFullRoll(false); setChannel("wholesale"); }}>{copy.wholesale}</button>
            <button type="button" aria-pressed={fullRoll} disabled={Boolean(selectedRoll?.reservedLength)} title={selectedRoll?.reservedLength ? copy.fullBlocked : undefined} className={`min-h-11 rounded-xl px-2 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${fullRoll ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`} onClick={() => { setFullRoll(true); setChannel("wholesale"); }}>{copy.full}</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={`${field} md:col-span-2`}>{copy.reservedOrder}<select className={input} value={reservationId} onChange={(e) => { const id=e.target.value; setReservationId(id); const reserved=reservations.find((r)=>r.id===id); if (reserved) { setFullRoll(false); setRollId(reserved.rollId); setProductId(reserved.productId); setQuantity(String(reserved.quantity)); if (reserved.customerId) setCustomerId(reserved.customerId); else if (reserved.customerName) setWalkInName(reserved.customerName); } }}><option value="">{copy.walkInSale}</option>{reservations.map((r)=><option key={r.id} value={r.id}>{r.orderReference} · {productByIdSafe(products, r.productId, copy.fabric)} · {r.quantity.toFixed(3)} {unitLabel(r.lengthUnit)} · {copy.dye} {r.dyeLot || copy.unrecorded}</option>)}</select></label>
            <label className={`${field} md:col-span-2`}>{copy.scan}<input className={input} value={rollSearch} onChange={(e) => { const value=e.target.value; setRollSearch(value); const exact=sellableRolls.find((roll)=>roll.rollNo.toLowerCase()===value.trim().toLowerCase()||(roll.barcode??"").toLowerCase()===value.trim().toLowerCase()); if(exact){if(exact.reservedLength>0)setFullRoll(false);setRollId(exact.id);setProductId(exact.productId);} }} placeholder={copy.scanHint} autoComplete="off" /></label>
            <label className={field}>{copy.fabric}<select className={input} value={productId} onChange={(e) => { setProductId(e.target.value); setRollId(""); }}><option value="">{copy.allFabrics}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className={field}>{copy.physicalRoll}<select disabled={Boolean(selectedReservation)} className={input} value={rollId} onChange={(e) => { const id = e.target.value; setRollId(id); const roll = rolls.find((r) => r.id === id); if (roll) { if(roll.reservedLength>0)setFullRoll(false); setProductId(roll.productId); setRollSearch(roll.rollNo); } }}><option value="">{visibleSellableRolls.length ? copy.selectRoll : copy.noMatch}</option>{(selectedReservation ? rolls.filter((r)=>r.id===selectedReservation.rollId) : visibleSellableRolls).map((r) => <option key={r.id} value={r.id}>{r.rollNo} · {(selectedReservation ? selectedReservation.quantity : r.remainingLength-r.reservedLength).toFixed(3)} {r.lengthUnit === "metre" ? "m" : "yd"}{r.dyeLot ? ` · ${copy.dye} ${r.dyeLot}` : ""}</option>)}</select></label>
            {selectedRoll && <div className="md:col-span-2 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-950"><span className="font-semibold">{copy.rolls} {selectedRoll.rollNo}</span> · {available.toFixed(3)} {selectedRoll.lengthUnit} {copy.available}{selectedRoll.dyeLot ? ` · ${copy.dye} ${selectedRoll.dyeLot}` : ""}{selectedRoll.shade ? ` · ${copy.shade} ${selectedRoll.shade}` : ""}{selectedRoll.rackLocation ? ` · ${selectedRoll.rackLocation}` : ""}</div>}
            <label className={field}>{copy.customer}<select className={input} value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">{copy.walkInCustomer}</option>{data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.contactType === "company" ? ` · ${copy.company}` : ""}</option>)}</select></label>
            {!customerId && <label className={field}>{copy.walkInName}<input className={input} value={walkInName} onChange={(e) => setWalkInName(e.target.value)} /></label>}
            <label className={field}>{fullRoll ? copy.fullQty : copy.measuredQty}<input disabled={fullRoll} type="number" min="0.001" max={available || undefined} step="0.001" className={input} value={fullRoll ? available.toFixed(3) : quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
            {canOverride && <label className={field}>{copy.managerPrice}<input type="number" min="0" step="0.01" className={input} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder={priceResolution ? String(priceResolution.price) : ""} /></label>}
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">{copy.appliedPrice}</p><p className="mt-1 text-xl font-bold text-slate-950">{formatLkr(priceResolution?.price ?? 0)}</p><p className="text-xs text-teal-700">{priceSourceLabel(priceResolution?.source)}</p></div>
          </div>
          <div className="mt-4 flex justify-end"><button type="button" className={primary} disabled={!selectedRoll || saleQty <= 0} onClick={addLine}>{copy.addAllocation}</button></div>
        </ProCard>
        <ProCard title={copy.allocated} eyebrow={copy.cart} action={<ProBadge tone={cart.length ? "teal" : "slate"}>{cart.length} {cart.length === 1 ? copy.line : copy.lines} · {formatLkr(total)}</ProBadge>}>
          {cart.length === 0 ? <p className="text-sm text-slate-500">{copy.noCuts}</p> : <div className="divide-y divide-slate-100">{cart.map((line) => <div key={line.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-slate-900">{line.productName} · {copy.rolls} {line.rollNo}</p><p className="text-xs text-slate-500">{saleModeLabel(line.saleMode)} · {line.quantity.toFixed(3)} {unitLabel(line.unit)} × {formatLkr(line.unitPrice)} · {priceSourceLabel(line.priceSource)}</p></div><div className="flex items-center gap-3"><span className="font-bold">{formatLkr(line.quantity*line.unitPrice)}</span><button type="button" aria-label={copy.removeLabel.replace("{fabric}", line.productName).replace("{roll}", line.rollNo)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50" onClick={() => setCart((rows) => rows.filter((r) => r.id !== line.id))}>{copy.remove}</button></div></div>)}</div>}
        </ProCard>
      </div>
      <div id="textile-settlement" className="xl:sticky xl:top-24 xl:self-start">
      <ProCard title={copy.paymentCheckout} eyebrow={copy.settlement}>
        <div className="space-y-4">
          <label className={field}>{copy.discount}<input type="number" min="0" max={gross} step="0.01" className={input} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></label>
          <label className={field}>{copy.primaryPayment}<select className={input} value={payment} onChange={(e) => setPayment(e.target.value as CheckoutTenderKind)}>{["cash","card","bank_transfer","cheque","credit"].map((p) => <option key={p} value={p}>{tenderLabel(p)}</option>)}</select></label>
          <label className={`${field} flex items-center gap-3 rounded-xl border border-slate-200 p-3.5`}><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /><span>{copy.split}</span></label>
          {split && <><label className={field}>{copy.secondPayment}<select className={input} value={secondaryPayment} onChange={(e) => setSecondaryPayment(e.target.value as CheckoutTenderKind)}>{["cash","card","bank_transfer","cheque","credit"].map((p) => <option key={p} value={p}>{tenderLabel(p)}</option>)}</select></label><label className={field}>{copy.secondAmount}<input type="number" min="0.01" max={total} step="0.01" className={input} value={secondaryAmount} onChange={(e) => setSecondaryAmount(e.target.value)} /></label></>}
          {chequeUsed && <div className="space-y-3 rounded-xl bg-slate-50 p-4"><label className={field}>{copy.chequeNo}<input className={input} value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} /></label><label className={field}>{copy.bank}<select className={input} value={chequeBank} onChange={(e) => setChequeBank(e.target.value)}>{LK_BANKS.map((bank) => <option key={bank}>{bank}</option>)}</select></label><label className={field}>{copy.chequeDate}<input type="date" className={input} value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={postDated} onChange={(e) => setPostDated(e.target.checked)} /> {copy.postDated}</label></div>}
          <div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs uppercase tracking-wider text-slate-400">{copy.amountDue}</p><p className="mt-1 text-3xl font-bold">{formatLkr(total)}</p></div>
          <button type="button" title={!canWrite ? disabledHint ?? undefined : undefined} disabled={!canWrite || saving || cart.length === 0 || total <= 0} className={`${primary} w-full`} onClick={() => void checkout()}>{saving ? copy.finalizing : copy.finalize}</button>
          <p className="text-xs leading-5 text-slate-500">{copy.atomicHint}</p>
        </div>
      </ProCard>
      </div>
    </div>}
    {cart.length > 0 && <><div className="h-20 xl:hidden" aria-hidden="true" /><div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur xl:hidden"><div className="mx-auto flex max-w-xl items-center justify-between gap-3"><div><p className="text-[11px] font-semibold text-slate-500">{cart.length} {copy.allocations}</p><p className="font-mono text-xl font-bold text-slate-950">{formatLkr(total)}</p></div><button type="button" className={primary} onClick={() => document.getElementById("textile-settlement")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{copy.reviewPayment}</button></div></div></>}
    <div className="mt-5 text-sm text-slate-500">{copy.reviewSales} <Link href="/bills" className="font-semibold text-teal-700">{copy.openBills}</Link>.</div>
  </ProMain></AppShell>;
}
