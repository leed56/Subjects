"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";
import { LOCALE_NAMES, nextLocale, type Locale } from "@/lib/i18n/translations";
import { PLANS, formatLkrPrice } from "@/lib/subscription/plans";
import { sectors } from "@/lib/sectors";
import { SectorIcon } from "@/components/sector-icon";
import {
  SalesIcon,
  StockIcon,
  BillsIcon,
  VatIcon,
  BankingIcon,
  CustomersIcon,
  JobsIcon,
  LanguageIcon,
  UsersIcon,
  ShieldIcon,
  LayersIcon,
} from "@/components/ui/icons";

/** Pick one of three locale-keyed values — the same 3-way convention used
 * across the app (dashboard/page.tsx, pulse/page.tsx, etc.), generic here
 * since this page picks whole arrays/tuples, not just strings. */
function pick<T>(locale: Locale, si: T, en: T, ta: T): T {
  if (locale === "si") return si;
  if (locale === "ta") return ta;
  return en;
}

const PAGE_COPY = {
  en: {
    nav: {
      features: "Features",
      solutions: "Solutions",
      pricing: "Pricing",
      industries: "Industries",
      contact: "Contact",
      signIn: "Sign in",
      demo: "Book a demo",
    },
    badge: "Admin-managed SaaS for Sri Lankan SMEs",
    heroTitle: "Business software that runs your shop,",
    heroAccent: "the Sri Lankan way.",
    heroDesc:
      "Sales, inventory, billing, VAT, banking and customer management — configured for your business by our team.",
    primaryCta: "Book a demo",
    secondaryCta: "Sign in",
    heroTrust: ["Admin-configured setup", "Secure role-based access", "Sri Lanka VAT ready"],
    capabilities: [
      ["Built for Sri Lankan businesses", "Local workflows, LKR pricing and VAT-ready operations"],
      ["Sri Lanka VAT-ready", "Track input and output VAT with clear summaries"],
      ["Multi-user role-based access", "Give each staff member only the access they need"],
      ["Inventory, billing & customers", "Run daily operations from one connected workspace"],
      ["Banking & cheque management", "Track deposits, cheques and reconciliations"],
    ],
    featuresEyebrow: "Core features",
    featuresTitle: "Your daily business, in one connected system",
    featuresDesc:
      "Sales, stock, billing and finance stay connected, so your team works faster with less duplication.",
    features: [
      ["Sales & POS", "Process sales, POS, quotations, credit sales and returns from one fast counter workflow."],
      ["Stock Management", "Track inventory in real time, find products quickly and catch low stock before it becomes a problem."],
      ["Billing & Invoicing", "Create invoices and bills, manage credit customers and keep balances organised without extra bookkeeping."],
      ["VAT Ready", "Track input and output VAT and prepare clean return-ready summaries from the same system."],
      ["Banking & Cheques", "Manage bank accounts, received and issued cheques, deposits and reconciliation."],
      ["Customers & Suppliers", "Keep contacts, balances, purchase history and outstanding amounts together."],
      ["Sector Modules", "Add AC service, vehicle and other sector-specific workflows only when your business needs them."],
    ],
    industriesEyebrow: "Built for your industry",
    industriesTitle: "One platform. Different workflows for different businesses.",
    industriesDesc:
      "Your shop gets the fields, reports and workflows that match how your sector actually operates.",
    industryDescriptions: {
      grocery: "Fast billing, weighted items, expiry tracking and credit customers.",
      electronics: "Serial and IMEI tracking, warranty, brand and model control.",
      electricals: "Meters, project billing and contractor-oriented pricing workflows.",
      spare_parts: "Part numbers, vehicle fitment and slow-moving stock visibility.",
      textile: "Fabric rolls, measured cuts, wholesale pricing, dye lots and customer credit.",
      ac_hvac: "Installation jobs, service schedules, parts and warranty workflows.",
      car_sales: "Per-vehicle stock, landed cost, aging and profitability tracking.",
    },
    pricingEyebrow: "Simple, transparent pricing",
    pricingTitle: "Choose the plan that fits your business",
    pricingDesc:
      "Plans are activated by LakBiz after payment and verification. Move up only when your business needs more capability.",
    planDescriptions: {
      starter: "Perfect for small shops",
      business: "For growing businesses",
      pro: "For advanced operations",
    },
    mostPopular: "Most popular",
    includes: "Includes",
    planCta: "Book a demo",
    planFootnote: "Plans are assigned manually by LakBiz admin after payment and verification.",
    proofEyebrow: "Built for real operations",
    proofTitle: "Built for the way serious businesses operate",
    proofDesc:
      "Clear controls, no public self-signup and no unnecessary complexity. LakBiz is configured around the way your business works.",
    proofItems: [
      ["Admin-managed onboarding", "Your shop, plan and access are configured before your team starts."],
      ["LKR-first workflows", "Pricing and daily operations are designed around Sri Lankan businesses."],
      ["VAT-ready operations", "Input VAT, output VAT and summaries stay connected to real transactions."],
      ["Role-based access", "Staff see the tools and data appropriate to their role."],
      ["Multi-branch ready", "Grow from one location to multiple branches without changing systems."],
      ["Offline billing on Pro", "Keep essential billing workflows available when connectivity is unreliable."],
    ],
    ctaEyebrow: "Get your LakBiz account",
    ctaTitle: "We configure the system. Your team gets to work.",
    ctaDesc:
      "Book a demo, choose the right plan, and our team will set up your shop and user access for you.",
    ctaPrimary: "Book a demo",
    ctaSecondary: "Sign in",
    footerTagline: "Admin-managed business software built for Sri Lankan SMEs.",
    footerProduct: "Product",
    footerStart: "Get started",
    rights: "All rights reserved.",
    region: "Sri Lanka",
  },
  si: {
    nav: {
      features: "විශේෂාංග",
      solutions: "විසඳුම්",
      pricing: "මිල ගණන්",
      industries: "ව්‍යාපාර වර්ග",
      contact: "සම්බන්ධ වන්න",
      signIn: "පිවිසෙන්න",
      demo: "ඩෙමෝවක් වෙන්කරගන්න",
    },
    badge: "ශ්‍රී ලංකා SMEs සඳහා අපේ කණ්ඩායම සකසන SaaS පද්ධතිය",
    heroTitle: "ඔබේ ව්‍යාපාරය එකම තැනකින් මෙහෙයවන්න,",
    heroAccent: "ශ්‍රී ලංකා ක්‍රමයට.",
    heroDesc:
      "විකුණුම්, තොග, බිල්පත්, VAT, බැංකු සහ ගනුදෙනුකරුවන් — ඔබේ ව්‍යාපාරයට ගැළපෙන ලෙස එකම පද්ධතියක.",
    primaryCta: "ඩෙමෝවක් වෙන්කරගන්න",
    secondaryCta: "පිවිසෙන්න",
    heroTrust: ["අපේ කණ්ඩායම සකසන පද්ධතිය", "භූමිකාව අනුව ආරක්ෂිත ප්‍රවේශය", "ශ්‍රී ලංකා VAT සඳහා සූදානම්"],
    capabilities: [
      ["ශ්‍රී ලංකා ව්‍යාපාර සඳහා", "දේශීය ක්‍රියාපටිපාටි, LKR මිලකරණය සහ VAT සඳහා සූදානම් මෙහෙයුම්"],
      ["VAT සඳහා සූදානම්", "ඇතුළත් සහ පිටත VAT පැහැදිලි සාරාංශ සමඟ පාලනය කරන්න"],
      ["භූමිකාව අනුව බහු-පරිශීලක ප්‍රවේශය", "එක් එක් සේවකයාට අවශ්‍ය ප්‍රවේශය පමණක් ලබා දෙන්න"],
      ["තොග, බිල්පත් සහ ගනුදෙනුකරුවන්", "දිනපතා මෙහෙයුම් එකම පද්ධතියකින් කරන්න"],
      ["බැංකු සහ චෙක් කළමනාකරණය", "තැන්පතු, චෙක්පත් සහ ගිණුම් සැසඳීම පාලනය කරන්න"],
    ],
    featuresEyebrow: "ප්‍රධාන විශේෂාංග",
    featuresTitle: "ඔබේ දිනපතා ව්‍යාපාර කටයුතු එකම පද්ධතියකින්",
    featuresDesc:
      "විකුණුම්, තොග, බිල්පත් සහ මූල්‍ය කටයුතු එකිනෙකට සම්බන්ධ නිසා වැඩ වේගවත් වන අතර නැවත නැවත දත්ත ඇතුළත් කිරීම අඩු වේ.",
    features: [
      ["විකුණුම් සහ POS", "විකුණුම්, POS, මිල ගණන්, ණය විකුණුම් සහ ආපසු භාරගැනීම් එකම වේගවත් ක්‍රියාපටිපාටියකින් කරන්න."],
      ["තොග කළමනාකරණය", "තොග තත්ත්වය එසැණින් බලන්න, භාණ්ඩ ඉක්මනින් සොයන්න සහ අඩු තොග දැනුම්දීම් ලබා ගන්න."],
      ["බිල්පත් සහ ඉන්වොයිස්", "ඉන්වොයිස් සහ බිල් සාදන්න, ණය ගනුදෙනුකරුවන් සහ ශේෂයන් පැහැදිලිව පාලනය කරන්න."],
      ["VAT සඳහා සූදානම්", "ඇතුළත් සහ පිටත VAT එකම පද්ධතියෙන් පාලනය කර වාර්තා සඳහා සූදානම් සාරාංශ ලබා ගන්න."],
      ["බැංකු සහ චෙක්", "බැංකු ගිණුම්, ලැබුණු සහ නිකුත් කළ චෙක්, තැන්පතු සහ ගිණුම් සැසඳීම පාලනය කරන්න."],
      ["ගනුදෙනුකරුවන් සහ සැපයුම්කරුවන්", "සම්බන්ධතා, ශේෂයන්, මිලදී ගැනීම් සහ හිඟ මුදල් එකම තැනක තබන්න."],
      ["ව්‍යාපාර-විශේෂ මොඩියුල", "AC සේවා, වාහන සහ අනෙකුත් ව්‍යාපාර-විශේෂ ක්‍රියාපටිපාටි අවශ්‍ය විට පමණක් සක්‍රිය කරන්න."],
    ],
    industriesEyebrow: "ඔබේ ව්‍යාපාර වර්ගය සඳහා",
    industriesTitle: "එකම පද්ධතියක්. ව්‍යාපාර වර්ගයට ගැළපෙන වෙනස් ක්‍රියාපටිපාටි.",
    industriesDesc:
      "ඔබේ ව්‍යාපාර වර්ගයට අවශ්‍ය තොරතුරු, වාර්තා සහ ක්‍රියාපටිපාටි අනුව LakBiz සකස් වේ.",
    industryDescriptions: {
      grocery: "වේගවත් බිල්පත්, බර අනුව භාණ්ඩ, කල් ඉකුත්වීම් සහ ණය ගනුදෙනුකරුවන්.",
      electronics: "Serial/IMEI අංක, වගකීම් කාලය, brand සහ model පාලනය.",
      electricals: "මීටර් අනුව විකිණීම, ව්‍යාපෘති බිල්පත් සහ කොන්ත්‍රාත් මිලකරණය.",
      spare_parts: "කොටස් අංක, වාහන ගැළපීම සහ මන්දගාමී තොග හඳුනාගැනීම.",
      textile: "රෙදි roll, මිනුම් අලෙවිය, තොග මිල, dye lot සහ පාරිභෝගික ණය පාලනය.",
      ac_hvac: "ස්ථාපන වැඩ, සේවා කාලසටහන්, අමතර කොටස් සහ වගකීම් ක්‍රියාපටිපාටි.",
      car_sales: "වාහන අනුව තොග, මුළු ගෙන්වීමේ පිරිවැය, තොග වයස සහ ලාභදායීතාව.",
    },
    pricingEyebrow: "සරල සහ පැහැදිලි මිල ගණන්",
    pricingTitle: "ඔබේ ව්‍යාපාරයට ගැළපෙන සැලැස්ම තෝරන්න",
    pricingDesc:
      "ගෙවීම තහවුරු වූ පසු LakBiz විසින් සැලැස්ම සක්‍රිය කරයි. වැඩි පහසුකම් අවශ්‍ය විට පමණක් ඉහළ සැලැස්මකට යන්න.",
    planDescriptions: {
      starter: "කුඩා වෙළඳසැල් සඳහා",
      business: "වර්ධනය වන ව්‍යාපාර සඳහා",
      pro: "උසස් මෙහෙයුම් සඳහා",
    },
    mostPopular: "වැඩිම ජනප්‍රිය",
    includes: "ඇතුළත්",
    planCta: "ඩෙමෝවක් වෙන්කරගන්න",
    planFootnote: "ගෙවීම තහවුරු වූ පසු LakBiz කණ්ඩායම විසින් සැලැස්ම ඔබේ ගිණුමට සකසයි.",
    proofEyebrow: "සැබෑ ව්‍යාපාර මෙහෙයුම් සඳහා",
    proofTitle: "සාර්ථක ව්‍යාපාරයක් ක්‍රියාත්මක වන ආකාරයට නිර්මාණය කළ පද්ධතිය",
    proofDesc:
      "අනවශ්‍ය සංකීර්ණතාවක් නැහැ. පොදු ලියාපදිංචියක් නැහැ. LakBiz ඔබේ ව්‍යාපාරය ක්‍රියා කරන ආකාරයට සකස් කරයි.",
    proofItems: [
      ["අපේ කණ්ඩායම සකසන ආරම්භය", "ඔබේ වෙළඳසැල, සැලැස්ම සහ පරිශීලක ප්‍රවේශය කණ්ඩායම වැඩ ආරම්භ කිරීමට පෙර සකසමු."],
      ["LKR පදනම් මෙහෙයුම්", "මිලකරණය සහ දිනපතා කටයුතු ශ්‍රී ලංකා ව්‍යාපාර සඳහා සකසා ඇත."],
      ["VAT සඳහා සූදානම්", "ඇතුළත් VAT, පිටත VAT සහ සාරාංශ සැබෑ ගනුදෙනු සමඟ සම්බන්ධයි."],
      ["භූමිකාව අනුව ප්‍රවේශය", "සේවකයාට ඔහුගේ කාර්යයට අවශ්‍ය මෙවලම් සහ දත්ත පමණක් පෙන්වයි."],
      ["ශාඛා කිහිපයකට සූදානම්", "පද්ධතිය මාරු නොකර එක ස්ථානයකින් ශාඛා කිහිපයකට වර්ධනය වන්න."],
      ["Pro හි offline බිල්පත්", "අන්තර්ජාල සම්බන්ධතාව දුර්වල වුවත් අත්‍යවශ්‍ය බිල්පත් කටයුතු දිගටම කරන්න."],
    ],
    ctaEyebrow: "ඔබේ LakBiz ගිණුම ලබා ගන්න",
    ctaTitle: "පද්ධතිය අපි සකස් කරමු. ඔබේ කණ්ඩායම වැඩ ආරම්භ කරයි.",
    ctaDesc:
      "ඩෙමෝවක් වෙන්කරගෙන නිවැරදි සැලැස්ම තෝරන්න. ඔබේ වෙළඳසැල සහ පරිශීලක ප්‍රවේශය අපේ කණ්ඩායම සකසයි.",
    ctaPrimary: "ඩෙමෝවක් වෙන්කරගන්න",
    ctaSecondary: "පිවිසෙන්න",
    footerTagline: "ශ්‍රී ලංකා SMEs සඳහා අපේ කණ්ඩායම සකසන ව්‍යාපාර මෘදුකාංගය.",
    footerProduct: "LakBiz",
    footerStart: "ආරම්භ කරන්න",
    rights: "සියලු හිමිකම් ඇවිරිණි.",
    region: "ශ්‍රී ලංකාව",
  },
  ta: {
    nav: {
      features: "அம்சங்கள்",
      solutions: "தீர்வுகள்",
      pricing: "விலை",
      industries: "தொழில்கள்",
      contact: "தொடர்பு",
      signIn: "உள்நுழைக",
      demo: "டெமோ பதிவு செய்க",
    },
    badge: "இலங்கை SMEக்களுக்காக எங்கள் குழு அமைக்கும் SaaS தளம்",
    heroTitle: "உங்கள் கடையை இயக்கும் வணிக மென்பொருள்,",
    heroAccent: "இலங்கை முறையில்.",
    heroDesc:
      "விற்பனை, சரக்கு, பில்லிங், VAT, வங்கி மற்றும் வாடிக்கையாளர் மேலாண்மை — உங்கள் வணிகத்திற்கு ஏற்ப எங்கள் குழுவால் அமைக்கப்படுகிறது.",
    primaryCta: "டெமோ பதிவு செய்க",
    secondaryCta: "உள்நுழைக",
    heroTrust: ["நிர்வாகி அமைக்கும் அமைப்பு", "பாதுகாப்பான பங்கு அடிப்படையிலான அணுகல்", "இலங்கை VAT தயார்"],
    capabilities: [
      ["இலங்கை வணிகங்களுக்காக கட்டமைக்கப்பட்டது", "உள்ளூர் பணிமுறைகள், LKR விலை மற்றும் VAT-தயார் செயல்பாடுகள்"],
      ["இலங்கை VAT-தயார்", "தெளிவான சுருக்கங்களுடன் உள்ளீட்டு மற்றும் வெளியீட்டு VAT ஐக் கண்காணிக்கவும்"],
      ["பல பயனர் பங்கு அடிப்படையிலான அணுகல்", "ஒவ்வொரு ஊழியருக்கும் தேவையான அணுகலை மட்டும் வழங்கவும்"],
      ["சரக்கு, பில்லிங் & வாடிக்கையாளர்கள்", "ஒரே இணைக்கப்பட்ட பணியிடத்திலிருந்து தினசரி செயல்பாடுகளை நடத்தவும்"],
      ["வங்கி & காசோலை மேலாண்மை", "வைப்புகள், காசோலைகள் மற்றும் சரிசெய்தல்களைக் கண்காணிக்கவும்"],
    ],
    featuresEyebrow: "முக்கிய அம்சங்கள்",
    featuresTitle: "உங்கள் தினசரி வணிகம், ஒரே இணைக்கப்பட்ட அமைப்பில்",
    featuresDesc:
      "விற்பனை, சரக்கு, பில்லிங் மற்றும் நிதி இணைக்கப்பட்டிருப்பதால், உங்கள் குழு குறைவான மறுநகல் மூலம் வேகமாக வேலை செய்கிறது.",
    features: [
      ["விற்பனை & POS", "ஒரே வேகமான கவுன்டர் பணிமுறையில் விற்பனை, POS, மேற்கோள், கடன் விற்பனை மற்றும் திரும்பப் பெறல்களைச் செயல்படுத்தவும்."],
      ["சரக்கு மேலாண்மை", "நேரடியாக சரக்கைக் கண்காணிக்கவும், பொருட்களை விரைவாகக் கண்டறியவும், பிரச்சனையாகும் முன் குறைந்த சரக்கைப் பிடிக்கவும்."],
      ["பில்லிங் & இன்வாய்ஸ்", "இன்வாய்ஸ் மற்றும் பில்களை உருவாக்கவும், கடன் வாடிக்கையாளர்களை நிர்வகிக்கவும், கூடுதல் கணக்கியல் இல்லாமல் நிலுவைகளை ஒழுங்காக வைக்கவும்."],
      ["VAT தயார்", "உள்ளீட்டு மற்றும் வெளியீட்டு VAT ஐக் கண்காணித்து, அதே அமைப்பிலிருந்து தெளிவான, வருமான-தயார் சுருக்கங்களைத் தயாரிக்கவும்."],
      ["வங்கி & காசோலைகள்", "வங்கிக் கணக்குகள், பெறப்பட்ட மற்றும் வழங்கப்பட்ட காசோலைகள், வைப்புகள் மற்றும் சரிசெய்தலை நிர்வகிக்கவும்."],
      ["வாடிக்கையாளர்கள் & சப்ளையர்கள்", "தொடர்புகள், நிலுவைகள், கொள்முதல் வரலாறு மற்றும் நிலுவைத் தொகைகளை ஒன்றாக வைக்கவும்."],
      ["தொழில்-குறிப்பிட்ட தொகுதிகள்", "உங்கள் வணிகத்திற்குத் தேவைப்படும்போது மட்டும் AC சேவை, வாகனம் மற்றும் பிற தொழில்-குறிப்பிட்ட பணிமுறைகளைச் சேர்க்கவும்."],
    ],
    industriesEyebrow: "உங்கள் தொழிலுக்காக கட்டமைக்கப்பட்டது",
    industriesTitle: "ஒரே தளம். வெவ்வேறு வணிகங்களுக்கு வெவ்வேறு பணிமுறைகள்.",
    industriesDesc:
      "உங்கள் தொழில் உண்மையில் எப்படி இயங்குகிறதோ அதற்கேற்ப புலங்கள், அறிக்கைகள் மற்றும் பணிமுறைகளை உங்கள் கடை பெறுகிறது.",
    industryDescriptions: {
      grocery: "வேகமான பில்லிங், எடை அடிப்படையிலான பொருட்கள், காலாவதி கண்காணிப்பு மற்றும் கடன் வாடிக்கையாளர்கள்.",
      electronics: "சீரியல் மற்றும் IMEI கண்காணிப்பு, உத்தரவாதம், பிராண்ட் மற்றும் மாடல் கட்டுப்பாடு.",
      electricals: "மீட்டர்கள், திட்ட பில்லிங் மற்றும் ஒப்பந்தக்காரர் சார்ந்த விலை பணிமுறைகள்.",
      spare_parts: "பாகம் எண்கள், வாகன பொருத்தம் மற்றும் மெதுவாக நகரும் சரக்கு தெரிவுநிலை.",
      textile: "துணி rolls, அளவிடப்பட்ட வெட்டுகள், மொத்த விலை, dye lots மற்றும் வாடிக்கையாளர் கடன்.",
      ac_hvac: "நிறுவல் பணிகள், சேவை அட்டவணைகள், பாகங்கள் மற்றும் உத்தரவாத பணிமுறைகள்.",
      car_sales: "வாகனத்திற்கான சரக்கு, இறக்குமதி செலவு, வயதாதல் மற்றும் லாபகரமான தன்மை கண்காணிப்பு.",
    },
    pricingEyebrow: "எளிய, வெளிப்படையான விலை",
    pricingTitle: "உங்கள் வணிகத்திற்கு ஏற்ற திட்டத்தைத் தேர்வுசெய்யவும்",
    pricingDesc:
      "கட்டணம் மற்றும் சரிபார்ப்புக்குப் பிறகு LakBiz ஆல் திட்டங்கள் செயல்படுத்தப்படும். உங்கள் வணிகத்திற்குத் தேவைப்படும்போது மட்டும் மேலே செல்லவும்.",
    planDescriptions: {
      starter: "சிறிய கடைகளுக்கு ஏற்றது",
      business: "வளரும் வணிகங்களுக்கு",
      pro: "மேம்பட்ட செயல்பாடுகளுக்கு",
    },
    mostPopular: "மிகவும் பிரபலமானது",
    includes: "உள்ளடக்கியவை",
    planCta: "டெமோ பதிவு செய்க",
    planFootnote: "கட்டணம் மற்றும் சரிபார்ப்புக்குப் பிறகு LakBiz நிர்வாகியால் திட்டங்கள் கைமுறையாக ஒதுக்கப்படும்.",
    proofEyebrow: "உண்மையான செயல்பாடுகளுக்காக கட்டமைக்கப்பட்டது",
    proofTitle: "தீவிர வணிகங்கள் இயங்கும் முறைக்காக கட்டமைக்கப்பட்டது",
    proofDesc:
      "தெளிவான கட்டுப்பாடுகள், பொது சுய-பதிவு இல்லை, தேவையற்ற சிக்கல் இல்லை. உங்கள் வணிகம் செயல்படும் விதத்திற்கு ஏற்ப LakBiz கட்டமைக்கப்பட்டுள்ளது.",
    proofItems: [
      ["நிர்வாகி நிர்வகிக்கும் ஆன்போர்டிங்", "உங்கள் குழு தொடங்குவதற்கு முன் உங்கள் கடை, திட்டம் மற்றும் அணுகல் கட்டமைக்கப்படும்."],
      ["LKR-முதன்மை பணிமுறைகள்", "விலை மற்றும் தினசரி செயல்பாடுகள் இலங்கை வணிகங்களுக்காக வடிவமைக்கப்பட்டுள்ளன."],
      ["VAT-தயார் செயல்பாடுகள்", "உள்ளீட்டு VAT, வெளியீட்டு VAT மற்றும் சுருக்கங்கள் உண்மையான பரிவர்த்தனைகளுடன் இணைக்கப்பட்டுள்ளன."],
      ["பங்கு அடிப்படையிலான அணுகல்", "ஊழியர்கள் தங்கள் பங்குக்கு ஏற்ற கருவிகள் மற்றும் தரவை மட்டும் பார்க்கிறார்கள்."],
      ["பல கிளைகளுக்குத் தயார்", "அமைப்புகளை மாற்றாமல் ஒரு இடத்திலிருந்து பல கிளைகளுக்கு வளரவும்."],
      ["Pro இல் ஆஃப்லைன் பில்லிங்", "இணைப்பு நம்பகமற்றதாக இருக்கும்போது அத்தியாவசிய பில்லிங் பணிமுறைகளைக் கிடைக்கச் செய்யவும்."],
    ],
    ctaEyebrow: "உங்கள் LakBiz கணக்கைப் பெறுங்கள்",
    ctaTitle: "நாங்கள் அமைப்பை அமைக்கிறோம். உங்கள் குழு வேலையைத் தொடங்கும்.",
    ctaDesc:
      "டெமோவைப் பதிவு செய்யவும், சரியான திட்டத்தைத் தேர்வுசெய்யவும், எங்கள் குழு உங்கள் கடை மற்றும் பயனர் அணுகலை அமைக்கும்.",
    ctaPrimary: "டெமோ பதிவு செய்க",
    ctaSecondary: "உள்நுழைக",
    footerTagline: "இலங்கை SMEக்களுக்காக கட்டமைக்கப்பட்ட நிர்வாகி-நிர்வகிக்கும் வணிக மென்பொருள்.",
    footerProduct: "தயாரிப்பு",
    footerStart: "தொடங்குங்கள்",
    rights: "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.",
    region: "இலங்கை",
  },
} as const;

