/**
 * Free production health-check (2026-06-27) — catches what a plain ping can't.
 *
 * A server-side curl returns 200 even when the React app white-screens (the HTML
 * shell loads; the crash is in the browser). So this loads the real site in a
 * headless browser, waits for React to render, and FAILS if:
 *   • /api/health is not OK, or
 *   • the homepage shows the error boundary ("Something went wrong"), or
 *   • #root rendered no content (blank app).
 * Run by .github/workflows/uptime-healthcheck.yml every 15 min. Exit code 1 →
 * the workflow fails → GitHub emails the repo admins (free, no vendor).
 *
 * Zero cost, no Sentry/Coralogix needed. Usage: node homepage-healthcheck.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || process.env.HEALTHCHECK_URL || "https://petwash.co.il";
const fail = (msg) => { console.error(`❌ ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`✅ ${msg}`);

async function checkApiHealth() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return fail(`/api/health HTTP ${res.status}`);
    if (body.status && String(body.status).toUpperCase() !== "OK") return fail(`/api/health status=${body.status}`);
    if (body.checks?.db && body.checks.db.ok === false) return fail("/api/health db.ok=false");
    ok(`/api/health OK (db ${body.checks?.db?.ok !== false ? "up" : "down"})`);
  } catch (e) {
    fail(`/api/health unreachable: ${e?.message || e}`);
  }
}

async function checkHomepageRenders() {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ locale: "he-IL" });
    const resp = await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 35000 });
    if (!resp || !resp.ok()) return fail(`homepage HTTP ${resp ? resp.status() : "no-response"}`);

    // Give React a beat to render / crash.
    await page.waitForTimeout(2500);

    const body = (await page.innerText("body").catch(() => "")) || "";
    if (/Something went wrong|encountered an unexpected error|אירעה שגיאה/i.test(body)) {
      return fail("homepage shows the error boundary (white-screen / render crash)");
    }
    const rootChildren = await page.evaluate(
      () => document.getElementById("root")?.childElementCount ?? 0,
    );
    if (rootChildren === 0) return fail("homepage #root is empty (app did not render)");
    if (body.replace(/\s/g, "").length < 50) return fail("homepage rendered almost no content");

    ok(`homepage rendered (root children=${rootChildren}, ${body.length} chars)`);
  } catch (e) {
    fail(`homepage check error: ${e?.message || e}`);
  } finally {
    await browser.close().catch(() => {});
  }
}

console.log(`[healthcheck] ${BASE} @ ${new Date().toISOString()}`);
await checkApiHealth();
await checkHomepageRenders();
if (process.exitCode === 1) {
  console.error("\n🚨 PetWash health-check FAILED — site is degraded or white-screening.");
} else {
  console.log("\n🎉 PetWash health-check passed.");
}
