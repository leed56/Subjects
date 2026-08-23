#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const previewUrl = (process.env.LAKBIZ_PREVIEW_URL ?? "https://subjects-git-claude-global-premium-ui-nexuserp.vercel.app").replace(/\/$/, "");
const screenshotDir = process.env.LAKBIZ_UI_QA_DIR ?? "/tmp/lakbiz-ui-qa";
const expectedHost = "zestppstpwjxriwcuykc.supabase.co";

if (!supabaseUrl || !serviceRole) throw new Error("Supabase URL and service-role key are required");
if (new URL(supabaseUrl).hostname !== expectedHost) throw new Error(`Refusing UI QA against unexpected Supabase host`);
if (!/^https:\/\//.test(previewUrl)) throw new Error("LAKBIZ_PREVIEW_URL must be HTTPS");

const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const runTag = String(process.env.GITHUB_RUN_ID ?? Date.now()).replace(/[^A-Za-z0-9_-]/g, "");
const password = `${randomBytes(20).toString("base64url")}A9!`;
const createdUsers = [];
const memberships = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function lookupOrg(name) {
  const { data, error } = await admin.from("organizations").select("id,name,sector").eq("name", name);
  if (error) throw new Error(`${name}: organization lookup failed: ${error.message}`);
  if ((data ?? []).length !== 1) throw new Error(`${name}: expected exactly one organization`);
  return data[0];
}

async function createQaUser(org, role, sector) {
  const email = `qa-ui-${sector}-${role}-${runTag}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { lakbiz_qa: true, qa_type: "deployed_ui", qa_role: role, qa_sector: sector },
  });
  if (error || !data.user) throw new Error(`UI QA Auth createUser failed: ${error?.message ?? "no user"}`);
  createdUsers.push(data.user.id);

  const { error: memberError } = await admin.from("org_members").insert({
    organization_id: org.id,
    user_id: data.user.id,
    role,
  });
  if (memberError) throw new Error(`UI QA membership failed: ${memberError.message}`);
  memberships.push({ organization_id: org.id, user_id: data.user.id });
  return { email, role, sector, org };
}

async function cleanup() {
  for (const membership of memberships.reverse()) {
    const { error } = await admin.from("org_members").delete().eq("organization_id", membership.organization_id).eq("user_id", membership.user_id);
    if (error) console.warn(`UI QA membership cleanup warning: ${error.message}`);
  }
  for (const userId of createdUsers.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.warn(`UI QA Auth cleanup warning: ${error.message}`);
  }
}

function safeName(value) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function login(page, user) {
  await page.goto(`${previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 60_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
}

async function assertClientSurface(page, { role }) {
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const forbidden of [
    "pharmacy template",
    "grocery template",
    "sector template",
    "business template",
    "cloud save failed",
    "new row violates row-level security",
  ]) {
    assert(!body.includes(forbidden), `Visible client UI leaked/failed with phrase: ${forbidden}`);
  }
  assert(body.includes("lakbiz"), "LakBiz application shell was not visible");

  if (role === "cashier") {
    for (const financial of [
      "owner financial snapshot",
      "stock cost value",
      "cost value · owner",
      "gross profit",
      "buy price (lkr)",
    ]) {
      assert(!body.includes(financial), `Cashier UI exposed owner-only financial phrase: ${financial}`);
    }
  }
}

async function capture(page, user, route, suffix = "desktop") {
  await page.goto(`${previewUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(500);
  await assertClientSurface(page, user);
  const file = `${screenshotDir}/${safeName(`${user.sector}-${user.role}-${route === "/" ? "home" : route}-${suffix}`)}.png`;
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function openAddItem(page, user) {
  await page.goto(`${previewUrl}/stock`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
  const add = page.getByRole("button", { name: /add item/i }).first();
  assert(await add.isVisible(), `${user.sector}: Add item button is not visible`);
  await add.click();
  await page.waitForTimeout(300);
  const required = page.locator('input[required]').first();
  if (await required.isVisible()) {
    await required.fill(user.sector === "pharmacy" ? "aci" : "tea");
    await page.waitForTimeout(900);
  }
  await assertClientSurface(page, user);
  const text = (await page.locator("body").innerText()).toLowerCase();
  assert(!text.includes("sector template"), "Add Item leaked sector template wording");
  const file = `${screenshotDir}/${user.sector}-${user.role}-stock-add-item-desktop.png`;
  await page.screenshot({ path: file, fullPage: true });
}

async function runViewport(browser, user, viewport, suffix, routes) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  try {
    await login(page, user);
    for (const route of routes) await capture(page, user, route, suffix);
    if (suffix === "desktop" && user.role === "owner") await openAddItem(page, user);
  } finally {
    await context.close();
  }
}

await mkdir(screenshotDir, { recursive: true });
let browser;
try {
  const [pharmacyOrg, groceryOrg] = await Promise.all([
    lookupOrg("LakBiz Pharmacy Demo"),
    lookupOrg("LakBiz Grocery Demo"),
  ]);
  assert(pharmacyOrg.sector === "pharmacy", "Pharmacy demo sector mismatch");
  assert(groceryOrg.sector === "grocery", "Grocery demo sector mismatch");

  const users = {
    pharmacyOwner: await createQaUser(pharmacyOrg, "owner", "pharmacy"),
    pharmacyCashier: await createQaUser(pharmacyOrg, "cashier", "pharmacy"),
    groceryOwner: await createQaUser(groceryOrg, "owner", "grocery"),
    groceryCashier: await createQaUser(groceryOrg, "cashier", "grocery"),
  };

  browser = await chromium.launch({ headless: true });
  const ownerRoutes = ["/dashboard", "/sales", "/stock", "/returns", "/banking", "/reports", "/settings/shop"];
  const cashierRoutes = ["/dashboard", "/sales", "/stock"];

  await runViewport(browser, users.pharmacyOwner, { width: 1440, height: 1000 }, "desktop", ownerRoutes);
  await runViewport(browser, users.groceryOwner, { width: 1440, height: 1000 }, "desktop", ownerRoutes);
  await runViewport(browser, users.pharmacyCashier, { width: 820, height: 1180 }, "tablet", cashierRoutes);
  await runViewport(browser, users.groceryCashier, { width: 820, height: 1180 }, "tablet", cashierRoutes);
  await runViewport(browser, users.pharmacyOwner, { width: 390, height: 844 }, "mobile", ["/dashboard", "/sales", "/stock"]);
  await runViewport(browser, users.groceryOwner, { width: 390, height: 844 }, "mobile", ["/dashboard", "/sales", "/stock"]);

  console.log("DEPLOYED_UI_QA_PASSED");
  console.log(JSON.stringify({ previewUrl, screenshotDir, screenshots: 22 }, null, 2));
} finally {
  if (browser) await browser.close();
  await cleanup();
  console.log("Deployed UI QA cleanup completed.");
}