type FeatureFlag = keyof (typeof PLANS)[number]["features"];

const PLAN_FEATURE_ROWS: { flag: FeatureFlag; en: string; si: string; ta: string }[] = [
  { flag: "sales", en: "Sales & POS", si: "විකුණුම් & POS", ta: "விற்பனை & POS" },
  { flag: "stock", en: "Stock", si: "තොග", ta: "சரக்கு" },
  { flag: "bills", en: "Billing", si: "බිල්පත්", ta: "பில்லிங்" },
  { flag: "customers", en: "Customers", si: "ගනුදෙනුකරුවන්", ta: "வாடிக்கையாளர்கள்" },
  { flag: "suppliers", en: "Suppliers", si: "සැපයුම්කරුවන්", ta: "சப்ளையர்கள்" },
  { flag: "banking", en: "Banking", si: "බැංකු", ta: "வங்கி" },
  { flag: "ac_jobs", en: "AC Jobs", si: "AC සේවා", ta: "AC பணிகள்" },
  { flag: "vehicles", en: "Vehicles", si: "වාහන", ta: "வாகனங்கள்" },
  { flag: "export", en: "Data export", si: "දත්ත පිටතට ලබාගැනීම", ta: "தரவு ஏற்றுமதி" },
  { flag: "offline", en: "Offline billing", si: "Offline බිල්පත්", ta: "ஆஃப்லைன் பில்லிங்" },
  { flag: "bulk_messaging", en: "Bulk customer messages", si: "සමූහ පාරිභෝගික පණිවිඩ", ta: "மொத்த வாடிக்கையாளர் செய்திகள்" },
];

