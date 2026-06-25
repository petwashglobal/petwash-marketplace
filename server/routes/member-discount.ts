/**
 * Member Wash Discount — self-read + senior/disability APPLICATION.
 * Mounted at /api/member.
 *
 *   GET  /api/member/wash-discount              → the CALLER's own resolved
 *        K9000 wash discount (server-authoritative). Read-only; never any
 *        document / ID data.
 *
 *   POST /api/member/wash-discount/apply        → submit a senior (65+) or
 *        disability discount application. OPTIONAL flow — manually reviewed by
 *        support@petwash.co.il. ID/passport number is ENCRYPTED at rest and
 *        only a MASKED value is emailed to support (spec §3, §9, §10).
 *
 *   GET  /api/member/wash-discount/application  → the CALLER's latest
 *        application status (masked — never returns the stored ID number).
 *
 * The APPROVED discount itself lives in member_wash_discounts (the price engine
 * reads that); this application table holds only the request + lifecycle.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { resolveWashDiscount } from '../services/memberDiscount';
import { db } from '../db';
import { memberDiscountApplications } from '../../shared/schema';
import { encryptField } from '../services/secretFieldCrypto';
import { EmailService } from '../emailService';
import { logAuditEvent } from '../middleware/auditLog';
import { logger } from '../lib/logger';

const router = Router();

const SUPPORT_EMAIL = 'support@petwash.co.il';
const DECLARATION_VERSION = 'discount-declaration-2026-06-25';

/** Mask an ID/passport so only the last 4 chars survive (e.g. •••••1234). */
function maskId(value: string): string {
  const v = String(value || '').trim();
  if (v.length <= 4) return '••••';
  return '•'.repeat(Math.max(4, v.length - 4)) + v.slice(-4);
}

/** Whole years between a DOB and now. */
function ageFrom(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

// GET /api/member/wash-discount — caller's resolved discount (read-only).
router.get('/wash-discount', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });

  const d = await resolveWashDiscount(uid);
  return res.json({
    ok: true,
    percent: d.percent,
    source: d.source,
    prestigeBasic: d.prestigeBasic,
    approved: d.approved,
  });
});

// Application input. ID number / disability ref are accepted but NEVER returned
// or logged in plaintext — they are encrypted before persistence.
const applySchema = z.object({
  discountType: z.enum(['senior', 'disability']),
  dateOfBirth: z.string().min(4).max(40), // ISO date
  idType: z.enum(['national_id', 'passport']),
  idNumber: z.string().trim().min(3).max(64),
  idCountry: z.string().trim().min(2).max(64),
  idIssueDate: z.string().max(40).optional(),
  // Disability-only (optional)
  disabilityRef: z.string().trim().max(64).optional(),
  disabilityIssueDate: z.string().max(40).optional(),
  disabilityExpiryDate: z.string().max(40).optional(),
  issuingAuthority: z.string().trim().max(160).optional(),
  // Truth declaration — must be explicitly accepted (spec §3).
  declarationAccepted: z.literal(true),
});

