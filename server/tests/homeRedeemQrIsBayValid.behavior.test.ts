/**
 * CEO 2026-09-12: "qr code to redeem and others not ok".
 *
 * The QR on /pet-parent/home, captioned "הצג/י בעמדה למימוש" (show at the bay
 * to redeem), is a token the bay CANNOT read. Three independent reasons, each
 * fatal on its own:
 *
 *  1. WRONG SIGNATURE ENCODING. The bay money path is
 *     server/routes/nayax-cortina.ts → resolveUserIdFromDynamicQr →
 *     verifyQrRedeemToken (server/lib/passTokens.ts), whose `sign`/`verify`
 *     use `.digest('base64url')` (43 chars). The home QR comes from
 *     POST /api/prestige-pass/token/generate, whose private `signPayload`
 *     uses `.digest('hex')` (64 chars). verify() rejects on the length check
 *     before it compares anything.
 *
 *  2. NO `purpose` FIELD. Even with the encoding fixed, verifyQrRedeemToken
 *     demands purpose === 'qr-redeem'. The prestige-pass payload
 *     ({jti,sub,wid,bay,mid,iat,exp,nonce}) has no purpose at all.
 *
 *  3. EXPIRED MOST OF THE TIME ANYWAY. prestige-pass mints with
 *     QR_TTL_SECONDS = 45, and PrestigeHome refetched it every 110_000 ms —
 *     so even in its own format the displayed code was dead for ~65 of every
 *     110 seconds. A 45-second authorization token must not idle on a home
 *     screen; it belongs on the redeem screen, minted at the moment of use.
 *
 * The WORKING mint is POST /api/k9000/generate-qr → buildQrRedeemToken, used
 * by client/src/pages/K9000Redeem.tsx at /wallet/redeem. Its own comment says
 * it plainly: "The Cortina money path accepts ONLY this short-lived qr-redeem
 * token". The home card now routes there instead of painting a dead barcode.
 *
 * Nothing here changes a money rail. It stops the app promising a redemption
 * the bay would refuse.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const R = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const TEST_SECRET = 'test-prestige-qr-secret-at-least-16-chars';

let passTokens: typeof import('../lib/passTokens');

beforeAll(async () => {
  // passTokens reads its secrets at module load, so set them first.
  process.env.PRESTIGE_QR_SECRET = TEST_SECRET;
  process.env.PASS_LINK_SECRET = TEST_SECRET;
  passTokens = await import('../lib/passTokens');
});

/** The prestige-pass payload shape, verbatim from routes/prestige-pass.ts. */
function prestigePassPayload() {
  const now = Math.floor(Date.now() / 1000);
  return {
    jti: crypto.randomUUID(),
    sub: 'hEz8JsRYz8bZEwZyBLNcVU3QEQo2',
    wid: 'WALLET-hEz8JsRY',
    bay: 'any',
    mid: undefined,
    iat: now,
    exp: now + 45,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
}

/** Reproduces routes/prestige-pass.ts `signPayload` — hex digest. */
function signLikePrestigePass(payload: unknown, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}.${sig}`;
}

describe('the token formats really are incompatible', () => {
  it('the replica above still matches the real signPayload (guards this test from rotting)', () => {
    const src = R('server/routes/prestige-pass.ts');
    const at = src.indexOf('function signPayload(');
    expect(at, 'signPayload was renamed or removed').toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf('\n}', at));
    expect(body).toContain("toString('base64url')");
    expect(body, 'prestige-pass no longer signs with hex — re-derive this test')
      .toContain("digest('hex')");

    const pass = R('server/lib/passTokens.ts');
    const signAt = pass.indexOf('function sign(');
    expect(pass.slice(signAt, pass.indexOf('\n}', signAt)))
      .toContain("digest('base64url')");
  });

  it('a prestige-pass token is REJECTED by the bay verifier', () => {
    const token = signLikePrestigePass(prestigePassPayload(), TEST_SECRET);
    // Same secret, same base64url body — and it still cannot be read.
    expect(() => passTokens.verifyQrRedeemToken(token)).toThrow(/INVALID_SIGNATURE/);
  });

  it('...and would STILL be rejected even if the encoding were fixed', () => {
    // Sign the identical payload the way passTokens does, to isolate reason #2.
    const payload = prestigePassPayload();
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', TEST_SECRET).update(body).digest('base64url');
    // `verify` reads expiresAt, which this payload calls `exp` → undefined.
    // Whatever it throws, it must NOT be a successful redeem.
    expect(() => passTokens.verifyQrRedeemToken(`${body}.${sig}`)).toThrow();
  });

  it('the token the bay DOES accept round-trips', () => {
    const good = passTokens.buildQrRedeemToken('PW-TEST-0001', 'user-123', 1);
    const decoded = passTokens.verifyQrRedeemToken(good);
    expect(decoded.purpose).toBe('qr-redeem');
    expect(decoded.userId).toBe('user-123');
    // 45 seconds — far too short to park on a home screen.
    expect(decoded.expiresAt - decoded.issuedAt).toBe(45);
  });

  it('the bay verifier is genuinely what the Cortina money path calls', () => {
    const cortina = R('server/routes/nayax-cortina.ts');
    expect(cortina).toContain("import { verifyQrRedeemToken } from '../lib/passTokens'");
    expect(cortina).toMatch(/function resolveUserIdFromDynamicQr[\s\S]{0,200}verifyQrRedeemToken\(code\)/);
  });
});

describe('the home card no longer paints a dead barcode', () => {
  const page = () => R('client/src/pages/PrestigeHome.tsx');

  it('PrestigeHome does not mint the incompatible prestige-pass QR', () => {
    // A CALL, not a mention — the fix leaves an explanatory comment naming the
    // endpoint, and that comment is the point.
    expect(page(), 'home still calls the mint whose tokens the bay rejects')
      .not.toMatch(/apiRequest\(\s*'POST'\s*,\s*'\/api\/prestige-pass\/token\/generate'/);
    expect(page(), 'the dead-token query is still registered')
      .not.toContain("queryKey: ['/api/prestige-pass/token/generate']");
  });

  it('PrestigeHome renders no QR code at all', () => {
    // A 45s authorization token cannot live on an idle screen. The card sends
    // the customer to the redeem screen, which mints one at the moment of use.
    expect(page()).not.toContain('QRCodeSVG');
  });

  it('the card routes to the redeem screen that uses the WORKING mint', () => {
    // Match the NAVIGATION, never the path text: the fix leaves a comment that
    // names /wallet/redeem, and a `toContain` would pass on that comment alone.
    // (This exact trap has bitten this repo before — pin link SHAPES.)
    expect(page(), 'the redeem tile no longer navigates to /wallet/redeem')
      .toMatch(/navigate\(\s*'\/wallet\/redeem'\s*\)/);
    const redeem = R('client/src/pages/K9000Redeem.tsx');
    expect(redeem).toContain('/api/k9000/generate-qr');
    const routes = R('client/src/App.tsx');
    expect(routes).toMatch(/<Route path="\/wallet\/redeem">/);
  });

  it('/api/k9000/generate-qr is still the mint that feeds the bay', () => {
    const src = R('server/routes.ts');
    const at = src.indexOf("app.post('/api/k9000/generate-qr'");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 6000)).toContain('buildQrRedeemToken');
  });
});
