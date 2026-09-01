/**
 * Regression pin — audit sweep batch 4 (2026-09-01).
 *
 * Landed on returning-user-auth-architecture:
 *   #233 AUDIT-MONEY-11 LOW    — super-app-bookings cancel: read
 *                                 totalCents (post-migration) with a
 *                                 legacy `total` fallback, not
 *                                 `total ?? 0` alone which yielded a
 *                                 0-cent refund on migrated rows.
 *   #231 AUDIT-MONEY-7          — treasury batchRef: crypto.randomBytes,
 *                                 not Math.random.
 *   #231 AUDIT-MONEY-9          — referral codes: crypto.randomInt, not
 *                                 Math.random.
 *   #231 AUDIT-MONEY-10         — prestige-pass pass id: crypto.randomBytes,
 *                                 not two Math.floor(1000+Math.random()*9000)
 *                                 draws (previously ~1e7 space).
 *   #239 AUDIT-AUTH-9  MED-LOW  — walk-payment-flow dev webhook: reject
 *                                 missing body userId instead of substituting
 *                                 the sentinel 'payment-webhook' — the
 *                                 impersonation shape the audit called out.
 *   #241 walkers/search refinement — distanceKm rounded to ~100m in the
 *                                    response (query already ~110m).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const superApp = readFileSync(join(ROOT, 'server/routes/super-app-bookings.ts'), 'utf8');
const treasury = readFileSync(join(ROOT, 'server/routes/treasury.ts'), 'utf8');
const prestige = readFileSync(join(ROOT, 'server/routes/prestige-pass.ts'), 'utf8');
const refStore = readFileSync(join(ROOT, 'server/services/ReferralStore.ts'), 'utf8');
const walkPay = readFileSync(join(ROOT, 'server/routes/walk-payment-flow.ts'), 'utf8');
const walkPet = readFileSync(join(ROOT, 'server/routes/walk-my-pet.ts'), 'utf8');

function stripComments(src: string): string {
  return src.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
}

// ─────────────────────────────────────────────────────────────────
// #233 super-app-bookings — totalCents-aware cancel refund
// ─────────────────────────────────────────────────────────────────
describe('#233 super-app-bookings cancel reads totalCents', () => {
  it('chargeCents branches on totalCents before falling back to legacy total', () => {
    // Anchor to the cancel handler by locating the customerCancellationRefundCents import.
    const idx = superApp.indexOf('customerCancellationRefundCents');
    expect(idx).toBeGreaterThan(0);
    const window = superApp.slice(idx, idx + 800);
    expect(window).toMatch(/totalCents\s*!=\s*null/);
    expect(window).toMatch(/Number\(\s*\(existingBooking as any\)\.totalCents\s*\)/);
  });

  it('does NOT compute chargeCents from `existingBooking.total` alone (legacy-only path banned)', () => {
    const idx = superApp.indexOf('customerCancellationRefundCents');
    const window = stripComments(superApp.slice(idx, idx + 800));
    // The bare `const chargeCents = Math.round(Number(existingBooking.total ?? 0) * 100);`
    // form is the audited defect. It must never appear as the sole
    // definition — a ternary/fallback that reads totalCents first is
    // required.
    const badLine = /const\s+chargeCents\s*=\s*Math\.round\(\s*Number\(\s*existingBooking\.total\s*\?\?\s*0\s*\)\s*\*\s*100\s*\)\s*;/;
    expect(badLine.test(window)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// #231 crypto for identifiers
// ─────────────────────────────────────────────────────────────────
describe('#231 identifiers use CSPRNG', () => {
  it('treasury batchRef uses randomBytes, not Math.random', () => {
    expect(treasury).toMatch(/import\s*\{\s*randomBytes\s*\}\s*from\s*['"]node:crypto['"]/);
    // Locate the assignment.
    const m = treasury.match(/const\s+batchRef\s*=\s*[^;]+;/);
    expect(m, 'batchRef must exist').toBeTruthy();
    expect(m![0]).toMatch(/randomBytes\(/);
    expect(m![0]).not.toMatch(/Math\.random/);
  });

  it('prestige-pass passId uses randomBytes, not Math.random', () => {
    // The block starts with `const passId = ` (allocated in the retry loop).
    const m = prestige.match(/const\s+passIdRaw\s*=\s*[^;]+;[\s\S]{0,200}const\s+passId\s*=\s*[^;]+;/);
    expect(m, 'passIdRaw + passId lines must exist').toBeTruthy();
    expect(m![0]).toMatch(/randomBytes\(/);
    expect(m![0]).not.toMatch(/Math\.random/);
  });

  it('ReferralStore randomCode uses crypto.randomInt, not Math.random', () => {
    expect(refStore).toMatch(/import\s*\{\s*randomInt\s*\}\s*from\s*['"]node:crypto['"]/);
    const m = refStore.match(/function\s+randomCode\([^)]*\)[\s\S]*?\n\}/);
    expect(m, 'randomCode must exist').toBeTruthy();
    expect(m![0]).toMatch(/randomInt\(/);
    expect(m![0]).not.toMatch(/Math\.random/);
  });
});

// ─────────────────────────────────────────────────────────────────
// #239 walk-payment-flow dev webhook — no body-userId substitution
// ─────────────────────────────────────────────────────────────────
describe('#239 walk-payment-flow webhook rejects missing owner', () => {
  it('never falls back to the sentinel string "payment-webhook" for ownerId', () => {
    const code = stripComments(walkPay);
    // The audited defect: `ownerId: req.body.userId || 'payment-webhook'`.
    expect(code).not.toMatch(/ownerId\s*:\s*req\.body\.userId\s*\|\|\s*['"]payment-webhook['"]/);
  });

  it('validates the claimed owner is a non-empty string before dispatching', () => {
    expect(walkPay).toMatch(/claimedOwner\s*=\s*typeof\s+req\.body\.userId\s*===\s*['"]string['"]/);
    expect(walkPay).toMatch(/INVALID_OWNER/);
  });
});

// ─────────────────────────────────────────────────────────────────
// #241 walkers/search — response distance quantization
// ─────────────────────────────────────────────────────────────────
describe('#241 walkers/search response distanceKm quantized', () => {
  it('POST /walkers/search rounds distanceKm to 1 decimal', () => {
    // The handler runs distance→distanceKm right after calculateDistance.
    const post = walkPet.match(
      /router\.post\(\s*['"]\/walkers\/search['"][\s\S]*?res\.json\(\s*\{/,
    );
    expect(post, 'POST /walkers/search handler must exist').toBeTruthy();
    expect(post![0]).toMatch(/const\s+distanceKm\s*=\s*Math\.round\(\s*distance\s*\*\s*10\s*\)\s*\/\s*10/);
  });
});
