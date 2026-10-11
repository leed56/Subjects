import type { SectorId } from "@/lib/types";
import { industryTemplate } from "./industry-templates";
import { executeDemoCommand, totalStock } from "./demo-engine";
import type { DemoState } from "./demo-types";

type Sample = [
  name: string,
  category: string,
  price: number,
  unit?: string,
  attributes?: Record<string, string>,
];
const SAMPLES: Record<SectorId, Sample[]> = {
  grocery: [
    ["Ceylon premium tea · 200 g", "Beverages", 1250],
    ["Red rice · 5 kg", "Pantry", 2100],
    ["Fresh milk · 1 L", "Dairy", 520],
    ["Coconut oil · 1 L", "Pantry", 1650],
    ["Organic lentils · 1 kg", "Pantry", 780],
    ["Cinnamon biscuits", "Bakery", 340],
    ["Arabica coffee · 250 g", "Beverages", 2400],
    ["Natural yoghurt · 4 pack", "Dairy", 680],
  ],
  pharmacy: [
    [
      "Paracetamol · 500 mg · 100 tabs",
      "OTC Medicines",
      680,
      "pack",
      { strength: "500 mg", batch: "PC-2408", manufacturer: "Sample Pharma" },
    ],
    ["Vitamin C · 30 tablets", "Vitamins", 1850],
    ["Digital thermometer", "Medical Devices", 2450],
    ["First aid dressing set", "First Aid", 1250],
    ["Saline solution · 500 ml", "Solutions", 540],
    ["Daily multivitamin · 60 tabs", "Vitamins", 3200],
    ["Hydrating skin cream", "Personal Care", 1480],
    ["Blood pressure monitor", "Medical Devices", 14500, "unit"],
  ],
  cosmetics: [
    [
      "Luminous skin serum · 30 ml",
      "Skincare",
      6800,
      "bottle",
      { shade: "Clear", pack: "30 ml", batch: "BS-2608", PAO: "12 months" },
    ],
    [
      "Velvet lip colour · Rosewood",
      "Makeup",
      3250,
      "unit",
      { shade: "Rosewood 04", pack: "3.5 g" },
    ],
    ["Daily mineral SPF · 50 ml", "Sun Care", 4500],
    ["Hydra barrier cream · 50 g", "Skincare", 5800],
    [
      "Satin foundation · Warm 03",
      "Makeup",
      4900,
      "bottle",
      { shade: "Warm 03" },
    ],
    ["Botanical perfume · 50 ml", "Fragrance", 8900],
    ["Soft brush collection", "Tools", 3800],
    ["Restorative hair mask", "Hair Care", 2800],
  ],
  textile: [
    [
      "Linen blend · Natural",
      "Linen",
      1850,
      "metre",
      {
        width: "58 in",
        gsm: "180",
        shade: "Natural",
        dyeLot: "LN-0826",
        roll: "RL-001",
      },
    ],
    [
      "Cotton poplin · Sky",
      "Cotton",
      980,
      "metre",
      { width: "60 in", shade: "Sky blue", dyeLot: "CT-241" },
    ],
    ["Indigo denim · 12 oz", "Denim", 1650, "metre"],
    ["Silk chiffon · Ivory", "Chiffon", 2200, "metre"],
    ["Uniform twill · Navy", "Uniform Fabric", 1250, "metre"],
    ["Premium suiting · Charcoal", "Suiting", 3400, "metre"],
    ["Floral rayon", "Rayon", 1120, "metre"],
    ["Cotton jersey · Sand", "Knits", 1450, "metre"],
  ],
  electronics: [
    [
      "Auralink wireless headphones",
      "Audio",
      24500,
      "unit",
      { serial: "SN-AU-0001", warranty: "12 months" },
    ],
    ["4K smart display · 43 inch", "Displays", 148000, "unit"],
    ["Ultrabook · 16 GB / 512 GB", "Computers", 285000, "unit"],
    ["Portable studio speaker", "Audio", 18500, "unit"],
    ["USB-C power hub", "Accessories", 6800],
    ["Wireless ergonomic mouse", "Accessories", 7500],
    ["Home Wi-Fi mesh pair", "Networking", 38000, "unit"],
    ["Action camera · 4K", "Cameras", 68500, "unit"],
  ],
  mobile_shop: [
    [
      "Nova Pro · 256 GB · Graphite",
      "Phones",
      185000,
      "unit",
      {
        IMEI: "DEMO-IMEI-0001",
        storage: "256 GB",
        colour: "Graphite",
        warranty: "12 months",
      },
    ],
    ["Nova Air · 128 GB · Blue", "Phones", 125000, "unit"],
    ["Refurbished Nova · 128 GB", "Used Devices", 78000, "unit"],
    ["65W USB-C charger", "Accessories", 8500],
    ["Premium silicone case", "Accessories", 2800],
    ["Display assembly · Nova Pro", "Repair Parts", 32500],
    ["Battery assembly · Nova Air", "Repair Parts", 6800],
    ["Wireless buds · Pearl", "Accessories", 24500, "unit"],
  ],
  electricals: [
    [
      "Copper cable · 2.5 mm²",
      "Wire & Cable",
      380,
      "metre",
      { rating: "2.5 mm²", length: "100 m reel" },
    ],
    ["LED panel · 24 W", "Lighting", 2850],
    ["Double wall socket", "Switches & Sockets", 1250],
    ["MCB breaker · 32 A", "Protection", 1680],
    ["LED floodlight · 100 W", "Lighting", 9800],
    ["PVC conduit · 20 mm", "Fixtures", 480],
    ["Industrial plug · 16 A", "Accessories", 2450],
    ["Digital multimeter", "Tools", 12500, "unit"],
  ],
  spare_parts: [
    [
      "Premium brake pads · Front",
      "Brake Parts",
      12500,
      "set",
      { OEM: "OEM-DEMO-001", fitment: "Sedan 2015–2023", bin: "A-04" },
    ],
    ["Engine oil filter", "Filters", 1850],
    ["Air filter · Sedan", "Filters", 2850],
    ["Shock absorber · Rear", "Suspension", 18500],
    ["Spark plug · Iridium", "Engine Parts", 3450],
    ["Drive belt assembly", "Engine Parts", 6800],
    ["LED headlamp module", "Electrical", 24500],
    ["Synthetic oil · 4 L", "Lubricants", 14500],
  ],
  footwear: [
    [
      "City sneaker · White · 42",
      "Sneakers",
      12500,
      "pair",
      { size: "42", colour: "White", style: "ST-001" },
    ],
    ["Classic leather loafer · 40", "Formal", 18500, "pair"],
    ["Trail runner · 43", "Sports", 16800, "pair"],
    ["School shoe · 35", "School", 6800, "pair"],
    ["Everyday sandal · 39", "Sandals", 4500, "pair"],
    ["City sneaker · Black · 41", "Sneakers", 12500, "pair"],
    ["Safety boot · 44", "Safety", 19500, "pair"],
    ["Cotton socks · 3 pack", "Accessories", 1480, "pack"],
  ],
  car_sales: [
    [
      "Aster Hybrid · 2022 · Pearl",
      "Hybrid",
      9850000,
      "vehicle",
      {
        VIN: "DEMO-VIN-0001",
        engine: "DEMO-EN-01",
        mileage: "32,800 km",
        year: "2022",
      },
    ],
    ["Aster Cross · 2021 · Graphite", "SUV", 12450000, "vehicle"],
    ["Mira City · 2023 · Silver", "Compact", 7850000, "vehicle"],
    ["Falcon Executive · 2020", "Sedan", 15800000, "vehicle"],
    ["Metro Van · 2022", "Commercial", 8650000, "vehicle"],
    ["Aster Hybrid · 2021 · Blue", "Hybrid", 9450000, "vehicle"],
    ["Mira City · 2022 · White", "Compact", 7450000, "vehicle"],
    ["Falcon Touring · 2021", "SUV", 16850000, "vehicle"],
  ],
  ac_hvac: [
    [
      "Inverter split AC · 12,000 BTU",
      "AC Units",
      185000,
      "unit",
      { BTU: "12,000", serial: "DEMO-AC-0001", warranty: "24 months" },
    ],
    ["Copper pipe · ¼ inch", "Pipe", 1250, "metre"],
    ["Outdoor mounting bracket", "Installation", 6800],
    ["R32 refrigerant · 1 kg", "Refrigerant", 9800],
    ["Universal control board", "Service Parts", 18500],
    ["Drain pipe · 20 mm", "Installation", 380, "metre"],
    ["Compressor · 18,000 BTU", "Service Parts", 68500, "unit"],
    ["Insulation sleeve", "Installation", 480, "metre"],
  ],
  hardware: [
    [
      "Cordless drill · 18 V",
      "Power Tools",
      38500,
      "unit",
      { brand: "BuildPro", material: "Steel", size: "18 V", bin: "B-08" },
    ],
    ["Cement · 50 kg", "Building Materials", 2450, "bag"],
    ["Interior paint · 4 L", "Paint", 6800],
    ["Hex bolt · M10 · 100 pack", "Fasteners", 1850],
    ["PVC pipe · ½ inch", "Plumbing", 580],
    ["Safety helmet", "Safety Equipment", 1480],
    ["Measuring tape · 5 m", "Tools", 1250],
    ["Angle grinder · 900 W", "Power Tools", 24500, "unit"],
  ],
  stationery: [
    [
      "Hardcover journal · A5",
      "Notebooks",
      1850,
      "unit",
      { paperSize: "A5", publisher: "Paper & Ink" },
    ],
    [
      "The Art of Everyday Design",
      "Books",
      4800,
      "unit",
      { ISBN: "978-0-DEMO-001", author: "Sample Author" },
    ],
    ["Colour pencil set · 24", "Art Supplies", 2450],
    ["Copy paper · A4 · 500 sheets", "Paper", 1680],
    ["Gel pen · 12 pack", "Writing Instruments", 1250],
    ["School essentials kit", "School Supplies", 3800],
    ["Desk organizer", "Office Supplies", 2850],
    ["Watercolour palette · 12", "Art Supplies", 3450],
  ],
  wholesale: [
    [
      "Ceylon tea · 24 × 200 g case",
      "Food & Beverage",
      24500,
      "case",
      { pack: "24 × 200 g", MOQ: "5 cases", tier: "Trade A" },
    ],
    ["Household soap · 48 case", "Household", 14500, "case"],
    ["Mineral water · 12 × 1 L", "Beverages", 1800, "case"],
    ["Coconut oil · 12 × 1 L", "Food & Beverage", 18500, "case"],
    ["Paper towels · 24 case", "Household", 9800, "case"],
    ["Shampoo · 24 × 200 ml", "Personal Care", 24500, "case"],
    ["Packaging carton · 50 pack", "Packaging", 6800, "pack"],
    ["Biscuits · 24 case", "Food & Beverage", 7800, "case"],
  ],
};

