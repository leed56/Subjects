import { describe, expect, it } from "vitest";
import { validateFabricShipmentMeasures } from "./textile-shipment-measure";

describe("fabric shipment measurements", () => {
  it("adds measured rolls in their original unit without floating point drift", () => {
    expect(validateFabricShipmentMeasures("metre", [{ length: 0.1, unit: "metre" }, { length: 0.2, unit: "metre" }], 0.3)).toBe(0.3);
  });
  it("rejects a mixture of metres and yards", () => {
    expect(() => validateFabricShipmentMeasures("metre", [{ length: 1, unit: "yard" }], 1)).toThrow("same unit");
  });
  it("rejects quantities that do not match physical rolls", () => {
    expect(() => validateFabricShipmentMeasures("yard", [{ length: 1, unit: "yard" }], 2)).toThrow("must equal");
  });
  it("rejects invalid precision and non-finite values", () => {
    expect(() => validateFabricShipmentMeasures("yard", [{ length: 0.0001, unit: "yard" }], 1)).toThrow("three decimal");
    expect(() => validateFabricShipmentMeasures("yard", [{ length: Infinity, unit: "yard" }], 1)).toThrow("positive length");
  });
});
