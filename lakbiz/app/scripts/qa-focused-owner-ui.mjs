#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const previewUrl = (process.env.LAKBIZ_PREVIEW_URL ?? "").replace(/\/$/, "");
const expectedBuildSha = (process.env.LAKBIZ_EXPECTED_BUILD_SHA ?? "").trim();
const screenshotDir = process.env.LAKBIZ_FOCUSED_UI_QA_DIR ?? "/tmp/lakbiz-focused-ui";
const routes = (process.env.LAKBIZ_FOCUSED_ROUTES ?? "/suppliers")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const expectedHost = "zestppstpwjxriwcuykc.supabase.co";

if (!supabaseUrl || !serviceRole || !previewUrl) {
  throw new Error("Supabase credentials and LAKBIZ_PREVIEW_URL are required");
}
if (new URL(supabaseUrl).hostname !== expectedHost) {
  throw new Error("Refusing focused UI QA against unexpected Supabase host");
}
if (!/^https:\/\//.test(previewUrl)) throw new Error("LAKBIZ_PREVIEW_URL must be HTTPS");

const admin = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runTag = String(process.env.GITHUB_RUN_ID ?? Date.now()).replace(/[^A-Za-z0-9_-]/g, "");
const password = `${randomBytes(20).toString("base64url")}A9!`;
let userId = "";
let orgId = "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeName(value) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function createOwner() {
  const { data: organizations, error: orgError } = await admin
    .from("organizations")
    .select("id,name,sector")
    .eq("name", "LakBiz Pharmacy Demo");
  if (orgError || (organizations ?? []).length !== 1) {
    throw new Error(`Focused QA organization lookup failed: ${orgError?.message ?? "not unique"}`);
  }
  const org = organizations[0];
  orgId = org.id;

  const email = `qa-focused-pharmacy-owner-${runTag}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { lakbiz_qa: true, qa_type: "focused_ui", qa_role: "owner" },
  });
  if (error || !data.user) throw new Error(`Focused QA user creation failed: ${error?.message ?? "no user"}`);
  userId = data.user.id;

  const { error: memberError } = await admin.from("org_members").insert({
    organization_id: orgId,
    user_id: userId,
    role: "owner",
  });
  if (memberError) throw new Error(`Focused QA membership failed: ${memberError.message}`);

  return { email };
}

async function cleanup() {
  if (orgId && userId) {
    await admin.from("org_members").delete().eq("organization_id", orgId).eq("user_id", userId);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}

async function verifyPreview(page) {
  await page.goto(`${previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const body = page.locator("body");
  const buildSha = (await body.getAttribute("data-lakbiz-build-sha"))?.trim() ?? "";
  const supabaseHost = (await body.getAttribute("data-lakbiz-supabase-host"))?.trim() ?? "";
  assert(!supabaseHost || supabaseHost === expectedHost, `Unexpected Supabase host: ${supabaseHost}`);
  if (expectedBuildSha) {
    assert(buildSha === expectedBuildSha, `Focused UI preview is stale. Expected ${expectedBuildSha}, found ${buildSha || "none"}`);
  }
}

async function login(page, email) {
  await page.addInitScript(() => localStorage.setItem("lakbiz-locale", "en"));
  await page.goto(`${previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
}

async function capture(page, route, suffix) {
  await page.goto(`${previewUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(500);
  assert(new URL(page.url()).pathname === route, `${route} redirected to ${page.url()}`);
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyText: document.body.innerText.slice(0, 4000),
  }));
  assert(metrics.scrollWidth <= metrics.innerWidth + 2, `${route} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.innerWidth}px`);
  assert(metrics.bodyText.toLowerCase().includes("lakbiz"), `${route} did not render the LakBiz shell`);
  const file = `${screenshotDir}/${safeName(`${route}-${suffix}`)}.png`;
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function captureSupplierDrawer(page) {
  if (!routes.includes("/suppliers")) return;
  await page.goto(`${previewUrl}/suppliers`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
  const addSupplier = page.getByRole("button", { name: /^add supplier$/i });
  assert(await addSupplier.isVisible().catch(() => false), "Add Supplier button is not visible");
  await addSupplier.click();
  await page.waitForTimeout(300);
  const dialog = page.locator('[role="dialog"]:visible').last();
  assert(await dialog.isVisible(), "Add Supplier drawer did not open");
  await page.screenshot({ path: `${screenshotDir}/suppliers-add-drawer-desktop.png`, fullPage: true });
}

await mkdir(screenshotDir, { recursive: true });
let browser;
try {
  const owner = await createOwner();
  browser = await chromium.launch({ headless: true });

  const preflight = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await verifyPreview(await preflight.newPage());
  } finally {
    await preflight.close();
  }

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const page = await desktop.newPage();
    await login(page, owner.email);
    for (const route of routes) await capture(page, route, "desktop");
    await captureSupplierDrawer(page);
  } finally {
    await desktop.close();
  }

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await mobile.newPage();
    await login(page, owner.email);
    for (const route of routes) await capture(page, route, "mobile");
  } finally {
    await mobile.close();
  }

  console.log("FOCUSED_OWNER_UI_QA_PASSED");
  console.log(JSON.stringify({ previewUrl, expectedBuildSha, routes, screenshotDir }, null, 2));
} finally {
  if (browser) await browser.close();
  await cleanup();
  console.log("Focused owner UI QA cleanup completed.");
}
