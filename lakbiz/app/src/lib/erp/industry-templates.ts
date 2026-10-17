import { sectors } from "@/lib/sectors";
import { inventoryTrackingPreset } from "@/lib/inventory-tracking";
import type { SectorId } from "@/lib/types";

export const WORKSPACES = [
  {
    id: "overview",
    label: "Overview",
    group: "Workspace",
    description: "Your business, in perspective.",
  },
  {
    id: "pos",
    label: "Point of sale",
    group: "Commerce",
    description: "A considered checkout. Every identity, every payment.",
  },
  {
    id: "purchases",
    label: "Purchases",
    group: "Commerce",
    description: "From purchase order to goods received.",
  },
  {
    id: "imports",
    label: "Imports & landed cost",
    group: "Commerce",
    description: "Bring every shipment cost into focus.",
  },
  {
    id: "inventory",
    label: "Inventory",
    group: "Operations",
    description: "The right stock, ready for the right moment.",
  },
  {
    id: "warehouses",
    label: "Warehouses",
    group: "Operations",
    description: "One clear view across locations and transfers.",
  },
  {
    id: "damage",
    label: "Damage & loss",
    group: "Operations",
    description: "Controlled write-offs with a complete movement trail.",
  },
  {
    id: "returns",
    label: "Returns & credit notes",
    group: "Operations",
    description:
      "Resolve the customer balance and the physical stock together.",
  },
  {
    id: "finance",
    label: "Finance & VAT",
    group: "Intelligence",
    description: "Balanced books. Clear cash flow. Traceable tax.",
  },
  {
    id: "customers",
    label: "Customers",
    group: "Relationships",
    description: "People, partnerships and customer accounts.",
  },
  {
    id: "loyalty",
    label: "Loyalty",
    group: "Relationships",
    description: "Give your best customers a reason to return.",
  },
  {
    id: "staff",
    label: "People & access",
    group: "Relationships",
    description: "Every person has a place. Every role has a boundary.",
  },
  {
    id: "reports",
    label: "Reports & insights",
    group: "Intelligence",
    description: "Turn operating data into the next good decision.",
  },
  {
    id: "pulse",
    label: "Owner Pulse",
    group: "Intelligence",
    description: "Your business health, wherever the day takes you.",
  },
  {
    id: "settings",
    label: "Settings",
    group: "Management",
    description: "Make the workspace work for your business.",
  },
  {
    id: "admin",
    label: "SaaS administration",
    group: "Management",
    description: "Subscriptions, tenant health and platform operations.",
  },
  {
    id: "templates",
    label: "Template Studio",
    group: "Management",
    description: "Versioned industry configuration with deliberate rollout.",
  },
] as const;
export type WorkspaceId = (typeof WORKSPACES)[number]["id"];
export type DemoRole = "owner" | "manager" | "cashier";
export const TEMPLATE_VERSION = "1.0.0";
export const DEMO_PASSWORD = "LakBizDemo2026!";

const SPECIALISM: Record<
  SectorId,
  { accent: string; company: string; promise: string; highlights: string[] }
