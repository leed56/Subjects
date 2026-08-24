/**
 * HVAC parts taxonomy used by job parts/materials workflows.
 *
 * Keep this as a suggestion catalog, not a rigid enum. Technicians must still
 * be able to enter a custom part when a supplier uses a different name or a
 * rare component is not listed here. The richer metadata powers the premium
 * external-purchase picker while `HVAC_COMPONENT_TYPES` remains backwards
 * compatible with the existing replacement-component datalist.
 */
export type HvacPartCategory =
  | "Major components"
  | "Electrical & controls"
  | "Refrigeration & piping"
  | "Installation & consumables";

export type HvacCatalogPart = {
  name: string;
  category: HvacPartCategory;
  unit: "pcs" | "m" | "kg" | "roll" | "can" | "set";
  keywords?: readonly string[];
};

export const HVAC_PART_CATEGORIES: readonly HvacPartCategory[] = [
  "Major components",
  "Electrical & controls",
  "Refrigeration & piping",
  "Installation & consumables",
] as const;

export const HVAC_PART_CATALOG: readonly HvacCatalogPart[] = [
  // Major components
  { name: "Compressor", category: "Major components", unit: "pcs", keywords: ["rotary", "scroll", "compressor motor"] },
  { name: "Condenser coil", category: "Major components", unit: "pcs", keywords: ["outdoor coil", "condenser"] },
  { name: "Evaporator coil", category: "Major components", unit: "pcs", keywords: ["indoor coil", "evaporator"] },
  { name: "PCB / Main control board", category: "Major components", unit: "pcs", keywords: ["pcb", "control board", "main board"] },
  { name: "Inverter board / IPM board", category: "Major components", unit: "pcs", keywords: ["inverter pcb", "ipm", "power board"] },
  { name: "Outdoor fan motor", category: "Major components", unit: "pcs", keywords: ["fan motor", "condenser motor"] },
  { name: "Indoor blower motor", category: "Major components", unit: "pcs", keywords: ["blower motor", "indoor fan motor"] },
  { name: "Swing motor", category: "Major components", unit: "pcs", keywords: ["louver motor", "flap motor"] },
  { name: "4-way reversing valve", category: "Major components", unit: "pcs", keywords: ["4 way valve", "reversing valve"] },
  { name: "Expansion valve", category: "Major components", unit: "pcs", keywords: ["eev", "txv", "expansion"] },
  { name: "Drain pump", category: "Major components", unit: "pcs", keywords: ["condensate pump"] },

  // Electrical & controls
  { name: "Run capacitor", category: "Electrical & controls", unit: "pcs", keywords: ["capacitor", "condenser capacitor"] },
  { name: "Start capacitor", category: "Electrical & controls", unit: "pcs", keywords: ["starting capacitor"] },
  { name: "Contactor", category: "Electrical & controls", unit: "pcs", keywords: ["magnetic contactor"] },
  { name: "Relay", category: "Electrical & controls", unit: "pcs", keywords: ["power relay", "control relay"] },
  { name: "Overload protector", category: "Electrical & controls", unit: "pcs", keywords: ["overload", "thermal protector"] },
  { name: "OCB / MCB breaker", category: "Electrical & controls", unit: "pcs", keywords: ["ocb", "mcb", "breaker", "circuit breaker"] },
  { name: "Isolator switch", category: "Electrical & controls", unit: "pcs", keywords: ["isolator", "disconnect switch"] },
  { name: "Pressure switch", category: "Electrical & controls", unit: "pcs", keywords: ["high pressure switch", "low pressure switch"] },
  { name: "Thermostat", category: "Electrical & controls", unit: "pcs" },
  { name: "Thermistor / Temperature sensor", category: "Electrical & controls", unit: "pcs", keywords: ["sensor", "thermistor", "room sensor", "coil sensor"] },
  { name: "Selector switch", category: "Electrical & controls", unit: "pcs" },
  { name: "Rocker switch", category: "Electrical & controls", unit: "pcs", keywords: ["switch"] },
  { name: "Terminal block", category: "Electrical & controls", unit: "pcs", keywords: ["connector block"] },
  { name: "Transformer", category: "Electrical & controls", unit: "pcs" },
  { name: "Remote control", category: "Electrical & controls", unit: "pcs", keywords: ["remote"] },
  { name: "Display board", category: "Electrical & controls", unit: "pcs", keywords: ["display pcb", "receiver board"] },

  // Refrigeration & piping
  { name: "Capillary tube", category: "Refrigeration & piping", unit: "m", keywords: ["capillary", "capillary line"] },
  { name: "Filter drier", category: "Refrigeration & piping", unit: "pcs", keywords: ["drier", "dryer"] },
  { name: "Refrigerant gas", category: "Refrigeration & piping", unit: "kg", keywords: ["gas", "r32", "r410a", "r22", "r134a"] },
  { name: "Copper pipe", category: "Refrigeration & piping", unit: "m", keywords: ["copper tube", "refrigerant pipe"] },
  { name: "Flare nut", category: "Refrigeration & piping", unit: "pcs" },
  { name: "Service valve", category: "Refrigeration & piping", unit: "pcs", keywords: ["2 way valve", "3 way valve"] },
  { name: "Schrader valve / Valve core", category: "Refrigeration & piping", unit: "pcs", keywords: ["schrader", "valve core"] },
  { name: "Pipe insulation", category: "Refrigeration & piping", unit: "m", keywords: ["insulation", "armaflex"] },
  { name: "Drain hose", category: "Refrigeration & piping", unit: "m" },
  { name: "PVC drain pipe", category: "Refrigeration & piping", unit: "m", keywords: ["drain pipe", "pvc"] },

  // Installation & consumables
  { name: "Wall mounting bracket", category: "Installation & consumables", unit: "set", keywords: ["bracket", "outdoor bracket"] },
  { name: "Rubber anti-vibration pad", category: "Installation & consumables", unit: "set", keywords: ["rubber mount", "vibration pad"] },
  { name: "Electrical cable", category: "Installation & consumables", unit: "m", keywords: ["wire", "power cable"] },
  { name: "Communication cable", category: "Installation & consumables", unit: "m", keywords: ["signal cable", "interconnect cable"] },
  { name: "Screws & fasteners", category: "Installation & consumables", unit: "set", keywords: ["screws", "bolts", "nuts", "fasteners"] },
  { name: "Wall plugs / Anchors", category: "Installation & consumables", unit: "set", keywords: ["wall plugs", "anchors"] },
  { name: "Cable ties", category: "Installation & consumables", unit: "set", keywords: ["zip ties"] },
  { name: "Insulation tape", category: "Installation & consumables", unit: "roll", keywords: ["foam tape"] },
  { name: "PVC electrical tape", category: "Installation & consumables", unit: "roll", keywords: ["tape"] },
  { name: "Silicone sealant", category: "Installation & consumables", unit: "can", keywords: ["silicone", "sealant"] },
  { name: "Wall putty", category: "Installation & consumables", unit: "kg", keywords: ["putty"] },
  { name: "Touch-up paint", category: "Installation & consumables", unit: "can", keywords: ["paint"] },
  { name: "Coil cleaner", category: "Installation & consumables", unit: "can", keywords: ["cleaning chemical", "coil chemical"] },
  { name: "General cleaning chemical", category: "Installation & consumables", unit: "can", keywords: ["cleaner", "chemical"] },
  { name: "Brazing rod", category: "Installation & consumables", unit: "pcs", keywords: ["welding rod", "silver rod"] },
] as const;

export const HVAC_COMPONENT_TYPES = [
  ...HVAC_PART_CATALOG.map((part) => part.name),
  "Other",
] as const;
