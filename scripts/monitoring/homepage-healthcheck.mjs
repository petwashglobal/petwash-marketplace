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
 * RETRY-BEFORE-ALARM (2026-07-09): a single transient 503 during a normal Cloud
 * Run instance recycle (~20s cold start, /health returns 503 until phase=ready)
 * used to fail the whole run and email "health check failed" — crying wolf on a
 * self-healing blip. We now probe up to HEALTHCHECK_ATTEMPTS times, spaced
 * HEALTHCHECK_RETRY_MS apart, and only fail if EVERY attempt fails. A genuine
 * sustained outage still fails all attempts and alarms; a cold-start recovers on
 * the next attempt and stays quiet.
 *
 * Zero cost, no Sentry/Coralogix needed. Usage: node homepage-healthcheck.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || process.env.HEALTHCHECK_URL || "https://petwash.co.il";
const ATTEMPTS = Math.max(1, Number(process.env.HEALTHCHECK_ATTEMPTS || 3));
const RETRY_DELAY_MS = Math.max(0, Number(process.env.HEALTHCHECK_RETRY_MS || 25000));

async function checkApiHealth() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, msg: `/api/health HTTP ${res.status}` };
    if (body.status && String(body.status).toUpperCase() !== "OK") return { ok: false, msg: `/api/health status=${body.status}` };
    if (body.checks?.db && body.checks.db.ok === false) return { ok: false, msg: "/api/health db.ok=false" };
    return { ok: true, msg: `/api/health OK (db ${body.checks?.db?.ok !== false ? "up" : "down"})` };
  } catch (e) {
    return { ok: false, msg: `/api/health unreachable: ${e?.message || e}` };
  }
}

async function checkHomepageRenders() {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ locale: "he-IL" });
    const resp = await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 35000 });
    if (!resp || !resp.ok()) return { ok: false, msg: `homepage HTTP ${resp ? resp.status() : "no-response"}` };

    // Give React a beat to render / crash.
    await page.waitForTimeout(2500);

    const body = (await page.innerText("body").catch(() => "")) || "";
    if (/Something went wrong|encountered an unexpected error|אירעה שגיאה/i.test(body)) {
      return { ok: false, msg: "homepage shows the error boundary (white-screen / render crash)" };
    }
    const rootChildren = await page.evaluate(
      () => document.getElementById("root")?.childElementCount ?? 0,
    );
    if (rootChildren === 0) return { ok: false, msg: "homepage #root is empty (app did not render)" };
    if (body.replace(/\s/g, "").length < 50) return { ok: false, msg: "homepage rendered almost no content" };

    return { ok: true, msg: `homepage rendered (root children=${rootChildren}, ${body.length} chars)` };
  } catch (e) {
    return { ok: false, msg: `homepage check error: ${e?.message || e}` };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function runOnce() {
  const api = await checkApiHealth();
  console.log(api.ok ? `✅ ${api.msg}` : `❌ ${api.msg}`);
  const home = await checkHomepageRenders();
  console.log(home.ok ? `✅ ${home.msg}` : `❌ ${home.msg}`);
  return api.ok && home.ok;
}

console.log(`[healthcheck] ${BASE} @ ${new Date().toISOString()} (up to ${ATTEMPTS} attempts)`);
let passed = false;
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  console.log(`\n— attempt ${attempt}/${ATTEMPTS} —`);
  passed = await runOnce();
  if (passed) break;
  if (attempt < ATTEMPTS) {
    console.log(`… attempt ${attempt} failed — retrying in ${Math.round(RETRY_DELAY_MS / 1000)}s (a transient cold-start must not alarm)`);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
}

if (passed) {
  console.log("\n🎉 PetWash health-check passed.");
} else {
  process.exitCode = 1;
  console.error(`\n🚨 PetWash health-check FAILED after ${ATTEMPTS} attempts — a SUSTAINED failure, not a transient cold-start. Site is genuinely degraded or white-screening.`);
}