// POST /api/member/wash-discount/apply
router.post('/wash-discount/apply', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  const email = req.firebaseUser?.email || null;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });

  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const b = parsed.data;

  const dob = new Date(b.dateOfBirth);
  if (isNaN(dob.getTime())) return res.status(400).json({ error: 'invalid_date_of_birth' });

  // Senior eligibility is server-enforced: must be 65+ (spec §3).
  if (b.discountType === 'senior' && ageFrom(dob) < 65) {
    return res.status(400).json({ error: 'senior_requires_age_65_plus' });
  }

  const parseDate = (s?: string): Date | null => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  try {
    // One open application per (user, type): supersede any prior non-approved
    // row so a member can re-apply after a rejection / needs-more-info.
    const existing = await db
      .select({ id: memberDiscountApplications.id, status: memberDiscountApplications.status })
      .from(memberDiscountApplications)
      .where(
        and(
          eq(memberDiscountApplications.userId, uid),
          eq(memberDiscountApplications.discountType, b.discountType),
        ),
      )
      .orderBy(desc(memberDiscountApplications.id))
      .limit(1);

    if (existing.length && existing[0].status === 'approved') {
      return res.status(409).json({ error: 'already_approved' });
    }

    const now = new Date();
    const values = {
      userId: uid,
      discountType: b.discountType,
      status: 'pending_review' as const,
      dateOfBirth: dob,
      idType: b.idType,
      idNumberEnc: encryptField(b.idNumber),
      idCountry: b.idCountry,
      idIssueDate: parseDate(b.idIssueDate),
      disabilityRefEnc: b.disabilityRef ? encryptField(b.disabilityRef) : null,
      disabilityIssueDate: parseDate(b.disabilityIssueDate),
      disabilityExpiryDate: parseDate(b.disabilityExpiryDate),
      issuingAuthority: b.issuingAuthority ?? null,
      declarationSignedAt: now,
      declarationVersion: DECLARATION_VERSION,
      submittedAt: now,
      updatedAt: now,
    };

    let appId: number;
    if (existing.length) {
      const [row] = await db
        .update(memberDiscountApplications)
        .set(values)
        .where(eq(memberDiscountApplications.id, existing[0].id))
        .returning({ id: memberDiscountApplications.id });
      appId = row.id;
    } else {
      const [row] = await db
        .insert(memberDiscountApplications)
        .values(values)
        .returning({ id: memberDiscountApplications.id });
      appId = row.id;
    }

    // Notify support — MASKED ID only, never the full number (spec §9).
    const adminBase = process.env.APP_PUBLIC_URL || 'https://petwash.co.il';
    const reviewLink = `${adminBase}/admin/member-discounts?application=${appId}`;
    const subject = 'New PetWash discount application pending review';
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:560px">
        <h2 style="color:#8A6A1B;margin:0 0 12px">New discount application — pending review</h2>
        <table style="font-size:14px;border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Application&nbsp;ID</td><td><b>#${appId}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Type</td><td>${b.discountType}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">User&nbsp;ID</td><td>${uid}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td>${email ?? '—'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">${b.idType}</td><td>${maskId(b.idNumber)} (${b.idCountry})</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Submitted</td><td>${now.toISOString()}</td></tr>
        </table>
        <p style="margin:16px 0">
          <a href="${reviewLink}" style="background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">
            Review in secure admin
          </a>
        </p>
        <p style="font-size:12px;color:#999">
          The full ID/passport number is NOT included in this email. View it only inside secure admin
          (every reveal is audit-logged). Approve at most 10% — K9000 washes only.
        </p>
      </div>`;
    EmailService.sendEmail(SUPPORT_EMAIL, subject, html).catch((e) =>
      logger.error('[MemberDiscountApply] support email failed', { appId, err: e?.message }),
    );

    // Audit — record the submission WITHOUT the sensitive number.
    await logAuditEvent({
      actorUserId: uid,
      actorRole: 'customer',
      actionType: 'MEMBER_DISCOUNT_APPLICATION_SUBMIT',
      targetType: 'member_discount_application',
      targetId: String(appId),
      ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0],
      userAgent: req.headers['user-agent'],
      metadata: { discountType: b.discountType, idType: b.idType, idCountry: b.idCountry, idMasked: maskId(b.idNumber) },
      severity: 'info',
    });

    return res.json({ ok: true, id: appId, status: 'pending_review' });
  } catch (err: any) {
    logger.error('[MemberDiscountApply] failed', { uid, err: err?.message });
    return res.status(500).json({ error: 'application_failed' });
  }
});

// GET /api/member/wash-discount/application — caller's latest status (masked).
router.get('/wash-discount/application', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });

  try {
    const rows = await db
      .select()
      .from(memberDiscountApplications)
      .where(eq(memberDiscountApplications.userId, uid))
      .orderBy(desc(memberDiscountApplications.id))
      .limit(5);

    // Never leak the encrypted ID. Return only safe lifecycle fields.
    const applications = rows.map((r) => ({
      id: r.id,
      discountType: r.discountType,
      status: r.status,
      idType: r.idType,
      idCountry: r.idCountry,
      approvedPercent: r.approvedPercent,
      reviewNote: r.status === 'needs_more_info' ? r.reviewNote : null,
      submittedAt: r.submittedAt,
      reviewedAt: r.reviewedAt,
    }));

    return res.json({ ok: true, applications });
  } catch (err: any) {
    logger.error('[MemberDiscountApplication] list failed', { uid, err: err?.message });
    return res.status(500).json({ error: 'application_list_failed' });
  }
});

export default router;
