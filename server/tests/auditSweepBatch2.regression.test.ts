/**
 * Regression pin — audit sweep batch 2 (2026-09-01).
 *
 * Bundles the five audit-item invariants shipped in the same commit.
 * One file, one owner. Each `describe` block gates one finding.
 *
 * Findings covered here:
 *   #211 AUDIT-LOG-3   — sumit-webhook: no raw body in audit chain
 *   #215 AUDIT-LOG-7   — provider-onboarding: no error.detail in logs
 *   #237 AUDIT-AUTH-4  — escrow release: proper auth + ownership check
 *   #238 AUDIT-AUTH-5  — marketplace-bookings/quote: no anonymous DB write
 *   #204 AUDIT-AI-9    — daycare-calculator: rate-limited + maxOutputTokens
 *   #205 AUDIT-AI-10   — loyalty ai-rewards-message: zod-validated + prompt-safe
 *   #214 AUDIT-LOG-6   — 5xx error.message echoes: helper + progressive ceiling
 *
 * Not covered here — separate files:
 *   #240 AUDIT-AUTH-7  — prestige-pass admin gate (see
 *                        prestigePassAdminGate.regression.test.ts)
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const sumit = readFileSync(join(ROOT, 'server/routes/sumit-webhook.ts'), 'utf8');
const providerOnb = readFileSync(join(ROOT, 'server/routes/provider-onboarding.ts'), 'utf8');
const escrow = readFileSync(join(ROOT, 'server/routes/escrow.ts'), 'utf8');
const marketBk = readFileSync(join(ROOT, 'server/routes/marketplace-bookings.ts'), 'utf8');
const daycare = readFileSync(join(ROOT, 'server/routes/daycare-calculator.ts'), 'utf8');
const loyalty = readFileSync(join(ROOT, 'server/routes/loyalty.ts'), 'utf8');
const sanitizer = readFileSync(join(ROOT, 'server/lib/sanitizeErrorResponse.ts'), 'utf8');

function grepRepo(pattern: string): string[] {
  try {
    const out = execSync(
      `rg --no-heading -n -U --multiline -g '*.ts' -g '!server/tests/**' -g '!**/node_modules/**' ${JSON.stringify(pattern)} ${ROOT}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return out.split('\n').filter(Boolean);
  } catch (err: any) {
    if (err?.status === 1) return [];
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
// #211 AUDIT-LOG-3
// ─────────────────────────────────────────────────────────────────
describe('#211 sumit-webhook: no raw body in audit chain', () => {
  it('the audit-chain record for a sumit event carries no bodyPreview / raw body slice', () => {
    // The audit call in this file MUST NOT include a `bodyPreview:` KEY
    // and MUST NOT slice `rawString` into a metadata VALUE. Strip
    // comments before checking so the removal-doc comment itself
    // doesn't false-positive.
    const auditCall = sumit.match(/recordAuditEvent\(\{[\s\S]*?\}\);/);
    expect(auditCall, 'recordAuditEvent call must exist').toBeTruthy();
    const codeOnly = auditCall![0]
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    // Check for the KEY (left of colon), not the word.
    expect(/\bbodyPreview\s*:/.test(codeOnly)).toBe(false);
    expect(/\brawString\b/.test(codeOnly)).toBe(false);
    // Only safe correlation fields are present (bodyBytes is a size).
    expect(codeOnly).toMatch(/bodyBytes/);
  });

  it('no other path in sumit-webhook.ts sends raw body preview into logs', () => {
    // A general check — the file MUST NOT have any `slice(0, 2000)` on
    // rawString (the exact pattern that was removed).
    expect(/rawString\.slice\(\s*0\s*,\s*2000\s*\)/.test(sumit)).toBe(false);
    // Nor should the whole raw string appear in a logger.info body log.
    expect(/logger\.\w+\([^)]*rawString/.test(sumit)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// #215 AUDIT-LOG-7
// ─────────────────────────────────────────────────────────────────
describe('#215 provider-onboarding: no error.detail / raw PII in logs', () => {
  it('the 5xx application-submission logger DOES NOT include error.detail', () => {
    const errBlock = providerOnb.match(
      /logger\.error\(\s*['"]\[Provider Onboarding\] Application submission error['"][\s\S]*?\}\s*\);/,
    );
    expect(errBlock, 'application-submission logger must exist').toBeTruthy();
    expect(/\bdetail:\s*error\.detail\b/.test(errBlock![0])).toBe(false);
    // error.message stays but is now length-clamped.
    expect(errBlock![0]).toMatch(/error\.message\.slice\(\s*0\s*,\s*200\s*\)/);
  });
});

// ─────────────────────────────────────────────────────────────────
// #237 AUDIT-AUTH-4
// ─────────────────────────────────────────────────────────────────
describe('#237 escrow release: requireAuth + ownership check', () => {
  it('the release handler sits behind requireAuth', () => {
    expect(escrow).toMatch(
      /router\.post\(\s*['"]\/:escrowId\/release['"]\s*,\s*requireAuth\s*,/,
    );
  });

  it('the release handler enforces customerId ownership', () => {
    // The handler body must compare escrow.customerId to callerId and
    // 403 on mismatch — this is the "not a shared header secret" part.
    const handler = escrow.match(
      /router\.post\(\s*['"]\/:escrowId\/release['"][\s\S]*?\}\s*\);/,
    );
    expect(handler, 'release handler must exist').toBeTruthy();
    expect(handler![0]).toMatch(/escrow\.customerId\s*!==\s*callerId/);
    expect(handler![0]).toMatch(/res\.status\(403\)/);
  });

  it('the release path does NOT accept an X-Escrow-Secret header for auth', () => {
    // Guard against a future regression where someone reintroduces a
    // shared-secret shortcut. The header name space is fixed.
    expect(/X-Escrow-Secret/i.test(escrow)).toBe(false);
    expect(/ESCROW_RELEASE_SECRET/i.test(escrow)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// #238 AUDIT-AUTH-5
// ─────────────────────────────────────────────────────────────────
describe('#238 marketplace-bookings/quote: no anonymous DB write', () => {
  it('the /quote handler no longer inserts customerId="anonymous"', () => {
    // Search the /quote handler body for the old anonymous-write pattern.
    const handler = marketBk.match(
      /router\.post\(\s*['"]\/quote['"][\s\S]*?\n\}\);/,
    );
    expect(handler, '/quote handler must exist').toBeTruthy();
    expect(/customerId:\s*userId\s*\|\|\s*['"]anonymous['"]/.test(handler![0])).toBe(false);
    expect(/customerId:\s*['"]anonymous['"]/.test(handler![0])).toBe(false);
  });

  it('the /quote handler gates the DB insert behind an authed uid', () => {
    const handler = marketBk.match(
      /router\.post\(\s*['"]\/quote['"][\s\S]*?\n\}\);/,
    );
    expect(handler).toBeTruthy();
    // Must have an `if (authedUid)` (or equivalent) branch around the
    // db.insert(quoteRequests) call.
    const insertIdx = handler![0].indexOf('db.insert(quoteRequests)');
    expect(insertIdx).toBeGreaterThan(-1);
    // Look backwards from the insert for an if-guard on authedUid.
    const before = handler![0].slice(0, insertIdx);
    expect(/if\s*\(\s*authedUid\s*\)/.test(before)).toBe(true);
  });

  it('client-declared customerId in the body is IGNORED (server-derived uid only)', () => {
    // The old handler took `customerId` from req.body directly. Now
    // only the derived session uid counts. A body customerId is
    // silently ignored — the ceiling is: no other line in this file
    // sets a DB customerId to a body value.
    const handler = marketBk.match(
      /router\.post\(\s*['"]\/quote['"][\s\S]*?\n\}\);/,
    );
    expect(handler).toBeTruthy();
    expect(/customerId:\s*customerId\b/.test(handler![0])).toBe(false);
    expect(/customerId:\s*req\.body\.customerId/.test(handler![0])).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// #204 AUDIT-AI-9
// ─────────────────────────────────────────────────────────────────
describe('#204 daycare-calculator: rate-limited + capped Gemini', () => {
  it('/calculate has aiChatLimiter middleware', () => {
    expect(daycare).toMatch(
      /router\.post\(\s*['"]\/calculate['"]\s*,\s*aiChatLimiter\s*,/,
    );
  });

  it('the Gemini call has maxOutputTokens set', () => {
    // The generateContent call MUST include a config.maxOutputTokens.
    const genCall = daycare.match(/genAI\.models\.generateContent\(\s*\{[\s\S]*?\}\s*\);/);
    expect(genCall, 'generateContent call must exist').toBeTruthy();
    expect(genCall![0]).toMatch(/maxOutputTokens:\s*\d+/);
  });
});

// ─────────────────────────────────────────────────────────────────
// #205 AUDIT-AI-10
// ─────────────────────────────────────────────────────────────────
describe('#205 loyalty ai-rewards-message: prompt-safe', () => {
  it('/ai-rewards-message has aiChatLimiter middleware', () => {
    expect(loyalty).toMatch(
      /router\.post\(\s*['"]\/ai-rewards-message['"]\s*,\s*aiChatLimiter\s*,/,
    );
  });

  it('body is zod-validated (tier enum + integer bounds)', () => {
    expect(loyalty).toMatch(/aiRewardsMessageBody\s*=\s*z\.object\(/);
    expect(loyalty).toMatch(
      /tier:\s*z\.enum\(\[[\s\S]*?['"]bronze['"][\s\S]*?\]\)/,
    );
    expect(loyalty).toMatch(/points:\s*z\.number\(\)\.int\(\)/);
  });

  it('the tier label in the prompt comes from a fixed map, not raw body', () => {
    // TIER_LABELS map derives the string that reaches Gemini —
    // prevents prompt injection even if validation is bypassed.
    expect(loyalty).toMatch(/const TIER_LABELS[\s\S]*?bronze:\s*['"]BRONZE['"]/);
    expect(loyalty).toMatch(/tierLabel\s*=\s*TIER_LABELS\[tier\]/);
    // The prompt uses ${tierLabel}, not ${tier.toUpperCase()}.
    const promptLine = loyalty
      .split('\n')
      .find((l) => l.includes('PetWash™ loyalty program AI concierge'));
    expect(promptLine, 'AI concierge prompt line must exist').toBeTruthy();
    expect(promptLine!.includes('${tierLabel}')).toBe(true);
    expect(promptLine!.includes('${tier.toUpperCase()}')).toBe(false);
  });

  it('the Gemini call has maxOutputTokens set', () => {
    const genCall = loyalty.match(
      /generateContent\(\s*\{[\s\S]*?parts: \[\{\s*text:[\s\S]*?PetWash™ loyalty[\s\S]*?\}\s*\);/,
    );
    expect(genCall, 'loyalty generateContent must exist').toBeTruthy();
    expect(genCall![0]).toMatch(/maxOutputTokens:\s*\d+/);
  });
});

// ─────────────────────────────────────────────────────────────────
// #214 AUDIT-LOG-6 — helper + progressive ceiling
// ─────────────────────────────────────────────────────────────────
describe('#214 5xx error.message echoes — helper + progressive ceiling', () => {
  it('sanitizeErrorResponse helper exists and returns a generic response', () => {
    expect(sanitizer).toMatch(/export function sanitizeErrorResponse/);
    expect(sanitizer).toMatch(/GENERIC_MESSAGE\s*=\s*['"][^'"]+['"]/);
    // The response body must NEVER include the raw error message.
    const bodyBlock = sanitizer.match(/body:\s*\{[\s\S]*?\}/);
    expect(bodyBlock, 'body block must exist').toBeTruthy();
    expect(bodyBlock![0].includes('err.message')).toBe(false);
    expect(bodyBlock![0].includes('(err as any).message')).toBe(false);
  });

  it('sendSanitizedError sends a fixed body + logs structured meta', () => {
    expect(sanitizer).toMatch(/export function sendSanitizedError/);
    // Log meta may reference errMessage internally (that's what the
    // logger sanitises), but the RESPONSE goes via sanitizeErrorResponse.
    expect(sanitizer).toMatch(/res\.status\(safe\.status\)\.json\(safe\.body\)/);
  });

  it('progressive ceiling: raw error.message in a 5xx json body must not GROW', () => {
    // Ceiling at today's occurrence count. Migrate a call to
    // sendSanitizedError → count drops. Add a new raw echo → this
    // test fails until the new site is migrated.
    // Pattern: res.status(5NN).json(...error.message)
    const hits = grepRepo(
      String.raw`res\.status\(5\d\d\)\.json\([\s\S]{0,80}?error\.message`,
    );
    // Exclude the sanitizer itself (it doesn't do this) and the
    // secureInboxIdentity regression test file (which asserts on this
    // shape). Everything else is a live migration target.
    const filtered = hits.filter(
      (l) =>
        !l.includes('server/lib/sanitizeErrorResponse.ts') &&
        !l.includes('server/tests/'),
    );
    // Ceiling calibrated to today's rg --multiline count.
    // The earlier estimate of 241 was per-line; the actual multiline
    // pattern matches more spanning blocks. Decrement as endpoints
    // migrate to sendSanitizedError().
    //
    // 2026-09-01 migration wave 1: accounting-export.ts (6 sites),
    // google-forms.ts (2), disputes.ts (1) → ceiling 385 → 377.
    // 2026-09-01 migration wave 2: gemini-watchdog.ts (14 sites)
    //   → ceiling 377 → 363.
    // 2026-09-01 migration wave 3: providers.ts (9 sites)
    //   → ceiling 363 → 354.
    // 2026-09-01 migration wave 4: marketplace-bookings.ts (11 sites) +
    //   finance/transaction-audit.ts (9 sites) → ceiling 354 → 334.
    // 2026-09-01 migration wave 5: gps-tracking.ts (8 sites) +
    //   contractor.ts (7 sites) + vat.ts (5 sites) → ceiling 334 → 314.
    const CEILING = 314;
    expect(filtered.length).toBeLessThanOrEqual(CEILING);
  });
});
