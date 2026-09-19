/**
 * THE "SAVE TO GOOGLE WALLET" TOKEN WAS NEVER A JWT.
 *
 * Three call sites ended with:
 *
 *     // Create unsigned JWT (Google Wallet will sign it)
 *     return Buffer.from(JSON.stringify(claims)).toString('base64url');
 *
 * The comment is wrong. Google's own documentation
 * (developers.google.com/wallet/generic/web, read 2026-09-19, page updated
 * 2026-09-16) lists as a prerequisite: "Sign your JWT with your Google Cloud
 * service account key", and the link format is
 * https://pay.google.com/gp/v/save/<signed_jwt>. Google VERIFIES your
 * signature; it does not produce one for you.
 *
 * So Android could never have worked — on top of the credentials
 * (GOOGLE_WALLET_ISSUER_ID / GOOGLE_WALLET_SERVICE_ACCOUNT) never having been
 * configured in production at all.
 *
 * This signs a real throwaway RSA key and verifies the output with the public
 * half, so the assertion is "Google could verify this", not "the source
 * mentions RS256".
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../lib/firebase-admin', () => ({
  db: { collection: () => ({ add: async () => ({ id: 'x' }), doc: () => ({ set: async () => ({}) }) }) },
}));

const src = readFileSync(resolve(__dirname, '..', 'googleWallet.ts'), 'utf8');
const code = src.split('\n').filter((l) => {
  const t = l.trim();
  return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
}).join('\n');

let publicKey = '';

beforeAll(() => {
  const { privateKey, publicKey: pub } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  publicKey = pub;
  process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000000000000';
  process.env.GOOGLE_WALLET_SERVICE_ACCOUNT = JSON.stringify({
    client_email: 'petwash-passes@petwash.iam.gserviceaccount.com',
    private_key: privateKey,
  });
});

afterEach(() => { vi.clearAllMocks(); });

describe('the source no longer hands back an unsigned blob', () => {
  it('nothing returns base64url of the claims', () => {
    expect(code).not.toMatch(/Buffer\.from\(JSON\.stringify\(claims\)\)\.toString\('base64url'\)/);
  });

  it('and the false comment is gone from the CODE', () => {
    // `code`, not `src`: the fix's own explanation quotes the sentence it
    // removed, so asserting on the raw file failed it for documenting itself.
    // Fourth time this trap appeared today.
    expect(code).not.toContain('Google Wallet will sign it');
  });

  it('signing is RS256, the only algorithm Google accepts here', () => {
    expect(code).toMatch(/algorithm: 'RS256'/);
  });
});

describe('what it produces is a JWT Google could actually verify', () => {
  it('three segments, and the signature checks out against the public key', async () => {
    const { GoogleWalletService } = await import('../googleWallet');
    const token = await GoogleWalletService.generateVIPCardJWT({
      userId: 'u1', userEmail: 'a@b.co', userName: 'Test Member',
      tier: 'gold', points: 10, discountPercent: 5, memberSince: new Date('2026-01-15'),
    } as any);

    expect(token.split('.')).toHaveLength(3);
    // Throws if the signature is wrong — this is the whole test.
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as any;
    expect(decoded.aud).toBe('google');
    expect(decoded.typ).toBe('savetowallet');
    expect(decoded.iss).toBe('petwash-passes@petwash.iam.gserviceaccount.com');
    expect(decoded.payload).toBeTruthy();
  });

  it('the issuer comes from the service account, so the two cannot disagree', () => {
    expect(code).toMatch(/iss: sa\.clientEmail/);
  });
});

describe('it refuses rather than pretending', () => {
  it('no service account → a clear error, not a broken link', async () => {
    const saved = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT;
    delete process.env.GOOGLE_WALLET_SERVICE_ACCOUNT;
    try {
      const { GoogleWalletService } = await import('../googleWallet');
      // The method wraps failures in its own message; what matters is that it
      // REFUSES rather than returning a link that silently does nothing.
      await expect(
        GoogleWalletService.generateVIPCardJWT({ userId: 'u', userEmail: 'e', userName: 'n', tier: 'gold', points: 0, discountPercent: 0, memberSince: new Date() } as any),
      ).rejects.toThrow();
      expect(GoogleWalletService.hasValidCredentials()).toBe(false);
    } finally {
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT = saved;
    }
  });

  it('a malformed service account does not report itself as configured', async () => {
    const saved = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT;
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT = 'not json at all';
    try {
      const { GoogleWalletService } = await import('../googleWallet');
      expect(GoogleWalletService.hasValidCredentials()).toBe(false);
    } finally {
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT = saved;
    }
  });
});

describe('a failure says WHY', () => {
  it('the cause is kept, not swallowed into one unactionable sentence', () => {
    // The bare rethrow made a configuration mistake and a Firestore outage
    // produce the identical message. Finding the real cause here needed a
    // temporary patch to the source — that is the cost of discarding it.
    expect(code).toMatch(/Failed to generate Google Wallet VIP card: \$\{/);
  });
});

describe("Google's 1800-character save-link limit is watched", () => {
  it('an over-long token warns instead of failing silently', () => {
    // Past ~1800 chars browsers truncate the link and the save just does
    // nothing — no error anywhere. Google documents this.
    expect(code).toMatch(/SAFE_JWT_LENGTH = 1800/);
    expect(code).toMatch(/token\.length > SAFE_JWT_LENGTH/);
  });
});