export function createDemoState(
  industry: SectorId,
  now = new Date(),
): DemoState {
  const template = industryTemplate(industry);
  if (!template) throw new Error("Unknown industry.");
  const date = now.toISOString(),
    dateOffset = (days: number) =>
      new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
  let state: DemoState = {
    schemaVersion: 1,
    industry,
    revision: 0,
    settings: {
      name: template.company,
      currency: "LKR",
      timezone: "Asia/Colombo",
      vatRegistered: true,
      vatRate: 18,
      loyaltySpend: 10000,
      pointValue: 100,
      plan:
        industry === "car_sales" || industry === "ac_hvac" ? "Pro" : "Business",
    },
    warehouses: [
      {
        id: "main",
        name: "Main showroom",
        city: "Colombo",
        manager: "Demo Operations",
      },
      {
        id: "central",
        name: "Central warehouse",
        city: "Kelaniya",
        manager: "Demo Warehouse",
      },
      {
        id: "south",
        name: "South branch",
        city: "Galle",
        manager: "Demo Branch",
      },
    ],
    products: SAMPLES[industry].map(
      ([name, category, price, unit, attrs], i) => ({
        id: `p-${i + 1}`,
        name,
        sku: `${industry.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(4, "0")}`,
        category,
        unit: unit ?? "pack",
        price: Math.round(price * 100),
        cost: Math.round(price * 64),
        reorder: industry === "car_sales" ? 1 : 12,
        quantities: {
          main: industry === "car_sales" ? 3 : 45 + i * 7,
          central: industry === "car_sales" ? 3 : 80 + i * 6,
          south: industry === "car_sales" ? 1 : 20 + i * 3,
        },
        identity:
          attrs?.batch ??
          attrs?.serial ??
          attrs?.IMEI ??
          attrs?.VIN ??
          attrs?.roll ??
          `LOT-${String(i + 1).padStart(3, "0")}`,
        expiry: ["grocery", "pharmacy", "cosmetics", "wholesale"].includes(
          industry,
        )
          ? dateOffset(i === 4 ? 16 : 180 + i * 30)
          : undefined,
        blocked: i === 7,
        attributes: attrs ?? {
          brand: "Sample Collection",
          pack: unit ?? "Standard",
        },
      }),
    ),
    customers: [
      {
        id: "c-1",
        name: "Maya Perera",
        company: false,
        city: "Colombo",
        credit: 0,
        creditLimit: 100000000,
        points: 1250,
        tier: "Gold",
      },
      {
        id: "c-2",
        name: "Ocean Trade Partners",
        company: true,
        city: "Galle",
        credit: 850000,
        creditLimit: 500000000,
        points: 650,
        tier: "Silver",
      },
      {
        id: "c-3",
        name: "Arun Fernando",
        company: false,
        city: "Kandy",
        credit: 240000,
        creditLimit: 250000000,
        points: 320,
        tier: "Member",
      },
      {
        id: "c-4",
        name: "Northside Retail Co.",
        company: true,
        city: "Jaffna",
        credit: 4200000,
        creditLimit: 500000000,
        points: 1800,
        tier: "Gold",
      },
      {
        id: "c-5",
        name: "Nila Jayawardena",
        company: false,
        city: "Negombo",
        credit: 0,
        creditLimit: 100000000,
        points: 480,
        tier: "Silver",
      },
    ],
    suppliers: [
      {
        id: "s-1",
        name: "Ceylon Supply Partners",
        origin: "Sri Lanka",
        payable: 2800000,
        leadDays: 4,
      },
      {
        id: "s-2",
        name: "Global Trade House",
        origin: "Singapore",
        payable: 4850000,
        leadDays: 21,
      },
      {
        id: "s-3",
        name: "Eastern Manufacturers",
        origin: "India",
        payable: 1250000,
        leadDays: 14,
      },
    ],
    staff: [
      {
        id: "u-1",
        name: "Demo Owner",
        job: "Business owner",
        role: "owner",
        location: "All locations",
        status: "Active",
      },
      {
        id: "u-2",
        name: "Demo Operations",
        job: "Operations manager",
        role: "manager",
        location: "Main showroom",
        status: "Active",
      },
      {
        id: "u-3",
        name: "Demo Cashier",
        job: "Sales associate",
        role: "cashier",
        location: "Main showroom",
        status: "Active",
      },
      {
        id: "u-4",
        name: "Demo Warehouse",
        job: "Warehouse manager",
        role: "manager",
        location: "Central warehouse",
        status: "Active",
      },
    ],
    sales: [],
    purchases: [],
    shipments: [],
    movements: [],
    journals: [],
    audit: [],
  };
  if (industry === "car_sales")
    state.customers.forEach((c) => {
      c.creditLimit = 5000000000;
    });
  const inventory = state.products.reduce(
      (s, p) => s + totalStock(p) * p.cost,
      0,
    ),
    credit = state.customers.reduce((s, c) => s + c.credit, 0),
    payables = state.suppliers.reduce((s, p) => s + p.payable, 0),
    cash = 50000000;
  state.journals.push({
    id: "opening",
    date,
    reference: "OPENING-DEMO",
    memo: "Synthetic opening balances",
    lines: [
      { account: "Inventory", debit: inventory, credit: 0 },
      { account: "Receivables", debit: credit, credit: 0 },
      { account: "Cash", debit: cash, credit: 0 },
      { account: "Payables", debit: 0, credit: payables },
      {
        account: "Opening equity",
        debit: 0,
        credit: inventory + credit + cash - payables,
      },
    ],
  });
  state.products.forEach((p) =>
    Object.entries(p.quantities).forEach(([to, quantity]) =>
      state.movements.push({
        id: `opening-${p.id}-${to}`,
        date,
        productId: p.id,
        quantity,
        type: "opening",
        to,
        reference: "OPENING-DEMO",
      }),
    ),
  );
  for (let d = 13; d >= 0; d--) {
    const day = new Date(now.getTime() - d * 86400000);
    state = executeDemoCommand(
      state,
      {
        type: "sale",
        lines: [
          {
            productId: `p-${(d % 6) + 1}`,
            quantity: industry === "car_sales" ? 1 : (d % 4) + 1,
          },
        ],
        customerId: `c-${(d % 5) + 1}`,
        payment: d % 4 === 0 ? "credit" : d % 2 === 0 ? "card" : "cash",
        warehouseId:
          industry === "car_sales" ? (d % 2 ? "main" : "central") : "main",
        redeemPoints: 0,
      },
      "owner",
      day,
      `seed-sale-${d}`,
    );
  }
  state = executeDemoCommand(
    state,
    {
      type: "purchase",
      supplier: "Ceylon Supply Partners",
      productId: "p-1",
      quantity: industry === "car_sales" ? 1 : 24,
      unitCost: state.products[0].cost,
      warehouseId: "central",
    },
    "owner",
    now,
    "seed-po",
  );
  const shipment = {
    reference: "IMP-2026-0042",
    supplier: "Global Trade House",
    origin: "Singapore",
    currency: "USD" as const,
    exchangeRate: 305,
    foreignGoods: industry === "car_sales" ? 45000 : 2400,
    freight: 12500000,
    duty: 3800000,
    insurance: 650000,
    clearing: 1200000,
    recoverableVat: 4800000,
    basis: "value" as const,
    lines: [
      {
        productId: "p-2",
        quantity: industry === "car_sales" ? 1 : 40,
        unitAmount: industry === "car_sales" ? 2000000 : 3000,
      },
      {
        productId: "p-3",
        quantity: industry === "car_sales" ? 1 : 24,
        unitAmount: industry === "car_sales" ? 2500000 : 5000,
      },
    ],
    warehouseId: "central",
    eta: dateOffset(6),
  };
  state = executeDemoCommand(
    state,
    { type: "shipment", shipment },
    "owner",
    now,
    "seed-import",
  );
  state = executeDemoCommand(
    state,
    { type: "advance_shipment", id: state.shipments[0].id },
    "owner",
    now,
    "seed-transit",
  );
  return state;
}
