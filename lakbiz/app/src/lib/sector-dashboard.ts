import type { SectorId } from "@/lib/types";

export type DashboardLocale = "en" | "si";

export type SectorDashboardPreset = {
  titleEn: string;
  titleSi: string;
  subtitleEn: string;
  subtitleSi: string;
  onboardingTitleEn: string;
  onboardingTitleSi: string;
  onboardingDescriptionEn: string;
  onboardingDescriptionSi: string;
  onboardingStepsEn: string[];
  onboardingStepsSi: string[];
  primaryAction: { href: string; labelEn: string; labelSi: string };
};

const PRESETS: Record<SectorId, SectorDashboardPreset> = {
  grocery: {
    titleEn: "Shop operations",
    titleSi: "වෙළඳසැල් මෙහෙයුම්",
    subtitleEn: "Counter sales, stock, customer credit and daily cash movement at a glance.",
    subtitleSi: "අලෙවිය, තොගය, පාරිභෝගික ණය සහ දෛනික මුදල් ගමනාගමනය එකම තැනකින්.",
    onboardingTitleEn: "Set up your counter for the first sale",
    onboardingTitleSi: "පළමු අලෙවිය සඳහා ඔබේ වෙළඳසැල සූදානම් කරන්න",
    onboardingDescriptionEn: "Start with products and opening stock, then add regular credit customers and begin billing.",
    onboardingDescriptionSi: "භාණ්ඩ සහ ආරම්භක තොගය එක් කර, ණය පාරිභෝගිකයින් සකසා බිල් කිරීම ආරම්භ කරන්න.",
    onboardingStepsEn: ["Add products, barcodes and opening stock", "Add regular customers and credit limits", "Create the first sale"],
    onboardingStepsSi: ["භාණ්ඩ, බාර්කෝඩ් සහ ආරම්භක තොගය එක් කරන්න", "නිතිපතා පාරිභෝගිකයින් සහ ණය සීමා එක් කරන්න", "පළමු අලෙවිය සාදන්න"],
    primaryAction: { href: "/sales", labelEn: "New sale", labelSi: "නව අලෙවිය" },
  },
  pharmacy: {
    titleEn: "Pharmacy operations",
    titleSi: "ඖෂධ අලෙවිසැල් මෙහෙයුම්",
    subtitleEn: "Medicine sales, stock availability, expiry awareness and supplier flow.",
    subtitleSi: "ඖෂධ අලෙවිය, තොග පවතින බව, කල් ඉකුත්වීම සහ සැපයුම්කරු ගමනාගමනය.",
    onboardingTitleEn: "Build a pharmacy-ready medicine catalogue",
    onboardingTitleSi: "ෆාමසි සඳහා සූදානම් ඖෂධ ලැයිස්තුවක් සකස් කරන්න",
    onboardingDescriptionEn: "Add medicines with generic name, strength, pack and batch/expiry information before billing.",
    onboardingDescriptionSi: "බිල් කිරීමට පෙර ඖෂධයේ සාමාන්‍ය නාමය, ශක්තිය, පැකේජය සහ බැච්/කල් ඉකුත් තොරතුරු එක් කරන්න.",
    onboardingStepsEn: ["Add medicines and opening stock", "Record batch and expiry details", "Add suppliers and start billing"],
    onboardingStepsSi: ["ඖෂධ සහ ආරම්භක තොගය එක් කරන්න", "බැච් සහ කල් ඉකුත් තොරතුරු සටහන් කරන්න", "සැපයුම්කරුවන් එක් කර බිල් කිරීම ආරම්භ කරන්න"],
    primaryAction: { href: "/stock", labelEn: "Add medicine", labelSi: "ඖෂධයක් එක් කරන්න" },
  },
  electronics: {
    titleEn: "Electronics operations",
    titleSi: "ඉලෙක්ට්‍රොනික ව්‍යාපාර මෙහෙයුම්",
    subtitleEn: "Device sales, serials, warranties, stock and customer records in one workspace.",
    subtitleSi: "උපාංග අලෙවිය, අනුක්‍රමික අංක, වගකීම්, තොගය සහ පාරිභෝගික වාර්තා එකම තැනකින්.",
    onboardingTitleEn: "Set up serial-aware electronics stock",
    onboardingTitleSi: "අනුක්‍රමික අංක සමඟ ඉලෙක්ට්‍රොනික තොගය සකස් කරන්න",
    onboardingDescriptionEn: "Create products with brand, model and warranty information, then receive stock and begin selling.",
    onboardingDescriptionSi: "වෙළඳ නාමය, මාදිලිය සහ වගකීම් තොරතුරු සමඟ භාණ්ඩ සාදා තොගය ලබාගෙන අලෙවිය ආරම්භ කරන්න.",
    onboardingStepsEn: ["Create device and accessory catalogue", "Record serial/warranty details", "Receive stock and start sales"],
    onboardingStepsSi: ["උපාංග සහ අමතර උපාංග ලැයිස්තුව සකස් කරන්න", "අනුක්‍රමික සහ වගකීම් තොරතුරු සටහන් කරන්න", "තොගය ලබාගෙන අලෙවිය ආරම්භ කරන්න"],
    primaryAction: { href: "/stock", labelEn: "Add device", labelSi: "උපාංගයක් එක් කරන්න" },
  },
  mobile_shop: {
    titleEn: "Mobile shop operations",
    titleSi: "ජංගම දුරකථන වෙළඳසැල් මෙහෙයුම්",
    subtitleEn: "Phones, IMEI/serial tracking, repair parts, accessories and counter sales.",
    subtitleSi: "දුරකථන, IMEI/අනුක්‍රමික අංක, අලුත්වැඩියා කොටස්, උපාංග සහ අලෙවිය.",
    onboardingTitleEn: "Prepare phone and repair-parts inventory",
    onboardingTitleSi: "දුරකථන සහ අලුත්වැඩියා කොටස් තොගය සූදානම් කරන්න",
    onboardingDescriptionEn: "Add phone models, IMEI/serial details and compatible repair parts before opening the counter.",
    onboardingDescriptionSi: "වෙළඳසැල ආරම්භ කිරීමට පෙර දුරකථන මාදිලි, IMEI/අනුක්‍රමික තොරතුරු සහ ගැළපෙන අලුත්වැඩියා කොටස් එක් කරන්න.",
    onboardingStepsEn: ["Add phones, accessories and repair parts", "Record IMEI/serial and warranty details", "Start counter sales"],
    onboardingStepsSi: ["දුරකථන, උපාංග සහ අලුත්වැඩියා කොටස් එක් කරන්න", "IMEI/අනුක්‍රමික සහ වගකීම් තොරතුරු සටහන් කරන්න", "අලෙවිය ආරම්භ කරන්න"],
    primaryAction: { href: "/stock", labelEn: "Add phone or part", labelSi: "දුරකථනයක් හෝ කොටසක් එක් කරන්න" },
  },
  electricals: {
    titleEn: "Electricals operations",
    titleSi: "විදුලි භාණ්ඩ ව්‍යාපාර මෙහෙයුම්",
    subtitleEn: "Counter sales, cable/fixture stock, contractor customers and supplier purchasing.",
    subtitleSi: "අලෙවිය, කේබල්/උපාංග තොගය, කොන්ත්‍රාත් පාරිභෝගිකයින් සහ සැපයුම් මිලදී ගැනීම්.",
    onboardingTitleEn: "Set up electrical stock by unit and project",
    onboardingTitleSi: "ඒකකය සහ ව්‍යාපෘතිය අනුව විදුලි තොගය සකස් කරන්න",
    onboardingDescriptionEn: "Create cable, breaker, switch and fixture items with the units your staff actually sells.",
    onboardingDescriptionSi: "ඔබේ කණ්ඩායම භාවිතා කරන ඒකක අනුව කේබල්, බ්‍රේකර්, ස්විච් සහ උපාංග භාණ්ඩ සාදන්න.",
    onboardingStepsEn: ["Add stock with correct selling units", "Add contractor and credit customers", "Receive supplier stock and start sales"],
    onboardingStepsSi: ["නිවැරදි අලෙවි ඒකක සමඟ තොගය එක් කරන්න", "කොන්ත්‍රාත් සහ ණය පාරිභෝගිකයින් එක් කරන්න", "සැපයුම් තොගය ලබාගෙන අලෙවිය ආරම්භ කරන්න"],
    primaryAction: { href: "/stock", labelEn: "Add stock item", labelSi: "තොග භාණ්ඩයක් එක් කරන්න" },
  },
  spare_parts: {
    titleEn: "Parts counter operations",
    titleSi: "අමතර කොටස් ව්‍යාපාර මෙහෙයුම්",
    subtitleEn: "Part numbers, vehicle fitment, bin stock, supplier flow and fast-moving sales.",
    subtitleSi: "කොටස් අංක, වාහන ගැළපීම, බින් තොගය, සැපයුම් සහ වේගවත් අලෙවිය.",
    onboardingTitleEn: "Build a searchable parts catalogue",
    onboardingTitleSi: "ඉක්මනින් සෙවිය හැකි අමතර කොටස් ලැයිස්තුවක් සාදන්න",
    onboardingDescriptionEn: "Use part/OEM numbers, fitment and shelf locations so staff can find the right item quickly.",
    onboardingDescriptionSi: "නිවැරදි කොටස ඉක්මනින් සොයාගැනීමට Part/OEM අංක, ගැළපීම සහ රාක්ක ස්ථාන භාවිතා කරන්න.",
    onboardingStepsEn: ["Add parts with OEM/part numbers", "Add fitment and bin locations", "Receive supplier stock and start billing"],
    onboardingStepsSi: ["OEM/කොටස් අංක සමඟ කොටස් එක් කරන්න", "ගැළපීම සහ බින් ස්ථාන එක් කරන්න", "සැපයුම් තොගය ලබාගෙන බිල් කිරීම ආරම්භ කරන්න"],
    primaryAction: { href: "/stock", labelEn: "Add part", labelSi: "කොටසක් එක් කරන්න" },
  },
  footwear: {
    titleEn: "Footwear operations",
    titleSi: "පාවහන් ව්‍යාපාර මෙහෙයුම්",
    subtitleEn: "Style, size and colour availability, counter sales and supplier stock.",
    subtitleSi: "ස්ටයිල්, ප්‍රමාණ සහ වර්ණ තොගය, අලෙවිය සහ සැපයුම් තොගය.",
    onboardingTitleEn: "Build stock around styles, sizes and colours",
    onboardingTitleSi: "ස්ටයිල්, ප්‍රමාණ සහ වර්ණ අනුව තොගය සකස් කරන්න",
    onboardingDescriptionEn: "Create products with article/style codes and the size/colour combinations customers ask for.",
    onboardingDescriptionSi: "පාරිභෝගිකයින් ඉල්ලන ප්‍රමාණ සහ වර්ණ සංයෝජන සමඟ article/style කේත භාවිතා කර භාණ්ඩ සාදන්න.",
    onboardingStepsEn: ["Add footwear styles", "Add size and colour stock", "Start billing and track fast-selling sizes"],
    onboardingStepsSi: ["පාවහන් ස්ටයිල් එක් කරන්න", "ප්‍රමාණ සහ වර්ණ තොගය එක් කරන්න", "බිල් කිරීම ආරම්භ කර වේගයෙන් අලෙවි වන ප්‍රමාණ බලන්න"],
    primaryAction: { href: "/stock", labelEn: "Add footwear", labelSi: "පාවහන් එක් කරන්න" },
  },
  textile: {
    titleEn: "Textile trading operations",
    titleSi: "රෙදි වෙළඳ මෙහෙයුම්",
    subtitleEn: "Roll stock, measured sales, wholesale customers, supplier flow and credit exposure.",
    subtitleSi: "Roll තොගය, මිනුම් අලෙවිය, තොග පාරිභෝගිකයින්, සැපයුම් සහ ණය පාලනය.",
    onboardingTitleEn: "Open your textile counter with real roll control",
    onboardingTitleSi: "නිවැරදි Roll පාලනය සමඟ රෙදි වෙළඳසැල ආරම්භ කරන්න",
    onboardingDescriptionEn: "Set up the four records needed for Pettah-style wholesale rolls and retail measured cuts.",
    onboardingDescriptionSi: "Pettah ආකාරයේ තොග Roll අලෙවිය සහ සිල්ලර මිනුම් කැපීම් සඳහා අවශ්‍ය වාර්තා හතර සකසන්න.",
    onboardingStepsEn: ["Add fabric styles and selling units", "Receive the first physical roll", "Configure wholesale customer terms", "Create the first fabric sale"],
    onboardingStepsSi: ["රෙදි වර්ග සහ අලෙවි ඒකක එක් කරන්න", "පළමු භෞතික Roll එක ලබාගන්න", "තොග පාරිභෝගික කොන්දේසි සකසන්න", "පළමු රෙදි අලෙවිය සාදන්න"],
    primaryAction: { href: "/sales", labelEn: "New fabric sale", labelSi: "නව රෙදි අලෙවිය" },
  },
  ac_hvac: {
    titleEn: "HVAC operations",
    titleSi: "HVAC මෙහෙයුම්",
    subtitleEn: "Installations, repairs, service schedules, field teams and parts in one command center.",
    subtitleSi: "ස්ථාපන, අලුත්වැඩියා, සේවා කාලසටහන්, ක්ෂේත්‍ර කණ්ඩායම් සහ කොටස් එකම තැනකින්.",
    onboardingTitleEn: "Prepare the HVAC workflow before the first job",
    onboardingTitleSi: "පළමු වැඩට පෙර HVAC ක්‍රියාමාර්ගය සූදානම් කරන්න",
    onboardingDescriptionEn: "Add customers, AC units/parts and workforce details, then create the first installation or service job.",
    onboardingDescriptionSi: "පාරිභෝගිකයින්, AC ඒකක/කොටස් සහ කණ්ඩායම් තොරතුරු එක් කර පළමු ස්ථාපන හෝ සේවා වැඩය සාදන්න.",
    onboardingStepsEn: ["Add customers and AC stock/parts", "Add technicians or contractors", "Create the first job and schedule it"],
    onboardingStepsSi: ["පාරිභෝගිකයින් සහ AC තොග/කොටස් එක් කරන්න", "තාක්ෂණිකයින් හෝ කොන්ත්‍රාත්කරුවන් එක් කරන්න", "පළමු වැඩය සාදා කාලසටහනට එක් කරන්න"],
    primaryAction: { href: "/jobs", labelEn: "New job", labelSi: "නව වැඩක්" },
  },
  car_sales: {
    titleEn: "Vehicle operations",
    titleSi: "වාහන ව්‍යාපාර මෙහෙයුම්",
    subtitleEn: "Vehicle stock, aging, customer pipeline and sales activity in one owner view.",
    subtitleSi: "වාහන තොගය, තොගයේ කාලය, පාරිභෝගික ප්‍රවාහය සහ අලෙවි ක්‍රියාකාරකම් එකම තැනකින්.",
    onboardingTitleEn: "Create your first vehicle stock record",
    onboardingTitleSi: "ඔබේ පළමු වාහන තොග වාර්තාව සාදන්න",
    onboardingDescriptionEn: "Add vehicles with chassis identity and selling details, then add customers and sales activity.",
    onboardingDescriptionSi: "චැසි හඳුනාගැනීම සහ අලෙවි තොරතුරු සමඟ වාහන එක් කර පාරිභෝගික හා අලෙවි ක්‍රියාකාරකම් සකස් කරන්න.",
    onboardingStepsEn: ["Add a vehicle with chassis identity", "Record the customer and enquiry", "Complete the first vehicle sale"],
    onboardingStepsSi: ["චැසි හඳුනාගැනීම සමඟ වාහනයක් එක් කරන්න", "පාරිභෝගිකයා සහ විමසීම සටහන් කරන්න", "පළමු වාහන අලෙවිය සම්පූර්ණ කරන්න"],
    primaryAction: { href: "/vehicles", labelEn: "Add vehicle", labelSi: "වාහනයක් එක් කරන්න" },
  },
};

export function sectorDashboardPreset(sectorId: SectorId): SectorDashboardPreset {
  return PRESETS[sectorId] ?? PRESETS.grocery;
}

export function localizedDashboardPreset(sectorId: SectorId, locale: DashboardLocale) {
  const preset = sectorDashboardPreset(sectorId);
  const si = locale === "si";
  return {
    title: si ? preset.titleSi : preset.titleEn,
    subtitle: si ? preset.subtitleSi : preset.subtitleEn,
    onboardingTitle: si ? preset.onboardingTitleSi : preset.onboardingTitleEn,
    onboardingDescription: si ? preset.onboardingDescriptionSi : preset.onboardingDescriptionEn,
    onboardingSteps: si ? preset.onboardingStepsSi : preset.onboardingStepsEn,
    primaryAction: {
      href: preset.primaryAction.href,
      label: si ? preset.primaryAction.labelSi : preset.primaryAction.labelEn,
    },
  };
}
