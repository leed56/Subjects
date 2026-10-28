import { chromium } from "playwright";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.LAKBIZ_LOCAL_URL ?? "http://localhost:3011";
const out = await mkdtemp(join(tmpdir(), "lakbiz-grocery-layout-"));
console.log(`Screenshots: ${out}`);
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // This is a local demo layout fixture; Windows can report navigator.onLine
  // as false even while the localhost preview is reachable.
  await context.addInitScript(() => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("lakbiz-locale", "en"));
  await page.goto(`${base}/sales`, { waitUntil: "networkidle" });
  const starter = page.getByTestId("grocery-starter-catalogue-button").first();
  if (await starter.count()) {
    await starter.click();
    await page.getByRole("button", { name: "Add catalogue", exact: true }).click();
    await page.getByText("16 available").waitFor({ timeout: 60_000 });
  }

  for (const locale of ["en", "si", "ta"]) {
    await page.evaluate((value) => localStorage.setItem("lakbiz-locale", value), locale);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["sales", "dashboard", "settings/plans"]) {
        await page.goto(`${base}/${route}`, { waitUntil: "networkidle" });
        await page.screenshot({ path: join(out, `${route.replace("/", "-")}-${locale}-${width}.png`), fullPage: true });
        const layout = await page.evaluate(() => ({
          horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
          language: document.documentElement.lang,
          bodyWidth: document.body.scrollWidth,
          viewportWidth: innerWidth,
          wideElements: [...document.querySelectorAll("body *")]
            .map((element) => ({ element, rect: element.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width > 0 && rect.right > innerWidth + 2)
            .sort((a, b) => b.rect.right - a.rect.right)
            .slice(0, 8)
            .map(({ element, rect }) => ({ tag: element.tagName, className: String(element.className).slice(0, 130), text: element.textContent?.slice(0, 45), right: Math.round(rect.right) })),
          productChain: (() => {
            const leaf = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Household"));
            const chain = [];
            for (let item = leaf; item && chain.length < 12; item = item.parentElement) {
              const rect = item.getBoundingClientRect();
              chain.push({ tag: item.tagName, className: String(item.className).slice(0, 90), width: Math.round(rect.width), scrollWidth: item.scrollWidth, clientWidth: item.clientWidth, overflowX: getComputedStyle(item).overflowX });
            }
            return chain;
          })(),
        }));
        if (layout.language !== locale || layout.horizontalOverflow > 2) {
          throw new Error(`${route} ${locale} ${width}px: ${JSON.stringify(layout)}`);
        }
        console.log(`PASS ${route} ${locale} ${width}px`);
      }
    }
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  console.log(`Screenshots: ${out}`);
} finally {
  await browser.close();
}
