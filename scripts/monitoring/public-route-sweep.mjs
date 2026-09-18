/**
 * Public route sweep — does every public page actually RENDER? (2026-09-17)
 *
 * Why this exists
 * ---------------
 * The uptime probe loads ONE url (the homepage). App.tsx declares 500+ routes.
 * So a crash confined to other pages is invisible to monitoring: on 2026-09-17
 * `<HelmetProvider>` was missing from the app root, which meant EVERY route
 * rendering <Helmet> died at first paint —
 *
 *     TypeError: Cannot read properties of undefined (reading 'add')
 *
 * killing /search, /marketplace/search and both /services/* SEO landing pages.
 * The homepage was fine, so uptime stayed green, CI stayed green, and the bug
 * surfaced only when a customer's iPhone hit it and Sentry caught the crash.
 * Googlebot had been crawling a crashing page in the meantime.
 *
 * That class of bug is found by looking at the pages. #2503 ("Found by crawling
 * 60 live production pages") found three real bugs that way — by hand. This is
 * that crawl, automated.
 *
 * What it checks, per route
 * ------------------------
 *   • the document responded (not a 4xx/5xx shell)
 *   • the app did not fall back to AppErrorBoundary ("Something went wrong" /
 *     "משהו השתבש") — the exact signature of the Helmet crash
 *   • #root actually has content (not a white screen)
 *   • no uncaught page error fired while rendering
 *   • the page set a <title> (a dead <Helmet> shows up here too)
 *
 * What it does NOT do
 * -------------------
 * Signed-out only, so admin / dashboard / provider surfaces are skipped rather
 * than reported as broken — a sign-in redirect is correct behaviour, not a
 * finding. It asserts pages RENDER; it does not assert they are correct.
 *
 * Usage
 *   node scripts/monitoring/public-route-sweep.mjs [baseUrl] [--fail] [--json]
 *
 *   --fail   exit 1 when any route is broken (default: report only, exit 0, so
 *            it can run for a while before anyone trusts it enough to block)
 *   --json   machine-readable output for a workflow summary
 *
 * Zero new dependencies: Playwright is already used by uptime-healthcheck.yml.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) || process.env.SWEEP_URL || "https://petwash.co.il").replace(/\/$/, "");
const FAIL_ON_BROKEN = args.includes("--fail");
const AS_JSON = args.includes("--json");
const CONCURRENCY = Math.max(1, Number(process.env.SWEEP_CONCURRENCY || 4));
const NAV_TIMEOUT = Math.max(5000, Number(process.env.SWEEP_NAV_TIMEOUT_MS || 30000));
const RENDER_TIMEOUT = Math.max(3000, Number(process.env.SWEEP_RENDER_TIMEOUT_MS || 15000));

/**
 * Route prefixes that need a signed-in user (or an admin). Signed out they
 * redirect to sign-in, which renders fine — checking them here would measure
 * the sign-in page over and over, and a redirect would look like a finding.
 */
const AUTH_PREFIXES = [
  "/admin", "/dashboard", "/provider", "/my-account", "/account",
  "/wallet", "/my-wallet", "/prestige-pass", "/inbox", "/messages",
  "/settings", "/staff", "/k9000", "/octopus", "/onboarding",
  "/checkout", "/payment", "/booking/manage", "/my-",
];

/**
 * Dynamic routes are skipped — except these, where a representative value is
 * worth a thousand skipped patterns. /services/* is here because that IS the
 * SEO surface the Helmet crash killed silently.
 */
const DYNAMIC_SAMPLES = {
  "/services/:service": "/services/dog-walking",
  "/services/:service/:city": "/services/dog-walking/tel-aviv",
};

/**
 * Routes that are CORRECTLY blank when opened cold, so a blank page is not a
 * finding. Firebase's own action handler renders nothing without a valid
 * ?oobCode (password reset / email verification arrive with one); the first
 * production sweep reported both as white screens.
 */
const EXPECTED_BLANK = new Set(["/__/auth/action", "/auth/action"]);

