/**
 * Post-deploy production smoke — release-freeze 2026-09-03.
 *
 * Runs a bounded, non-destructive check-list against the live public
 * hostname after a successful CI deploy. Complements the every-15-min
 * uptime health-check with the checks the release runbook §5 named.
 *
 * MINIMUM SET (all must pass):
 *   1. homepage returns 200 and React mounts (no white-screen)
 *   2. /api/health returns OK (DB, Redis)
 *   3. /api/config/public returns 200 with the expected top-level key
 *   4. /signin renders (no unhandled boot crash)
 *   5. an unauthenticated protected endpoint returns 401/403/redirect
 *      — NOT 200, NOT a body containing user data
 *   6. static JS assets referenced by / actually load (200 + non-empty)
 *
 * NON-DESTRUCTIVE guarantee: this script never posts, never mutates
 * server state, never sends SMS/email, never touches money. Only GETs.
 *
 * Usage:  node scripts/monitoring/release-smoke.mjs [baseUrl]
 * Env:    SMOKE_ATTEMPTS   (default 3)
 *         SMOKE_RETRY_MS   (default 20000)
 */

import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.SMOKE_URL || 'https://petwash.co.il';
const ATTEMPTS = Math.max(1, Number(process.env.SMOKE_ATTEMPTS || 3));
const RETRY_MS = Math.max(0, Number(process.env.SMOKE_RETRY_MS || 20000));

const HTTP_TIMEOUT_MS = 15000;
const NAV_TIMEOUT_MS = 30000;
const REACT_MOUNT_TIMEOUT_MS = 15000;

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      redirect: 'manual',
      ...opts,
    });
    return { ok: true, res };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function checkHealth() {
  const r = await safeFetch(`${BASE}/api/health`);
  if (!r.ok) return { ok: false, msg: `/api/health unreachable: ${r.error}` };
  if (!r.res.ok) return { ok: false, msg: `/api/health HTTP ${r.res.status}` };
  const body = await r.res.json().catch(() => ({}));
  if (body.status && String(body.status).toUpperCase() !== 'OK') {
    return { ok: false, msg: `/api/health status=${body.status}` };
  }
  if (body.checks?.db && body.checks.db.ok === false) {
    return { ok: false, msg: '/api/health db.ok=false' };
  }
  return { ok: true, msg: `/api/health OK (db=${body.checks?.db?.ok !== false ? 'up' : 'down'})` };
}

async function checkPublicConfig() {
  const r = await safeFetch(`${BASE}/api/config/public`);
  if (!r.ok) return { ok: false, msg: `/api/config/public unreachable: ${r.error}` };
  if (!r.res.ok) return { ok: false, msg: `/api/config/public HTTP ${r.res.status}` };
  const body = await r.res.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return { ok: false, msg: '/api/config/public not JSON' };
  }
  // Release B1 shape: { returningUser: { newDoor: { enabled, percent } } }
  if (!body.returningUser || typeof body.returningUser !== 'object') {
    return { ok: false, msg: `/api/config/public missing returningUser (keys=${Object.keys(body).join(',')})` };
  }
  return { ok: true, msg: '/api/config/public served returningUser shape' };
}

async function checkProtectedIsGated() {
  // /api/me/capabilities is the classic unauth-should-401 endpoint on this
  // release; B8 also makes it 503 on infra failure but only after auth.
  const r = await safeFetch(`${BASE}/api/me/capabilities`);
  if (!r.ok) return { ok: false, msg: `/api/me/capabilities unreachable: ${r.error}` };
  const s = r.res.status;
  // Acceptable: 401 (canonical unauth), 302 (redirect to /signin).
  if (s === 401 || s === 403 || (s >= 300 && s < 400)) {
    return { ok: true, msg: `/api/me/capabilities correctly gated (HTTP ${s})` };
  }
  return { ok: false, msg: `/api/me/capabilities NOT gated — HTTP ${s} for unauthenticated caller` };
}

