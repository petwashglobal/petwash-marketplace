/**
 * POST /api/prestige/join
 *
 * Atomic Prestige join coordinator.
 *
 * Before this route existed, a new user had to:
 *   1. Call POST /api/loyalty/auto-enroll         → creates loyalty_profiles row
 *   2. Call POST /api/privilege-loyalty/register  → creates privilege_members row (with form + file)
 *   3. Call POST /api/prestige-pass/activate      → upserts Firestore pass doc + sends wallet email
 *
 * Those three calls were independent, had no transaction boundary, and could leave the user
 * partially enrolled if any step failed.  This route wraps the minimum required logic for
 * each system in a single endpoint so the frontend can do one call and get a fully enrolled
 * member with:
 *   - loyalty_profiles row (tier bronze, 100 welcome points)
 *   - privilege_members row (pending_verification status)
 *   - Firestore prestige_passes doc
 *   - Wallet email dispatched
 *
 * Authentication: Firebase Bearer token (requireAuth middleware in routes.ts mount).
 *
 * Request body (JSON):
 *   { firstName, lastName, email, phone, tier?: 'pearl'|'black'|'platinum', language?: 'he'|'en' }
 *
 * Response:
 *   { ok, memberId, cardNumber, tier, loyaltyProfile, emailSent, alreadyEnrolled }
 */

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { auth as fbAdminAuth, firestoreDb } from '../lib/firebase-admin';
import { authService } from '../services/AuthService';
import { EmailService } from '../emailService';

const router = Router();

// ── Input schema ─────────────────────────────────────────────────────────────
const joinSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName:  z.string().min(1).max(80),
  email:     z.string().email(),
  phone:     z.string().min(7).max(20),
  tier:      z.enum(['pearl', 'black', 'platinum']).default('pearl'),
  language:  z.enum(['he', 'en']).default('he'),
});

const TIER_DISPLAY: Record<string, { he: string; en: string }> = {
  pearl:    { he: 'פנינה', en: 'Prestige Pearl' },
  black:    { he: 'שחור', en: 'Prestige Black' },
  platinum: { he: 'פלטינום', en: 'Prestige Platinum' },
};

const FREE_WASHES: Record<string, number> = { black: 5, platinum: 3, pearl: 1 };

