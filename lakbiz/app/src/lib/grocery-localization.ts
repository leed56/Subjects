import type { Locale } from "@/lib/i18n/translations";

/**
 * Display-only localization for the LakBiz starter grocery catalogue.  The
 * stable SKU is deliberately the key: switching language never changes the
 * record that stock, sales, barcode lookup or accounting depend on.
 */
type Localized = Record<Locale, string>;

type GroceryProductLike = {
  name: string;
  sku?: string | null;
  category?: string | null;
  customFields?: Record<string, unknown>;
};

const productLabels: Record<string, Localized> = {
  "GRC-BAN-001": { en: "Banana", si: "කෙසෙල්", ta: "வாழைப்பழம்" },
  "GRC-APL-001": { en: "Apple", si: "ඇපල්", ta: "ஆப்பிள்" },
  "GRC-TOM-001": { en: "Tomato", si: "තක්කාලි", ta: "தக்காளி" },
  "GRC-POT-001": { en: "Potato", si: "අර්තාපල්", ta: "உருளைக்கிழங்கு" },
  "GRC-ONI-001": { en: "Red Onion", si: "රතු ලූනු", ta: "சிவப்பு வெங்காயம்" },
  "GRC-CAR-001": { en: "Carrot", si: "කැරට්", ta: "காரட்" },
  "GRC-GIN-001": { en: "Ginger", si: "ඉඟුරු", ta: "இஞ்சி" },
  "GRC-CHI-001": { en: "Green Chilli", si: "අමු මිරිස්", ta: "பச்சை மிளகாய்" },
  "GRC-CHK-001": { en: "Chicken", si: "කුකුල් මස්", ta: "கோழி இறைச்சி" },
  "GRC-BRD-001": { en: "Bread", si: "පාන්", ta: "ரொட்டி" },
  "GRC-RIC-001": { en: "Rice", si: "සහල්", ta: "அரிசி" },
  "GRC-FLR-001": { en: "Wheat Flour", si: "තිරිඟු පිටි", ta: "கோதுமை மா" },
  "GRC-SUG-001": { en: "Sugar", si: "සීනි", ta: "சர்க்கரை" },
  "GRC-COC-001": { en: "Coconut", si: "පොල්", ta: "தேங்காய்" },
  "GRC-EGG-001": { en: "Eggs", si: "බිත්තර", ta: "முட்டை" },
  "GRC-MLK-001": { en: "Fresh Milk", si: "නැවුම් කිරි", ta: "புதிய பால்" },
  "GRC-MILL-CHP-001": { en: "Chilli Powder", si: "මිරිස් කුඩු", ta: "மிளகாய்த் தூள்" },
  "GRC-MILL-CHL-001": { en: "Chilli Pieces", si: "මිරිස් කෑලි", ta: "மிளகாய்த் துண்டுகள்" },
  "GRC-MILL-RCH-001": { en: "Roasted Chilli Powder", si: "බැදපු මිරිස් කුඩු", ta: "வறுத்த மிளகாய்த் தூள்" },
  "GRC-MILL-TUR-001": { en: "Turmeric Powder", si: "කහ කුඩු", ta: "மஞ்சள் தூள்" },
  "GRC-MILL-COR-001": { en: "Coriander Powder", si: "කොත්තමල්ලි කුඩු", ta: "கொத்தமல்லித் தூள்" },
  "GRC-MILL-CUM-001": { en: "Cumin Powder", si: "සූදුරු කුඩු", ta: "சீரகத் தூள்" },
  "GRC-MILL-RCU-001": { en: "Roasted Cumin Powder", si: "බැදපු සූදුරු කුඩු", ta: "வறுத்த சீரகத் தூள்" },
  "GRC-MILL-FEN-001": { en: "Fennel Powder", si: "මහදුරු කුඩු", ta: "பெருஞ்சீரகத் தூள்" },
  "GRC-MILL-FGK-001": { en: "Fenugreek Powder", si: "උළුහාල් කුඩු", ta: "வெந்தயத் தூள்" },
  "GRC-MILL-PEP-001": { en: "Black Pepper Powder", si: "ගම්මිරිස් කුඩු", ta: "கருமிளகுத் தூள்" },
  "GRC-MILL-CIN-001": { en: "Cinnamon Powder", si: "කුරුඳු කුඩු", ta: "பட்டைத் தூள்" },
  "GRC-MILL-MUS-001": { en: "Mustard Powder", si: "අබ කුඩු", ta: "கடுகுத் தூள்" },
  "GRC-MILL-GIN-001": { en: "Ginger Powder", si: "ඉඟුරු කුඩු", ta: "இஞ்சித் தூள்" },
  "GRC-MILL-CLO-001": { en: "Clove Powder", si: "කරාබු නැටි කුඩු", ta: "கிராம்புத் தூள்" },
  "GRC-MILL-CAR-001": { en: "Cardamom Powder", si: "එනසාල් කුඩු", ta: "ஏலக்காய்த் தூள்" },
  "GRC-MILL-NUT-001": { en: "Nutmeg Powder", si: "සාදික්කා කුඩු", ta: "ஜாதிக்காய்த் தூள்" },
  "GRC-MILL-GOR-001": { en: "Goraka Powder", si: "ගොරකා කුඩු", ta: "கொரக்கா தூள்" },
  "GRC-MILL-CLF-001": { en: "Curry Leaf Powder", si: "කරපිංචා කුඩු", ta: "கறிவேப்பிலைத் தூள்" },
  "GRC-MILL-RAW-001": { en: "Raw Curry Powder", si: "අමු තුනපහ", ta: "வறுக்காத கறித் தூள்" },
  "GRC-MILL-RST-001": { en: "Roasted Curry Powder", si: "බැදපු තුනපහ", ta: "வறுத்த கறித் தூள்" },
  "GRC-MILL-JAF-001": { en: "Jaffna Curry Powder", si: "යාපනය තුනපහ", ta: "யாழ்ப்பாணக் கறித் தூள்" },
  "GRC-MILL-MEA-001": { en: "Meat Curry Powder", si: "මස් කරි තුනපහ", ta: "இறைச்சிக் கறித் தூள்" },
  "GRC-MILL-FIS-001": { en: "Fish Curry Powder", si: "මාළු කරි තුනපහ", ta: "மீன் கறித் தூள்" },
  "GRC-MILL-CKM-001": { en: "Chicken Masala", si: "කුකුල් මස් මසාලා", ta: "கோழி மசாலா" },
  "GRC-MILL-FSM-001": { en: "Fish Masala", si: "මාළු මසාලා", ta: "மீன் மசாலா" },
  "GRC-MILL-BIR-001": { en: "Biryani Masala", si: "බිරියානි මසාලා", ta: "பிரியாணி மசாலா" },
  "GRC-MILL-GAR-001": { en: "Garam Masala", si: "ගරම් මසාලා", ta: "கரம் மசாலா" },
  "GRC-MILL-SAM-001": { en: "Sambar Powder", si: "සාම්බාර් කුඩු", ta: "சாம்பார் பொடி" },
  "GRC-MILL-RRF-001": { en: "Red Rice Flour", si: "රතු සහල් පිටි", ta: "சிவப்பரிசி மா" },
  "GRC-MILL-WRF-001": { en: "White Rice Flour", si: "සුදු සහල් පිටි", ta: "வெள்ளையரிசி மா" },
  "GRC-MILL-KUR-001": { en: "Kurakkan Flour", si: "කුරක්කන් පිටි", ta: "குரக்கன் மா" },
  "GRC-MILL-GRF-001": { en: "Gram Flour", si: "කඩල පිටි", ta: "கடலை மா" },
  "GRC-MILL-UND-001": { en: "Undu Flour", si: "උඳු පිටි", ta: "உளுந்து மா" },
  "GRC-MILL-ATT-001": { en: "Atta Flour", si: "ආටා පිටි", ta: "ஆட்டா மா" },
  "GRC-MILL-THO-001": { en: "Thosai Mix", si: "තෝසේ මිශ්‍රණය", ta: "தோசை மாவுக் கலவை" },
  "GRC-MILL-HOP-001": { en: "Hopper Mix", si: "ආප්ප මිශ්‍රණය", ta: "ஆப்ப மாவுக் கலவை" },
};

