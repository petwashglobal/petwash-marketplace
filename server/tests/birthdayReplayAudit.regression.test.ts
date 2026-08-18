/**
 * Task 28 — CEO fire order 101-140.
 *
 * BIRTHDAY BENEFIT REPLAY audit.
 *
 * Endpoint: POST /api/promo/birthday/claim (also /seasonal/claim same
 * pattern). The claim doc key is `${uid}_${currentYear}` — one doc
 * per user per year — so the natural business-uniqueness handle is
 * the (uid, year) pair.
 *
 * Finding: SEQUENTIAL replay is properly guarded. The handler:
 *   1. GETs the birthday_promos doc by (uid, year).
 *   2. Checks `data.claimed === true` → 409 already_claimed.
 *   3. Otherwise UPDATEs `claimed: true, claimedAt, claimedIp,
 *      claimedUserAgentHash`.
 *
 * A second-in-time request sees `claimed: true` and 409s. The
 * discount is not re-applied.
 *
 * Race-window flag (documented, NOT modified):
 *   The GET-then-UPDATE is NOT wrapped in `firestoreDb.runTransaction()`.
 *   Two truly-simultaneous claims could both read claimed=false and
 *   both UPDATE. Firestore document writes are atomic, so the last
 *   write wins — but both responses would say ok:true and the client
 *   could reasonably try to apply the discount twice. Discount
 *   accounting itself is separate — a follow-up PR could add a
 *   transaction wrapper. Marketing-adjacent — flag for CEO decision.
 *
 * NO code change in this PR.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(
  resolve(__dirname, '..', 'routes', 'birthday-promo.ts'),
  'utf8',
);

describe('POST /api/promo/birthday/claim — replay guard', () => {
  const claimIdx = SRC.indexOf("router.post('/birthday/claim'");
  const region = SRC.slice(claimIdx, claimIdx + 5000);

  it('handler registered', () => expect(claimIdx).toBeGreaterThan(-1));

  it('doc key scopes claim to one doc per (uid, year)', () => {
    expect(region).toMatch(/const docKey = `\$\{uid\}_\$\{currentYear\}`/);
  });

  it('reads the birthday_promos doc BEFORE writing', () => {
    expect(region).toMatch(/firestoreDb\.collection\('birthday_promos'\)\.doc\(docKey\)/);
    expect(region).toMatch(/const promoDoc = await promoRef\.get\(\)/);
  });

  it('replay after successful claim returns 409 already_claimed', () => {
    expect(region).toMatch(/if \(data\.claimed\)/);
    expect(region).toMatch(/'already_claimed'/);
    expect(region).toMatch(/res\.status\(409\)/);
  });

  it('expired benefit returns 410 (natural per-year TTL)', () => {
    expect(region).toMatch(/if \(now > new Date\(data\.expiresAt\)\)/);
    expect(region).toMatch(/'expired'/);
    expect(region).toMatch(/res\.status\(410\)/);
  });

  it('claim writes anti-sharing fingerprint (claimedIp + claimedUserAgentHash)', () => {
    expect(region).toMatch(/claimed:\s*true/);
    expect(region).toMatch(/claimedAt:\s*now\.toISOString\(\)/);
    expect(region).toMatch(/claimedIp:\s*ip/);
    expect(region).toMatch(/claimedUserAgentHash:\s*uaHash/);
  });

  it('code-mismatch attempts return 400 (not 200 with skip)', () => {
    expect(region).toMatch(/if \(data\.code !== code\)/);
    expect(region).toMatch(/'Invalid promo code'/);
    expect(region).toMatch(/res\.status\(400\)/);
  });
});

describe('seasonal-claim mirrors the same pattern', () => {
  const seasonalIdx = SRC.indexOf("router.post('/seasonal/claim'");
  const region = SRC.slice(seasonalIdx, seasonalIdx + 3000);

  it('handler registered', () => expect(seasonalIdx).toBeGreaterThan(-1));
  it('doc key scopes claim to (uid, season, year)', () => {
    expect(region).toMatch(/const docKey = `\$\{uid\}_\$\{season\}_\$\{currentYear\}`/);
  });
  it('data.claimed → 409 already_claimed', () => {
    expect(region).toMatch(/if \(data\.claimed\) return res\.status\(409\)/);
    expect(region).toMatch(/'already_claimed'/);
  });
});

describe('race-window flag (audit-only)', () => {
  it('the birthday claim handler is NOT wrapped in firestoreDb.runTransaction', () => {
    const claimIdx = SRC.indexOf("router.post('/birthday/claim'");
    const nextRouteIdx = SRC.indexOf("router.post(", claimIdx + 1);
    const region = SRC.slice(claimIdx, nextRouteIdx > 0 ? nextRouteIdx : claimIdx + 8000);
    // Documentation-only assertion: the handler does NOT use
    // firestoreDb.runTransaction. A future fix could wrap the
    // get + update pair in one. This test breaks when someone
    // adds it (so the audit comment can be removed then).
    expect(region).not.toMatch(/firestoreDb\.runTransaction/);
  });
});