/**
 * The Suspense fallback label (App.tsx PAGE_LOADER_COPY). A page still showing
 * this when the clock runs out did not render slowly — its lazy chunk never
 * arrived, which for a visitor is a spinner that never stops. Naming that
 * exactly beats reporting "almost no content": it says WHICH failure it is.
 */
const LOADER_COPY = /^(טוען\.\.\.|Loading\.\.\.|جاري التحميل\.\.\.|Загрузка\.\.\.|Chargement\.\.\.|Cargando\.\.\.)$/;

/** The error-boundary fallback, from client/src/lib/crashCardCopy.ts. */
const CRASH_COPY = /Something went wrong|משהו השתבש|A new version is available|זמינה גרסה חדשה|encountered an unexpected error|אירעה שגיאה/i;

/** Read the route table from App.tsx — the source of truth, never a hand-list. */
function collectRoutes() {
  const src = fs.readFileSync(path.join(REPO, "client", "src", "App.tsx"), "utf8");
  const found = new Set();
  for (const m of src.matchAll(/<Route\s+path="([^"]+)"/g)) found.add(m[1]);

  const routes = [];
  const skipped = { auth: 0, dynamic: 0, splat: 0, expectedBlank: 0 };
  for (const raw of found) {
    if (raw.includes("*")) { skipped.splat++; continue; }
    const isDynamic = raw.includes(":");
    if (isDynamic) {
      const sample = DYNAMIC_SAMPLES[raw];
      if (!sample) { skipped.dynamic++; continue; }
      if (AUTH_PREFIXES.some((p) => sample.startsWith(p))) { skipped.auth++; continue; }
      routes.push({ pattern: raw, url: sample });
      continue;
    }
    if (AUTH_PREFIXES.some((p) => raw === p || raw.startsWith(p + "/") || raw.startsWith(p))) {
      skipped.auth++; continue;
    }
    if (EXPECTED_BLANK.has(raw)) { skipped.expectedBlank++; continue; }
    routes.push({ pattern: raw, url: raw });
  }
  routes.sort((a, b) => a.url.localeCompare(b.url));
  return { routes, skipped };
}

