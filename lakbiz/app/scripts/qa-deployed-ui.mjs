#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const previewUrl = (process.env.LAKBIZ_PREVIEW_URL ?? "https://subjects-git-claude-global-premium-ui-nexuserp.vercel.app").replace(/\/$/, "");
const screenshotDir = process.env.LAKBIZ_UI_QA_DIR ?? "/tmp/lakbiz-ui-qa";
const expectedBuildSha = (process.env.LAKBIZ_EXPECTED_BUILD_SHA ?? "").trim();
const expectedHost = "zestppstpwjxriwcuykc.supabase.co";
const githubRepository = process.env.GITHUB_REPOSITORY ?? "leed56/Subjects";
const QA_ONLY_PATHS = new Set([
  "lakbiz/app/scripts/qa-deployed-ui.mjs",
  ".github/workflows/lakbiz-deployed-ui-qa.yml",
]);

if (!supabaseUrl || !serviceRole) throw new Error("Supabase URL and service-role key are required");
if (new URL(supabaseUrl).hostname !== expectedHost) throw new Error("Refusing UI QA against unexpected Supabase host");
if (!/^https:\/\//.test(previewUrl)) throw new Error("LAKBIZ_PREVIEW_URL must be HTTPS");

const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const runTag = String(process.env.GITHUB_RUN_ID ?? Date.now()).replace(/[^A-Za-z0-9_-]/g, "");
const password = `${randomBytes(20).toString("base64url")}A9!`;
const createdUsers = [];
const memberships = [];
const screenshots = [];

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

async function readPreviewIdentity(page) {
  await page.goto(`${previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const body = page.locator("body");
  return {
    buildSha: (await body.getAttribute("data-lakbiz-build-sha"))?.trim() ?? "",
    supabaseHost: (await body.getAttribute("data-lakbiz-supabase-host"))?.trim() ?? "",
  };
}

async function isQaOnlyPreviewDrift(deployedSha, expectedSha) {
  if (!deployedSha || !expectedSha || deployedSha === expectedSha) return false;
  if (!/^[0-9a-f]{40}$/i.test(deployedSha) || !/^[0-9a-f]{40}$/i.test(expectedSha)) return false;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(githubRepository)) return false;
  try {
    const response = await fetch(
      `https://api.github.com/repos/${githubRepository}/compare/${deployedSha}...${expectedSha}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "lakbiz-deployed-ui-qa",
        },
      },
    );
    if (!response.ok) return false;
    const comparison = await response.json();
    if (comparison.status !== "ahead" || !Array.isArray(comparison.files) || comparison.files.length === 0) return false;
    const changedPaths = comparison.files.map((file) => String(file.filename ?? ""));
    const qaOnly = changedPaths.every((path) => QA_ONLY_PATHS.has(path));
    if (qaOnly) {
      console.log(`Preview build ${deployedSha} accepted for QA-only head ${expectedSha}; changed files: ${changedPaths.join(", ")}`);
    }
    return qaOnly;
  } catch {
    return false;
  }
}

async function waitForExpectedPreview(page) {
  let last = { buildSha: "", supabaseHost: "" };
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    last = await readPreviewIdentity(page);
    if (last.supabaseHost && last.supabaseHost !== expectedHost) {
      throw new Error(`Preview points to unexpected Supabase host: ${last.supabaseHost}`);
    }
    if (!expectedBuildSha || last.buildSha === expectedBuildSha) {
      if (expectedBuildSha) console.log(`Preview build verified: ${last.buildSha}`);
      return;
    }
    if (await isQaOnlyPreviewDrift(last.buildSha, expectedBuildSha)) return;
    if (attempt < 24) {
      console.log(`Preview not on expected commit yet (${last.buildSha || "build identity unavailable"}); retrying.`);
      await page.waitForTimeout(10_000);
    }
  }
  throw new Error(
    `Preview deployment is stale or unavailable. Expected commit ${expectedBuildSha}, found ${last.buildSha || "no build identity"}.`,
  );
}

async function saveDiagnostic(page, user, label) {
  const file = `${screenshotDir}/${safeName(`${user.sector}-${user.role}-${label}`)}.png`;
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  screenshots.push(file);
  const visibleText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 1600);
  console.error(JSON.stringify({
    diagnostic: label,
    sector: user.sector,
    role: user.role,
    url: page.url(),
    visibleText,
  }, null, 2));
}

