/**
 * POST /api/prestige/join
 *
 * CEO DEEP-LOGIC §49-§50 — thin HTTP shell over the canonical
 * PrestigeEnrollmentService. The enrollment logic is no longer
 * inlined here; both the HTTP surface and the Action Brain's
 * PRESTIGE_JOIN handler call `enrollPrestige(...)` so the two paths
 * cannot drift.
 *
 * Authentication: Firebase Bearer token (requireAuth middleware in
 * routes.ts mount). This handler does NOT accept an actorUid from
 * the body — the identity is server-derived from the Firebase user
 * on the request.
 *
 * Request body (JSON):
 *   { firstName, lastName, email, phone, tier?: 'pearl'|'black'|'platinum',
 *     language?: 'he'|'en' }
 *
 * Response (success):
 *   { ok, status, memberId, cardNumber, tier, tierDisplay,
 *     loyaltyProfile, alreadyEnrolled, emailSent }
 *
 * Response (failure):
 *   { ok:false, status, ... }
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { EmailService } from '../emailService';
import { authService } from '../services/AuthService';
import { db as firestoreDb } from '../lib/firebase-admin';
import { SUPPORT_EMAIL as CANONICAL_SUPPORT_EMAIL } from '@shared/support-contact';
import { enrollPrestige } from '../services/marketplace/PrestigeEnrollmentService';

const router = Router();

const joinSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName:  z.string().min(1).max(80),
  email:     z.string().email(),
  phone:     z.string().min(7).max(20),
  tier:      z.enum(['pearl', 'black', 'platinum']).default('pearl'),
  language:  z.enum(['he', 'en']).default('he'),
});

router.post('/join', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).firebaseUser?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.flatten() });
    }

    // CEO §50 — one authority. This route no longer inlines the
    // enrollment steps; the shared service handles loyalty_profiles,
    // privilege_members, Firestore prestige_passes, and the users
    // row sync. Additive Firebase claims (§59) preserve
    // accountType / role for Provider or admin accounts.
    const result = await enrollPrestige(userId, parsed.data);

    // Map service outcomes to HTTP responses.
    if (result.status === 'ENROLLED' || result.status === 'ALREADY_ACTIVE') {
      // Wallet ensure + welcome email are HTTP-shell concerns (§37).
      // The service is pure of email dispatch so the Action Brain
      // handler can decide whether to fire the notification via its
      // own outbox.
      authService.ensureWalletAccount(userId).catch((e: any) =>
        logger.warn('[PrestigeJoin] ensureWalletAccount failed (non-fatal)', { error: e?.message }),
      );

      let emailSent = false;
      try {
        const appBaseUrl = process.env.APP_BASE_URL || 'https://petwash.co.il';
        const memberNumber = result.memberId;
        const html = `<!DOCTYPE html><html lang="he"><body style="font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right;padding:24px;background:#fff;">
<div style="max-width:520px;margin:auto;">
<h2 style="color:#111;font-size:22px;margin-bottom:8px;">🐾 ברוך הבא ל-PetWash™ Prestige</h2>
<p style="color:#555;margin-bottom:20px;">הכרטיס שלך מוכן. ניתן לנהל את הארנק שלך מהאפליקציה.</p>
<table style="border-collapse:collapse;width:100%;border:1px solid #eee;border-radius:8px;overflow:hidden;">
  <tr style="background:#f9f9f9;"><td style="padding:12px 16px;color:#777;font-size:14px;">שם</td><td style="padding:12px 16px;font-weight:600;">${parsed.data.firstName} ${parsed.data.lastName}</td></tr>
  <tr><td style="padding:12px 16px;color:#777;font-size:14px;">מספר כרטיס</td><td style="padding:12px 16px;font-weight:600;letter-spacing:2px;">${result.cardNumber}</td></tr>
  <tr style="background:#f9f9f9;"><td style="padding:12px 16px;color:#777;font-size:14px;">רמה</td><td style="padding:12px 16px;font-weight:600;">${result.tierDisplay}</td></tr>
  <tr><td style="padding:12px 16px;color:#777;font-size:14px;">מספר חבר</td><td style="padding:12px 16px;font-weight:600;">${memberNumber}</td></tr>
</table>
<div style="margin-top:24px;text-align:center;">
  <a href="${appBaseUrl}/prestige-pass/wallet" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">פתח ארנק Prestige</a>
</div>
<p style="margin-top:32px;font-size:12px;color:#aaa;text-align:center;">PetWash Ltd. | ${CANONICAL_SUPPORT_EMAIL} | ${appBaseUrl}</p>
</div></body></html>`;
        emailSent = await EmailService.send({
          to: parsed.data.email,
          subject: `הפאס ה-Prestige שלך מוכן — ${result.tierDisplay} 🐾`,
          html,
        });
        if (emailSent) {
          await firestoreDb.collection('prestige_passes').doc(userId).update({ emailSentAt: new Date().toISOString() }).catch(() => {});
        }
      } catch (emailErr: any) {
        logger.error('[PrestigeJoin] Email step failed (non-fatal)', { error: emailErr?.message });
      }

      return res.json({
        ok: true,
        status: result.status,
        memberId: result.memberId,
        cardNumber: result.cardNumber,
        tier: result.tier,
        tierDisplay: result.tierDisplay,
        loyaltyProfile: result.loyaltyProfile,
        alreadyEnrolled: result.status === 'ALREADY_ACTIVE',
        emailSent,
      });
    }

    // Failure surfaces from the service.
    if (result.status === 'MISSING_REQUIRED_PROFILE') {
      return res.status(400).json({ ok: false, error: 'Missing required profile', status: result.status, missing: result.missing });
    }
    if (result.status === 'IDENTITY_CONFLICT') {
      return res.status(409).json({ ok: false, error: 'Identity conflict', status: result.status });
    }
    if (result.status === 'LOYALTY_STORE_FAILED') {
      return res.status(500).json({ ok: false, error: 'Could not complete your membership — please try again', code: 'PRESTIGE_JOIN_LOYALTY_FAILED' });
    }
    if (result.status === 'PRIVILEGE_STORE_FAILED') {
      return res.status(500).json({ ok: false, error: 'Could not complete your membership — please try again', code: 'PRESTIGE_JOIN_FAILED' });
    }
    return res.status(500).json({ ok: false, error: 'Unknown enrollment outcome' });
  } catch (err: any) {
    logger.error('[PrestigeJoin] Unhandled error', { error: err?.message });
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

export default router;