const categoryLabels: Record<string, Localized> = {
  "All Products": { en: "All Products", si: "සියලු භාණ්ඩ", ta: "அனைத்து பொருட்கள்" },
  Fruits: { en: "Fruits", si: "පලතුරු", ta: "பழங்கள்" },
  Vegetables: { en: "Vegetables", si: "එළවළු", ta: "காய்கறிகள்" },
  "Meat & Poultry": { en: "Meat & Poultry", si: "මස් සහ කුකුල් මස්", ta: "இறைச்சி மற்றும் கோழி" },
  Dairy: { en: "Dairy", si: "කිරි නිෂ්පාදන", ta: "பால் பொருட்கள்" },
  Bakery: { en: "Bakery", si: "බේකරි", ta: "பேக்கரி" },
  "Rice, Flour & Dry Goods": { en: "Rice, Flour & Dry Goods", si: "සහල්, පිටි සහ වියළි භාණ්ඩ", ta: "அரிசி, மாவு மற்றும் உலர் பொருட்கள்" },
  "Spices & Seasoning": { en: "Spices & Seasoning", si: "කුළුබඩු සහ රසකාරක", ta: "மசாலா மற்றும் சுவையூட்டிகள்" },
  Beverages: { en: "Beverages", si: "පානයන්", ta: "பானங்கள்" },
  Household: { en: "Household", si: "ගෘහස්ථ භාණ්ඩ", ta: "வீட்டு உபயோகப் பொருட்கள்" },
  "Frozen Meat & Seafood": { en: "Meat & Poultry", si: "මස් සහ කුකුල් මස්", ta: "இறைச்சி மற்றும் கோழி" },
  "Bread & Buns": { en: "Bakery", si: "බේකරි", ta: "பேக்கரி" },
  "Rice, Flour & Grains": { en: "Rice, Flour & Dry Goods", si: "සහල්, පිටි සහ වියළි භාණ්ඩ", ta: "அரிசி, மாவு மற்றும் உலர் பொருட்கள்" },
  "Sugar & Salt": { en: "Rice, Flour & Dry Goods", si: "සහල්, පිටි සහ වියළි භාණ්ඩ", ta: "அரிசி, மாவு மற்றும் உலர் பொருட்கள்" },
  "Coconut Products": { en: "Household", si: "ගෘහස්ථ භාණ්ඩ", ta: "வீட்டு உபயோகப் பொருட்கள்" },
  Eggs: { en: "Dairy", si: "කිරි නිෂ්පාදන", ta: "பால் பொருட்கள்" },
  "Milk & Dairy": { en: "Dairy", si: "කිරි නිෂ්පාදන", ta: "பால் பொருட்கள்" },
};

