from pathlib import Path

p = Path("lakbiz/app/scripts/demo-catalog/importer.mjs")
s = p.read_text()

s = s.replace(
    'export const LAKBIZ_PROJECT_HOST = `${LAKBIZ_PROJECT_REF}.supabase.co`;\n',
    'export const LAKBIZ_PROJECT_HOST = `${LAKBIZ_PROJECT_REF}.supabase.co`;\nexport const DEMO_HISTORY_SALE_COUNT = 185;\n',
    1,
)
s = s.replace(
    'const saleable = products.filter((product) => !shouldTrackLot(product) && Number(product.sellPrice) > 0).slice(0, 12);',
    'const saleable = products.filter((product) => !shouldTrackLot(product) && Number(product.sellPrice) > 0).slice(0, 240);',
    1,
)
needle = '''  if (bankAccount) {\n    bankAccount.balance = bankTransactions.reduce((balance, transaction) => {'''
addition = '''  // Add enough deterministic synthetic activity for dashboard trends to be\n  // meaningful. These extra rows intentionally use only cash/card tenders so\n  // the original five fixtures remain the focused examples for credit, cheque\n  // and bank-transfer workflows. Current stock is a separate seeded snapshot.\n  for (let s = methods.length; s < DEMO_HISTORY_SALE_COUNT; s += 1) {\n    const productA = saleable[(s * 13) % saleable.length];\n    const productB = saleable[(s * 29 + 7) % saleable.length];\n    const customer = customers[s % customers.length];\n    const saleId = `demo:${sector}:sale:${s + 1}`;\n    const qtyA = 1 + (s % 3);\n    const qtyB = 1 + ((s + 1) % 2);\n    const totalA = Number(productA.sellPrice) * qtyA;\n    const totalB = Number(productB.sellPrice) * qtyB;\n    const total = Math.round((totalA + totalB) * 100) / 100;\n    const cost = Number(productA.buyPrice || 0) * qtyA + Number(productB.buyPrice || 0) * qtyB;\n    const profit = Math.round((total - cost) * 100) / 100;\n    const method = s % 4 === 0 ? "card" : "cash";\n    const walkIn = s % 4 === 1;\n    const date = saleDate((s - methods.length) % 30);\n\n    sales.push({\n      id: saleId,\n      organization_id: orgId,\n      bill_no: `DEMO-${sector === "pharmacy" ? "PH" : "GR"}-${String(s + 1).padStart(4, "0")}`,\n      sale_date: date,\n      subtotal: total,\n      output_vat: 0,\n      total,\n      profit,\n      payment_method: method,\n      customer_id: walkIn ? null : customer.id,\n      customer_name: walkIn ? "Walk-in Customer" : customer.name,\n      credit_amount: 0,\n      cheque_id: null,\n      discount: 0,\n    });\n    [\n      { product: productA, qty: qtyA },\n      { product: productB, qty: qtyB },\n    ].forEach(({ product, qty }, index) => lines.push({\n      id: uuidFromSeed(`${saleId}:${index}`),\n      sale_id: saleId,\n      organization_id: orgId,\n      product_id: product.id,\n      product_name: product.productName,\n      qty,\n      unit_price: product.sellPrice || 0,\n      buy_price: product.buyPrice || 0,\n      line_order: index,\n    }));\n    tenders.push({\n      id: `demo:${sector}:tender:${s + 1}`,\n      organization_id: orgId,\n      sale_id: saleId,\n      kind: method,\n      amount: total,\n      note: "Synthetic demo sales history; not factual customer activity.",\n      created_by: null,\n      created_at: date,\n    });\n  }\n\n''' + needle
if needle not in s:
    raise SystemExit("importer history insertion point not found")
s = s.replace(needle, addition, 1)
p.write_text(s)

p = Path("lakbiz/app/scripts/demo-catalog/importer.test.mjs")
t = p.read_text()
t = t.replace(
    '  assertLakBizTarget,\n',
    '  assertLakBizTarget,\n  DEMO_HISTORY_SALE_COUNT,\n',
    1,
)
needle = '''  it("creates stable UUIDs for idempotent lot rows", () => {'''
addition = '''  it("seeds a non-toy deterministic 30-day sales history", () => {\n    expect(DEMO_HISTORY_SALE_COUNT).toBe(185);\n  });\n\n''' + needle
if needle not in t:
    raise SystemExit("importer test insertion point not found")
t = t.replace(needle, addition, 1)
p.write_text(t)
