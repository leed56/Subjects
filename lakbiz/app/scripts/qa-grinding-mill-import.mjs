import { chromium } from "playwright";

// This intentionally uses a disposable, unauthenticated browser context and
// localhost only. It must never import into a real shop.
const base = "http://localhost:3012";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${base}/stock`, { waitUntil: "networkidle" });
  await page.waitForTimeout(750);
  if (!(await page.getByText("Demo Shop").count())) throw new Error("Refusing import: not an isolated demo shop");
  await page.getByRole("button", { name: /ඇඹරුම්හල් භාණ්ඩ එක් කරන්න|Add grinding-mill range|அரவை ஆலைப் பொருட்களைச் சேர்/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /භාණ්ඩ එක් කරන්න|Add templates|பொருட்களைச் சேர்/ }).click();
  await page.getByRole("button", { name: /ඇඹරුම්හල් භාණ්ඩ එක් කර ඇත|Grinding-mill range added|அரவை ஆலைப் பொருட்கள் சேர்க்கப்பட்டன/ }).waitFor({ timeout: 60000 });
  await page.reload({ waitUntil: "networkidle" });
  const stock = await page.locator("body").innerText();
  if (!stock.includes("36") || !stock.includes("අක්‍රිය")) throw new Error("Imported inactive records missing from Stock");
  await page.goto(`${base}/sales`, { waitUntil: "networkidle" });
  const pos = await page.locator("body").innerText();
  if (pos.includes("Chilli Powder") || pos.includes("මිරිස් කුඩු")) throw new Error("Inactive template appeared as sellable in POS");
  console.log("PASS: 36 demo-only records imported, persisted, inactive and absent from sellable POS.");
} finally {
  await browser.close();
}