const unitLabels: Record<string, Localized> = {
  "1 kg": { en: "1 kg", si: "1 කිලෝග්‍රෑම්", ta: "1 கிலோ" },
  "250 g": { en: "250 g", si: "250 ග්‍රෑම්", ta: "250 கிராம்" },
  "50 g": { en: "50 g", si: "50 ග්‍රෑම්", ta: "50 கிராம்" },
  "100 g": { en: "100 g", si: "100 ග්‍රෑම්", ta: "100 கிராம்" },
  "200 g": { en: "200 g", si: "200 ග්‍රෑම්", ta: "200 கிராம்" },
  "400 g": { en: "400 g", si: "400 ග්‍රෑම්", ta: "400 கிராம்" },
  "500 g": { en: "500 g", si: "500 ග්‍රෑම්", ta: "500 கிராம்" },
  "1 L": { en: "1 L", si: "1 ලීටර්", ta: "1 லிட்டர்" },
  each: { en: "each", si: "එකක්", ta: "ஒன்று" },
  "1 loaf": { en: "1 loaf", si: "පාන් ගෙඩියක්", ta: "1 ரொட்டி" },
  "10 pack": { en: "10 pack", si: "බිත්තර 10 පැකට්ටුව", ta: "10 முட்டை பொதி" },
  kg: { en: "kg", si: "කිලෝග්‍රෑම්", ta: "கிலோ" },
  L: { en: "L", si: "ලීටර්", ta: "லிட்டர்" },
  pcs: { en: "pieces", si: "කෑලි", ta: "துண்டுகள்" },
  pack: { en: "pack", si: "පැකට්ටුව", ta: "பொதி" },
};

