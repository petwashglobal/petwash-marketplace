// ONE idempotent, non-clobbering user provisioning used by EVERY auth session
// (phone, email, social). Before this, the wallet/loyalty/users bootstrap ran
// ONLY inside the "new Firebase user" branch of each handler, best-effort — so a
// DB blip, or a Firebase user that somehow lost its Postgres row, left a
// PERMANENT ORPHAN: no wallet (wallet queries crash), no membership, never
// activates, and every later login skipped the bootstrap because the Firebase
// user already existed. Running this on every successful session HEALS orphans.
//
// Safety: it never overwrites an existing users row (checks existence first, so
// a provider's role/intent is never downgraded to 'customer'); wallet + loyalty
// are ON CONFLICT DO NOTHING; the verified-flag calls are idempotent. (2026-07-31)
import { pool, db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';
import { logger } from '../lib/logger';

export interface ProvisionOptions {
  channel: 'phone' | 'email' | 'social';
  email?: string | null;
  phone?: string | null;
  signupIntent?: string;
}

export async function ensureUserProvisioned(uid: string, opts: ProvisionOptions): Promise<void> {
  // 1. Wallet — without a row, wallet queries crash. Idempotent.
  try {
    const walletId = `WALLET-${uid.slice(0, 20)}`;
    await pool.query(
      `INSERT INTO wallet_accounts (wallet_id, user_id, cash_wallet_balance_cents, updated_at)
       VALUES ($1, $2, 0, NOW()) ON CONFLICT (wallet_id) DO NOTHING`,
      [walletId, uid],
    );
  } catch (e: any) {
    logger.warn('[authBootstrap] wallet ensure failed (non-blocking)', { uid, error: e?.message });
  }

  // 2. Loyalty profile — same welcome grant as the Google path. Idempotent.
  try {
    await pool.query(
      `INSERT INTO loyalty_profiles
         (user_id, tier, tier_since, tier_progress, tier_threshold,
          points, lifetime_points, xp, level,
          total_washes, current_streak, longest_streak,
          average_wash_interval, is_vip, concierge_access, priority_support,
          preferred_stations, preferred_times, personalized_offers,
          created_at, updated_at)
       VALUES ($1, 'bronze', NOW(), 0, 1000,
               100, 100, 0, 1,
               0, 0, 0,
               21, false, false, false,
               '[]', '[]', '[]',
               NOW(), NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [uid],
    );
  } catch (e: any) {
    logger.warn('[authBootstrap] loyalty ensure failed (non-blocking)', { uid, error: e?.message });
  }

  // 3. users row — create ONLY if missing. NEVER overwrite an existing row (that
  //    would clobber role/signupIntent — e.g. downgrade a provider to customer).
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, uid)).limit(1);
    if (!existing) {
      await storage.upsertUser({
        id: uid,
        email: opts.email ?? null,
        phone: opts.phone ?? null,
        role: 'customer',
        authProvider: opts.channel,
        language: 'he',
        country: 'IL',
        userStatus: 'new',
        signupIntent: opts.signupIntent ?? 'customer',
      } as any);
      logger.info('[authBootstrap] healed missing users row', { uid, channel: opts.channel });
    }
  } catch (e: any) {
    logger.warn('[authBootstrap] users row ensure failed (non-blocking)', { uid, error: e?.message });
  }

  // 4. Verified flag — the OTP/social just proved this channel. Idempotent
  //    (each mark* no-ops if already set) and drives activationStatus forward.
  try {
    if (opts.channel === 'phone') {
      const { markMobileVerified } = await import('./ActivationService');
      await markMobileVerified(uid);
    } else if (opts.channel === 'email') {
      const { markEmailVerified } = await import('./ActivationService');
      await markEmailVerified(uid, { acceptTerms: true });
    } else if (opts.channel === 'social' && opts.email) {
      // Google/Apple/Facebook verify the email on their side (Apple relay too) —
      // so a social login is a verified email → it activates the account.
      const { markEmailVerified } = await import('./ActivationService');
      await markEmailVerified(uid, { acceptTerms: true });
    }
  } catch (e: any) {
    logger.warn('[authBootstrap] verified-flag ensure failed (non-blocking)', { uid, error: e?.message });
  }
}
