import path from 'path';
import fs from 'fs';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { startSessionKey } from '../lib/cortinaStartSession';

/**
 * Redeem-at-bay rail audit 2026-09-12 — the mis-wirings that would have
 * surfaced for the first time at a bay with a paying customer:
 *  1. Cortina burned no nonce and checked no tokenVersion (double-spend / revoked pass)
 *  2. the kiosk route verified a token nobody mints (different secret + schema)
 *  3. Google Wallet baked a 45-second token into a permanent pass
 *  4. two unauthenticated debit endpoints with no callers were reachable
 *  5. the home/wallet "token/generate" minted a QR the bay cannot read
 *  6. the StartSession key derivation (last 32 chars; exact-64 was WRONG — Nayax example is 65)
 *  7. nothing warned that no bay carries a Nayax terminal id
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const CORTINA = R('server/routes/nayax-cortina.ts');
const K9000 = R('server/routes/k9000.ts');
const GW = R('server/services/GoogleWalletService.ts');
const PP = R('server/routes/prestige-pass.ts');
const PR = R('server/routes/pass-redeem.ts');

describe('1. Cortina: one scan, one debit, and revoked passes stay revoked', () => {
  it('burns the nonce in the shared registry and compares qr_token_version — ONE guard for BOTH rails (2026-09-13)', () => {
    const GUARD = R('server/lib/redeemTokenGuard.ts');
    expect(GUARD).toContain('INSERT INTO petwash_pass_nonce_registry (nonce, pass_id, expires_at, used_at)');
    expect(GUARD).toContain("throw new Error('TOKEN_REPLAYED')");
    expect(GUARD).toContain("throw new Error('TOKEN_REVOKED')");
    expect(CORTINA).toMatch(/async function resolveUserIdFromDynamicQr\(code: string\): Promise<string>/);
    expect(CORTINA).toContain('await enforceRedeemTokenFreshness(p);');
    expect(K9000).toContain('await enforceRedeemTokenFreshness(payload);');
    expect(K9000).toContain("if (reason === 'TOKEN_REVOKED')");
    expect((CORTINA.match(/userId = await resolveUserIdFromDynamicQr\(code\)/g) || []).length).toBe(2);
  });
});

describe('2. kiosk /redeem-wash verifies what /generate-qr mints', () => {
  it('uses verifyQrRedeemToken (passTokens), not lib/signedRedeemToken', () => {
    expect(K9000).toContain("import { verifyQrRedeemToken, type PassTokenPayload } from '../lib/passTokens';");
    expect(K9000).not.toMatch(/verifySignedRedeemToken\(/);
    expect(K9000).toContain('payload = verifyQrRedeemToken(scannedCode);');
    expect(K9000).toContain('const userId = payload.userId;');
  });
});

describe('3. Google Wallet carries an identity barcode, like Apple', () => {
  it('wallet-barcode token, no fake rotatingBarcode', () => {
    expect(GW).toContain("import { buildWalletBarcodeToken } from '../lib/passTokens';");
    expect(GW).not.toMatch(/buildQrRedeemToken\(/);
    expect(GW).not.toContain('rotatingBarcode: {');
    expect(GW).not.toContain('initialRotatingBarcodeValues');
  });
});

describe('4. unauthenticated debit endpoints are sealed', () => {
  it('/api/pass/redeem and /api/prestige-pass/token/redeem answer 410 first', () => {
    expect(PR).toMatch(/router\.post\('\/redeem', \(_req: Request, res: Response\) => \{\s*res\.status\(410\)/);
    expect(PP).toMatch(/router\.post\('\/token\/redeem', \(_req: Request, res: Response\) => \{\s*res\.status\(410\)/);
  });

  // 2026-09-13. The previous version of this block asserted that the 410 seal was
  // registered BEFORE a handler at '/redeem-retired-2026-09-12' — i.e. it REQUIRED
  // the old debit handler to still exist. The 2026-09-12 retirement had renamed the
  // handlers instead of deleting them, so they stayed fully reachable at the new
  // paths: POST /api/pass/redeem-retired-2026-09-12 debited a member's pass by up to
  // ₪200 with no kiosk auth. The seal only covered the old path. This test was also
  // never in test:money, so it guarded nothing. It now forbids the pattern outright.
  it('no retired money handler survives under a renamed path, in ANY route file', () => {
    const dir = path.join(process.cwd(), 'server', 'routes');
    const offenders: string[] = [];
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      // A route whose PATH says it is retired/deprecated must be a stub, not a real
      // handler. ('legacy' is deliberately NOT matched — /wallet/legacy-balance-report
      // is a real admin report about legacy balances, not a retired endpoint.)
      // not a real handler: it may not be async and may not touch the ledger/db.
      const re = /(?:router|app)\.(?:get|post|put|patch|delete)\(\s*['"`]([^'"`]*(?:retired|deprecated)[^'"`]*)['"`]([\s\S]*?)\n\}\);/gi;
      for (const m of src.matchAll(re)) {
        const body = m[2];
        if (/async\s*\(|atomicLedgerEntry|applySmartRedemption|db\.(insert|update|delete)|debit/i.test(body)) {
          offenders.push(`${f}: ${m[1]}`);
        }
      }
    }
    expect(offenders, `live handler(s) behind a "retired" path:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('the two specific renamed handlers are gone', () => {
    expect(PR).not.toContain("router.post('/redeem-retired-2026-09-12'");
    expect(PP).not.toContain("router.post('/token/redeem-retired-2026-09-12'");
  });
});

describe('5. /token/generate mints the bay-valid token', () => {
  it('buildQrRedeemToken, hex signer gone', () => {
    expect(PP).toContain('const token = buildQrRedeemToken(');
    expect(PP).not.toContain('function signPayload(');
    expect(R('client/src/pages/K9000Redeem.tsx')).not.toContain("kioskId: 'any'");
  });
});

describe('6. Cortina StartSession key', () => {
  it('derives the key from the LAST 32 chars and rejects anything shorter than 32', () => {
    expect(() => startSessionKey('x'.repeat(31))).toThrow('cortina_secret_token_too_short');
    expect(startSessionKey('a'.repeat(33) + 'b'.repeat(32)).toString('utf8')).toBe('b'.repeat(32));
  });
});

describe('7. boot check for bay mappings', () => {
  it('shouts when the rail is on and no bay has a Nayax terminal id', () => {
    expect(CORTINA).toContain('export async function warnIfCortinaHasNoBayMappings');
    expect(CORTINA).toContain('void warnIfCortinaHasNoBayMappings();');
    expect(CORTINA).toContain('every Nayax callback will decline bay_not_found');
  });
});