export type GroceryUiKey =
  | "searchPlaceholder" | "newBill" | "holdBill" | "recallBill" | "priceCheck" | "inventory"
  | "groceryPos" | "fastCheckout" | "checkoutDescription" | "todaySales" | "billsGenerated"
  | "averageBill" | "itemsSold" | "noBillsYet" | "completedToday" | "fromCheckout"
  | "todayBills" | "popularProducts" | "allProducts" | "inStock" | "lowStock" | "add"
  | "showMore" | "noMatchingProducts" | "emptyCategory" | "emptyCategoryHint" | "openStock"
  | "cart" | "checkout" | "noItemsSelected" | "chooseProducts" | "removeItem" | "decrease"
  | "increase" | "unit" | "splitPayment" | "completed" | "completedBill" | "saleFailed"
  | "receipt" | "customer" | "return" | "stock" | "liveStoreData" | "activeItems"
  | "outOfStock" | "salesOverview" | "categorySales" | "shelfAlerts" | "topProducts"
  | "recentTransactions" | "inventoryHealth" | "viewStock" | "viewReport" | "viewBills"
  | "noSalesYet" | "salesWillAppear" | "topSellersWillAppear" | "shelvesReady"
  | "readyToSell" | "itemsLeft" | "tax" | "discount" | "subtotal" | "total";

