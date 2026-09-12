/**
 * ONE freshness guard for the 45-second redeem QR (2026-09-13).
 *
 * Two acceptors exist for the same token — the Nayax Cortina bay rail
 * (server/routes/nayax-cortina.ts) and the kiosk rail
 * (server/routes/k9000.ts /redeem-wash). Until today each burned the nonce in
 * its OWN table (petwash_pass_nonce_registry vs k9000_redeemed_nonces), so a
 * single QR could be spent once on each rail inside its TTL, and only the
 * Cortina rail compared qr_token_version (a revoked pass was still accepted
 * at the kiosk). Both rails now call this: same registry, same revocation
 * rule, first scan wins everywhere.
 *
 * Throws: TOKEN_REVOKED (pass version bumped after mint), TOKEN_REPLAYED
 * (nonce already burned). Fail-CLOSED on a registry error — the caller must
 * not authorise a wash it cannot prove is fresh.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { petwashPassAccounts } from '@shared/schema';
import type { PassTokenPayload } from './passTokens';

export interface RedeemGuardDeps {
  passVersionFor: (userId: string) => Promise<number | null>;
  burnNonce: (nonce: string, passRef: string, expiresAt: Date) => Promise<boolean>;
}

export const defaultRedeemGuardDeps: RedeemGuardDeps = {
  passVersionFor: async (userId) => {
    const [acct] = await db
      .select({ v: petwashPassAccounts.qrTokenVersion })
      .from(petwashPassAccounts)
      .where(eq(petwashPassAccounts.userId, userId))
      .limit(1);
    return acct ? Number(acct.v) : null;
  },
  burnNonce: async (nonce, passRef, expiresAt) => {
    const r = await db.execute(sql`
      INSERT INTO petwash_pass_nonce_registry (nonce, pass_id, expires_at, used_at)
      VALUES (${nonce}, ${passRef}, ${expiresAt}, NOW())
      ON CONFLICT (nonce) DO NOTHING
      RETURNING id
    `);
    return ((r as any).rows?.length ?? (r as any).rowCount ?? 0) > 0;
  },
};

/**
 * Verify-then-consume. Call ONCE per presented token, after signature/expiry
 * verification (verifyQrRedeemToken) and BEFORE any money moves.
 */
export async function enforceRedeemTokenFreshness(
  p: PassTokenPayload,
  deps: RedeemGuardDeps = defaultRedeemGuardDeps,
): Promise<void> {
  // Revocation: a revoked pass bumps qr_token_version; a token minted before
  // the bump must not spend. Wallet-only members carry no pass row → nothing
  // to compare.
  if (typeof p.tokenVersion === 'number') {
    const v = await deps.passVersionFor(p.userId);
    if (v !== null && v !== p.tokenVersion) throw new Error('TOKEN_REVOKED');
  }
  // Replay: first scan wins on EVERY rail.
  if (p.nonce) {
    const fresh = await deps.burnNonce(p.nonce, p.passId || p.userId, new Date((p.expiresAt || 0) * 1000));
    if (!fresh) throw new Error('TOKEN_REPLAYED');
  }
}
