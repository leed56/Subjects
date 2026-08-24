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
const expectedHost = "zestppstpwjxriwcuykc.supabase.co";

if (!supabaseUrl || !serviceRole || !previewUrl) {
  throw new Error("Supabase credentials and LAKBIZ_PREVIEW_URL are required");
}
if (new URL(supabaseUrl).hostname !== expectedHost) {
  throw new Error("Refusing Vehicles UI QA against unexpected Supabase host");
}
if (!/^https:\/\//.test(previewUrl)) throw new Error("LAKBIZ_PREVIEW_URL must be HTTPS");

const admin = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runTag = String(process.env.GITHUB_RUN_ID ?? Date.now()).replace(/[^A-Za-z0-9_-]/g, "");
const password = `${randomBytes(20).toString("base64url")}A9!`;
const orgName = `LakBiz Vehicles QA ${runTag}`;
const vehicleId = `qa-vehicle-${runTag}`;
let orgId = "";
let subscriptionId = "";
let userId = "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeName(value) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function createFixture() {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: orgName, sector: "car_sales" })
    .select("id,name,sector")
    .single();
  if (orgError || !org) throw new Error(`Vehicles QA organization creation failed: ${orgError?.message ?? "no row"}`);
  orgId = org.id;
  assert(org.sector === "car_sales", `Vehicles QA organization sector mismatch: ${org.sector}`);

  const { data: subscription, error: subscriptionError } = await admin
    .from("subscriptions")
    .insert({
      organization_id: orgId,
      plan_id: "pro",
      status: "trialing",
      billing_cycle: "monthly",
      trial_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (subscriptionError || !subscription) {
    throw new Error(`Vehicles QA subscription creation failed: ${subscriptionError?.message ?? "no row"}`);
  }
  subscriptionId = subscription.id;

  const now = new Date().toISOString();
  const { error: vehicleError } = await admin.from("vehicles").insert({
    id: vehicleId,
    organization_id: orgId,
    stock_id: "QA-VEH-001",
    date_added: now,
    make: "Toyota",
    model: "Corolla Cross",
    year: 2024,
    chassis_no: `QA-CHASSIS-${runTag}`,
    engine_no: `QA-ENGINE-${runTag}`,
    reg_no: "QA-1234",
    color: "Pearl White",
    fuel: "hybrid",
    transmission: "auto",
    mileage_km: 18500,
    condition: "Reconditioned",
    purchase_price: 12500000,
    recondition_cost: 350000,
    ask_price: 14250000,
    min_price: 13800000,
    status: "for_sale",
    notes: "Disposable browser-QA vehicle",
    created_at: now,
    updated_at: now,
  });
  if (vehicleError) throw new Error(`Vehicles QA seed failed: ${vehicleError.message}`);

  const email = `qa-focused-car-sales-owner-${runTag}@example.invalid`;
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      lakbiz_qa: true,
      qa_type: "focused_vehicles_ui",
      qa_role: "owner",
      qa_sector: "car_sales",
    },
  });
  if (authError || !authData.user) throw new Error(`Vehicles QA user creation failed: ${authError?.message ?? "no user"}`);
  userId = authData.user.id;

  const { error: memberError } = await admin.from("org_members").insert({
    organization_id: orgId,
    user_id: userId,
    role: "owner",
  });
  if (memberError) throw new Error(`Vehicles QA membership failed: ${memberError.message}`);

  return { email };
}

async function cleanup() {
  if (orgId) await admin.from("vehicles").delete().eq("organization_id", orgId);
  if (orgId && userId) {
    await admin.from("org_members").delete().eq("organization_id", orgId).eq("user_id", userId);
  }
  if (subscriptionId) await admin.from("subscriptions").delete().eq("id", subscriptionId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
}

async function verifyPreview(page) {
  await page.goto(`${previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const body = page.locator("body");
  const buildSha = (await body.getAttribute("data-lakbiz-build-sha"))?.trim() ?? "";
  const supabaseHost = (await body.getAttribute("data-lakbiz-supabase-host"))?.trim() ?? "";
  assert(!supabaseHost || supabaseHost === expectedHost, `Unexpected Supabase host: ${supabaseHost}`);
  if (expectedBuildSha) {
    assert(buildSha === expectedBuildSha, `Vehicles preview is stale. Expected ${expectedBuildSha}, found ${buildSha || "none"}`);
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

async function captureVehicles(page, suffix) {
  await page.goto(`${previewUrl}/vehicles`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(500);
  assert(new URL(page.url()).pathname === "/vehicles", `/vehicles redirected to ${page.url()}`);

  const metrics = await page.evaluate(() => {
    const innerWidth = window.innerWidth;
    const overflowElements = [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 140),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          className: typeof element.className === "string" ? element.className.slice(0, 200) : "",
        };
      })
      .filter((element) => element.right > innerWidth + 2 || element.left < -2)
      .slice(0, 15);
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      bodyText: document.body.innerText.slice(0, 8000),
      overflowElements,
    };
  });

  if (metrics.scrollWidth > metrics.innerWidth + 2) {
    const file = `${screenshotDir}/vehicles-${suffix}-overflow.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.error(JSON.stringify({ diagnostic: "vehicles-horizontal-overflow", ...metrics, screenshot: file }, null, 2));
    throw new Error(`/vehicles has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.innerWidth}px`);
  }

  const bodyText = metrics.bodyText.toLowerCase();
  assert(bodyText.includes("lakbiz"), "Vehicles did not render the LakBiz shell");
  assert(bodyText.includes("qa-veh-001"), "Seeded QA vehicle did not render in the showroom register");
  assert(bodyText.includes("corolla cross"), "Seeded QA vehicle identity is missing");
  assert(bodyText.includes("cost") && bodyText.includes("profit"), "Owner financial vehicle columns/metrics are missing");

  const file = `${screenshotDir}/${safeName(`vehicles-${suffix}`)}.png`;
  await page.screenshot({ path: file, fullPage: true });
}

async function captureAddDrawer(page) {
  await page.goto(`${previewUrl}/vehicles`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
  const addVehicle = page.getByRole("button", { name: /add.*vehicle|vehicle.*add/i }).first();
  assert(await addVehicle.isVisible().catch(() => false), "Add Vehicle button is not visible");
  await addVehicle.click();
  await page.waitForTimeout(300);
  const dialog = page.locator('[role="dialog"]:visible').last();
  assert(await dialog.isVisible().catch(() => false), "Add Vehicle drawer did not open");
  const dialogText = (await dialog.innerText()).toLowerCase();
  assert(dialogText.includes("chassis"), "Add Vehicle drawer is missing chassis input");
  assert(dialogText.includes("pricing"), "Add Vehicle drawer is missing pricing section");
  await page.screenshot({ path: `${screenshotDir}/vehicles-add-drawer-desktop.png`, fullPage: true });
}

await mkdir(screenshotDir, { recursive: true });
let browser;
try {
  const owner = await createFixture();
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
    await captureVehicles(page, "desktop");
    await captureAddDrawer(page);
  } finally {
    await desktop.close();
  }

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await mobile.newPage();
    await login(page, owner.email);
    await captureVehicles(page, "mobile");
  } finally {
    await mobile.close();
  }

  console.log("FOCUSED_VEHICLES_UI_QA_PASSED");
  console.log(JSON.stringify({ previewUrl, expectedBuildSha, orgName, screenshotDir }, null, 2));
} finally {
  if (browser) await browser.close();
  await cleanup();
  console.log("Focused Vehicles UI QA cleanup completed.");
}