const ui: Record<GroceryUiKey, Localized> = {
  searchPlaceholder: { en: "Search products, scan barcode or enter SKU…", si: "භාණ්ඩය, SKU හෝ තීරු කේතය සොයන්න…", ta: "பொருட்கள், SKU அல்லது பட்டைக் குறியீட்டைத் தேடவும்…" },
  newBill: { en: "New bill", si: "නව බිල්පත", ta: "புதிய பில்" },
  holdBill: { en: "Hold bill", si: "බිල්පත රඳවන්න", ta: "பில்லை நிறுத்து" },
  recallBill: { en: "Recall bill", si: "බිල්පත නැවත කැඳවන්න", ta: "பில்லை மீட்டெடு" },
  priceCheck: { en: "Price check", si: "මිල බලන්න", ta: "விலை பார்க்க" },
  inventory: { en: "Inventory", si: "තොගය", ta: "சரக்கு" },
  groceryPos: { en: "Grocery POS / Billing", si: "සිල්ලර POS / බිල්පත්", ta: "மளிகை POS / பில்லிங்" },
  fastCheckout: { en: "Fast grocery checkout", si: "වේගවත් සිල්ලර ගෙවීම", ta: "வேகமான மளிகை கட்டணம்" },
  checkoutDescription: { en: "Scan a barcode, choose products and complete a Sri Lankan retail bill in one place.", si: "තීරු කේතය කියවා, භාණ්ඩ තෝරා ශ්‍රී ලංකා සිල්ලර බිල්පත එකම තැනකින් සම්පූර්ණ කරන්න.", ta: "பட்டைக் குறியீட்டைப் படித்து, பொருட்களைத் தேர்ந்தெடுத்து இலங்கை சில்லறை பில்லை ஒரே இடத்தில் முடிக்கவும்." },
  todaySales: { en: "Today’s sales", si: "අද විකුණුම්", ta: "இன்றைய விற்பனை" },
  billsGenerated: { en: "Bills generated", si: "සාදන ලද බිල්පත්", ta: "உருவாக்கிய பில்கள்" },
  averageBill: { en: "Average bill value", si: "සාමාන්‍ය බිල්පත", ta: "சராசரி பில் மதிப்பு" },
  itemsSold: { en: "Items sold", si: "විකුණු භාණ්ඩ", ta: "விற்ற பொருட்கள்" },
  noBillsYet: { en: "No completed bill yet", si: "සම්පූර්ණ කළ බිල්පතක් තවම නැත", ta: "முடிக்கப்பட்ட பில் இன்னும் இல்லை" },
  completedToday: { en: "Completed today", si: "අද සම්පූර්ණ කළ බිල්පත්", ta: "இன்று முடிக்கப்பட்டது" },
  fromCheckout: { en: "From completed checkout", si: "සම්පූර්ණ කළ ගෙවීමෙන්", ta: "முடிக்கப்பட்ட கட்டணத்திலிருந்து" },
  todayBills: { en: "Across today’s bills", si: "අද බිල්පත් හරහා", ta: "இன்றைய பில்கள் முழுவதும்" },
  popularProducts: { en: "Popular products", si: "ජනප්‍රිය භාණ්ඩ", ta: "பிரபல பொருட்கள்" },
  allProducts: { en: "All Products", si: "සියලු භාණ්ඩ", ta: "அனைத்து பொருட்கள்" },
  inStock: { en: "in stock", si: "තොගයේ ඇත", ta: "கையிருப்பில் உள்ளது" },
  lowStock: { en: "Low stock", si: "අඩු තොගය", ta: "குறைந்த சரக்கு" },
  add: { en: "Add", si: "එකතු කරන්න", ta: "சேர்" },
  showMore: { en: "Show more products", si: "තවත් භාණ්ඩ පෙන්වන්න", ta: "மேலும் பொருட்களைக் காட்டு" },
  noMatchingProducts: { en: "No matching products", si: "ගැලපෙන භාණ්ඩ හමු නොවීය", ta: "பொருந்தும் பொருட்கள் இல்லை" },
  emptyCategory: { en: "This category has no products yet", si: "මෙම කාණ්ඩයේ භාණ්ඩ තවම නැත", ta: "இந்த வகையில் இன்னும் பொருட்கள் இல்லை" },
  emptyCategoryHint: { en: "Add a product in Stock or choose another grocery category.", si: "තොගයට භාණ්ඩයක් එක් කරන්න හෝ වෙනත් සිල්ලර කාණ්ඩයක් තෝරන්න.", ta: "சரக்கில் பொருளைச் சேர்க்கவும் அல்லது வேறு மளிகை வகையைத் தேர்ந்தெடுக்கவும்." },
  openStock: { en: "Open stock", si: "තොගය විවෘත කරන්න", ta: "சரக்கைத் திற" },
  cart: { en: "Cart", si: "කරත්තය", ta: "கூடை" },
  checkout: { en: "Checkout", si: "ගෙවීම", ta: "கட்டணம்" },
  noItemsSelected: { en: "No items selected", si: "භාණ්ඩ තෝරා නැත", ta: "பொருட்கள் தேர்ந்தெடுக்கப்படவில்லை" },
  chooseProducts: { en: "Choose products from the left to build the bill.", si: "බිල්පත සෑදීමට වමෙන් භාණ්ඩ තෝරන්න.", ta: "பில்லை உருவாக்க இடதுபுறத்தில் பொருட்களைத் தேர்ந்தெடுக்கவும்." },
  removeItem: { en: "Remove item", si: "භාණ්ඩය ඉවත් කරන්න", ta: "பொருளை அகற்று" },
  decrease: { en: "Decrease by 1", si: "1 කින් අඩු කරන්න", ta: "1 குறைக்கவும்" },
  increase: { en: "Increase by 1", si: "1 කින් වැඩි කරන්න", ta: "1 அதிகரிக்கவும்" },
  unit: { en: "units", si: "ඒකක", ta: "அலகுகள்" },
  splitPayment: { en: "Split payment", si: "බෙදා ගෙවීම", ta: "பிரித்த கட்டணம்" },
  completed: { en: "Complete payment", si: "ගෙවීම සම්පූර්ණ කරන්න", ta: "கட்டணத்தை முடிக்கவும்" },
  completedBill: { en: "Sale completed", si: "විකිණීම සම්පූර්ණයි", ta: "விற்பனை முடிந்தது" },
  saleFailed: { en: "Sale could not be completed", si: "විකිණීම සම්පූර්ණ කළ නොහැක", ta: "விற்பனையை முடிக்க முடியவில்லை" },
  receipt: { en: "Receipt", si: "ලදුපත", ta: "ரசீது" },
  customer: { en: "Customer", si: "ගනුදෙනුකරු", ta: "வாடிக்கையாளர்" },
  return: { en: "Return", si: "ආපසු භාරගැනීම", ta: "திரும்பப்பெறல்" },
  stock: { en: "Stock", si: "තොගය", ta: "சரக்கு" },
  liveStoreData: { en: "Live store data", si: "සජීවී වෙළඳසැල් දත්ත", ta: "நேரடி கடைத் தரவு" },
  activeItems: { en: "active items", si: "සක්‍රිය භාණ්ඩ", ta: "செயலில் உள்ள பொருட்கள்" },
  outOfStock: { en: "out of stock", si: "තොගයේ නැත", ta: "கையிருப்பில் இல்லை" },
  salesOverview: { en: "Sales overview", si: "විකුණුම් සමාලෝචනය", ta: "விற்பனை கண்ணோட்டம்" },
  categorySales: { en: "Category sales", si: "කාණ්ඩ විකුණුම්", ta: "வகை விற்பனை" },
  shelfAlerts: { en: "Shelf alerts", si: "රාක්ක අනතුරු ඇඟවීම්", ta: "அலமாரி எச்சரிக்கைகள்" },
  topProducts: { en: "Top selling products", si: "වැඩිම විකුණුම් භාණ්ඩ", ta: "அதிகம் விற்கும் பொருட்கள்" },
  recentTransactions: { en: "Recent transactions", si: "මෑත ගනුදෙනු", ta: "சமீபத்திய பரிவர்த்தனைகள்" },
  inventoryHealth: { en: "Inventory status", si: "තොග තත්ත්වය", ta: "சரக்கு நிலை" },
  viewStock: { en: "View stock", si: "තොගය බලන්න", ta: "சரக்கைப் பார்" },
  viewReport: { en: "View report", si: "වාර්තාව බලන්න", ta: "அறிக்கையைப் பார்" },
  viewBills: { en: "View bills", si: "බිල්පත් බලන්න", ta: "பில்களைப் பார்" },
  noSalesYet: { en: "No sales yet", si: "විකුණුම් තවම නැත", ta: "இன்னும் விற்பனை இல்லை" },
  salesWillAppear: { en: "Sales will appear here after checkout.", si: "ගෙවීම සම්පූර්ණ වූ පසු විකුණුම් මෙහි පෙන්වයි.", ta: "கட்டணம் முடிந்த பின் விற்பனை இங்கே தோன்றும்." },
  topSellersWillAppear: { en: "Top sellers will appear after recorded sales.", si: "විකුණුම් සටහන් වූ පසු වැඩිම විකුණුම් මෙහි පෙන්වයි.", ta: "விற்பனை பதிவான பின் அதிகம் விற்கும் பொருட்கள் தோன்றும்." },
  shelvesReady: { en: "Shelves are ready to sell.", si: "රාක්ක විකිණීමට සූදානම්.", ta: "அலமாரிகள் விற்பனைக்குத் தயாராக உள்ளன." },
  readyToSell: { en: "Ready to sell", si: "විකිණීමට සූදානම්", ta: "விற்பனைக்கு தயார்" },
  itemsLeft: { en: "left", si: "ඉතිරි", ta: "மீதம்" },
  tax: { en: "Tax", si: "බදු", ta: "வரி" },
  discount: { en: "Discount", si: "වට්ටම", ta: "தள்ளுபடி" },
  subtotal: { en: "Subtotal", si: "උප එකතුව", ta: "இடைத் தொகை" },
  total: { en: "Total", si: "මුළු එකතුව", ta: "மொத்தம்" },
};

