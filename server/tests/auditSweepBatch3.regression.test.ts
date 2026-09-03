/**
 * Regression pin — audit sweep batch 3 (2026-09-01).
 *
 * Findings the cross-branch inventory agent confirmed are on THIS
 * branch too (byte-identical with main + doctrine). Batch scope:
 *
 *   #228 AUDIT-MONEY-3 HIGH — financial-document ref ids: no Math.random()
 *   #232 AUDIT-MONEY-8 MED  — maya-voice-webhook: raw body captured
 *                              BEFORE parse for HMAC correctness
 *   #241 AUDIT-AUTH-8  MED  — walkers/search: rate-limited + radius
 *                              cap + lat/lon rounded
 *   #223 AUDIT-SMS-6+10     — turnstile guard: fails CLOSED in prod
 *
 * Deferred (needs separate lane):
 *   #223 rate-limiter in-memory store  — swap to Redis; touches every
 *                                        limiter file; own lane.
 *   #216 AUDIT-LOG-13 productionHardeningAndOneTap Firebase custom
 *                                        token in HTML — needs a redesign
 *                                        of the one-tap handoff (out of
 *                                        scope for a local edit).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const finDoc = readFileSync(join(ROOT, 'server/services/FinancialDocumentService.ts'), 'utf8');
const mayaVoice = readFileSync(join(ROOT, 'server/routes/maya-voice-webhook.ts'), 'utf8');
const walkMyPet = readFileSync(join(ROOT, 'server/routes/walk-my-pet.ts'), 'utf8');
const turnstile = readFileSync(join(ROOT, 'server/lib/turnstileGuard.ts'), 'utf8');

// ─────────────────────────────────────────────────────────────────
// #228 AUDIT-MONEY-3
// ─────────────────────────────────────────────────────────────────
describe('#228 FinancialDocumentService: no Math.random for reference ids', () => {
  it('generateDocumentReference uses crypto.randomBytes, not Math.random', () => {
    const fn = finDoc.match(/function generateDocumentReference[\s\S]*?\n\}/);
    expect(fn, 'generateDocumentReference must exist').toBeTruthy();
    // Filter comment lines so removal-documentation doesn't false-positive.
    const codeOnly = fn![0].split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    expect(/Math\.random\(/.test(codeOnly)).toBe(false);
    expect(codeOnly).toMatch(/randomBytes\(/);
  });

  it('the module imports randomBytes from crypto', () => {
    expect(finDoc).toMatch(/import\s*\{[^}]*\brandomBytes\b[^}]*\}\s*from\s*['"]crypto['"]/);
  });
});

// ─────────────────────────────────────────────────────────────────
// #232 AUDIT-MONEY-8
// ─────────────────────────────────────────────────────────────────
describe('#232 maya-voice-webhook: raw body captured pre-parse for HMAC', () => {
  it('router uses express.raw BEFORE the JSON parse', () => {
    expect(mayaVoice).toMatch(/import\s*\{[^}]*\braw as expressRaw\b[^}]*\}\s*from\s*['"]express['"]/);
    expect(mayaVoice).toMatch(/router\.use\(\s*['"]\/webhook['"]\s*,\s*expressRaw\(/);
  });

  it('handler NEVER derives rawBody from JSON.stringify of a parsed body', () => {
    // Strip comments (removal doc mentions the old pattern).
    const codeOnly = mayaVoice
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    expect(/req\.rawBody\s*=\s*JSON\.stringify\(/.test(codeOnly)).toBe(false);
    expect(/rawBody\s*=\s*JSON\.stringify\(req\.body/.test(codeOnly)).toBe(false);
  });

  it('signature verification uses req.rawBody (untouched provider bytes)', () => {
    expect(mayaVoice).toMatch(/provider\.verifySignature\(\s*req\s*,\s*req\.rawBody\s*(?:\?\?\s*['"]['"])?\s*\)/);
  });
});

// ─────────────────────────────────────────────────────────────────
// #241 AUDIT-AUTH-8
// ─────────────────────────────────────────────────────────────────
describe('#241 walkers/search: rate-limited + capped + rounded', () => {
  it('GET /walkers/search sits behind apiLimiter', () => {
    expect(walkMyPet).toMatch(
      /router\.get\(\s*['"]\/walkers\/search['"]\s*,\s*apiLimiter\s*,/,
    );
  });

  it('POST /walkers/search sits behind apiLimiter', () => {
    expect(walkMyPet).toMatch(
      /router\.post\(\s*['"]\/walkers\/search['"]\s*,\s*apiLimiter\s*,/,
    );
  });

  it('POST /walkers/search caps radius and rounds coordinates', () => {
    // Capture the whole handler body up to the closing router.post });
    // The bounding-box query with qLat/qLon is a few lines after the
    // `let query = db` line, so we need a wider window.
    const postHandler = walkMyPet.match(
      /router\.post\(\s*['"]\/walkers\/search['"][\s\S]*?const walkers = await query;/,
    );
    expect(postHandler, 'POST /walkers/search handler must exist').toBeTruthy();
    // Radius cap.
    expect(postHandler![0]).toMatch(/Math\.min\(\s*25/);
    // Coordinate rounding — 3 decimal places (~110m).
    expect(postHandler![0]).toMatch(/round3/);
    expect(postHandler![0]).toMatch(/const qLat\s*=\s*round3\(latitude\)/);
    expect(postHandler![0]).toMatch(/const qLon\s*=\s*round3\(longitude\)/);
    // DB query uses the ROUNDED values.
    expect(postHandler![0]).toMatch(/qLat\s*-\s*latDelta/);
    expect(postHandler![0]).toMatch(/qLon\s*-\s*lonDelta/);
  });
});

// ─────────────────────────────────────────────────────────────────
// #223 AUDIT-SMS-6 — Turnstile fail-CLOSED in prod
// ─────────────────────────────────────────────────────────────────
describe('#223 turnstileGuard: fails CLOSED in production', () => {
  it('missing secret → 503 in production', () => {
    // Structural: the not-configured branch must contain both a
    // NODE_ENV production check AND a 503 response.
    const branch = turnstile.match(/if \(!isTurnstileConfigured\(\)\)\s*\{[\s\S]*?return next\(\);\s*\}/);
    expect(branch, 'not-configured branch must exist').toBeTruthy();
    expect(branch![0]).toMatch(/process\.env\.NODE_ENV\s*===\s*['"]production['"]/);
    expect(branch![0]).toMatch(/status\(503\)/);
    expect(branch![0]).toMatch(/TURNSTILE_NOT_CONFIGURED/);
    // Non-prod still logs + skips (dev / preview shouldn't need the secret).
    expect(branch![0]).toMatch(/return next\(\);/);
  });
});
