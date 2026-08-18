/**
 * GET /api/me/status — the SINGLE source the frontend reads to decide what to
 * show (MASTER BIBLE §3/§9). ONE user_id → all connected modules. Each module is
 * resolved FAIL-SOFT: one module erroring never breaks the whole status (returns
 * that module's safe default instead). Returns ONLY real backend state — never
 * fake balances/earnings/approvals.
 *
 * Shape:
 *   { user, prestige, discount, provider, wallet, pets_count }
 */
import { Router, type Request, type Response } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { storage } from '../storage';
import { db, pool } from '../db';
import { pets } from '../../shared/schema';
import { memberDiscountApplications } from '../../shared/schema';
import { providerServices } from '../../shared/schema-provider-services';
import { walletService } from '../services/WalletService';
import { resolveWashDiscount } from '../services/memberDiscount';
import { logger } from '../lib/logger';

const router = Router();

function ageFrom(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const d = dob instanceof Date ? dob : new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

const APPROVED_SERVICE_STATUSES = ['approved_for_booking', 'approved_for_payout'];

// GET /api/me/status
router.get('/status', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });

  // ── user (the anchor) ──────────────────────────────────────────────────────
  let user: any = null;
  try { user = await storage.getUser(uid); } catch (e: any) { logger.warn('[me/status] user load failed', { err: e?.message }); }
  const age = ageFrom(user?.dateOfBirth);
  const ageVerified = age !== null && age >= 18;
  const userBlock = {
    user_id: uid,
    account_status: (user?.userStatus || user?.accountStatus || (user ? 'active' : 'unknown')),
    mobile_verified: !!(user?.phoneVerified ?? user?.phone),
    email_verified: !!(user?.emailVerified),
    age_verified: ageVerified,
  };

  // ── prestige (enrollment truth = privilege_members row) ────────────────────
  // BEFORE (2026-08-18 audit finding): reported ACTIVE for anyone aged 18+,
  // even if the user had NEVER joined Prestige. That over-reported enrollment
  // across the customer surface (Prestige-only CTAs shown to non-members,
  // reward-rate display promised to walk-ins, etc.).
  // AFTER: read the authoritative privilege_members table (raw SQL matches
  // the pattern used by prestige-join.ts + privilege-loyalty.ts). ACTIVE only
  // when the user has actually enrolled AND the membership is not suspended.
  // Age remains a gate for JOINING (elsewhere) — but it is not proof of
  // enrollment, so it must not drive this shape's status any longer.
  let prestige = {
    status: 'NOT_JOINED' as string,
    reward_rate: 5,
    scope: 'K9000_WASH_ONLY',
    tier: null as string | null,
    member_id: null as string | null,
  };
  try {
    const r = await pool.query(
      `SELECT member_id, tier, status
         FROM privilege_members
        WHERE firebase_uid = $1
        LIMIT 1`,
      [uid],
    );
    const row = r.rows[0];
    if (row) {
      const st = (row.status || '').toString().toLowerCase();
      // 'active' → ACTIVE. Anything else (suspended, cancelled, pending, …)
      // → whatever the DB says, uppercased, so admins can inspect the raw
      // state without a second query.
      prestige.status = st === 'active' ? 'ACTIVE' : (st || 'UNKNOWN').toUpperCase();
      prestige.tier = row.tier || null;
      prestige.member_id = row.member_id || null;
    }
  } catch (e: any) {
    logger.warn('[me/status] prestige load failed', { err: e?.message });
  }

  // ── discount (resolved rate + latest application status) ───────────────────
  let discount = { status: 'NOT_APPLIED' as string, type: null as string | null, rate: 0 };
  try {
    const [latest] = await db
      .select({ status: memberDiscountApplications.status, type: memberDiscountApplications.discountType, pct: memberDiscountApplications.approvedPercent })
      .from(memberDiscountApplications)
      .where(eq(memberDiscountApplications.userId, uid))
      .orderBy(desc(memberDiscountApplications.id))
      .limit(1);
    const wd = await resolveWashDiscount(uid).catch(() => null);
    if (wd?.approved) {
      discount = { status: 'APPROVED', type: wd.source === 'disability' ? 'disability' : 'senior', rate: wd.percent };
    } else if (latest) {
      discount = { status: String(latest.status).toUpperCase(), type: latest.type ?? null, rate: latest.pct ?? 0 };
    }
  } catch (e: any) { logger.warn('[me/status] discount load failed', { err: e?.message }); }

  // ── provider (application status + approved services) ───────────────────────
  let provider = { status: 'NOT_APPLIED' as string, approved_services: [] as string[], payout_status: 'NOT_REQUIRED' as string };
  try {
    const app = await storage.getProviderApplicationByUser(uid);
    if (app) {
      provider.status = String((app as any).status || 'pending_review').toUpperCase();
      provider.payout_status = String((app as any).payoutStatus || 'NOT_STARTED').toUpperCase();
      try {
        const rows = await db
          .select({ svc: providerServices.serviceType, st: providerServices.serviceStatus })
          .from(providerServices)
          .where(and(eq(providerServices.providerId, uid), inArray(providerServices.serviceStatus, APPROVED_SERVICE_STATUSES)));
        provider.approved_services = rows.map((r) => r.svc).filter(Boolean) as string[];
      } catch { /* services optional */ }
    }
  } catch (e: any) { logger.warn('[me/status] provider load failed', { err: e?.message }); }

  // ── wallet (real balances, ledger-derived; 0 for a new member) ─────────────
  let wallet = { reward_balance: 0, wallet_balance: 0, gift_balance: 0, wash_credits: 0 };
  try {
    const w = await walletService.getWalletSummary(uid);
    wallet = {
      reward_balance: w.loyaltyPointsBalance || 0,        // Prestige reward (points)
      wallet_balance: w.totalCreditsValueCents || 0,      // total credit value (cents)
      gift_balance: w.egiftBalanceCents || 0,             // gift (cents)
      wash_credits: w.washPackageCredits || 0,            // wash count
    };
  } catch (e: any) { logger.warn('[me/status] wallet load failed', { err: e?.message }); }

  // ── pets_count ─────────────────────────────────────────────────────────────
  let pets_count = 0;
  try {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(pets).where(eq(pets.userId, uid));
    pets_count = row?.n ?? 0;
  } catch (e: any) { logger.warn('[me/status] pets count failed', { err: e?.message }); }

  return res.json({ user: userBlock, prestige, discount, provider, wallet, pets_count });
});

export default router;