async function checkRoute(browser, route) {
  const page = await browser.newPage({ locale: "he-IL", viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  // EVIDENCE. The first production sweep reported /loyalty and /support as
  // "almost no content (7 chars)" and that was the whole story — no way to tell
  // a 404'd chunk from a slow one without opening a browser by hand. The
  // uptime probe already learned this lesson (#2524 era); collect the same
  // proof here, quietly, and print it only for a route that actually failed.
  const failedRequests = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message || e).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
  page.on("requestfailed", (r) => failedRequests.push(`${r.url().slice(-80)} (${r.failure()?.errorText})`));
  page.on("response", (r) => {
    if (r.status() >= 400 && /\/assets\/|\.js|\.css/.test(r.url())) {
      failedRequests.push(`${r.url().slice(-80)} HTTP ${r.status()}`);
    }
  });

  const problems = [];
  let title = "";
  let chars = 0;
  try {
    const resp = await page.goto(BASE + route.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    if (!resp) {
      problems.push("no response");
    } else if (resp.status() >= 400) {
      problems.push(`HTTP ${resp.status()}`);
    }

    // Wait for real content, not merely "a child" — a Suspense spinner is a
    // child too, and the old uptime probe was fooled by exactly that.
    await page
      .waitForFunction(
        () => (document.getElementById("root")?.childElementCount ?? 0) > 0
          && (document.body?.innerText || "").replace(/\s/g, "").length >= 40,
        { timeout: RENDER_TIMEOUT },
      )
      .catch(() => {});

    const body = (await page.innerText("body").catch(() => "")) || "";
    chars = body.replace(/\s/g, "").length;
    title = await page.title().catch(() => "");
    const rootChildren = await page.evaluate(() => document.getElementById("root")?.childElementCount ?? 0);

    if (CRASH_COPY.test(body)) problems.push("ERROR BOUNDARY (render crash)");
    else if (rootChildren === 0) problems.push("#root empty (white screen)");
    else if (LOADER_COPY.test(body.trim())) {
      // Still the Suspense fallback when the clock ran out: the lazy chunk
      // never arrived. For a visitor this is a spinner that never stops.
      problems.push(`STUCK ON LOADING SPINNER after ${RENDER_TIMEOUT}ms (lazy chunk never arrived)`);
    }
    else if (chars < 40) problems.push(`almost no content (${chars} chars)`);

    if (pageErrors.length) problems.push(`pageerror: ${pageErrors[0]}`);
    if (!title.trim()) problems.push("no <title>");
  } catch (e) {
    problems.push(`navigation error: ${String(e?.message || e).slice(0, 120)}`);
  } finally {
    await page.close().catch(() => {});
  }
  const evidence = problems.length
    ? {
        failedRequests: failedRequests.slice(0, 4),
        consoleErrors: consoleErrors.slice(0, 4),
      }
    : null;
  return { ...route, ok: problems.length === 0, problems, title, chars, evidence };
}

/**
 * One retry before calling a route broken. A chunk fetch that loses a race
 * with a deploy, or a cold CDN edge, is not a broken page — and an alert
 * nobody trusts is worse than no alert (#2526). A genuinely broken route
 * fails both times.
 */
async function checkRouteWithRetry(browser, route) {
  const first = await checkRoute(browser, route);
  if (first.ok) return first;
  await new Promise((r) => setTimeout(r, 2000));
  const second = await checkRoute(browser, route);
  return second.ok ? { ...second, flaky: true } : second;
}

async function main() {
  const { routes, skipped } = collectRoutes();
  if (!AS_JSON) {
    console.log(`[route-sweep] ${BASE} @ ${new Date().toISOString()}`);
    console.log(`[route-sweep] ${routes.length} public routes to check ` +
      `(skipped: ${skipped.auth} auth-gated, ${skipped.dynamic} dynamic, ${skipped.splat} catch-all, ${skipped.expectedBlank} expected-blank)\n`);
  }

  // SWEEP_CHROMIUM_PATH: run against a Chromium that is already on the machine
  // instead of the one this Playwright version would download (dev containers
  // and self-hosted runners often pin a different build). Unset in CI, where
  // the workflow installs its own.
  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    ...(process.env.SWEEP_CHROMIUM_PATH ? { executablePath: process.env.SWEEP_CHROMIUM_PATH } : {}),
  });
  const results = [];
  try {
    const queue = [...routes];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const r = await checkRouteWithRetry(browser, job);
        results.push(r);
        if (!AS_JSON) {
          process.stdout.write(r.ok ? "." : "\n  ✗ " + r.url + " — " + r.problems.join("; ") + "\n");
        }
      }
    });
    await Promise.all(workers);
  } finally {
    await browser.close().catch(() => {});
  }

  results.sort((a, b) => a.url.localeCompare(b.url));
  const broken = results.filter((r) => !r.ok);

  if (AS_JSON) {
    console.log(JSON.stringify({ base: BASE, checked: results.length, broken: broken.length, skipped, routes: results }, null, 2));
  } else {
    console.log(`\n\n[route-sweep] ${results.length - broken.length}/${results.length} rendered`);
    const flaky = results.filter((r) => r.flaky);
    if (flaky.length) {
      console.log(`${flaky.length} recovered on retry (not reported): ${flaky.map((f) => f.url).join(", ")}`);
    }
    if (broken.length) {
      console.log(`\n${broken.length} BROKEN:`);
      for (const b of broken) {
        console.log(`  ${b.url}\n      ${b.problems.join("\n      ")}`);
        const ev = b.evidence;
        if (ev?.failedRequests?.length) console.log(`      failed requests: ${ev.failedRequests.join(" | ")}`);
        if (ev?.consoleErrors?.length) console.log(`      console: ${ev.consoleErrors.join(" | ")}`);
      }
      console.log("\nA route listed here served the error fallback, a blank page, or threw while rendering.");
    } else {
      console.log("Every public route rendered.");
    }
  }

  // Report-only by default: this should earn trust before it can block a deploy.
  process.exit(broken.length && FAIL_ON_BROKEN ? 1 : 0);
}

main().catch((e) => {
  console.error(`[route-sweep] fatal: ${e?.message || e}`);
  process.exit(FAIL_ON_BROKEN ? 1 : 0);
});
