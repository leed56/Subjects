/**
 * job-parts-materials phase — HVAC component taxonomy (Part 7 of the
 * brief). A plain suggestion list, not a rigid table or enum: used as a
 * `<datalist>` for the old/new-component name fields on a replacement
 * line, so reporting gets consistent naming *when* the technician picks
 * from it, without ever blocking free text. Matches the existing pattern
 * this codebase already uses for AC part categories
 * (`categoriesForSector`) and brands (`AC_BRANDS`) — a maintained list
 * that improves consistency without forcing it.
 */
export const HVAC_COMPONENT_TYPES = [
  "Compressor",
  "PCB / Control board",
  "Capacitor",
  "Contactor",
  "Fan motor",
  "Blower motor",
  "Thermistor / Sensor",
  "Remote control",
  "Display board",
  "Swing motor",
  "Expansion valve",
  "4-way valve",
  "Filter",
  "Drain pump",
  "Drain hose",
  "Copper pipe",
  "Insulation",
  "Refrigerant",
  "Electrical cable",
  "Breaker",
  "Isolator",
  "Mounting bracket",
  "Rubber mount",
  "Other",
] as const;