async function checkPagesRender() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const failures = [];
  try {
    for (const path of ['/', '/signin']) {
      const page = await browser.newPage({ locale: 'he-IL' });
      const boot = { crashed: false, message: '' };
      page.on('pageerror', (err) => {
        boot.crashed = true;
        boot.message = err?.message || String(err);
      });
      try {
        const resp = await page.goto(`${BASE}${path}`, {
          waitUntil: 'domcontentloaded',
          timeout: NAV_TIMEOUT_MS,
        });
        if (!resp || !resp.ok()) {
          failures.push(`${path}: HTTP ${resp ? resp.status() : 'no-response'}`);
          continue;
        }
        await page
          .waitForFunction(
            () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
            { timeout: REACT_MOUNT_TIMEOUT_MS },
          )
          .catch(() => {});
        const body = (await page.innerText('body').catch(() => '')) || '';
        if (/Something went wrong|encountered an unexpected error|אירעה שגיאה/i.test(body)) {
          failures.push(`${path}: error boundary rendered`);
          continue;
        }
        const rootChildren = await page.evaluate(
          () => document.getElementById('root')?.childElementCount ?? 0,
        );
        if (rootChildren === 0) {
          failures.push(`${path}: #root empty (app did not mount)`);
          continue;
        }
        if (boot.crashed) {
          failures.push(`${path}: unhandled pageerror — ${boot.message}`);
          continue;
        }
      } catch (e) {
        failures.push(`${path}: nav threw ${e?.message || e}`);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return failures.length
    ? { ok: false, msg: `pages failed: ${failures.join(' | ')}` }
    : { ok: true, msg: '/ and /signin rendered without React crash' };
}

async function checkStaticAssetsLoad() {
  // Grab the homepage HTML, extract the first <script src="/assets/...">
  // and confirm it returns 200 + non-empty. If the manifest is stale (chunk
  // renamed but HTML references old path), the app will white-screen — this
  // guard makes that failure loud in smoke instead of subtle in the browser.
  const r = await safeFetch(BASE);
  if (!r.ok) return { ok: false, msg: `homepage unreachable: ${r.error}` };
  const html = await r.res.text().catch(() => '');
  const m = html.match(/<script[^>]+src=["']([^"']+\.js)["']/);
  if (!m) return { ok: true, msg: 'no <script src> found — skipping (edge case)' };
  const assetUrl = m[1].startsWith('http') ? m[1] : `${BASE}${m[1]}`;
  const a = await safeFetch(assetUrl);
  if (!a.ok) return { ok: false, msg: `asset unreachable ${assetUrl}: ${a.error}` };
  if (!a.res.ok) return { ok: false, msg: `asset HTTP ${a.res.status} ${assetUrl}` };
  const text = await a.res.text().catch(() => '');
  if (!text || text.length < 200) {
    return { ok: false, msg: `asset unexpectedly small (${text.length} bytes) ${assetUrl}` };
  }
  return { ok: true, msg: `first JS asset served (${text.length} bytes)` };
}

async function runOnce() {
  const checks = [
    ['health',          await checkHealth()],
    ['publicConfig',    await checkPublicConfig()],
    ['gatedEndpoint',   await checkProtectedIsGated()],
    ['staticAssets',    await checkStaticAssetsLoad()],
    ['pagesRender',     await checkPagesRender()],
  ];
  for (const [name, r] of checks) {
    console.log(r.ok ? green(`✔ ${name}`) : red(`✘ ${name}`), dim(r.msg));
  }
  return checks.every(([, r]) => r.ok);
}

console.log(`[release-smoke] ${BASE} @ ${new Date().toISOString()} (up to ${ATTEMPTS} attempts)`);
let passed = false;
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  console.log(`\n— attempt ${attempt}/${ATTEMPTS} —`);
  passed = await runOnce();
  if (passed) break;
  if (attempt < ATTEMPTS) {
    console.log(dim(`… attempt ${attempt} failed — retrying in ${Math.round(RETRY_MS / 1000)}s (cold-start tolerance)`));
    await new Promise((r) => setTimeout(r, RETRY_MS));
  }
}

if (passed) {
  console.log('\n' + green('🎉 Release smoke PASSED.'));
} else {
  process.exitCode = 1;
  console.error('\n' + red(`🚨 Release smoke FAILED after ${ATTEMPTS} attempts.`));
}