export function groceryUi(locale: Locale, key: GroceryUiKey): string {
  return ui[key][locale];
}

export function isStarterGroceryProduct(product: Pick<GroceryProductLike, "sku">): boolean {
  return Boolean(product.sku && productLabels[product.sku]);
}

export function groceryProductLabel(product: GroceryProductLike, locale: Locale): string {
  const canonical = product.sku ? productLabels[product.sku] : undefined;
  return canonical && product.name === canonical.en ? canonical[locale] : product.name;
}

export function groceryCategoryLabel(category: string | null | undefined, locale: Locale): string {
  const source = category?.trim() || "";
  return categoryLabels[source]?.[locale] ?? source;
}

export function groceryUnitLabel(value: unknown, locale: Locale): string {
  const source = typeof value === "string" ? value.trim() : "";
  return unitLabels[source]?.[locale] ?? (source || ui.unit[locale]);
}

/** Search aliases include all three display languages while leaving custom
 * owner-created names intact. This makes scan/search independent of the UI
 * language without storing translated copies in tenant data. */
export function groceryProductSearchText(product: GroceryProductLike): string {
  const canonical = product.sku ? productLabels[product.sku] : undefined;
  const productAliases = canonical && product.name === canonical.en ? canonical : undefined;
  const categoryAliases = categoryLabels[product.category?.trim() ?? ""];
  const unit = product.customFields?.unitVariant ?? product.customFields?.unit;
  const unitAliases = typeof unit === "string" ? unitLabels[unit] : undefined;
  return [
    product.name,
    product.sku,
    product.category,
    product.customFields?.barcode,
    ...(productAliases ? Object.values(productAliases) : []),
    ...(categoryAliases ? Object.values(categoryAliases) : []),
    ...(unitAliases ? Object.values(unitAliases) : []),
  ]
    .filter(Boolean)
    .map(String)
    .join(" ")
    .toLocaleLowerCase();
}