> = {
  grocery: {
    accent: "#16a085",
    company: "Green Basket Market",
    promise: "Fresh stock. A faster counter.",
    highlights: [
      "Pack & weight pricing",
      "Expiry-aware replenishment",
      "Everyday customer loyalty",
    ],
  },
  pharmacy: {
    accent: "#0891b2",
    company: "Serene Care Pharmacy",
    promise: "Confidence in every batch.",
    highlights: [
      "Batch & expiry / FEFO",
      "Prescription flags",
      "Quarantine & return inspection",
    ],
  },
  cosmetics: {
    accent: "#c02681",
    company: "Velvet Beauty House",
    promise: "Beautiful commerce, down to the shade.",
    highlights: [
      "Shade & pack variants",
      "Batch expiry & labelled PAO",
      "Beauty loyalty & collections",
    ],
  },
  textile: {
    accent: "#7c3aed",
    company: "Ceylon Fabric Distribution",
    promise: "Wholesale rolls. Measured stock. Clear trade.",
    highlights: [
      "Fabric roll & dye lot identity",
      "Measured cuts & remnants",
      "Wholesale credit & dispatch",
    ],
  },
  electronics: {
    accent: "#2563eb",
    company: "Circuit & Co.",
    promise: "Precision for high-value inventory.",
    highlights: [
      "Serial & warranty identity",
      "Model & colour variants",
      "Inspection & service returns",
    ],
  },
  mobile_shop: {
    accent: "#4f46e5",
    company: "Nova Mobile Gallery",
    promise: "One device. One traceable identity.",
    highlights: [
      "IMEI & storage variants",
      "New & refurbished lanes",
      "Repair parts compatibility",
    ],
  },
  spare_parts: {
    accent: "#d97706",
    company: "Torque Parts Centre",
    promise: "The right part, the first time.",
    highlights: [
      "OEM & part numbers",
      "Vehicle compatibility",
      "Bin locations & reorder",
    ],
  },
  car_sales: {
    accent: "#b58b45",
    company: "Prestige Motor Gallery",
    promise: "A considered journey from import to handover.",
    highlights: [
      "Chassis / VIN identity",
      "Landed & reconditioning costs",
      "Ageing, finance & handover",
    ],
  },
  hardware: {
    accent: "#d97706",
    company: "Foundation Hardware",
    promise: "Build with a better operating system.",
    highlights: [
      "Size & material variations",
      "Pack, weight & unit pricing",
      "Trade customer accounts",
    ],
  },
  stationery: {
    accent: "#e05b50",
    company: "Paper & Ink Collective",
    promise: "A smarter chapter for your business.",
    highlights: [
      "ISBN, author & publisher",
      "School & office packs",
      "Seasonal replenishment",
    ],
  },
  wholesale: {
    accent: "#0284c7",
    company: "Nexus Distribution",
    promise: "Trade at scale, with clarity.",
    highlights: [
      "Case quantities & price tiers",
      "B2B credit & collections",
      "Warehouse fulfilment",
    ],
  },
  electricals: {
    accent: "#ca8a04",
    company: "Volt Electrical Supply",
    promise: "A connected view of every rating and reel.",
    highlights: [
      "Rating & cable lengths",
      "Trade accounts",
      "Supplier & site purchasing",
    ],
  },
  footwear: {
    accent: "#be185d",
    company: "Stride Footwear Studio",
    promise: "Every size has its own story.",
    highlights: [
      "Size / colour variants",
      "Style & barcode identities",
      "Size-run replenishment",
    ],
  },
  ac_hvac: {
    accent: "#0e7490",
    company: "ClimateWorks Engineering",
    promise: "Parts, projects and people in sync.",
    highlights: [
      "Installed asset & serial history",
      "Technician scheduling",
      "Service due & job costing",
    ],
  },
};

export const INDUSTRY_TEMPLATES = sectors.map((sector) => ({
  ...sector,
  ...(sector.id === "textile" ? {
    nameEn: "Wholesale Fabric Roll Distribution",
    description: "For wholesale textile fabric-roll distributors: roll stock, dye lots, measured quantities, trade pricing, customer credit and dispatch.",
  } : {}),
  ...SPECIALISM[sector.id],
  version: TEMPLATE_VERSION,
  inventory: inventoryTrackingPreset(sector.id),
  demoEmail: `demo.${sector.id}@lakbiz.example`,
  demoPath: `/demo/${sector.id}`,
  modules: WORKSPACES.map((w) => w.id),
  currency: "LKR",
  timezone: "Asia/Colombo",
}));
export type IndustryTemplate = (typeof INDUSTRY_TEMPLATES)[number];
export function industryTemplate(id: string) {
  return INDUSTRY_TEMPLATES.find((t) => t.id === id);
}
export function demoCanUse(role: DemoRole, workspace: WorkspaceId) {
  if (role === "owner") return true;
  if (
    [
      "finance",
      "imports",
      "purchases",
      "reports",
      "pulse",
      "admin",
      "templates",
      "loyalty",
      "settings",
      "staff",
    ].includes(workspace)
  )
    return false;
  return (
    role === "manager" ||
    ["overview", "pos", "inventory", "customers"].includes(workspace)
  );
}
/** Public sample logins identify synthetic workspaces. They grant no Supabase session. */
export function validateDemoLogin(
  industry: string,
  email: string,
  password: string,
) {
  return (
    industryTemplate(industry)?.demoEmail === email.trim().toLowerCase() &&
    password === DEMO_PASSWORD
  );
}