const FEATURE_ICONS = [SalesIcon, StockIcon, BillsIcon, VatIcon, BankingIcon, CustomersIcon, JobsIcon];
const CAPABILITY_ICONS = [ShieldIcon, VatIcon, UsersIcon, LayersIcon, BankingIcon];
const PROOF_ICONS = [ShieldIcon, LanguageIcon, VatIcon, UsersIcon, LayersIcon, StockIcon];
const INDUSTRY_ACCENTS = [
  "from-teal-300/30 via-cyan-200/10 to-transparent",
  "from-sky-300/25 via-teal-200/10 to-transparent",
  "from-emerald-300/25 via-teal-200/10 to-transparent",
  "from-cyan-300/20 via-slate-200/5 to-transparent",
  "from-teal-200/25 via-emerald-200/10 to-transparent",
  "from-sky-200/20 via-teal-200/10 to-transparent",
];

const INDUSTRY_REPORT_SI: Record<string, string> = {
  "Daily sales": "දිනපතා විකුණුම්",
  "Expiry alert": "කල් ඉකුත් දැනුම්දීම්",
  "Top sellers": "වැඩිම විකිණෙන භාණ්ඩ",
  "Warranty expiring": "වගකීම් කාලය අවසන් වන භාණ්ඩ",
  "Sales by brand": "Brand අනුව විකුණුම්",
  "Sales by project": "ව්‍යාපෘතිය අනුව විකුණුම්",
  "Stock by unit": "ඒකක අනුව තොග",
  "Slow movers": "මන්දගාමී භාණ්ඩ",
  "Fast movers": "වේගයෙන් විකිණෙන භාණ්ඩ",
  "Reorder list": "නැවත ඇණවුම් ලැයිස්තුව",
  "Installations pending": "අවසන් නොකළ ස්ථාපන",
  "Warranty registrations": "වගකීම් ලියාපදිංචි",
  "Pipe & accessory usage": "Pipe සහ accessories භාවිතය",
  "Stock aging 30/60/90 days": "තොග වයස 30/60/90 දින",
  "Profit per vehicle": "වාහනයකට ලාභය",
  "Cash vs leasing mix": "Cash සහ leasing මිශ්‍රණය",
};