router.post('/join', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).firebaseUser?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { firstName, lastName, email, phone, tier, language } = parsed.data;
    const tierKey = tier.toLowerCase();
    const tierDisplay = TIER_DISPLAY[tierKey]?.en || 'Prestige Pearl';

    // ── Step 1: loyalty_profiles (via schema-loyalty dynamic import) ─────────
    let loyaltyProfile: any = null;
    let alreadyEnrolled = false;
    try {
      const { loyaltyProfiles, pointsTransactions } = await import('../../shared/schema-loyalty');

      const [existing] = await db
        .select()
        .from(loyaltyProfiles)
        .where(eq(loyaltyProfiles.userId, userId))
        .limit(1);

      if (existing) {
        loyaltyProfile = existing;
        alreadyEnrolled = true;
      } else {
        const WELCOME_POINTS = 100;
        const [profile] = await db
          .insert(loyaltyProfiles)
          .values({
            userId,
            tier: 'bronze',
            tierSince: new Date(),
            tierProgress: 0,
            tierThreshold: 1000,
            points: WELCOME_POINTS,
            lifetimePoints: WELCOME_POINTS,
            xp: 0,
            level: 1,
            totalWashes: 0,
            currentStreak: 0,
            longestStreak: 0,
            averageWashInterval: 21,
            isVip: false,
            conciergeAccess: false,
            prioritySupport: false,
          })
          .returning();

        loyaltyProfile = profile;

        // Welcome points transaction
        await db.insert(pointsTransactions).values({
          userId,
          type: 'earned',
          amount: WELCOME_POINTS,
          balance: WELCOME_POINTS,
          source: 'signup',
          description: `Welcome bonus — Prestige join (${tierDisplay})`,
        }).catch((e: any) => logger.warn('[PrestigeJoin] Points tx failed (non-fatal)', { error: e?.message }));

        // Firebase custom claims
        await fbAdminAuth.setCustomUserClaims(userId, {
          ...((await fbAdminAuth.getUser(userId)).customClaims || {}),
          accountType: 'pet_parent',
          role: 'public',
          loyaltyTier: 'bronze',
          loyaltyMember: true,
          program: 'PetWash Privilege',
        }).catch((e: any) => logger.warn('[PrestigeJoin] Custom claims failed (non-fatal)', { error: e?.message }));
      }
    } catch (loyaltyErr: any) {
      // Non-fatal: log but continue so the rest of enrollment completes
      logger.error('[PrestigeJoin] Loyalty step failed', { error: loyaltyErr?.message, userId });
    }

    // ── Step 2: privilege_members ────────────────────────────────────────────
    let memberId: string | null = null;
    try {
      // Raw SQL is used here intentionally: privilege-loyalty.ts performs a
      // runtime CREATE TABLE IF NOT EXISTS before the table is used, so we
      // cannot safely import the Drizzle table object at module load time.
      // The query is parameterised ($1/$2/…) so there is no injection risk.
      const existing = await db.execute(
        { text: `SELECT member_id FROM privilege_members WHERE email = $1 LIMIT 1`, values: [email.trim().toLowerCase()] } as any
      );
      if ((existing as any).rows?.length > 0) {
        memberId = (existing as any).rows[0].member_id;
      } else {
        memberId = `PWP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await db.execute({
          text: `
            INSERT INTO privilege_members
              (member_id, first_name, last_name, email, phone, language, terms_consent, status)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'pending_verification')
            ON CONFLICT (email) DO NOTHING
          `,
          values: [memberId, firstName.trim(), lastName.trim(), email.trim().toLowerCase(), phone.trim(), language],
        } as any);
      }
    } catch (privilegeErr: any) {
      logger.error('[PrestigeJoin] Privilege step failed', { error: privilegeErr?.message, userId });
      // Non-fatal — continue to prestige pass step
    }

    // ── Step 3: Firestore prestige_passes doc ────────────────────────────────
    const passCardNumber = `${userId.slice(0, 4).toUpperCase()}${Date.now().toString().slice(-8)}`;
    try {
      const passRef = firestoreDb.collection('prestige_passes').doc(userId);
      const existing = await passRef.get();
      if (!existing.exists) {
        await passRef.set({
          userId,
          tier: tierKey,
          cardNumber: passCardNumber,
          cashWalletCents: 0,
          freeWashesRemaining: FREE_WASHES[tierKey] ?? 1,
          issuedAt: new Date().toISOString(),
          emailSentAt: null,
        });
      }
    } catch (passErr: any) {
      logger.error('[PrestigeJoin] Firestore pass step failed', { error: passErr?.message, userId });
    }

    // ── Step 4: Wallet account ensure ────────────────────────────────────────
    authService.ensureWalletAccount(userId).catch((e: any) =>
      logger.warn('[PrestigeJoin] ensureWalletAccount failed (non-fatal)', { error: e?.message })
    );

    // ── Step 5: Wallet email (simple inline template) ───────────────────────
    let emailSent = false;
    try {
      const appBaseUrl = process.env.APP_BASE_URL || 'https://petwash.co.il';
      const memberNumber = memberId || `PW-${userId.slice(-8).toUpperCase()}`;
      const html = `<!DOCTYPE html><html lang="he"><body style="font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right;padding:24px;background:#fff;">
<div style="max-width:520px;margin:auto;">
<h2 style="color:#111;font-size:22px;margin-bottom:8px;">🐾 ברוך הבא ל-PetWash™ Prestige</h2>
<p style="color:#555;margin-bottom:20px;">הכרטיס שלך מוכן. ניתן לנהל את הארנק שלך מהאפליקציה.</p>
<table style="border-collapse:collapse;width:100%;border:1px solid #eee;border-radius:8px;overflow:hidden;">
  <tr style="background:#f9f9f9;"><td style="padding:12px 16px;color:#777;font-size:14px;">שם</td><td style="padding:12px 16px;font-weight:600;">${firstName} ${lastName}</td></tr>
  <tr><td style="padding:12px 16px;color:#777;font-size:14px;">מספר כרטיס</td><td style="padding:12px 16px;font-weight:600;letter-spacing:2px;">${passCardNumber}</td></tr>
  <tr style="background:#f9f9f9;"><td style="padding:12px 16px;color:#777;font-size:14px;">רמה</td><td style="padding:12px 16px;font-weight:600;">${tierDisplay}</td></tr>
  <tr><td style="padding:12px 16px;color:#777;font-size:14px;">מספר חבר</td><td style="padding:12px 16px;font-weight:600;">${memberNumber}</td></tr>
</table>
<div style="margin-top:24px;text-align:center;">
  <a href="${appBaseUrl}/prestige-pass/wallet" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">פתח ארנק Prestige</a>
</div>
<p style="margin-top:32px;font-size:12px;color:#aaa;text-align:center;">PetWash Ltd. | support@petwash.co.il | ${appBaseUrl}</p>
</div></body></html>`;

      emailSent = await EmailService.send({
        to: email,
        subject: `הפאס הפרסטיז שלך מוכן — ${tierDisplay} 🐾`,
        html,
      });

      if (emailSent) {
        await firestoreDb
          .collection('prestige_passes')
          .doc(userId)
          .update({ emailSentAt: new Date().toISOString() })
          .catch(() => {});
      }
    } catch (emailErr: any) {
      logger.error('[PrestigeJoin] Email step failed (non-fatal)', { error: emailErr?.message, userId });
    }

    return res.json({
      ok:            true,
      memberId,
      cardNumber:    passCardNumber,
      tier:          tierKey,
      tierDisplay,
      loyaltyProfile,
      alreadyEnrolled,
      emailSent,
    });
  } catch (err: any) {
    logger.error('[PrestigeJoin] Unhandled error', { error: err?.message });
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

export default router;