async function login(page, user) {
  const consoleErrors = [];
  const pageErrors = [];
  const authResponses = [];
  const onConsole = (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500));
  };
  const onPageError = (error) => pageErrors.push(String(error?.message ?? error).slice(0, 500));
  const onResponse = (response) => {
    if (!response.url().includes("/auth/v1/token")) return;
    authResponses.push({ url: response.url(), status: response.status() });
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  try {
    await page.goto(`${previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(500);

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');
    await emailInput.waitFor({ state: "visible", timeout: 15_000 });
    await passwordInput.waitFor({ state: "visible", timeout: 15_000 });
    await submitButton.waitFor({ state: "visible", timeout: 15_000 });
    await emailInput.fill(user.email);
    await passwordInput.fill(password);
    await submitButton.click();

    try {
      await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 60_000 });
    } catch (error) {
      console.error(JSON.stringify({
        diagnostic: "login-runtime",
        sector: user.sector,
        role: user.role,
        consoleErrors,
        pageErrors,
        authResponses,
      }, null, 2));
      await saveDiagnostic(page, user, "login-failure");
      throw new Error(`${user.sector}/${user.role}: login did not reach /dashboard. ${error instanceof Error ? error.message : "Unknown login failure"}`);
    }
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
  }
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

  if (["cashier", "technician", "data_entry", "manager"].includes(role)) {
    for (const financial of [
      "owner financial snapshot",
      "stock cost value",
      "cost value · owner",
      "gross profit",
      "buy price (lkr)",
    ]) {
      assert(!body.includes(financial), `${role} UI exposed owner-only financial phrase: ${financial}`);
    }
  }
}

async function capture(page, user, route, suffix = "desktop") {
  await page.goto(`${previewUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(500);
  const actualPath = new URL(page.url()).pathname;
  assert(actualPath === route, `${user.sector}/${user.role}: ${route} redirected to ${actualPath}`);
  await assertClientSurface(page, user);
  const file = `${screenshotDir}/${safeName(`${user.sector}-${user.role}-${route === "/" ? "home" : route}-${suffix}`)}.png`;
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push(file);
  return file;
}

async function openAddItem(page, user) {
  await page.goto(`${previewUrl}/stock`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
  // The production Sinhala copy currently uses "භාණ්ඩය එකතු කරන්න" while
  // an older translation used "භාණ්ඩයක් එකතු කරන්න". Accept both accessible
  // names without weakening the requirement that the Add Item control exists.
  const add = page.getByRole("button", { name: /(?:add item|භාණ්ඩ(?:ය|යක්)\s+එකතු\s+කරන්න)/i }).first();
  if (!(await add.isVisible().catch(() => false))) {
    await saveDiagnostic(page, user, "stock-add-item-control-missing");
    throw new Error(`${user.sector}: localized Add item button is not visible`);
  }
  await add.click();
  await page.waitForTimeout(300);
  const required = page.locator('input[required]').first();
  if (await required.isVisible()) {
    const searchSeed = user.sector === "pharmacy" ? "aci" : user.sector === "ac_hvac" ? "compressor" : "tea";
    await required.fill(searchSeed);
    await page.waitForTimeout(900);
  }
  await assertClientSurface(page, user);
  const text = (await page.locator("body").innerText()).toLowerCase();
  assert(!text.includes("sector template"), "Add Item leaked sector template wording");
  const file = `${screenshotDir}/${user.sector}-${user.role}-stock-add-item-desktop.png`;
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push(file);
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
  const [pharmacyOrg, groceryOrg, hvacOrg] = await Promise.all([
    lookupOrg("LakBiz Pharmacy Demo"),
    lookupOrg("LakBiz Grocery Demo"),
    lookupOrg("IMT Test 2"),
  ]);
  assert(pharmacyOrg.sector === "pharmacy", "Pharmacy demo sector mismatch");
  assert(groceryOrg.sector === "grocery", "Grocery demo sector mismatch");
  assert(hvacOrg.sector === "ac_hvac", "HVAC QA sector mismatch");

  browser = await chromium.launch({ headless: true });
  const preflightContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await waitForExpectedPreview(await preflightContext.newPage());
  } finally {
    await preflightContext.close();
  }

  const users = {
    pharmacyOwner: await createQaUser(pharmacyOrg, "owner", "pharmacy"),
    pharmacyCashier: await createQaUser(pharmacyOrg, "cashier", "pharmacy"),
    groceryOwner: await createQaUser(groceryOrg, "owner", "grocery"),
    groceryCashier: await createQaUser(groceryOrg, "cashier", "grocery"),
    hvacOwner: await createQaUser(hvacOrg, "owner", "ac_hvac"),
    hvacTechnician: await createQaUser(hvacOrg, "technician", "ac_hvac"),
  };

  const retailOwnerRoutes = ["/dashboard", "/sales", "/stock", "/returns", "/banking", "/reports", "/settings/shop"];
  const retailCashierRoutes = ["/dashboard", "/sales", "/stock"];
  const hvacOwnerRoutes = ["/dashboard", "/jobs", "/sales", "/stock", "/job-costing", "/reports"];
  const hvacTechnicianRoutes = ["/dashboard", "/jobs"];

  await runViewport(browser, users.pharmacyOwner, { width: 1440, height: 1000 }, "desktop", retailOwnerRoutes);
  await runViewport(browser, users.groceryOwner, { width: 1440, height: 1000 }, "desktop", retailOwnerRoutes);
  await runViewport(browser, users.hvacOwner, { width: 1440, height: 1000 }, "desktop", hvacOwnerRoutes);

  await runViewport(browser, users.pharmacyCashier, { width: 820, height: 1180 }, "tablet", retailCashierRoutes);
  await runViewport(browser, users.groceryCashier, { width: 820, height: 1180 }, "tablet", retailCashierRoutes);
  await runViewport(browser, users.hvacTechnician, { width: 820, height: 1180 }, "tablet", hvacTechnicianRoutes);

  await runViewport(browser, users.pharmacyOwner, { width: 390, height: 844 }, "mobile", ["/dashboard", "/sales", "/stock"]);
  await runViewport(browser, users.groceryOwner, { width: 390, height: 844 }, "mobile", ["/dashboard", "/sales", "/stock"]);
  await runViewport(browser, users.hvacOwner, { width: 390, height: 844 }, "mobile", ["/dashboard", "/jobs"]);

  console.log("DEPLOYED_UI_QA_PASSED");
  console.log(JSON.stringify({ previewUrl, expectedBuildSha, screenshotDir, screenshots: screenshots.length }, null, 2));
} finally {
  if (browser) await browser.close();
  await cleanup();
  console.log("Deployed UI QA cleanup completed.");
}