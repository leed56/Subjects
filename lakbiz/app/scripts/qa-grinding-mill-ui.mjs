import { chromium } from "playwright";

const base = process.env.LAKBIZ_LOCAL_URL ?? "http://localhost:3012";
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on("pageerror", (error) => console.log(`browser error: ${error.message}`));
    await page.goto(`${base}/stock`, { waitUntil: "networkidle" });
    await page.waitForTimeout(750);
    const state = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
      catalogueVisible: /grinding-mill range|ඇඹරුම්හල්|அரவை ஆலை/.test(document.body.innerText),
    }));
    if (state.horizontalOverflow || !state.catalogueVisible) throw new Error(`Stock catalogue failed at ${width}px`);
    await page.getByRole("button", { name: /ඇඹරුම්හල් භාණ්ඩ එක් කරන්න|Add grinding-mill range|அரவை ஆலைப் பொருட்களைச் சேர்/ }).click();
    await page.waitForTimeout(200);
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible()) || !(await dialog.innerText()).includes("36")) {
      throw new Error(`Owner confirmation unavailable at ${width}px`);
    }
    if (!(await dialog.innerText()).includes("අක්‍රිය")) throw new Error(`Localized confirmation missing at ${width}px`);
    const asset = await page.request.get(`${base}/images/grocery/grinding-mill/cum.svg`);
    if (!asset.ok() || !(await asset.text()).includes("Cumin Powder")) throw new Error("Cumin artwork unavailable");
    console.log(`PASS: ${width}px Stock action, localized confirmation, artwork and no horizontal overflow.`);
    await page.close();
  }
} finally {
  await browser.close();
}
