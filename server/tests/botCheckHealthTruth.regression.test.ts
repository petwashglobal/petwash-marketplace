/**
 * /api/health/bot-check must not describe an outage as an advisory.
 *
 * FOUND LIVE 2026-09-06. Production had no TURNSTILE_SECRET_KEY, so
 * turnstileGuard — which fails CLOSED in production since AUDIT-SMS-6
 * (2026-09-01) — was returning 503 TURNSTILE_NOT_CONFIGURED from
 * POST /api/auth/email/start and POST /api/auth/sms/start. No customer could
 * receive a signup or passwordless-login code.
 *
 * The health endpoint reported:
 *
 *   { "status": "ADVISORY", "enforcementActive": false,
 *     "note": "TURNSTILE_SECRET_KEY not set — protected surfaces log a WARN
 *              and skip the check." }
 *
 * Every word of that note described the behaviour the guard had BEFORE the
 * fail-closed change. The one place an operator looks was telling them the
 * surfaces were merely unprotected — that is, working — while they were down.
 *
 * A monitoring endpoint that is stale about the thing it monitors is worse
 * than no endpoint, because it is trusted. These pins tie its wording to the
 * guard's actual behaviour.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const INDEX = readFileSync(join(ROOT, 'server/index.ts'), 'utf8');
const GUARD = readFileSync(join(ROOT, 'server/lib/turnstileGuard.ts'), 'utf8');

function handler(): string {
  const start = INDEX.indexOf("app.get('/api/health/bot-check'");
  expect(start, 'bot-check handler not found').toBeGreaterThan(-1);
  const end = INDEX.indexOf("app.get('/api/health/strict'", start);
  return INDEX.slice(start, end === -1 ? start + 4000 : end);
}

describe('the guard really does fail closed — the premise of these pins', () => {
  it('returns 503 TURNSTILE_NOT_CONFIGURED in production when the secret is missing', () => {
    expect(GUARD).toContain('TURNSTILE_NOT_CONFIGURED');
    expect(GUARD).toMatch(/process\.env\.NODE_ENV === 'production'/);
    expect(GUARD).toContain('res.status(503)');
  });

  it('and only skips outside production', () => {
    expect(GUARD).toMatch(/check skipped \(non-prod\)/);
  });
});

describe('the health endpoint reports what the guard actually does', () => {
  const h = handler();

  it('distinguishes production from non-production at all', () => {
    // The stale version had no idea which environment it was describing, which
    // is precisely how it came to describe the wrong one.
    expect(h).toMatch(/NODE_ENV === 'production'/);
  });

  it('reports an OUTAGE when production has no secret', () => {
    expect(h).toContain("'OUTAGE'");
    expect(h).toMatch(/surfacesDown = isProduction && !turnstileServerConfigured/);
  });

  it('never calls that state merely ADVISORY', () => {
    // ADVISORY must remain reachable for non-production, but not for the
    // production-without-a-secret case.
    const outageBranch = h.slice(h.indexOf('const status ='), h.indexOf('res.status(200)'));
    expect(outageBranch).toMatch(/surfacesDown \? 'OUTAGE'/);
  });

  it('exposes a boolean an alert can page on', () => {
    expect(h).toContain('protectedSurfacesRejectingAllTraffic');
  });

  it('the outage note says customers are affected, and names the surfaces', () => {
    expect(h).toContain('no customer can receive a signup or passwordless-login code');
    expect(h).toContain('/api/auth/email/start');
    expect(h).toContain('/api/auth/sms/start');
  });

  it('NEVER claims the surfaces skip the check when they are failing closed', () => {
    // The exact stale sentence, which was true before 2026-09-01 and false after.
    expect(h).not.toContain('protected surfaces log a WARN and skip the check');
  });

  it('the non-production note warns what the same config would do in production', () => {
    expect(h).toContain('would take the protected surfaces DOWN');
  });

  it('still never exposes key material', () => {
    expect(h).not.toMatch(/TURNSTILE_SECRET_KEY\s*[,}\]]/);
    expect(h).toMatch(/!!process\.env\.TURNSTILE_SECRET_KEY/);
  });
});

describe('Turnstile needs BOTH halves — the guard documents it and the release enforces it', () => {
  const GUARD_SRC = readFileSync(join(ROOT, 'server/lib/turnstileGuard.ts'), 'utf8');
  const INVARIANT = readFileSync(join(ROOT, 'scripts/guards/turnstile-release-invariant.mjs'), 'utf8');
  /**
   * Executable text only. The script's own comment EXPLAINS why the hostname
   * check was removed, and therefore quotes it — the same trap that made the
   * profile-bypass pin fail against its own fix. A pin that prose can break is
   * not testing the code.
   */
  const INVARIANT_CODE = INVARIANT
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const CI = readFileSync(join(ROOT, '.github/workflows/petwash-ci.yml'), 'utf8');

  it('the guard says so, because setting only the secret does not restore service', () => {
    // With the secret but no site key the browser cannot mint a token, so the
    // failure moves 503 -> 400 TURNSTILE_TOKEN_REQUIRED and signup stays dead.
    expect(GUARD_SRC).toContain('TURNSTILE HAS TWO HALVES');
    expect(GUARD_SRC).toContain('VITE_TURNSTILE_SITE_KEY');
    expect(GUARD_SRC).toContain('the client must be REBUILT');
  });

  it('the invariant checks the BUILT BUNDLE, not just an env var', () => {
    // A VITE_* value is inlined at build time. Reading process.env at deploy
    // time would pass while shipping a bundle that has no key in it.
    expect(INVARIANT).toContain('SITE_KEY_MISSING');
    expect(INVARIANT).toContain('SITE_KEY_SHAPE');
    expect(INVARIANT).toMatch(/dead-code-eliminated/);
  });

  it('detects the key directly, not by sniffing a hostname substring', () => {
    // The first version inferred presence from challenges.cloudflare.com
    // appearing in the bundle. CodeQL flagged it as incomplete URL substring
    // sanitisation and was right about the shape, even though nothing was
    // being sanitised. Presence of the public site-key literal is both more
    // direct and exactly how the outage was diagnosed.
    expect(INVARIANT_CODE).not.toContain('challenges.cloudflare.com');
    expect(INVARIANT_CODE).toContain('const SITE_KEY_SHAPE = ');
    expect(INVARIANT_CODE).toContain('0x4');
  });

  it('it checks the server half too', () => {
    expect(INVARIANT).toContain('TURNSTILE_SECRET_KEY');
  });

  it('it fails the release rather than warning', () => {
    expect(INVARIANT).toContain('Release BLOCKED');
    expect(INVARIANT).toMatch(/process\.exit\(1\)/);
  });

  it('it defaults to STRICT — a guard that silently opts out is the bug it prevents', () => {
    expect(INVARIANT).toMatch(/GITHUB_REF === 'refs\/heads\/main'/);
  });

  it('it never reads or prints key material', () => {
    expect(INVARIANT).toContain('value not read');
    // Presence checks only — no comparison against, or echo of, a key.
    expect(INVARIANT).not.toMatch(/console\.log\([^)]*process\.env\.TURNSTILE_SECRET_KEY/);
  });

  it('the deploy runs it AFTER the client build', () => {
    expect(CI).toContain('turnstile-release-invariant.mjs');
    const buildAt = CI.indexOf('run: npm run build');
    const gateAt = CI.indexOf('turnstile-release-invariant.mjs');
    expect(buildAt).toBeGreaterThan(-1);
    expect(gateAt).toBeGreaterThan(buildAt);
  });
});