const INDUSTRY_REPORT_TA: Record<string, string> = {
  "Daily sales": "தினசரி விற்பனை",
  "Expiry alert": "காலாவதி எச்சரிக்கை",
  "Top sellers": "அதிகம் விற்பனையானவை",
  "Warranty expiring": "உத்தரவாதம் முடிவடையும் பொருட்கள்",
  "Sales by brand": "பிராண்ட் அடிப்படையில் விற்பனை",
  "Sales by project": "திட்டம் அடிப்படையில் விற்பனை",
  "Stock by unit": "அலகு அடிப்படையில் சரக்கு",
  "Slow movers": "மெதுவாக நகரும் பொருட்கள்",
  "Fast movers": "வேகமாக விற்பனையாகும் பொருட்கள்",
  "Reorder list": "மறு ஆர்டர் பட்டியல்",
  "Installations pending": "நிலுவையிலுள்ள நிறுவல்கள்",
  "Warranty registrations": "உத்தரவாத பதிவுகள்",
  "Pipe & accessory usage": "Pipe & accessories பயன்பாடு",
  "Stock aging 30/60/90 days": "சரக்கு வயது 30/60/90 நாட்கள்",
  "Profit per vehicle": "வாகனத்திற்கான லாபம்",
  "Cash vs leasing mix": "Cash vs leasing கலவை",
};

