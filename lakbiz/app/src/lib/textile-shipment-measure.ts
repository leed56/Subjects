/** Validate physical roll measures before recording a shipment receipt.
 * Amounts remain in their original unit; this deliberately performs no conversion.
 */
export type FabricLengthUnit = "metre" | "yard";
export type FabricRollMeasure = { length: number; unit: FabricLengthUnit };

export function validateFabricShipmentMeasures(unit: FabricLengthUnit, rolls: FabricRollMeasure[], expectedQuantity: number): number {
  if (unit !== "metre" && unit !== "yard") throw Error("Choose metres or yards for this shipment line.");
  if (!Array.isArray(rolls) || rolls.length < 1 || rolls.length > 500) throw Error("Enter between 1 and 500 physical rolls.");
  if (!Number.isFinite(expectedQuantity) || expectedQuantity <= 0 || Math.abs(expectedQuantity * 1000 - Math.round(expectedQuantity * 1000)) > 0.000001) throw Error("Enter a valid shipment quantity with at most three decimal places.");
  let thousandths = 0;
  for (const roll of rolls) {
    if (roll.unit !== unit) throw Error("All rolls on a shipment line must use the same unit.");
    if (!Number.isFinite(roll.length) || roll.length <= 0 || Math.abs(roll.length * 1000 - Math.round(roll.length * 1000)) > 0.000001) throw Error("Each roll needs a positive length with at most three decimal places.");
    thousandths += Math.round(roll.length * 1000);
    if (!Number.isSafeInteger(thousandths)) throw Error("Roll quantities are too large.");
  }
  if (thousandths !== Math.round(expectedQuantity * 1000)) throw Error("Roll lengths must equal the shipment receipt quantity.");
  return thousandths / 1000;
}