export type GroceryWorkspacePage = "bills" | "customers" | "suppliers" | "returns" | "expenses" | "reports" | "vatSettings" | "vatReturn";

type WorkspaceCopy = { eyebrow: string; title: string; description: string };

const workspaceCopy: Record<GroceryWorkspacePage, Record<Locale, WorkspaceCopy>> = {
  bills: {
    en: { eyebrow: "Grocery sales ledger", title: "Bills & orders", description: "Review completed checkout records in your LakBiz sales register." },
    si: { eyebrow: "සිල්ලර විකුණුම් ලේඛනය", title: "බිල්පත් සහ ඇණවුම්", description: "ඔබේ LakBiz විකුණුම් ලේඛනයේ සම්පූර්ණ කළ ගෙවීම් වාර්තා බලන්න." },
    ta: { eyebrow: "மளிகை விற்பனைப் பதிவு", title: "பில்கள் மற்றும் ஆர்டர்கள்", description: "உங்கள் LakBiz விற்பனைப் பதிவில் முடிக்கப்பட்ட கட்டணப் பதிவுகளைப் பார்க்கவும்." },
  },
  customers: {
    en: { eyebrow: "Grocery retail", title: "Customer directory", description: "Keep walk-in and account customer details ready for a fast checkout." },
    si: { eyebrow: "සිල්ලර වෙළඳාම", title: "ගනුදෙනුකරු ලැයිස්තුව", description: "වේගවත් ගෙවීමක් සඳහා සාමාන්‍ය සහ ගිණුම් ගනුදෙනුකරුවන්ගේ විස්තර සූදානම්ව තබාගන්න." },
    ta: { eyebrow: "மளிகை சில்லறை", title: "வாடிக்கையாளர் பட்டியல்", description: "விரைவான கட்டணத்திற்காக நேரடி மற்றும் கணக்கு வாடிக்கையாளர்களின் விவரங்களைத் தயாராக வைத்திருங்கள்." },
  },
  suppliers: {
    en: { eyebrow: "Supply & replenishment", title: "Suppliers & goods receipts", description: "Keep grocery suppliers, purchase orders, goods receipts and payables in one compact workspace." },
    si: { eyebrow: "සැපයුම සහ නැවත පිරවීම", title: "සැපයුම්කරුවන් සහ භාණ්ඩ ලැබීම්", description: "සිල්ලර සැපයුම්කරුවන්, මිලදී ගැනීමේ ඇණවුම්, භාණ්ඩ ලැබීම් සහ ගෙවිය යුතු මුදල් එකම වැඩබිමක තබාගන්න." },
    ta: { eyebrow: "வழங்கல் மற்றும் மீள்நிரப்பு", title: "வழங்குநர்கள் மற்றும் பொருள் ரசீதுகள்", description: "மளிகை வழங்குநர்கள், கொள்முதல் ஆர்டர்கள், பொருள் ரசீதுகள் மற்றும் நிலுவைகளை ஒரே பணியிடத்தில் வைத்திருங்கள்." },
  },
  returns: {
    en: { eyebrow: "Retail returns", title: "Returns control", description: "Process documented returns, credit notes and refunds without changing the original sale." },
    si: { eyebrow: "සිල්ලර ආපසු භාරගැනීම්", title: "ආපසු භාරගැනීම් පාලනය", description: "මුල් විකිණීම වෙනස් නොකර ලේඛනගත ආපසු භාරගැනීම්, ණය සටහන් සහ මුදල් ආපසු ගෙවීම් සකසන්න." },
    ta: { eyebrow: "சில்லறை திரும்பப்பெறல்கள்", title: "திரும்பப்பெறல் கட்டுப்பாடு", description: "அசல் விற்பனையை மாற்றாமல் ஆவணப்படுத்திய திரும்பப்பெறல்கள், கடன் குறிப்புகள் மற்றும் பணத்தைத் திருப்பிச் செலுத்துதல்களைச் செயலாக்கவும்." },
  },
  expenses: {
    en: { eyebrow: "Grocery operations", title: "Store expenses", description: "Track the operating costs behind your retail performance." },
    si: { eyebrow: "සිල්ලර මෙහෙයුම්", title: "වෙළඳසැල් වියදම්", description: "ඔබේ සිල්ලර කාර්ය සාධනයට අදාළ මෙහෙයුම් පිරිවැය සටහන් කරන්න." },
    ta: { eyebrow: "மளிகை செயல்பாடுகள்", title: "கடைச் செலவுகள்", description: "உங்கள் சில்லறை செயல்திறனின் இயக்கச் செலவுகளைக் கண்காணிக்கவும்." },
  },
  reports: {
    en: { eyebrow: "Retail intelligence", title: "Store reports", description: "Review completed grocery sales, category performance and inventory movement." },
    si: { eyebrow: "සිල්ලර විශ්ලේෂණ", title: "වෙළඳසැල් වාර්තා", description: "සම්පූර්ණ කළ සිල්ලර විකුණුම්, කාණ්ඩ කාර්ය සාධනය සහ තොග චලනය සමාලෝචනය කරන්න." },
    ta: { eyebrow: "சில்லறை நுண்ணறிவு", title: "கடை அறிக்கைகள்", description: "முடிக்கப்பட்ட மளிகை விற்பனை, வகை செயல்திறன் மற்றும் சரக்கு நகர்வை மதிப்பாய்வு செய்யவும்." },
  },
  vatSettings: {
    en: { eyebrow: "Store tax & filings", title: "VAT and tax settings", description: "Set up tax registration and filing preferences before VAT reconciliation begins." },
    si: { eyebrow: "වෙළඳසැල් බදු සහ ගොනු කිරීම", title: "VAT සහ බදු සැකසුම්", description: "VAT සමාන කිරීම ආරම්භ කිරීමට පෙර බදු ලියාපදිංචිය සහ ගොනු කිරීමේ සැකසුම් සකසන්න." },
    ta: { eyebrow: "கடை வரி மற்றும் தாக்கல்", title: "VAT மற்றும் வரி அமைப்புகள்", description: "VAT சமநிலைப்படுத்தல் தொடங்குவதற்கு முன் வரிப் பதிவு மற்றும் தாக்கல் விருப்பங்களை அமைக்கவும்." },
  },
  vatReturn: {
    en: { eyebrow: "Store tax & filings", title: "VAT reconciliation", description: "Review VAT collected and recoverable from your recorded sales and purchases." },
    si: { eyebrow: "වෙළඳසැල් බදු සහ ගොනු කිරීම", title: "VAT සමාන කිරීම", description: "සටහන් කළ විකුණුම් සහ මිලදී ගැනීම්වලින් එකතු කළ සහ ආපසු ලබාගත හැකි VAT සමාලෝචනය කරන්න." },
    ta: { eyebrow: "கடை வரி மற்றும் தாக்கல்", title: "VAT சமநிலைப்படுத்தல்", description: "பதிவு செய்த விற்பனை மற்றும் கொள்முதலில் வசூலித்த, திரும்பப் பெறக்கூடிய VAT-ஐ மதிப்பாய்வு செய்யவும்." },
  },
};

export function groceryWorkspaceCopy(locale: Locale, page: GroceryWorkspacePage): WorkspaceCopy {
  return workspaceCopy[page][locale];
}