function industryReportLabel(report: string, locale: Locale) {
  if (locale === "si") return INDUSTRY_REPORT_SI[report] ?? report;
  if (locale === "ta") return INDUSTRY_REPORT_TA[report] ?? report;
  return report;
}

export function MarketingHomePage() {
  const { locale, setLocale } = useLocale();
  const c = PAGE_COPY[locale];
  const year = new Date().getFullYear();
  // Sinhala and Tamil headings both run noticeably wider than the English
  // copy at the same point size — this only tunes type sizing/width, never
  // which text renders (that's PAGE_COPY[locale] above).
  const roomy = locale !== "en";

  const salesStoryItems = pick(
    locale,
    ["වේගවත් කවුන්ටර් ක්‍රියාවලිය", "ණය විකුණුම්", "ආපසු භාරගැනීම් සහ මිල ගණන්"],
    ["Fast counter flow", "Credit sales", "Returns & quotations"],
    ["வேகமான கவுன்டர் பணிமுறை", "கடன் விற்பனை", "திரும்பப் பெறல் & மேற்கோள்"],
  );
  const stockMetrics = pick(
    locale,
    [["තොගයේ", "1,248"], ["අඩු තොග", "18"], ["වර්ග", "42"]],
    [["In stock", "1,248"], ["Low stock", "18"], ["Categories", "42"]],
    [["கையிருப்பில்", "1,248"], ["குறைந்த சரக்கு", "18"], ["வகைகள்", "42"]],
  );
  const billingRows = pick(
    locale,
    [["ඉන්වොයිස් #INV-2048", "Rs. 18,500"], ["ණය ශේෂය", "Rs. 7,200"], ["ලැබුණු ගෙවීම", "Rs. 11,300"]],
    [["Invoice #INV-2048", "Rs. 18,500"], ["Credit balance", "Rs. 7,200"], ["Payment received", "Rs. 11,300"]],
    [["இன்வாய்ஸ் #INV-2048", "Rs. 18,500"], ["கடன் நிலுவை", "Rs. 7,200"], ["பெறப்பட்ட கட்டணம்", "Rs. 11,300"]],
  );

  return (
    <div lang={locale} className="min-h-screen overflow-hidden bg-white text-slate-950">
      <header className="sticky inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-teal-600 text-sm font-black text-white shadow-[0_8px_22px_rgba(13,148,136,0.22)]">L</span>
            <span className="text-xl font-bold tracking-[-0.035em] text-slate-950">LakBiz</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-500 lg:flex">
            <a href="#features" className="transition hover:text-slate-950">{c.nav.features}</a>
            <a href="#solutions" className="transition hover:text-slate-950">{c.nav.solutions}</a>
            <a href="#plans" className="transition hover:text-slate-950">{c.nav.pricing}</a>
            <a href="#industries" className="transition hover:text-slate-950">{c.nav.industries}</a>
            <a href="#contact" className="transition hover:text-slate-950">{c.nav.contact}</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cycles si -> en -> ta -> si, same as every other language
                switch in the app (nextLocale) — this previously toggled
                only between "en" and "si" directly, so a visitor on Tamil
                had no way to reach it from this control at all. */}
            <button
              type="button"
              onClick={() => setLocale(nextLocale(locale))}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
              aria-label="Toggle language"
            >
              {LOCALE_NAMES[nextLocale(locale)]}
            </button>
            <Link href="/login" className="hidden min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 sm:inline-flex">
              {c.nav.signIn}
            </Link>
            <a href="mailto:hello@lakbiz.app" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-teal-600 px-4 text-xs font-bold text-white shadow-[0_8px_22px_rgba(13,148,136,0.2)] transition hover:bg-teal-700 sm:px-5 sm:text-sm">
              {c.nav.demo}
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-white pb-12 pt-10 sm:pt-12 lg:pb-14 lg:pt-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_84%_10%,rgba(20,184,166,0.16),transparent_31%),radial-gradient(circle_at_18%_8%,rgba(45,212,191,0.08),transparent_25%)]" />
          <div className="pointer-events-none absolute right-[-8rem] top-24 h-[29rem] w-[29rem] rounded-full border border-teal-100" />
          <div className="pointer-events-none absolute right-[-1rem] top-48 h-[18rem] w-[18rem] rounded-full border border-teal-100/80" />

          <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12 xl:gap-16">
              <div className={`text-center lg:text-left ${roomy ? "max-w-[670px]" : "max-w-[620px]"}`}>
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/80 px-4 py-2 text-[11px] font-bold text-teal-800 lg:mx-0">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[9px] text-white">✓</span>
                  {c.badge}
                </div>

                <h1 className={`mt-6 font-bold tracking-[-0.052em] text-slate-950 ${roomy ? "text-[2.25rem] leading-[1.08] sm:text-[2.85rem] lg:text-[3.55rem]" : "text-[2.8rem] leading-[0.98] sm:text-[3.7rem] lg:text-[4.45rem]"}`}>
                  {c.heroTitle}{" "}
                  <span className="text-teal-600">{c.heroAccent}</span>
                </h1>
                <p className={`mx-auto mt-6 max-w-[560px] text-base text-slate-500 sm:text-lg lg:mx-0 ${roomy ? "leading-8" : "leading-7 sm:leading-8"}`}>
                  {c.heroDesc}
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <a href="mailto:hello@lakbiz.app" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-600 px-7 text-sm font-bold text-white shadow-[0_14px_34px_rgba(13,148,136,0.22)] transition hover:bg-teal-700">
                    {c.primaryCta}<span className="ml-2">→</span>
                  </a>
                  <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-7 text-sm font-bold text-slate-800 shadow-[0_6px_20px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:bg-slate-50">
                    {c.secondaryCta}
                  </Link>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 lg:justify-start">
                  {c.heroTrust.map((item) => (
                    <span key={item} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <ProductShowcase locale={locale} />
            </div>
          </div>
        </section>

        <section id="solutions" className="relative z-10 bg-white pb-14">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="grid overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-[0_16px_55px_rgba(15,23,42,0.07)] sm:grid-cols-2 lg:grid-cols-5">
              {c.capabilities.map(([title, desc], index) => {
                const Icon = CAPABILITY_ICONS[index];
                return (
                  <div key={title} className={`flex gap-3.5 px-5 py-5 ${index > 0 ? "border-t border-slate-100 sm:border-l sm:border-t-0" : ""}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100"><Icon className="h-5 w-5" /></span>
                    <div>
                      <p className="text-sm font-bold leading-5 text-slate-900">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 bg-[#f4f7fa] py-16 lg:py-20">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <SectionHeading eyebrow={c.featuresEyebrow} title={c.featuresTitle} description={c.featuresDesc} compact={roomy} />

            <div className="mt-10 grid gap-4 lg:grid-cols-12">
              <FeatureStory
                title={c.features[0][0]}
                description={c.features[0][1]}
                Icon={FEATURE_ICONS[0]}
                dark
                className="lg:col-span-7 lg:row-span-2"
              >
                <div className="mt-8 grid gap-3 sm:grid-cols-[1.25fr_0.75fr]">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">{pick(locale, "අද", "Today", "இன்று")}</span>
                      <span className="rounded-full bg-teal-300/10 px-2.5 py-1 text-[10px] font-bold text-teal-300">{pick(locale, "සජීවී", "LIVE", "நேரடி")}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {["Rs. 45,680", pick(locale, "බිල් 32", "32 bills", "32 பில்கள்"), "Rs. 12,340"].map((value) => (
                        <div key={value} className="rounded-xl bg-white/[0.045] px-3 py-3 text-sm font-bold text-white">{value}</div>
                      ))}
                    </div>
                    <div className="mt-4 h-20 rounded-xl bg-[linear-gradient(180deg,rgba(45,212,191,0.15),rgba(45,212,191,0.02))] p-3">
                      <svg viewBox="0 0 360 70" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
                        <path d="M0 58 C40 55 55 32 92 40 C130 48 142 20 180 31 C220 43 240 13 275 23 C312 33 328 8 360 14" fill="none" stroke="#5eead4" strokeWidth="3.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {salesStoryItems.map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-semibold text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-teal-300" />{item}
                      </div>
                    ))}
                  </div>
                </div>
              </FeatureStory>

              <FeatureStory
                title={c.features[1][0]}
                description={c.features[1][1]}
                Icon={FEATURE_ICONS[1]}
                className="lg:col-span-5"
              >
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {stockMetrics.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-inset ring-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
                    </div>
                  ))}
                </div>
              </FeatureStory>

              <FeatureStory
                title={c.features[2][0]}
                description={c.features[2][1]}
                Icon={FEATURE_ICONS[2]}
                className="lg:col-span-5"
              >
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  {billingRows.map(([label, value], index) => (
                    <div key={label} className={`flex items-center justify-between py-2 text-sm ${index > 0 ? "border-t border-slate-200/70" : ""}`}>
                      <span className="font-medium text-slate-600">{label}</span>
                      <span className="font-bold text-slate-950">{value}</span>
                    </div>
                  ))}
                </div>
              </FeatureStory>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {c.features.slice(3).map(([title, desc], index) => {
                const Icon = FEATURE_ICONS[index + 3];
                return (
                  <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></span>
                    <h3 className="mt-4 text-base font-bold tracking-tight text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="industries" className="scroll-mt-24 bg-[#07111f] py-16 text-white lg:py-20">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div className="max-w-3xl">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-300">{c.industriesEyebrow}</p>
                <h2 className={`mt-3 font-bold tracking-[-0.045em] text-white ${roomy ? "text-[2rem] leading-[1.12] sm:text-[2.55rem] lg:text-[2.75rem]" : "text-3xl sm:text-4xl lg:text-[3rem]"}`}>{c.industriesTitle}</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400 lg:justify-self-end">{c.industriesDesc}</p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sectors.map((sector, index) => {
                const desc = c.industryDescriptions[sector.id as keyof typeof c.industryDescriptions] ?? sector.description;
                return (
                  <article key={sector.id} className="group relative overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-teal-300/25 hover:bg-white/[0.055]">
                    <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${INDUSTRY_ACCENTS[index % INDUSTRY_ACCENTS.length]}`} />
                    <div className="relative flex items-start justify-between gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.07] text-teal-300 ring-1 ring-inset ring-white/[0.08]"><SectorIcon sectorId={sector.id} className="h-6 w-6" /></span>
                      <span className="text-sm text-slate-600 transition group-hover:text-teal-300">↗</span>
                    </div>
                    <h3 className="relative mt-7 text-xl font-bold tracking-tight text-white">{pick(locale, sector.nameSi, sector.nameEn, sector.nameTa)}</h3>
                    <p className="relative mt-2 max-w-md text-sm leading-6 text-slate-400">{desc}</p>
                    <div className="relative mt-5 flex flex-wrap gap-2">
                      {sector.reports.slice(0, 2).map((report) => (
                        <span key={report} className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-slate-500">{industryReportLabel(report, locale)}</span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="plans" className="scroll-mt-24 bg-[#eef3f6] py-16 lg:py-20">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-10">
            <SectionHeading eyebrow={c.pricingEyebrow} title={c.pricingTitle} description={c.pricingDesc} compact={roomy} />

            <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
              {PLANS.map((plan) => {
                const highlight = plan.highlight;
                const enabledRows = PLAN_FEATURE_ROWS.filter((row) => plan.features[row.flag]);
                const planName = pick(locale, plan.nameSi, plan.nameEn, plan.nameTa);
                const planDesc = c.planDescriptions[plan.id as keyof typeof c.planDescriptions] ?? "";
                return (
                  <article key={plan.id} className={`relative flex flex-col overflow-hidden rounded-[1.45rem] border bg-white ${highlight ? "border-teal-400 shadow-[0_26px_70px_rgba(13,148,136,0.16)] ring-1 ring-teal-200 lg:-translate-y-3" : "border-slate-200 shadow-[0_10px_34px_rgba(15,23,42,0.05)]"}`}>
                    {highlight && <div className="bg-teal-600 px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white">{c.mostPopular}</div>}
                    <div className="flex flex-1 flex-col p-6 sm:p-7">
                      <div>
                        <h3 className="text-xl font-bold text-slate-950">{planName}</h3>
                        <p className="mt-1 text-sm text-slate-500">{planDesc}</p>
                        <p className="mt-5 text-[2.65rem] font-bold tracking-[-0.05em] text-teal-700">
                          {formatLkrPrice(plan.priceMonthlyLkr)}
                          <span className="ml-1 text-sm font-semibold tracking-normal text-slate-400">/{pick(locale, "මාසය", "month", "மாதம்")}</span>
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-100">
                            {pick(locale, `පරිශීලකයින් ${plan.maxUsers} දක්වා`, `Up to ${plan.maxUsers} ${plan.maxUsers === 1 ? "user" : "users"}`, `${plan.maxUsers} பயனர்கள் வரை`)}
                          </span>
                          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-100">
                            {pick(locale, `ශාඛා ${plan.maxBranches}`, `${plan.maxBranches} ${plan.maxBranches === 1 ? "branch" : "branches"}`, `${plan.maxBranches} கிளைகள்`)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-slate-100 pt-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{c.includes}</p>
                        <ul className="mt-4 space-y-2.5">
                          {enabledRows.slice(0, highlight ? 8 : 7).map((row) => (
                            <li key={row.flag} className="flex items-center gap-2.5 text-sm text-slate-600">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-50 text-[9px] font-bold text-teal-700">✓</span>
                              {pick(locale, row.si, row.en, row.ta)}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <a href="mailto:hello@lakbiz.app" className={`mt-7 inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold transition ${highlight ? "bg-teal-600 text-white shadow-[0_12px_28px_rgba(13,148,136,0.2)] hover:bg-teal-700" : "border border-teal-300 bg-white text-teal-700 hover:bg-teal-50"}`}>
                        {c.planCta}
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">{c.planFootnote}</p>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-10">
            <div className="relative overflow-hidden rounded-[1.8rem] bg-[#07111f] px-6 py-10 text-white shadow-[0_28px_70px_rgba(7,17,31,0.16)] sm:px-9 lg:px-12 lg:py-12">
              <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-teal-300/10" />
              <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
                <div className="max-w-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-300">{c.proofEyebrow}</p>
                  <h2 className={`mt-3 font-bold tracking-[-0.045em] text-white ${roomy ? "text-[2rem] leading-[1.12] sm:text-[2.5rem]" : "text-3xl sm:text-4xl"}`}>{c.proofTitle}</h2>
                  <p className="mt-4 text-sm leading-6 text-slate-400">{c.proofDesc}</p>
                </div>
                <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2">
                  {c.proofItems.map(([title, desc], index) => {
                    const Icon = PROOF_ICONS[index];
                    return (
                      <div key={title} className="flex gap-3.5 border-t border-white/[0.08] pt-5 first:border-t-0 first:pt-0 sm:first:border-t sm:first:pt-5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-300/10 text-teal-300 ring-1 ring-inset ring-teal-300/10"><Icon className="h-5 w-5" /></span>
                        <div>
                          <h3 className="text-sm font-bold text-white">{title}</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 bg-white pb-16 lg:pb-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
            <div className="relative overflow-hidden rounded-[1.8rem] bg-[linear-gradient(110deg,#075c61_0%,#0d9488_58%,#08796f_100%)] px-6 py-10 text-white shadow-[0_28px_70px_rgba(6,78,84,0.2)] sm:px-9 lg:px-12 lg:py-12">
              <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/10" />
              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-100">{c.ctaEyebrow}</p>
                  <h2 className={`mt-3 font-bold tracking-[-0.045em] ${roomy ? "text-[2rem] leading-[1.12] sm:text-[2.6rem]" : "text-3xl sm:text-4xl"}`}>{c.ctaTitle}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-teal-50/80">{c.ctaDesc}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
                  <a href="mailto:hello@lakbiz.app" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-teal-800 shadow-[0_10px_26px_rgba(4,47,46,0.16)] transition hover:bg-teal-50">{c.ctaPrimary}<span className="ml-2">→</span></a>
                  <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/[0.06] px-6 text-sm font-bold text-white transition hover:bg-white/[0.12]">{c.ctaSecondary}</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#07111f] text-slate-400">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-sm font-black text-[#06201e]">L</span>
                <span className="text-lg font-bold text-white">LakBiz</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">{c.footerTagline}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{c.footerProduct}</p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm">
                <a href="#features" className="hover:text-white">{c.nav.features}</a>
                <a href="#plans" className="hover:text-white">{c.nav.pricing}</a>
                <a href="#industries" className="hover:text-white">{c.nav.industries}</a>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{c.footerStart}</p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm">
                <a href="mailto:hello@lakbiz.app" className="hover:text-white">{c.nav.demo}</a>
                <Link href="/login" className="hover:text-white">{c.nav.signIn}</Link>
                <a href="mailto:hello@lakbiz.app" className="hover:text-white">hello@lakbiz.app</a>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-white/[0.07] pt-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>© {year} LakBiz. {c.rights}</span>
            <span>{c.region}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, compact = false }: { eyebrow: string; title: string; description?: string; compact?: boolean }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.19em] text-teal-700">{eyebrow}</p>
      <h2 className={`mt-3 font-bold tracking-[-0.045em] text-slate-950 ${compact ? "text-[2rem] leading-[1.12] sm:text-[2.5rem] lg:text-[2.65rem]" : "text-3xl sm:text-4xl lg:text-[2.8rem]"}`}>{title}</h2>
      {description && <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
    </div>
  );
}

function FeatureStory({
  title,
  description,
  Icon,
  dark = false,
  className = "",
  children,
}: {
  title: string;
  description: string;
  Icon: typeof SalesIcon;
  dark?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className={`relative overflow-hidden rounded-[1.55rem] border p-6 shadow-[0_12px_36px_rgba(15,23,42,0.055)] sm:p-7 ${dark ? "border-slate-900 bg-[#07111f] text-white" : "border-slate-200 bg-white"} ${className}`}>
      {dark && <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal-300/10 blur-3xl" />}
      <div className="relative">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${dark ? "bg-teal-300/10 text-teal-300 ring-1 ring-inset ring-teal-300/10" : "bg-teal-50 text-teal-700"}`}><Icon className="h-5 w-5" /></span>
        <h3 className={`mt-5 text-xl font-bold tracking-tight sm:text-2xl ${dark ? "text-white" : "text-slate-950"}`}>{title}</h3>
        <p className={`mt-2 max-w-2xl text-sm leading-6 ${dark ? "text-slate-400" : "text-slate-500"}`}>{description}</p>
        {children}
      </div>
    </article>
  );
}

function ProductShowcase({ locale }: { locale: Locale }) {
  const stats = pick(
    locale,
    [
      ["අද විකුණුම්", "Rs. 45,680", "සජීවී"],
      ["ලාභය", "Rs. 12,340", "සටහන් කර ඇත"],
      ["බිල්", "32", "සූදානම්"],
      ["මුදල්", "Rs. 128,750", "ලබා ගත හැක"],
    ],
    [
      ["Today sales", "Rs. 45,680", "Live"],
      ["Profit", "Rs. 12,340", "Tracked"],
      ["Bills", "32", "Ready"],
      ["Cash", "Rs. 128,750", "Available"],
    ],
    [
      ["இன்று விற்பனை", "Rs. 45,680", "நேரடி"],
      ["லாபம்", "Rs. 12,340", "கண்காணிக்கப்பட்டது"],
      ["பில்கள்", "32", "தயார்"],
      ["பணம்", "Rs. 128,750", "கிடைக்கிறது"],
    ],
  );
  const navItems = pick(
    locale,
    ["මුල් පුවරුව", "විකුණුම්", "තොග", "ගනුදෙනුකරුවන්", "බිල්", "VAT වාර්තාව"],
    ["Dashboard", "Sales", "Stock", "Customers", "Bills", "VAT return"],
    ["முகப்பு", "விற்பனை", "சரக்கு", "வாடிக்கையாளர்கள்", "பில்கள்", "VAT அறிக்கை"],
  );
  const sideCards = pick(
    locale,
    [["අඩු තොග", "Cooking Oil 5L", "ඒකක 2 ඉතිරි"], ["ලැබිය යුතු", "Rs. 85,420", "ණය ගනුදෙනුකරුවන්"], ["ගෙවිය යුතු VAT", "Rs. 9,500", "මෙම කාර්තුව"]],
    [["LOW STOCK", "Cooking Oil 5L", "2 units left"], ["RECEIVABLES", "Rs. 85,420", "Credit customers"], ["VAT PAYABLE", "Rs. 9,500", "This quarter"]],
    [["குறைந்த சரக்கு", "Cooking Oil 5L", "2 அலகுகள் மீதம்"], ["பெறத்தக்கவை", "Rs. 85,420", "கடன் வாடிக்கையாளர்கள்"], ["செலுத்த வேண்டிய VAT", "Rs. 9,500", "இந்த காலாண்டு"]],
  );

  return (
    <div className="relative mx-auto w-full max-w-[840px] pb-12" aria-hidden="true">
      <div className="absolute inset-x-16 bottom-4 h-24 rounded-full bg-teal-200/65 blur-3xl" />
      <div className="relative ml-auto w-[94%] rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-[0_38px_90px_rgba(15,23,42,0.17)]">
        <div className="overflow-hidden rounded-[1.3rem] border border-slate-200 bg-white">
          <div className="flex h-11 items-center gap-2 bg-slate-950 px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 hidden rounded-full bg-white/[0.07] px-3 py-1 text-[9px] font-medium text-slate-500 sm:block">lakbiz.app/dashboard</span>
          </div>

          <div className="grid min-h-[31rem] grid-cols-[5.5rem_1fr] bg-[#f6f8fb] sm:grid-cols-[10rem_1fr]">
            <aside className="bg-[#07111f] px-2.5 py-5 sm:px-4">
              <p className="mb-5 px-2 text-xs font-bold text-teal-300 sm:text-base">LakBiz</p>
              {navItems.map((item, index) => (
                <div key={item} className={`mb-1.5 rounded-lg px-2 py-2 text-[8px] font-semibold sm:px-2.5 sm:text-[10px] ${index === 0 ? "bg-teal-400/15 text-white" : "text-slate-600"}`}>{item}</div>
              ))}
            </aside>

            <div className="min-w-0 p-3 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="hidden h-9 flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 text-[10px] text-slate-400 shadow-sm sm:flex">{pick(locale, "ගනුදෙනු, භාණ්ඩ සහ ගනුදෙනුකරුවන් සොයන්න…", "Search transactions, products, customers…", "பரிவர்த்தனைகள், பொருட்கள், வாடிக்கையாளர்களைத் தேடுங்கள்…")}</div>
                <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                  <span className="h-6 w-6 rounded-full bg-teal-100" />
                  <span className="hidden text-[10px] font-semibold text-slate-700 md:block">{pick(locale, "වෙළඳසැල", "Customer Shop", "வாடிக்கையாளர் கடை")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {stats.map(([label, value, hint]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_14px_rgba(15,23,42,0.045)]">
                    <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1.5 truncate text-xs font-bold text-slate-950 sm:text-sm">{value}</p>
                    <p className="mt-1 text-[8px] font-semibold text-teal-600">{hint}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1.5fr_0.7fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-slate-800 sm:text-xs">{pick(locale, "විකුණුම් විශ්ලේෂණය", "Sales analytics", "விற்பனை பகுப்பாய்வு")}</p>
                    <span className="rounded-full bg-slate-50 px-2 py-1 text-[8px] font-semibold text-slate-400">{pick(locale, "මේ සතිය", "This week", "இந்த வாரம்")}</span>
                  </div>
                  <div className="mt-5 h-44 sm:h-52">
                    <svg viewBox="0 0 500 190" className="h-full w-full" preserveAspectRatio="none">
                      <defs><linearGradient id="heroChart" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity="0.22" /><stop offset="100%" stopColor="#14b8a6" stopOpacity="0" /></linearGradient></defs>
                      {[42, 84, 126, 168].map((y) => <line key={y} x1="0" x2="500" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />)}
                      <path d="M0 160 C55 142 72 118 122 126 C170 134 190 98 235 108 C288 120 302 70 355 84 C400 96 425 45 500 58 L500 190 L0 190 Z" fill="url(#heroChart)" />
                      <path d="M0 160 C55 142 72 118 122 126 C170 134 190 98 235 108 C288 120 302 70 355 84 C400 96 425 45 500 58" fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="hidden space-y-3 md:block">
                  {sideCards.map(([label, value, hint]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
                      <p className="mt-1.5 text-xs font-bold text-slate-900">{value}</p>
                      <p className="mt-1 text-[8px] text-slate-400">{hint}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-1 left-2 w-[8.5rem] rounded-[1.65rem] border-[5px] border-slate-950 bg-white p-2 shadow-[0_24px_58px_rgba(15,23,42,0.24)] sm:-left-3 sm:w-[10.6rem]">
        <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between px-1">
          <p className="text-[8px] font-bold text-slate-950">LakBiz</p>
          <span className="h-2 w-2 rounded-full bg-teal-500" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-1.5">
              <p className="truncate text-[5px] font-semibold text-slate-400">{label}</p>
              <p className="mt-0.5 truncate text-[7px] font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg bg-teal-600 px-2 py-2 text-center text-[6px] font-bold text-white">{pick(locale, "ඉක්මන් විකිණීම", "Quick sale", "விரைவு விற்பனை")}</div>
      </div>
    </div>
  );
}
