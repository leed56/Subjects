from pathlib import Path

core = Path("lakbiz/app/scripts/demo-catalog/core.mjs")
s = core.read_text()
start = s.index('  if (has(/RICE|ATTA|FLOUR|OATS|CEREAL|GRAIN/))')
end_marker = '  return { department: "Packaged Food", category: "Packaged Food", subcategory: "General Grocery" };\n'
end = s.index(end_marker, start) + len(end_marker)
replacement = r'''  // Grocery classification must prioritize non-food identities before broad
  // food tokens. Otherwise names such as "hair oil" or "tea tree face wash"
  // are incorrectly captured by Oil & Fats / Beverages.
  if (has(/FABRIC CONDITIONER|LAUNDRY|WASHING POWDER|DETERGENT|DISH[ -]?WASH|FLOOR CLEAN|TOILET CLEAN|BLEACH|SURFACE CLEAN|CLEANER|AIR FRESH|PEST|INSECTICIDE|TISSUE|PAPER TOWEL|TOILET ROLL|GARBAGE BAG|\bVIM\b|\bSURF\b/)) return { department: "Household", category: "Cleaning", subcategory: "Household" };
  if (has(/FACE WASH|BODY WASH|SHOWER GEL|SHAMPOO|CONDITIONER|HAIR OIL|HAIR GEL|DEODORANT|BODY SPRAY|COLOGNE|PERFUME|EAU DE|HAND ?WASH|BEAUTY BAR|TOOTHPASTE|TOOTHBRUSH|MOUTHWASH|LOTION|SERUM|MOISTUR|SUNSCREEN|SUN SCREEN|ALOE VERA GEL|\bSOAP\b|SANITARY|PANTY LINER|DIAPER|NAPPY|BABY WIPES?|FACE CREAM|BODY CREAM|HAND CREAM|SKIN CREAM|BEAUTY CREAM|FACE SCRUB|FACIAL|LIP BALM|NAIL POLISH|RAZOR|SHAVING|\bBABY\b/)) return { department: "Personal & Baby", category: "Personal Care", subcategory: "Personal & Baby" };
  if (has(/\bPET\b|\bDOG\b|\bCAT\b/)) return { department: "Pet Care", category: "Pet Food & Care", subcategory: "Pet Care" };
  if (has(/RICE|ATTA|FLOUR|OATS|CEREAL|GRAIN/)) return { department: "Grocery & Staples", category: "Rice, Flour & Grains", subcategory: "Rice, Flour & Grains" };
  if (has(/DHAL|LENTIL|CHICKPEA|BEAN|PULSE/)) return { department: "Grocery & Staples", category: "Pulses", subcategory: "Dhal & Pulses" };
  if (has(/SUGAR|SALT|SPICE|CHILLI|CURRY|PEPPER|SEASONING|CINNAMON/)) return { department: "Grocery & Staples", category: "Spices & Seasoning", subcategory: "Staples & Seasoning" };
  if (has(/OIL|COCONUT MILK|COCONUT CREAM/)) return { department: "Grocery & Staples", category: "Oil & Fats", subcategory: "Oil & Coconut Products" };
  if (has(/BISCUIT|CRACKER|COOKIE/)) return { department: "Packaged Food", category: "Biscuits & Crackers", subcategory: "Biscuits & Crackers" };
  if (has(/NOODLE|PASTA|MACARONI/)) return { department: "Packaged Food", category: "Noodles & Pasta", subcategory: "Noodles & Pasta" };
  if (has(/SAUCE|KETCHUP|MAYONNAISE|CHUTNEY|CONDIMENT/)) return { department: "Packaged Food", category: "Sauces & Condiments", subcategory: "Sauces & Condiments" };
  if (has(/CHIPS|SNACK|MIXTURE|NUT|CHOCOLATE|CANDY|GUM|TOFFEE/)) return { department: "Snacks & Confectionery", category: "Snacks", subcategory: "Snacks & Confectionery" };
  if (has(/WATER|JUICE|DRINK|PEPSI|COCA|7\s*UP|SPRITE|TEA|COFFEE|MILK POWDER|MALT/)) return { department: "Beverages", category: "Water & Soft Drinks", subcategory: "Beverages" };
  if (has(/ONION|CARROT|POTATO|BEANS|CABBAGE|TOMATO|VEGETABLE|BANANA|APPLE|ORANGE|MANGO|PAPAYA/)) return { department: "Fresh Food", category: "Vegetables", subcategory: "Fresh Produce" };
  if (has(/YOGURT|YOGHURT|CURD|CHEESE|BUTTER|FRESH MILK/)) return { department: "Chilled & Dairy", category: "Milk & Dairy", subcategory: "Dairy" };
  if (has(/FROZEN|ICE CREAM/)) return { department: "Frozen", category: "Frozen Foods", subcategory: "Frozen" };
  if (has(/BREAD|BUN|CAKE/)) return { department: "Bakery", category: "Bread & Buns", subcategory: "Bakery" };
  return { department: "Packaged Food", category: "Packaged Food", subcategory: "General Grocery" };
'''
s = s[:start] + replacement + s[end:]
core.write_text(s)

test = Path("lakbiz/app/scripts/demo-catalog/core.test.mjs")
t = test.read_text()
t = t.replace('  classifySpcProduct,\n', '  classifyRetailProduct,\n  classifySpcProduct,\n', 1)
needle = '''  it("conservatively separates devices/supplies from medicines", () => {\n    expect(classifySpcProduct("DISP HYPOD NEEDLE 21G").productKind).toBe("medical_supply");\n    expect(classifySpcProduct("AMOXYCILLIN CAP 500MG")).toMatchObject({\n      productKind: "medicine",\n      subcategory: "Capsules",\n      dosageForm: "Capsule",\n    });\n  });\n'''
addition = needle + '''\n  it("prioritizes grocery personal-care and household identity over broad food tokens", () => {\n    expect(classifyRetailProduct("4 EVER Venivel Face Wash Whitening, 100ml", "grocery")).toMatchObject({ category: "Personal Care" });\n    expect(classifyRetailProduct("Tea Tree Face Wash, 100ml", "grocery")).toMatchObject({ category: "Personal Care" });\n    expect(classifyRetailProduct("Herbal Hair Oil, 200ml", "grocery")).toMatchObject({ category: "Personal Care" });\n    expect(classifyRetailProduct("Comfort Lily Fresh Fabric Conditioner, 860ml", "grocery")).toMatchObject({ category: "Cleaning" });\n    expect(classifyRetailProduct("Coconut Cooking Oil, 1L", "grocery")).toMatchObject({ category: "Oil & Fats" });\n    expect(classifyRetailProduct("Ceylon Tea, 100g", "grocery")).toMatchObject({ category: "Water & Soft Drinks" });\n  });\n'''
if needle not in t:
    raise SystemExit("core test insertion point not found")
t = t.replace(needle, addition, 1)
test.write_text(t)
