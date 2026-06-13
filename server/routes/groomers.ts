/**
 * PUBLIC GROOMER PROFILE ROUTE
 * GET /api/groomers/:id — public groomer profile + visible reviews.
 *
 * Groomers are not a separate table: a groomer is a `trainers` row whose
 * serviceTypes array contains 'grooming' (same model searchGroomers uses).
 * This endpoint powers client/src/pages/groomers/GroomerDetail.tsx.
 *
 * Approval gate (mirrors searchGroomers): only an ACTIVE, APPROVED, non-
 * suspended grooming provider is returned — otherwise 404, so the page never
 * renders an unvetted or suspended provider.
 *
 * Privacy: this is a PUBLIC page, so it deliberately does NOT expose email,
 * phone, ID documents, or certification-document URLs. The public trust
 * signals are isVerified / isCertified; contact happens via the in-app inbox
 * and booking flow, never raw PII.
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { trainers, contractorReviews } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(404).json({ error: 'Groomer not found' });

    const [t] = await db
      .select()
      .from(trainers)
      .where(
        and(
          eq(trainers.id, id),
          eq(trainers.isActive, true),
          eq(trainers.verificationStatus, 'approved'),
          eq(trainers.isSuspended, false),
          sql`'grooming' = ANY(${trainers.serviceTypes})`,
        ),
      )
      .limit(1);

    if (!t) return res.status(404).json({ error: 'Groomer not found' });

    const hourly = t.hourlyRate ? Math.round(parseFloat(t.hourlyRate)) : 0;
    const serviceTypes: string[] = Array.isArray(t.serviceTypes) ? t.serviceTypes : [];

    // Map a trainer row → the Groomer shape GroomerDetail.tsx expects. Only
    // real columns are mapped; fields with no backing column (salon name/photos,
    // accepts* flags) are omitted/empty so the page shows honest fallbacks
    // rather than invented data.
    const groomer = {
      id: t.id,
      userId: t.userId,
      fullName: `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Groomer',
      email: '',                     // PII — not exposed on a public page
      phone: '',                     // PII — contact via in-app inbox/booking
      city: t.serviceArea || '',
      salonName: '',                 // no backing column
      salonAddress: '',              // no backing column
      bio: t.bio || '',
      specialties: t.specialties || [],
      certifications: [],            // cert-document URLs are private; isCertified is the public signal
      yearsOfExperience: t.yearsOfExperience || 0,
      priceRangeMin: hourly,
      priceRangeMax: hourly,
      hasMobileService: serviceTypes.includes('in_home'),
      profilePhotoUrl: t.profilePhotoUrl || null,
      salonPhotos: [] as string[],
      rating: t.averageRating || '0',
      totalGroomings: t.totalSessions || 0,
      isActive: t.isActive,
      isVerified: t.verificationStatus === 'approved',
      isCertified: t.isCertified,
    };

    // Reviews from the unified contractorReviews table (same source as the
    // academy trainer profile): owner→contractor, visible only.
    const reviewRows = await db
      .select()
      .from(contractorReviews)
      .where(
        and(
          eq(contractorReviews.subjectId, t.userId),
          eq(contractorReviews.reviewType, 'owner_to_contractor'),
          eq(contractorReviews.isVisible, true),
        ),
      )
      .orderBy(desc(contractorReviews.createdAt))
      .limit(20);

    const reviews = reviewRows.map((r) => ({
      id: r.id,
      customerName: r.reviewerName || 'Customer',
      rating: r.overallRating || 0,
      comment: r.reviewText || '',
      createdAt: r.createdAt,
    }));

    res.json({ groomer, reviews });
  } catch (err: any) {
    logger.error('[Groomers] profile fetch failed', { err: err?.message });
    res.status(500).json({ error: 'Failed to load groomer' });
  }
});

export default router;
