import { Router } from 'express';
import { randomInt, randomBytes } from 'crypto';
import { db, pool } from '../db';
import { 
  walkerProfiles, 
  walkBookings, 
  walkGpsTracking,
  walkHealthData,
  walkBlockchainAudit,
  walkerReviews,
  walkAlerts,
  walkVideos,
  users,
  octopusBookings,
  octopusLedger,
  octopusInvoices,
  bookingRequests,
  providerApprovalQueue,
  walkSlotHolds,
  type InsertWalkerProfile,
  type InsertWalkBooking,
  type InsertWalkGpsTracking,
  type InsertWalkerReview
} from '../../shared/schema';
import { formatUserAddress, bookingSnapshotToAddress } from '../../shared/formatAddress';
import { projectPublicWalker } from '@shared/lib/publicWalkerProfile';
import { eq, and, gte, lte, lt, sql, desc, asc, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { requireLoyaltyMember } from '../middleware/loyalty';
import { requireAuth } from '../customAuth';
import { isSuperAdminVerified } from '../middleware/rbac';
import { checkBookingProximity } from '../lib/proximity';
import { bookingLimiter } from '../middleware/rateLimiter';
import { calculateDistance } from '../services/location/MapsService';
import { buildAllNavigationLinks } from '../utils/navigation';
import { walkEliteBookingEngine } from '../services/booking-engines/walk/WalkEliteBookingEngine';
import { acquireSlotLock, releaseSlotLock, BookingSlotConflictError } from '../lib/marketplaceSlotLock';
import { calendarIntegrationService } from '../services/CalendarIntegrationService';
import { IsraeliDigitalReceiptService } from '../services/IsraeliDigitalReceiptService';
import VATCalculatorService from '../services/VATCalculatorService';
import { logger } from '../lib/logger';
import { syncChatToBookingStatus, checkCancellationWindow } from '../lib/booking-chat-sync';
import { backupFinancialDocument } from '../services/gcsBackupService';
import { verifyCaptchaToken } from '../lib/verifyCaptcha';
import { verifyTurnstileToken } from '../lib/verifyTurnstile';
import { dispatchNotifications, buildBookingCancelledSms } from '../services/PetWashNotificationEngine';
import { assertOperatingControl } from '../lib/petwashOperatingControlGateway';

const router = Router();

// Booking grace period: allow bookings up to 5 minutes in the past to handle
// clock skew between client and server (same constant used in sitter-suite.ts).
const BOOKING_GRACE_PERIOD_MS = 5 * 60 * 1000;

// =================== WALKER REGISTRATION & PROFILES ===================

// Strict allowlist for walker self-registration. Server-controlled fields
// (verificationStatus, ratings, banking, commission, biometric scores, etc.)
// are NEVER accepted from the client — they are set server-side below.
const walkerRegisterBodySchema = z.object({
  captchaToken: z.string().optional(),
  turnstileToken: z.string().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  displayName: z.string().max(120).optional(),
  profilePhotoUrl: z.string().url().max(500).optional(),
  bio: z.string().max(2000).optional(),
  city: z.string().min(1).max(120),
  country: z.string().min(2).max(8).default('IL'),
  serviceRadiusKm: z.number().int().min(0).max(200).optional(),
  yearsOfExperience: z.number().int().min(0).max(80).optional(),
  specializations: z.array(z.string().max(60)).max(20).optional(),
  certifications: z.array(z.string().max(80)).max(20).optional(),
  hasBodyCamera: z.boolean().optional(),
  hasDroneAccess: z.boolean().optional(),
  hasFirstAidKit: z.boolean().optional(),
  hasCarTransport: z.boolean().optional(),
  baseHourlyRate: z.union([z.number(), z.string()]),
  minimumMinutes: z.number().int().min(5).max(480).optional(),
  currency: z.enum(['ILS', 'USD', 'GBP', 'AUD', 'CAD']).optional(),
  walkPackages: z.array(z.any()).max(20).optional(),
  extraServices: z.array(z.any()).max(20).optional(),
  maxDailyWalks: z.number().int().min(0).max(50).optional(),
}).strict();

// Create walker profile (first step of registration)
router.post('/walkers/register', requireAuth, async (req, res) => {
  try {
    // Always derive userId from the verified Firebase token — never trust req.body.
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parsed = walkerRegisterBodySchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn('[Walk My Pet] Walker registration rejected — invalid body', {
        userId,
        issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code })),
      });
      return res.status(400).json({
        error: 'Invalid registration data',
        errorCode: 'INVALID_BODY',
        issues: parsed.error.issues,
      });
    }
    const { captchaToken, turnstileToken: walkerTurnstileToken, ...safeBody } = parsed.data;
    if (!captchaToken) {
      logger.warn('[Walk My Pet] Walker registration rejected — missing captchaToken', { userId });
      return res.status(400).json({ error: 'Security verification token required. Please refresh and try again.', errorCode: 'CAPTCHA_REQUIRED' });
    }
    const captchaResult = await verifyCaptchaToken(captchaToken, 'provider_register');
    if (!captchaResult.valid) {
      logger.warn('[Walk My Pet] Walker registration blocked by reCAPTCHA', { reason: captchaResult.reason, score: captchaResult.score, userId });
      return res.status(400).json({ error: 'Security check failed. Please refresh and try again.', reason: captchaResult.reason });
    }
    if (captchaResult.suspicious) {
      if (walkerTurnstileToken) {
        const tip = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;
        const tsResult = await verifyTurnstileToken(walkerTurnstileToken, tip);
        if (!tsResult.valid) {
          logger.warn('[Walk My Pet] Turnstile fallback rejected', { reason: tsResult.reason, score: captchaResult.score, userId });
          return res.status(400).json({ error: 'Additional verification required.', errorCode: 'STEP_UP_REQUIRED', score: captchaResult.score });
        }
        logger.info('[Walk My Pet] Turnstile fallback accepted — suspicious reCAPTCHA score bypassed', { score: captchaResult.score, userId });
      } else {
        logger.warn('[Walk My Pet] Suspicious traffic on walker registration — step-up required', { score: captchaResult.score, userId });
        return res.status(400).json({ error: 'Additional verification required.', errorCode: 'STEP_UP_REQUIRED', score: captchaResult.score });
      }
    }

    const walkerData: InsertWalkerProfile = {
      ...safeBody,
      baseHourlyRate: String(safeBody.baseHourlyRate),
      userId,
      walkerId: `WALKER-${crypto.randomUUID()}`,
      verificationStatus: 'pending',
      kycCompleted: false,
      backgroundCheckStatus: 'pending',
      averageRating: '0',
      totalWalks: 0,
      totalReviews: 0,
      acceptanceRate: '0',
      isAvailable: false, // Not available until verified
      isActive: true,
      bankAccountVerified: false,
      commissionRate: '15.00',
    };

    const [newWalker] = await db.insert(walkerProfiles).values(walkerData).returning();

    // Add to admin approval queue so staff can review the application
    try {
      await db.insert(providerApprovalQueue).values({
        providerId: newWalker.walkerId,
        platform: 'walk_my_pet',
        status: 'pending',
        priority: 'normal',
      });
    } catch (queueErr) {
      logger.warn('[Walk My Pet] Could not add to approval queue (non-fatal):', { err: (queueErr as any)?.message });
    }
    
    res.status(201).json({ 
      success: true, 
      walker: newWalker,
      message: 'Walker profile created. Please complete KYC verification to activate.' 
    });
  } catch (error: any) {
    console.error('[Walk My Pet] Walker registration error:', error);
    res.status(500).json({ error: 'Failed to create walker profile', details: error.message });
  }
});

/**
 * PATCH /api/walk-my-pet/walkers/location - Update walker's live GPS location
 * Called by the walker dashboard to keep their position current for proximity matching
 */
router.patch('/walkers/location', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { latitude, longitude } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude (numbers) are required' });
    }

    const [updated] = await db
      .update(walkerProfiles)
      .set({ currentLatitude: latitude.toString(), currentLongitude: longitude.toString() })
      .where(eq(walkerProfiles.userId, userId))
      .returning({ walkerId: walkerProfiles.walkerId });

    if (!updated) {
      return res.status(404).json({ error: 'Walker profile not found' });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Walk My Pet] Error updating walker location:', error);
    return res.status(500).json({ error: 'Failed to update location' });
  }
});

// Get walker profile.
//
// P0-2 fix (2026-08-18): previously returned the RAW walker_profiles row,
// which mixes marketing display with KYC (kycCompleted, backgroundCheckStatus,
// selfiePhotoUrl, governmentIdUrl, biometricMatchScore), banking
// (bankAccountVerified, nayaxPayoutAccountId), commission (commissionRate),
// admin ops (suspensionReason, suspendedUntil, instantBookMinTrust,
// acceptanceRate), and the walker's Firebase UID (userId). This endpoint
// is UNAUTHENTICATED — any of that leaking is a real problem, and a new
// sensitive column added later would silently ship to the public.
//
// Now: project through the explicit PublicWalkerProfileDTO allowlist in
// shared/lib/publicWalkerProfile.ts. Unknown / sensitive fields cannot be
// exposed without an explicit addition to the DTO (which is reviewed).
router.get('/walkers/:walkerId', async (req, res) => {
  try {
    const { walkerId } = req.params;

    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, walkerId))
      .limit(1);

    if (!walker) {
      return res.status(404).json({ error: 'Walker not found' });
    }

    const dto = projectPublicWalker(walker);
    if (!dto) {
      // Row present but projector rejected it (shape unexpected) — treat
      // as not-found rather than surface a broken response.
      return res.status(404).json({ error: 'Walker not found' });
    }
    res.json({ walker: dto });
  } catch (error: any) {
    console.error('[Walk My Pet] Get walker error:', error);
    res.status(500).json({ error: 'Failed to fetch walker profile' });
  }
});

// Update walker profile
router.patch('/walkers/:walkerId', requireAuth, async (req, res) => {
  try {
    const { walkerId } = req.params;
    const userId = (req as any).user?.uid;

    // Verify ownership
    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, walkerId))
      .limit(1);

    if (!walker) {
      return res.status(404).json({ error: 'Walker not found' });
    }

    if (walker.userId !== userId && !(req as any).user?.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // SECURITY 2026-05-24 (CRITICAL fix from audit finding S4):
    //   Pre-fix: `.set({ ...req.body, updatedAt })` let an authenticated
    //   walker set ANY column on their own row including kycVerified,
    //   commissionRate, isVerified, rating, totalEarnings. Strip the
    //   privileged columns before the update runs.
    const DENY = new Set([
      'kycVerified', 'isVerified', 'verified', 'featured', 'approved',
      'status', 'userStatus', 'accountStatus', 'role',
      'rating', 'ratingCount', 'averageRating', 'reviewCount',
      'commission_rate', 'commissionRate', 'platformFee', 'platformFeePercent',
      'balance', 'walletBalance', 'earnings', 'totalEarnings', 'lifetimeEarnings',
      'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'adminNotes', 'internalNotes',
      'userId', 'uid', 'firebaseUid', 'id', 'walkerId',
    ]);
    const safeUpdates: Record<string, unknown> = {};
    const stripped: string[] = [];
    for (const [k, v] of Object.entries(req.body || {})) {
      if (DENY.has(k)) { stripped.push(k); continue; }
      safeUpdates[k] = v;
    }
    if (stripped.length > 0) {
      console.warn('[Walk My Pet] Stripped privileged fields from self-update',
        { walkerId, userId, stripped });
    }

    const [updatedWalker] = await db
      .update(walkerProfiles)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(walkerProfiles.walkerId, walkerId))
      .returning();

    res.json({ success: true, walker: updatedWalker });
  } catch (error: any) {
    console.error('[Walk My Pet] Update walker error:', error);
    res.status(500).json({ error: 'Failed to update walker profile' });
  }
});

// GET /walkers/search — Returns all active, verified walkers for client-side filtering (used by WalkMyPet listing page)
router.get('/walkers/search', async (req, res) => {
  try {
    const city = (req.query.city as string) || '';
    const walkers = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.isActive, true))
      .orderBy(desc(walkerProfiles.averageRating))
      .limit(200);

    // DTO round 1 (2026-08-22): previously `walkers.map(w => ({...w, ...}))`
    // spread the FULL row on an UNAUTHENTICATED endpoint — leaking every
    // walker's email, phone, kycVerified, governmentIdUrl, biometricMatchScore,
    // bankAccountVerified, nayaxPayoutAccountId, commissionRate, adminNotes,
    // internalNotes to any anonymous visitor. Uses the existing
    // `projectPublicWalker` helper (already used at line 234 for /walkers/:id)
    // so the surface stays a single audited allowlist. filter(Boolean) drops
    // any row that fails projection.
    const mapped = walkers
      .map(w => projectPublicWalker(w))
      .filter((w): w is NonNullable<typeof w> => w !== null);

    const filtered = city
      ? mapped.filter(w => (w.city || '').toLowerCase().includes(city.toLowerCase()))
      : mapped;
    res.json(filtered);
  } catch (error: any) {
    logger.error('[Walk My Pet] GET walkers/search error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch walkers' });
  }
});

// Search walkers by location (geolocation)
router.post('/walkers/search', async (req, res) => {
  try {
    const { latitude, longitude, radiusKm = 5, minRating = 0, hasBodyCamera, hasDroneAccess } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    // Calculate bounding box for efficient search
    // 1 degree latitude ≈ 111km, longitude varies by latitude
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    let query = db
      .select()
      .from(walkerProfiles)
      .where(
        and(
          eq(walkerProfiles.verificationStatus, 'verified'),
          eq(walkerProfiles.isAvailable, true),
          eq(walkerProfiles.isActive, true),
          gte(walkerProfiles.averageRating, minRating.toString()),
          // Bounding box filter
          gte(walkerProfiles.currentLatitude, (latitude - latDelta).toString()),
          lte(walkerProfiles.currentLatitude, (latitude + latDelta).toString()),
          gte(walkerProfiles.currentLongitude, (longitude - lonDelta).toString()),
          lte(walkerProfiles.currentLongitude, (longitude + lonDelta).toString())
        )
      );

    const walkers = await query;

    // DTO round 1 (2026-08-22): same as the GET /walkers/search fix above —
    // this UNAUTHENTICATED geo-search previously spread `...walker` on every
    // result, echoing KYC + banking + live GPS back to the anonymous caller.
    // Now: compute distance/eligibility on the raw row (server-side), then
    // project to the public DTO before echoing. Live currentLatitude /
    // currentLongitude are consumed server-side and DELIBERATELY dropped
    // from the response — the DTO carries neither.
    const walkersWithDistance = walkers
      .map(walker => {
        const walkerLat = parseFloat(walker.currentLatitude || '0');
        const walkerLon = parseFloat(walker.currentLongitude || '0');
        const distance = calculateDistance(latitude, longitude, walkerLat, walkerLon);
        const dto = projectPublicWalker(walker);
        return dto ? { ...dto, distanceKm: distance, hasBodyCamera: walker.hasBodyCamera === true, hasDroneAccess: walker.hasDroneAccess === true } : null;
      })
      .filter((w): w is NonNullable<typeof w> => w !== null)
      .filter(w => w.distanceKm <= radiusKm)
      .filter(w => !hasBodyCamera || w.hasBodyCamera)
      .filter(w => !hasDroneAccess || w.hasDroneAccess)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ 
      success: true, 
      walkers: walkersWithDistance,
      count: walkersWithDistance.length
    });
  } catch (error: any) {
    console.error('[Walk My Pet] Search walkers error:', error);
    res.status(500).json({ error: 'Failed to search walkers' });
  }
});

// =================== WALK BOOKING ===================

// Create walk booking - USING LUXURY ENGINE
// LAW & ORDER (CEO 2026-07-31): members-only — requireLoyaltyMember was a dead import.
router.post('/walks/book', requireAuth, requireLoyaltyMember, async (req, res) => {
  // Hoisted so the outer catch can free the persistent slot lock on failure.
  let slotLockRef: string | null = null;
  try {
    // Always derive ownerId from the verified Firebase token — never trust req.body.
    const ownerId = (req as any).user?.uid;
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { 
      walkerId, 
      scheduledDate, 
      scheduledStartTime, 
      durationMinutes,
      pickupLatitude,
      pickupLongitude,
      pickupAddress,
      petName,
      petBreed,
      petWeight,
      petSpecialNeeds
    } = req.body;

    // Validate required fields
    if (!walkerId || !scheduledDate || !scheduledStartTime || !durationMinutes || 
        !pickupLatitude || !pickupLongitude || !pickupAddress) {
      return res.status(400).json({ error: 'Missing required booking information' });
    }

    // Validate duration is a positive number
    const durationNum = Number(durationMinutes);
    if (!Number.isFinite(durationNum) || durationNum <= 0) {
      return res.status(400).json({ error: 'durationMinutes must be a positive number' });
    }

    // Parse dates for luxury engine
    const startDateTime = new Date(`${scheduledDate}T${scheduledStartTime}`);
    if (isNaN(startDateTime.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledDate or scheduledStartTime' });
    }
    // Reject bookings for past dates/times (use a small grace window of 5 minutes)
    if (startDateTime.getTime() < Date.now() - BOOKING_GRACE_PERIOD_MS) {
      return res.status(400).json({ error: 'Scheduled walk must be in the future' });
    }
    const endDateTime = new Date(startDateTime.getTime() + durationNum * 60000);
    const scheduledDateOnly = new Date(scheduledDate); // Keep day-only for queries

    // Verify walker exists, is active and verified before booking
    const [walkerProfile] = await db
      .select({
        walkerId: walkerProfiles.walkerId,
        // userId + id: needed to mirror the booking into booking_requests so the
        // provider job inbox can see it (booking bridge, 2026-07-24).
        userId: walkerProfiles.userId,
        profileId: walkerProfiles.id,
        isActive: walkerProfiles.isActive,
        verificationStatus: walkerProfiles.verificationStatus,
        currentLatitude: walkerProfiles.currentLatitude,
        currentLongitude: walkerProfiles.currentLongitude,
        serviceRadiusKm: walkerProfiles.serviceRadiusKm,
      })
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, walkerId))
      .limit(1);
    if (!walkerProfile) {
      return res.status(404).json({ error: 'Walker not found' });
    }
    if (!walkerProfile.isActive) {
      return res.status(400).json({ error: 'Walker is not currently active' });
    }
    if (walkerProfile.verificationStatus !== 'verified') {
      return res.status(400).json({ error: 'Walker is not verified and cannot accept bookings' });
    }

    // Enforce the walker's SERVICE AREA. Was a hardcoded distanceKm=5 that never
    // actually checked pickup vs the walker — out-of-range walks could be booked.
    // checkBookingProximity fails OPEN on missing coords (won't block coord-less
    // bookings) and is env-toggleable (BOOKING_PROXIMITY_ENFORCED).
    const proximity = checkBookingProximity({
      customerLat: pickupLatitude,
      customerLng: pickupLongitude,
      providerLat: walkerProfile.currentLatitude,
      providerLng: walkerProfile.currentLongitude,
      maxKm: walkerProfile.serviceRadiusKm,
    });
    if (!proximity.ok) {
      return res.status(422).json({
        error: 'OUT_OF_RANGE',
        message: `This walker serves up to ${proximity.maxKm}km; the pickup is about ${Math.round(proximity.distanceKm)}km away.`,
      });
    }
    // Store the REAL distance when we could compute it, else the local default.
    const distanceKm = proximity.distanceKm ?? 5;

    // STEP 1: Check availability using LUXURY ENGINE
    const availability = await walkEliteBookingEngine.checkAvailability({
      providerId: walkerId,
      serviceType: 'dog_walk',
      startDate: startDateTime,
      endDate: endDateTime,
      metadata: { 
        petName, 
        petBreed, 
        pickupAddress,
        pickupLatitude,
        pickupLongitude,
        distanceKm
      }
    });

    if (!availability.available) {
      return res.status(400).json({ error: availability.message });
    }

    // SLOT HOLD: prevent double-booking race between availability check and INSERT.
    // ── ATOMIC (booking-hardening 2026-06-20) ─────────────────────────────────
    // The hold is acquired via INSERT ... ON CONFLICT DO NOTHING against the
    // UNIQUE (walker_id, slot_id) constraint (migration 0059). "No row inserted"
    // means another concurrent booking already holds this exact slot → 409.
    // This removes the read-check-insert race the old SELECT-then-INSERT had.
    const now = new Date();
    // Purge expired holds (lazy cleanup) so a stale row never poisons the slot.
    await db.delete(walkSlotHolds).where(lt(walkSlotHolds.expiresAt, now));
    const holdId = `HOLD-${randomBytes(6).toString('hex').toUpperCase()}`;
    const slotKey = `${walkerId}-${scheduledDate}T${scheduledStartTime}`;
    const holdTtlMs = 5 * 60 * 1000; // 5-minute TTL to cover the booking transaction
    const holdExpiresAt = new Date(Date.now() + holdTtlMs);
    const insertedHold = await db.insert(walkSlotHolds).values({
      holdId,
      slotId: slotKey,
      walkerId,
      estimatedAmount: '0',
      expiresAt: holdExpiresAt,
    })
      .onConflictDoNothing({ target: [walkSlotHolds.walkerId, walkSlotHolds.slotId] })
      .returning({ id: walkSlotHolds.id });
    if (insertedHold.length === 0) {
      // Slot already held by a concurrent booking — fail closed (no double-hold).
      return res.status(409).json({ error: 'Walker slot is currently being booked. Please try again in a moment.' });
    }

    // STEP 2: Get pricing quote using LUXURY ENGINE (with loyalty discounts!)
    const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                     req.socket.remoteAddress || 
                     '127.0.0.1';

    const pricing = await walkEliteBookingEngine.quotePrice({
      providerId: walkerId,
      serviceType: 'dog_walk',
      startDate: startDateTime,
      endDate: endDateTime,
      userId: ownerId,
      ipAddress: clientIP,
      metadata: { 
        durationMinutes,
        pickupLatitude,
        pickupLongitude,
        distanceKm,
        petName,
        petBreed,
        petWeight,
        petSpecialNeeds
      }
    });

    // Generate bookingId
    const bookingId = `WALK-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // ON-DEMAND: Create booking in pending_provider status
    // Escrow and payment are NOT created until walker accepts
    const bookingData: InsertWalkBooking = {
      bookingId,
      ownerId,
      walkerId,
      scheduledDate: scheduledDateOnly,
      scheduledStartTime,
      durationMinutes,
      pickupLatitude: pickupLatitude.toString(),
      pickupLongitude: pickupLongitude.toString(),
      pickupAddress,
      geofenceRadiusMeters: 500,
      geofenceCenterLat: pickupLatitude.toString(),
      geofenceCenterLon: pickupLongitude.toString(),
      petName,
      petBreed,
      petWeight,
      petSpecialNeeds,
      walkerRate: pricing.baseRate.toFixed(2),
      platformFeeOwner: (pricing.platformFee * 0.25).toFixed(2),
      platformFeeSitter: (pricing.platformFee * 0.75).toFixed(2),
      totalCost: pricing.totalPrice.toFixed(2),
      walkerPayout: pricing.providerPayout.toFixed(2),
      currency: pricing.currency,
      status: 'pending_provider',
      confirmationCode: randomInt(100000, 1000000).toString(),
      isLiveTrackingActive: false,
      isVideoStreamActive: false,
      isDroneMonitoringActive: false,
      geofenceViolationCount: 0,
      emergencyStopTriggered: false,
      ownerNotified: false,
      // Legal source tag (booking-hardening 2026-06-20) — prove platform of origin.
      serviceSource: 'walk_my_pet',
    };

    // ── PERSISTENT DOUBLE-BOOKING GUARD (P1, 2026-07-25) ─────────────────────
    // The walkSlotHolds row above is a 5-minute TTL hold — it closes the instant
    // create-race, but it EXPIRES while the booking sits pending_provider for
    // much longer, and availability counts only 'confirmed'. So a second request
    // for the same walker+slot could slip in after the hold lapsed and end up as
    // a second pending walk; accepting both double-books. Add the same persistent,
    // DB-enforced slot lock the sitter/academy arms use (marketplace_booking_slot_
    // locks, EXCLUDE constraint) — it lives for the booking's whole life and is
    // keyed on the walker's canonical Firebase userId, so it also blocks a clash
    // with that person's sitter/marketplace bookings. Released on decline/cancel.
    const walkLockProviderId = walkerProfile.userId || `walker:${walkerId}`;
    try {
      await acquireSlotLock(db, {
        providerId: walkLockProviderId,
        startAt: startDateTime,
        endAt: endDateTime,
        bookingRef: bookingId,
        serviceType: 'dog_walking',
      });
      slotLockRef = bookingId;
    } catch (lockErr) {
      // Free the short-term hold we grabbed earlier so it doesn't linger.
      await db.delete(walkSlotHolds).where(eq(walkSlotHolds.holdId, holdId)).catch(() => {});
      if (lockErr instanceof BookingSlotConflictError) {
        return res.status(409).json({
          error: 'This walker is already booked for the selected time. Please choose another slot or walker.',
          errorCode: 'SLOT_TAKEN',
        });
      }
      throw lockErr;
    }

    const [newBooking] = await db.insert(walkBookings).values(bookingData).returning();

    // BRIDGE (2026-07-24): mirror into booking_requests so the provider job
    // inbox (/provider-os) can SEE and accept this walk. Without it the booking
    // hung at pending_provider forever — the only UI that reads walk_bookings
    // (WalkerDashboard.tsx) was never routed. Fail-soft.
    try {
      const { bridgeLegacyBooking } = await import('../services/legacyBookingBridge');
      const startAt = new Date(`${scheduledDateOnly}T${scheduledStartTime || '09:00'}:00`);
      const endAt = new Date(startAt.getTime() + (Number(durationMinutes) || 30) * 60000);
      await bridgeLegacyBooking({
        ownerId,
        providerUserId: walkerProfile.userId as string,
        providerProfileId: walkerProfile.profileId as number,
        providerType: 'walker',
        serviceType: 'dog_walking',
        startDate: isNaN(startAt.getTime()) ? new Date() : startAt,
        endDate: isNaN(endAt.getTime()) ? new Date(Date.now() + 30 * 60000) : endAt,
        petCount: 1,
        subtotalCents: Math.round(pricing.baseRate * 100),
        serviceFeeCents: Math.round(pricing.platformFee * 100),
        totalCents: Math.round(pricing.totalPrice * 100),
        providerPayoutCents: Math.round(pricing.providerPayout * 100),
        ownerMessage: null,
        legacyRef: { table: 'walk_bookings', id: bookingId },
      });
    } catch { /* bridge is best-effort */ }

    // Record in Octopus Brain ledger (financial audit trail)
    const octopusId = `OB-WALK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const priceCents = Math.round(pricing.totalPrice * 100);
    const platformFeeCents = Math.round(pricing.platformFee * 100);
    const providerShareCents = Math.round(pricing.providerPayout * 100);
    try {
      await db.insert(octopusBookings).values({
        id: octopusId,
        platform: 'walk_my_pet',
        status: 'DRAFT',
        userId: ownerId,
        providerId: walkerId,
        price: priceCents,
        platformFee: platformFeeCents,
        providerShare: providerShareCents,
        idempotencyKey: bookingId,
      });
      await db.insert(octopusLedger).values({
        id: `OL-${crypto.randomBytes(4).toString('hex')}`,
        type: 'BOOKING_CREATED',
        bookingId: octopusId,
        amount: priceCents,
        platform: 'walk_my_pet',
        metadata: { walkBookingId: bookingId, durationMinutes, ownerId, walkerId },
      });
      console.log(`[Octopus Brain] Walk booking recorded: ${octopusId} for ${bookingId}`);
    } catch (octopusErr) {
      console.warn('[Octopus Brain] Failed to record walk booking (non-blocking)', octopusErr);
    }

    // Create alert for walker (on-demand notification)
    await db.insert(walkAlerts).values({
      alertId: `ALERT-${crypto.randomUUID()}`,
      bookingId: newBooking.bookingId,
      alertType: 'new_booking',
      severity: 'info',
      title: 'בקשת טיול חדשה!',
      message: `יש לך בקשת טיול חדשה ל-${scheduledDate} בשעה ${scheduledStartTime}. אנא אשר/י באפליקציה.`,
      actionRequired: true,
      sentToWalker: true,
      isRead: false,
    });

    // Notify walker via SMS (fire-and-forget)
    (async () => {
      try {
        const [walker] = await db.select().from(walkerProfiles).where(eq(walkerProfiles.id, parseInt(walkerId)));
        if (walker?.userId) {
          const [walkerUser] = await db.select().from(users).where(eq(users.id, walker.userId));
          const walkerPhone = walkerUser?.phone || walkerUser?.phoneNumber;
          if (walkerPhone) {
            const { TwilioSMSService } = await import('../services/TwilioSMSService');
            const smsService = new TwilioSMSService();
            await smsService.sendSMS(
              walkerPhone,
              `🐾 ⁦PetWash™⁩ - בקשת טיול חדשה!\n` +
              `תאריך: ${scheduledDate} בשעה ${scheduledStartTime}\n` +
              `${durationMinutes} דקות · ₪${pricing.totalPrice.toFixed(0)}\n` +
              `אנא אשר/י את ההזמנה באפליקציה.`
            );
          }
        }
      } catch (notifErr) {
        console.warn('[Walk My Pet] Walker notification failed (non-blocking)', notifErr);
      }
    })();

    // Generate navigation links for pickup location
    const navigationLinks = buildAllNavigationLinks({
      lat: parseFloat(pickupLatitude),
      lng: parseFloat(pickupLongitude),
      label: `Walk Pickup: ${petName}`,
    });

    res.status(201).json({ 
      success: true, 
      booking: newBooking,
      status: 'pending_provider',
      navigation: navigationLinks,
      message: 'הבקשה נשלחה למטייל/ת. תקבל/י עדכון כשההזמנה תאושר.'
    });
  } catch (error: any) {
    // Free the persistent slot lock if we grabbed it but the booking failed,
    // so a failed attempt never leaves the walker's calendar blocked (P1 fix).
    if (slotLockRef) {
      await releaseSlotLock(db, slotLockRef).catch((relErr) =>
        console.warn('[Walk My Pet] slot-lock release after failed booking skipped', relErr),
      );
    }
    console.error('[Walk My Pet] Booking error:', error);
    res.status(500).json({ error: 'Failed to create booking', details: error.message });
  }
});

/**
 * POST /api/walk-my-pet/bookings/:bookingId/cancel — CUSTOMER cancel.
 * MONEY-SAFE: only BEFORE a walker accepts (status pending_provider). Cancels BOTH
 * the customer row and the bridged provider-inbox row. Walk had no customer-cancel
 * route at all. A confirmed booking → contact support. (2026-07-31)
 */
router.post('/bookings/:bookingId/cancel', requireAuth, requireLoyaltyMember, async (req, res) => {
  try {
    const ownerId = (req as any).user?.uid;
    const { bookingId } = req.params;
    const [booking] = await db.select().from(walkBookings).where(eq(walkBookings.bookingId, bookingId)).limit(1);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.ownerId !== ownerId) return res.status(403).json({ error: 'Access denied' });
    if (String(booking.status) !== 'pending_provider') {
      return res.status(400).json({ error: 'CONFIRMED_BOOKING', message: 'This walk is already accepted. Please contact PetWash support to cancel it.' });
    }
    await db.update(walkBookings).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(walkBookings.bookingId, bookingId));
    await releaseSlotLock(db, bookingId).catch(() => {});
    try {
      await pool.query(
        `UPDATE booking_requests SET status = 'cancelled', updated_at = NOW()
         WHERE quote_breakdown->'legacyRef'->>'id' = $1 AND status = 'pending'`,
        [bookingId],
      );
    } catch (e: any) { logger.warn('[Walk My Pet] cancel bridge-sync failed', { error: e?.message }); }
    logger.info('[Walk My Pet] customer cancelled pending walk', { bookingId, ownerId });
    return res.json({ success: true, status: 'cancelled' });
  } catch (e: any) {
    logger.error('[Walk My Pet] customer cancel error', e);
    return res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * PATCH /api/walk-my-pet/bookings/:bookingId/provider-respond
 * on-demand: Walker accepts or declines a walk request
 */
router.patch('/bookings/:bookingId/provider-respond', requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { action, declineReason } = req.body;
    const providerUid = (req as any).user?.uid;
    
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or decline' });
    }

    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId));
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.status !== 'pending_provider') {
      return res.status(400).json({ error: `Booking is already ${booking.status}` });
    }

    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, booking.walkerId));
    
    if (!walker || walker.userId !== providerUid) {
      return res.status(403).json({ error: 'Only the assigned walker can respond' });
    }
    
    if (action === 'accept') {
      // Confirm booking with luxury engine (escrow + audit trail)
      try {
        const pricing = {
          subtotal: parseFloat(booking.walkerRate || '0'),
          platformFee: parseFloat(booking.platformFeeOwner || '0') + parseFloat(booking.platformFeeSitter || '0'),
          providerPayout: parseFloat(booking.walkerPayout || '0'),
          totalPrice: parseFloat(booking.totalCost || '0'),
          loyaltyDiscount: 0,
          currency: booking.currency || 'ILS',
          breakdown: [],
          baseRate: parseFloat(booking.walkerRate || '0'),
        };

        await walkEliteBookingEngine.confirmBooking(
          booking.bookingId,
          pricing,
          booking.ownerId,
          walker.userId
        );
      } catch (escrowErr: any) {
        // FAIL CLOSED: if the escrow hold can't be placed we must NOT confirm the
        // booking, write a PAYMENT_CAPTURED ledger, or issue an Israeli tax receipt —
        // doing so records a paid, confirmed walk with no money actually held (free
        // service + a real tax document). Stop here and surface the failure.
        logger.error('[Walk My Pet] Escrow confirmation FAILED — booking NOT confirmed', {
          bookingId, error: escrowErr?.message,
        });
        return res.status(502).json({
          success: false,
          error: 'Could not secure the payment hold for this booking. Please try again.',
          code: 'ESCROW_HOLD_FAILED',
        });
      }

      await db
        .update(walkBookings)
        .set({
          status: 'confirmed',
          updatedAt: new Date(),
        })
        .where(eq(walkBookings.bookingId, bookingId));
      
      await syncChatToBookingStatus(bookingId, 'confirmed', 'walk_my_pet');
      
      logger.info(`[Walk My Pet] Walker ACCEPTED booking ${bookingId}`);

      // Update Octopus Brain: DRAFT → CONFIRMED + payment captured ledger
      try {
        const [octopusRecord] = await db.select().from(octopusBookings)
          .where(eq(octopusBookings.idempotencyKey, booking.bookingId)).limit(1);
        if (octopusRecord) {
          await db.update(octopusBookings)
            .set({ status: 'CONFIRMED', updatedAt: new Date() })
            .where(eq(octopusBookings.id, octopusRecord.id));
          // NO PAYMENT_CAPTURED row here (2026-07-30 audit): confirmBooking →
          // moveToEscrow only writes a Firestore escrow DOC — no card charge, no
          // wallet debit, no payment rail is invoked anywhere on this path. A
          // capture ledger entry for money that never moved is a false book
          // entry. Restore it ONLY when a verified payment rail lands here.
          logger.info('[Octopus Brain] Walk booking confirmed (no payment captured on this rail)', { octopusId: octopusRecord.id });
        }
      } catch (octopusErr) {
        logger.warn('[Octopus Brain] Failed to update walk booking status (non-blocking)', octopusErr);
      }

      // NO fiscal receipt here (2026-07-30 audit): this accept path invokes NO
      // payment rail — confirmBooking/moveToEscrow only writes a Firestore
      // escrow doc, and the old call stamped 'Nayax Card Payment' on a real
      // SUMIT/ITA חשבונית מס-קבלה for money that was never collected. A tax
      // document may only be issued at a verified fiscal event (money-invariants
      // §2). When a real payment rail lands on this path, restore the receipt
      // AT THE CAPTURE EVENT with the actual transaction id.
      logger.error('[Walk My Pet] Booking accepted WITHOUT a payment rail — no money collected, no receipt issued. Wire this path to a verified payment before launch.', {
        bookingId: booking.bookingId,
        totalCost: booking.totalCost,
      });

      // Add calendar event (non-blocking)
      calendarIntegrationService.createBookingEvent({
        platform: 'walk-my-pet',
        bookingId: booking.bookingId,
        title: `⁦Walk My Pet™⁩ - Dog Walk (${booking.durationMinutes} min)`,
        description: `Dog walking booking confirmed for ${booking.durationMinutes} minutes`,
        startTime: new Date(booking.scheduledDate),
        endTime: new Date(new Date(booking.scheduledDate).getTime() + (booking.durationMinutes || 60) * 60000),
        providerName: walker.businessName || `Walker ${walker.walkerId}`,
      }).catch(() => {});

      // Backup financial records to Google Cloud Storage (non-blocking)
      (async () => {
        try {
          await backupFinancialDocument({
            documentType: 'escrow_record',
            bookingId: booking.bookingId,
            platform: 'walk_my_pet',
            content: JSON.stringify({
              bookingId: booking.bookingId,
              ownerId: booking.ownerId,
              walkerId: booking.walkerId,
              totalCost: booking.totalCost,
              walkerPayout: booking.walkerPayout,
              platformFeeOwner: booking.platformFeeOwner,
              platformFeeSitter: booking.platformFeeSitter,
              confirmedAt: new Date().toISOString(),
              escrowHoldHours: 72,
              durationMinutes: booking.durationMinutes,
            }, null, 2),
          });
        } catch (gcsErr) {
          logger.warn('[GCS] Walk financial backup failed (non-blocking)', gcsErr);
        }
      })();
      
      // NOTIFY THE CUSTOMER (2026-07-31 fix): the response claimed the customer was
      // notified, but this path sent NOTHING — the owner never learned their walk was
      // accepted and was never prompted to continue. Dispatch inbox+SMS+push. Fail-soft.
      try {
        const { dispatchNotification } = await import('../lib/notificationDispatcher');
        const { rows: ownerRows } = await pool.query('SELECT email, phone FROM users WHERE id = $1', [booking.ownerId]);
        const owner = ownerRows[0] || {};
        const base = process.env.APP_URL || 'https://petwash.co.il';
        await dispatchNotification({
          uid: booking.ownerId,
          email: owner.email ?? undefined,
          phone: owner.phone ?? undefined,
          type: 'booking_accepted',
          title: '✅ הטיול אושר!',
          bodyHtml: `<p>המטייל/ת אישר/ה את הטיול שלך ב-⁦Walk My Pet™⁩. אפשר לצפות בפרטים באזור ההזמנות שלך.</p>`,
          bodyText: 'הטיול שלך ב-Walk My Pet אושר! היכנס/י לאזור ההזמנות לפרטים.',
          ctaText: 'צפייה בהזמנות',
          ctaUrl: `${base}/my-bookings`,
          channels: ['inbox', 'sms', 'push'],
          priority: 8,
          meta: { bookingId: booking.bookingId },
        });
      } catch (notifErr: any) {
        logger.warn('[Walk My Pet] accept customer-notification failed (non-blocking)', { error: notifErr?.message });
      }

      res.json({
        success: true,
        status: 'confirmed',
        message: 'הטיול אושר! הלקוח/ה קיבל/ה הודעה.',
      });
    } else {
      await db
        .update(walkBookings)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(walkBookings.bookingId, bookingId));

      // Free the walker's calendar — the request is dead (P1 fix).
      await releaseSlotLock(db, bookingId).catch((relErr) =>
        logger.warn('[Walk My Pet] slot-lock release on decline skipped', { bookingId, error: String(relErr) }),
      );

      await syncChatToBookingStatus(bookingId, 'cancelled', 'walk_my_pet');

      // ── Accounting: write CANCELLATION to octopus_ledger ──────────────────
      // Payment has NOT been captured at decline time (capture happens on accept).
      // We still write a CANCELLATION entry for a complete audit trail.
      // The octopus_bookings row is found via idempotencyKey = bookingId.
      try {
        const [octopusRecord] = await db.select().from(octopusBookings)
          .where(eq(octopusBookings.idempotencyKey, bookingId)).limit(1);
        if (octopusRecord) {
          await db.update(octopusBookings)
            .set({ status: 'CANCELLED', updatedAt: new Date() })
            .where(eq(octopusBookings.id, octopusRecord.id));
          await db.insert(octopusLedger).values({
            id: `OL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
            type: 'CANCELLATION',
            bookingId: octopusRecord.id,
            amount: 0,
            platform: 'walk_my_pet',
            metadata: {
              reason: declineReason || 'Walker declined',
              cancelledBy: 'provider',
              cancelledAt: new Date().toISOString(),
            },
          });
        }
      } catch (octopusErr) {
        logger.warn('[Walk My Pet] Octopus cancellation ledger entry failed (non-blocking)', octopusErr);
      }

      // ── Void any stale receipts for this booking ───────────────────────────
      try {
        const existingReceipts = await IsraeliDigitalReceiptService.getReceiptByBookingId(bookingId);
        for (const r of existingReceipts) {
          if (!r.isVoided) {
            await IsraeliDigitalReceiptService.voidReceipt({
              receiptId: r.id,
              voidReason: `Walk declined by walker: ${declineReason || 'no reason given'}`,
            });
          }
        }
      } catch (voidErr) {
        logger.warn('[Walk My Pet] Receipt void on decline failed (non-blocking)', voidErr);
      }
      
      logger.info(`[Walk My Pet] Walker DECLINED booking ${bookingId}, reason: ${declineReason}`);
      
      res.json({
        success: true,
        status: 'declined',
        message: 'הטיול נדחה. הלקוח/ה יקבל/תקבל הודעה.',
      });
    }
  } catch (error: any) {
    console.error('[Walk My Pet] Provider respond error:', error);
    res.status(500).json({ error: 'Failed to process provider response' });
  }
});

/**
 * GET /api/walk-my-pet/bookings/provider-pending
 * Get all pending walk requests for the authenticated walker
 */
router.get('/bookings/provider-pending', requireAuth, async (req, res) => {
  try {
    const providerUid = (req as any).user?.uid;
    
    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.userId, providerUid));
    
    if (!walker) {
      return res.json({ bookings: [], total: 0 });
    }
    
    const pendingBookings = await db
      .select()
      .from(walkBookings)
      .where(
        and(
          eq(walkBookings.walkerId, walker.walkerId),
          eq(walkBookings.status, 'pending_provider')
        )
      )
      .orderBy(desc(walkBookings.createdAt));
    
    res.json({ bookings: pendingBookings, total: pendingBookings.length });
  } catch (error: any) {
    console.error('[Walk My Pet] Fetch provider pending error:', error);
    res.status(500).json({ error: 'Failed to fetch pending bookings' });
  }
});

// EMERGENCY/ASAP WALK REQUEST (PetWash™ "Book Now" model)
router.post('/walks/emergency-request', requireAuth, async (req, res) => {
  try {
    // Always derive ownerId from the verified Firebase token — never trust req.body.
    const ownerId = (req as any).user?.uid;
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { EmergencyWalkService } = await import('../services/EmergencyWalkService');
    
    const result = await EmergencyWalkService.requestEmergencyWalk({
      ownerId,
      ownerEmail: req.body.ownerEmail,
      petName: req.body.petName,
      petBreed: req.body.petBreed,
      petWeight: req.body.petWeight,
      specialInstructions: req.body.specialInstructions,
      location: {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        address: req.body.address,
      },
      walkDuration: req.body.walkDuration, // 30 or 60 minutes only
    });

    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }

    // Generate navigation links for emergency pickup location
    const navigationLinks = buildAllNavigationLinks({
      lat: req.body.latitude,
      lng: req.body.longitude,
      label: `Emergency Walk: ${req.body.petName}`,
    });

    res.status(201).json({
      success: true,
      bookingId: result.bookingId,
      matchedWalker: result.matchedWalker,
      pricing: result.pricing,
      surgePricing: result.surgePricing,
      eta: result.eta,
      navigation: navigationLinks,
      message: `Emergency walk confirmed! Walker ${result.matchedWalker?.walkerName} will arrive in ${result.matchedWalker?.estimatedArrivalMinutes} minutes.`,
    });
  } catch (error: any) {
    console.error('[Emergency Walk] Request failed:', error);
    res.status(500).json({ error: 'Failed to process emergency walk request', details: error.message });
  }
});

// =================== SLOT HOLDS (DB-persisted, double-booking prevention) ===================

router.post('/walks/holds', requireAuth, async (req, res) => {
  try {
    const { slotId, walkerId, estimatedAmount, walkDuration } = req.body;
    if (!slotId || !walkerId) {
      return res.status(400).json({ success: false, error: 'slotId and walkerId are required' });
    }
    // SECURITY (price-tampering guard, sweep 2026-07-13): the client echoes back the
    // price we quoted, but must NOT be trusted. Enforce a server-side FLOOR from the
    // canonical base-price table (mirrors EmergencyWalkService) so a tampered request
    // can never hold — and later pay for — a walk below its real minimum. The stored
    // hold amount is what the payment step charges (it no longer reads req.body.amount).
    const WALK_BASE_FLOOR_CENTS: Record<number, number> = { 30: 8000, 60: 15000 };
    const _durMin = Number(walkDuration) || 30;
    const _floorCents = WALK_BASE_FLOOR_CENTS[_durMin] ?? 8000;
    const _amountCents = Math.round(Number(estimatedAmount || 0) * 100);
    if (!Number.isFinite(_amountCents) || _amountCents < _floorCents) {
      return res.status(400).json({
        success: false,
        error: 'Amount is below the minimum price for this walk.',
      });
    }
    const now = new Date();
    // Purge expired holds first (lazy cleanup) so a stale row never poisons the slot.
    await db.delete(walkSlotHolds).where(lt(walkSlotHolds.expiresAt, now));
    // ── ATOMIC slot-hold acquisition (booking-hardening 2026-06-20) ──────────
    // INSERT ... ON CONFLICT DO NOTHING against UNIQUE (walker_id, slot_id)
    // (migration 0059). "No row inserted" == slot already held → 409. Replaces
    // the old read-check-insert which raced under concurrency.
    const holdId = `HOLD-${randomBytes(6).toString('hex').toUpperCase()}`;
    const ttlMs = (walkDuration || 30) * 60 * 1000 + 5 * 60 * 1000; // walk duration + 5min buffer
    const expiresAt = new Date(Date.now() + ttlMs);
    const inserted = await db.insert(walkSlotHolds).values({
      holdId,
      slotId,
      walkerId,
      estimatedAmount: String(estimatedAmount || 0),
      expiresAt,
    })
      .onConflictDoNothing({ target: [walkSlotHolds.walkerId, walkSlotHolds.slotId] })
      .returning({ id: walkSlotHolds.id });
    if (inserted.length === 0) {
      return res.status(409).json({ success: false, error: 'Walker slot currently held by another booking' });
    }
    return res.json({ success: true, holdId, slotId, estimatedAmount: estimatedAmount || 0, expiresAt: expiresAt.toISOString() });
  } catch (error: any) {
    console.error('[Walk Holds] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to create slot hold' });
  }
});

// Get booking details
router.get('/walks/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Get walker details
    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, booking.walkerId))
      .limit(1);

    res.json({ 
      booking,
      walker: walker ? {
        walkerId: walker.walkerId,
        displayName: walker.displayName,
        profilePhotoUrl: walker.profilePhotoUrl,
        averageRating: walker.averageRating,
        totalWalks: walker.totalWalks,
        hasBodyCamera: walker.hasBodyCamera,
        hasDroneAccess: walker.hasDroneAccess,
      } : null
    });
  } catch (error: any) {
    console.error('[Walk My Pet] Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Lightweight status poll for pending_match screen (real-time two-way matching)
router.get('/walks/bookings/:bookingId/status', async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [booking] = await db
      .select({
        bookingId: walkBookings.bookingId,
        status: walkBookings.status,
      })
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ status: booking.status, bookingId: booking.bookingId });
  } catch (error: any) {
    console.error('[Walk My Pet] Get booking status error:', error);
    res.status(500).json({ error: 'Failed to fetch booking status' });
  }
});

// Walker confirms booking
// PR-F: requireAuth + ownership check. Caller must be the assigned walker
// (looked up via walkerProfiles.userId, since walkBookings.walkerId stores
// the WALKER-UUID — not a Firebase UID). Body-supplied walkerId is no
// longer trusted.
router.post('/walks/:bookingId/confirm', requireAuth, async (req, res) => {
  try {
    const callerUid = (req as any).user?.uid as string | undefined;
    if (!callerUid) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { bookingId } = req.params;

    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Resolve the walker's Firebase UID via walkerProfiles.
    const [walker] = await db
      .select({ userId: walkerProfiles.userId })
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, booking.walkerId))
      .limit(1);

    if (!walker || walker.userId !== callerUid) {
      return res.status(403).json({ error: 'Forbidden: only the assigned walker may confirm this booking' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Booking already processed' });
    }

    const [updatedBooking] = await db
      .update(walkBookings)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(eq(walkBookings.bookingId, bookingId))
      .returning();

    await syncChatToBookingStatus(bookingId, 'confirmed', 'walk_my_pet');

    // Notify owner
    await db.insert(walkAlerts).values({
      alertId: `ALERT-${crypto.randomUUID()}`,
      bookingId,
      alertType: 'booking_confirmed',
      severity: 'info',
      title: 'Walk Confirmed!',
      message: 'Your walker has confirmed the walk. See you soon!',
      actionRequired: false,
      sentToOwner: true,
      isRead: false,
    });

    calendarIntegrationService.createBookingEvent({
      platform: 'walk-my-pet',
      bookingId: booking.bookingId,
      title: `⁦Walk My Pet™⁩ - Dog Walk`,
      description: `Dog walk booking confirmed`,
      startTime: new Date(booking.scheduledDate),
      endTime: new Date(new Date(booking.scheduledDate).getTime() + (booking.durationMinutes || 30) * 60000),
      location: booking.pickupAddress || undefined,
      petName: booking.petName || undefined,
    }).catch(() => {});

    res.json({ success: true, booking: updatedBooking });
  } catch (error: any) {
    console.error('[Walk My Pet] Confirm booking error:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// Start walk (walker initiates)
// PR-F: requireAuth + ownership check + per-user bookingLimiter rate limit
// (caps brute-force attempts on the 6-digit confirmationCode at 20/15min
// per Firebase UID — combined with auth this defeats enumeration).
router.post('/walks/:bookingId/start', requireAuth, bookingLimiter, async (req, res) => {
  try {
    const callerUid = (req as any).user?.uid as string | undefined;
    if (!callerUid) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { bookingId } = req.params;
    const { confirmationCode, latitude, longitude } = req.body;

    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Resolve the walker's Firebase UID via walkerProfiles.
    const [walker] = await db
      .select({ userId: walkerProfiles.userId })
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, booking.walkerId))
      .limit(1);

    if (!walker || walker.userId !== callerUid) {
      return res.status(403).json({ error: 'Forbidden: only the assigned walker may start this walk' });
    }

    if (booking.confirmationCode !== confirmationCode) {
      return res.status(400).json({ error: 'Invalid confirmation code' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Booking not confirmed' });
    }

    const [updatedBooking] = await db
      .update(walkBookings)
      .set({ 
        status: 'in_progress',
        actualStartTime: new Date(),
        isLiveTrackingActive: true,
        updatedAt: new Date()
      })
      .where(eq(walkBookings.bookingId, bookingId))
      .returning();

    await syncChatToBookingStatus(bookingId, 'in_progress', 'walk_my_pet');

    // Record first GPS point
    await db.insert(walkGpsTracking).values({
      bookingId,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      isInsideGeofence: true,
      recordedAt: new Date(),
    });

    // Notify owner
    await db.insert(walkAlerts).values({
      alertId: `ALERT-${crypto.randomUUID()}`,
      bookingId,
      alertType: 'walk_started',
      severity: 'info',
      title: 'Walk Started!',
      message: 'Your dog\'s walk has begun. Track live location now!',
      actionRequired: false,
      sentToOwner: true,
      isRead: false,
    });

    res.json({ success: true, booking: updatedBooking, message: 'Walk started! Live tracking active.' });
  } catch (error: any) {
    console.error('[Walk My Pet] Start walk error:', error);
    res.status(500).json({ error: 'Failed to start walk' });
  }
});

// =================== GPS TRACKING ===================

// Upload GPS point (walker's device streams location)
router.post('/walks/:bookingId/gps', requireAuth, async (req, res) => {
  try {
    const callerId = (req as any).user?.uid;
    const { bookingId } = req.params;
    const { latitude, longitude, accuracy, speed, heading, batteryLevel } = req.body;

    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking || booking.status !== 'in_progress') {
      return res.status(400).json({ error: 'Walk not in progress' });
    }

    // walkBookings.walkerId stores the walker PROFILE id (WALKER-…), NOT the
    // Firebase uid — resolve the profile to its userId before comparing, or the
    // real walker is always 403'd and can never stream GPS / complete the walk.
    // (Mirrors the /confirm handler's lookup.)
    const [walkerRow] = await db
      .select({ userId: walkerProfiles.userId })
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, booking.walkerId))
      .limit(1);
    if (!walkerRow || walkerRow.userId !== callerId) {
      return res.status(403).json({ error: 'Forbidden: you are not the walker for this booking' });
    }

    // Calculate distance from geofence center
    const centerLat = parseFloat(booking.geofenceCenterLat || '0');
    const centerLon = parseFloat(booking.geofenceCenterLon || '0');
    const R = 6371000; // Earth's radius in meters
    const dLat = (latitude - centerLat) * Math.PI / 180;
    const dLon = (longitude - centerLon) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(centerLat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceMeters = R * c;

    const isInsideGeofence = distanceMeters <= (booking.geofenceRadiusMeters || 500);

    // Record GPS point
    await db.insert(walkGpsTracking).values({
      bookingId,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      accuracy: accuracy?.toString(),
      speed: speed?.toString(),
      heading: heading?.toString(),
      isInsideGeofence,
      distanceFromCenterMeters: distanceMeters.toFixed(2),
      batteryLevel,
      recordedAt: new Date(),
    });

    // Geofence violation check
    if (!isInsideGeofence) {
      const currentViolations = booking.geofenceViolationCount || 0;
      await db
        .update(walkBookings)
        .set({ 
          geofenceViolationCount: currentViolations + 1,
          updatedAt: new Date()
        })
        .where(eq(walkBookings.bookingId, bookingId));

      // Send alert to owner
      if (currentViolations === 0) { // First violation only
        await db.insert(walkAlerts).values({
          alertId: `ALERT-${crypto.randomUUID()}`,
          bookingId,
          alertType: 'geofence_exit',
          severity: 'warning',
          title: 'Geofence Alert',
          message: `Walker has left the designated safe zone (${distanceMeters.toFixed(0)}m away)`,
          actionRequired: false,
          sentToOwner: true,
          isRead: false,
        });
      }
    }

    res.json({ success: true, isInsideGeofence, distanceMeters: distanceMeters.toFixed(2) });
  } catch (error: any) {
    console.error('[Walk My Pet] GPS tracking error:', error);
    res.status(500).json({ error: 'Failed to record GPS data' });
  }
});

// Get live GPS tracking data
router.get('/walks/:bookingId/gps/live', requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = (req as any).user?.uid;
    const { limit = 50 } = req.query;

    // SECURITY: live GPS of a pet/walker is sensitive — only the pet owner or the
    // assigned walker may read it. Was anonymous + enumerable by bookingId before.
    const [booking] = await db
      .select({ ownerId: walkBookings.ownerId, walkerId: walkBookings.walkerId })
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);
    if (!booking) return res.status(404).json({ error: 'Walk not found' });

    let authorized = booking.ownerId === userId;
    if (!authorized && booking.walkerId) {
      // walkerId is a walker-profile id, not a Firebase uid — resolve the caller's
      // walker profile and compare.
      const [w] = await db
        .select({ walkerId: walkerProfiles.walkerId })
        .from(walkerProfiles)
        .where(eq(walkerProfiles.userId, userId))
        .limit(1);
      authorized = !!w && w.walkerId === booking.walkerId;
    }
    if (!authorized) return res.status(403).json({ error: 'Not authorized to view this walk' });

    // Clamp the limit (was unbounded → could dump the whole GPS history).
    const cappedLimit = Math.min(Math.max(parseInt(limit as string) || 50, 1), 200);
    const gpsPoints = await db
      .select()
      .from(walkGpsTracking)
      .where(eq(walkGpsTracking.bookingId, bookingId))
      .orderBy(desc(walkGpsTracking.recordedAt))
      .limit(cappedLimit);

    res.json({ success: true, gpsPoints: gpsPoints.reverse() });
  } catch (error: any) {
    console.error('[Walk My Pet] Get GPS data error:', error);
    res.status(500).json({ error: 'Failed to fetch GPS data' });
  }
});

// =================== WALK COMPLETION ===================

// Complete walk
router.post('/walks/:bookingId/complete', requireAuth, async (req, res) => {
  try {
    const callerId = (req as any).user?.uid;
    const { bookingId } = req.params;
    const { completionNotes, healthData } = req.body;

    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking || booking.status !== 'in_progress') {
      return res.status(400).json({ error: 'Walk not in progress' });
    }

    // walkBookings.walkerId stores the walker PROFILE id (WALKER-…), NOT the
    // Firebase uid — resolve the profile to its userId before comparing, or the
    // real walker is always 403'd and can never stream GPS / complete the walk.
    // (Mirrors the /confirm handler's lookup.)
    const [walkerRow] = await db
      .select({ userId: walkerProfiles.userId })
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, booking.walkerId))
      .limit(1);
    if (!walkerRow || walkerRow.userId !== callerId) {
      return res.status(403).json({ error: 'Forbidden: you are not the walker for this booking' });
    }

    const actualDuration = booking.actualStartTime 
      ? Math.round((new Date().getTime() - new Date(booking.actualStartTime).getTime()) / 60000)
      : booking.durationMinutes;

    // Get all GPS points for blockchain verification
    const gpsPoints = await db
      .select()
      .from(walkGpsTracking)
      .where(eq(walkGpsTracking.bookingId, bookingId));

    // Calculate total distance
    let totalDistance = 0;
    for (let i = 1; i < gpsPoints.length; i++) {
      const lat1 = parseFloat(gpsPoints[i-1].latitude);
      const lon1 = parseFloat(gpsPoints[i-1].longitude);
      const lat2 = parseFloat(gpsPoints[i].latitude);
      const lon2 = parseFloat(gpsPoints[i].longitude);
      
      const R = 6371000; // meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }

    // Update booking
    const [updatedBooking] = await db
      .update(walkBookings)
      .set({
        status: 'completed',
        actualEndTime: new Date(),
        actualDurationMinutes: actualDuration,
        walkCompletedSuccessfully: true,
        completionNotes,
        isLiveTrackingActive: false,
        updatedAt: new Date(),
      })
      .where(eq(walkBookings.bookingId, bookingId))
      .returning();

    await syncChatToBookingStatus(bookingId, 'completed', 'walk_my_pet');

    // ── Stage 2: provider settlement with withholding tax (ניכוי מס במקור) ──
    // walkerPayout is the gross amount earned by the walker (before withholding).
    // We call recordProviderSettlement so withholding is tracked in provider_commissions.
    // Non-blocking — failure must not abort the completion response.
    let walkSettlement: any = undefined;
    try {
      const walkSettlementResult = await IsraeliDigitalReceiptService.recordProviderSettlement({
        bookingId,
        providerId: booking.walkerId,
        providerType: 'walker',
        grossPayoutAmount: parseFloat(booking.walkerPayout || '0'),
        hasWithholdingExemption: false,
        customerPaidAmount: parseFloat(booking.totalCost || '0'),
        bookingDbId: booking.id,
      });
      if (walkSettlementResult.success && walkSettlementResult.settlement) {
        walkSettlement = walkSettlementResult.settlement;
      }
    } catch (settlementErr: any) {
      logger.warn('[Walk My Pet] Provider settlement recording failed (non-blocking)', { error: settlementErr.message, bookingId });
    }

    // ── VAT: single authoritative P&L entry at service completion ───────────
    // Israeli law מועד החיוב: taxable supply is complete on service delivery.
    // Acceptance is an operational event only — no P&L entry is made there.
    // Stage 2: withholding & Osek data are passed so the ledger entry is complete.
    // Non-blocking — failure must not abort the completion response.
    try {
      await VATCalculatorService.recordTransactionFromGross(
        'walk-my-pet',
        bookingId,
        parseFloat(booking.totalCost || '0'),
        bookingId,
        { completedAt: new Date().toISOString() },
        walkSettlement ? {
          withholdingTaxAmount: walkSettlement.withholdingTaxAmount,
          withholdingTaxRate: walkSettlement.withholdingTaxRate,
          netPaymentToProvider: walkSettlement.netPaymentToProvider,
          commissionId: walkSettlement.commissionId,
          osekType: walkSettlement.osekType,
        } : undefined
      );
    } catch (vatCompletionErr: any) {
      logger.warn('[Walk My Pet] VAT ledger at completion failed (non-blocking)', { error: vatCompletionErr.message, bookingId });
    }

    // Create blockchain audit record
    const previousBlock = await db
      .select()
      .from(walkBlockchainAudit)
      .orderBy(desc(walkBlockchainAudit.createdAt))
      .limit(1);

    const blockData = {
      bookingId,
      walkStartTimestamp: booking.actualStartTime!,
      walkEndTimestamp: new Date(),
      totalDurationSeconds: actualDuration * 60,
      totalDistanceMeters: Math.round(totalDistance),
      gpsDataPointsCount: gpsPoints.length,
      geofenceViolations: booking.geofenceViolationCount || 0,
      geofenceCompliancePercent: ((gpsPoints.filter(p => p.isInsideGeofence).length / gpsPoints.length) * 100).toFixed(2),
      amountPaidByOwner: booking.totalCost,
      amountPaidToWalker: booking.walkerPayout,
      platformCommission: (parseFloat(booking.platformFeeOwner) + parseFloat(booking.platformFeeSitter)).toFixed(2),
    };

    const blockString = JSON.stringify(blockData);
    const blockHash = crypto.createHash('sha256').update(blockString).digest('hex');
    const previousBlockHash = previousBlock[0]?.blockHash || '0';

    await db.insert(walkBlockchainAudit).values({
      ...blockData,
      blockHash,
      previousBlockHash,
      merkleRoot: crypto.createHash('sha256').update(gpsPoints.map(p => `${p.latitude},${p.longitude}`).join('|')).digest('hex'),
      verificationStatus: 'verified',
    });

    // Save health data if provided
    if (healthData) {
      await db.insert(walkHealthData).values({
        bookingId,
        ...healthData,
        distanceKm: (totalDistance / 1000).toFixed(2),
      });
    }

    // Notify owner
    await db.insert(walkAlerts).values({
      alertId: `ALERT-${crypto.randomUUID()}`,
      bookingId,
      alertType: 'completion',
      severity: 'info',
      title: 'Walk Completed!',
      message: `Walk completed successfully! Distance: ${(totalDistance/1000).toFixed(2)}km`,
      actionRequired: false,
      sentToOwner: true,
      isRead: false,
    });

    // Update walker stats
    await db.execute(sql`
      UPDATE walker_profiles 
      SET total_walks = total_walks + 1,
          updated_at = NOW()
      WHERE walker_id = ${booking.walkerId}
    `);

    res.json({ 
      success: true, 
      booking: updatedBooking,
      stats: {
        distanceKm: (totalDistance / 1000).toFixed(2),
        durationMinutes: actualDuration,
        gpsPointsRecorded: gpsPoints.length,
        blockchainHash: blockHash,
      }
    });
  } catch (error: any) {
    console.error('[Walk My Pet] Complete walk error:', error);
    res.status(500).json({ error: 'Failed to complete walk' });
  }
});

// =================== REVIEWS ===================

// Submit walker review
router.post('/walkers/:walkerId/review', requireAuth, async (req, res) => {
  try {
    const { walkerId } = req.params;
    const ownerId = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!ownerId) return res.status(401).json({ error: 'Authentication required' });

    // COMPLETED-WALK GATE: a review must reference a real walk that belongs to this
    // owner, was with THIS walker, is COMPLETED, and hasn't been reviewed yet.
    // Without it, any authed user could rate any walker they never used (ratings
    // drive search ranking).
    const bookingId = req.body?.bookingId;
    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, String(bookingId)))
      .limit(1);
    if (!walk || walk.ownerId !== ownerId || walk.walkerId !== walkerId) {
      return res.status(403).json({ error: 'You can only review your own completed walk with this walker.' });
    }
    if (walk.status !== 'completed') {
      return res.status(400).json({ error: 'You can only review a completed walk.' });
    }
    const [existingWalkReview] = await db
      .select({ reviewId: walkerReviews.reviewId })
      .from(walkerReviews)
      .where(eq(walkerReviews.bookingId, String(bookingId)))
      .limit(1);
    if (existingWalkReview) {
      return res.status(409).json({ error: 'This walk has already been reviewed.' });
    }

    const reviewData: InsertWalkerReview = {
      reviewId: `REV-${crypto.randomUUID()}`,
      ...req.body,
      walkerId,
      ownerId,
      isVerifiedWalk: true,
      isFlagged: false,
    };

    const [newReview] = await db.insert(walkerReviews).values(reviewData).returning();

    // Update walker's average rating
    const allReviews = await db
      .select()
      .from(walkerReviews)
      .where(eq(walkerReviews.walkerId, walkerId));

    const avgRating = allReviews.reduce((sum, r) => sum + r.overallRating, 0) / allReviews.length;

    await db
      .update(walkerProfiles)
      .set({ 
        averageRating: avgRating.toFixed(2),
        totalReviews: allReviews.length,
        updatedAt: new Date()
      })
      .where(eq(walkerProfiles.walkerId, walkerId));

    res.status(201).json({ success: true, review: newReview });
  } catch (error: any) {
    console.error('[Walk My Pet] Review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get walker reviews
router.get('/walkers/:walkerId/reviews', async (req, res) => {
  try {
    const { walkerId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const reviews = await db
      .select()
      .from(walkerReviews)
      .where(eq(walkerReviews.walkerId, walkerId))
      .orderBy(desc(walkerReviews.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({ success: true, reviews });
  } catch (error: any) {
    console.error('[Walk My Pet] Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// =================== USER BOOKINGS ===================

// Issue #153 PR-WALK-1 — Walk-My-Pet owner walks security bridge.
//
// PR-3 (CustomerBookings unified aggregator) needs a customer-scoped
// owner-walks endpoint. The pre-existing handler at this site trusted
// req.params.userId as the source of truth and ran with NO auth
// middleware — the same anti-pattern PR #173 already closed for the
// pet ICS endpoint. Audit (issue #153 stop-and-report) confirmed only
// one legitimate caller (client/src/pages/walk-my-pet/OwnerDashboard
// .tsx:53,55), so the leak surface is small but live.
//
// Fix shape (mirrors PR #173):
//   1. NEW canonical route: GET /api/walk-my-pet/walks/mine
//      • requireAuth at the route
//      • UID read from req.user.uid (verified Firebase token)
//      • same response shape as the legacy route
//   2. LEGACY route /users/:userId/walks now requires auth AND the path
//      uid must match the verified token uid (or caller must be admin).
//      Mismatch → 403. Anonymous → 401. Backwards compatible for any
//      caller that was already passing a valid session cookie + correct
//      uid; abusive callers blocked.
//
// Out of scope: schema, booking writes, BookingEngine, payments, schema,
// state machines, walker scoping, K9000/Nayax/Tranzila.

// Canonical safe route — read by CustomerBookings aggregator (PR-3).
router.get('/walks/mine', requireAuth, async (req: any, res) => {
  try {
    const userId: string = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { status } = req.query;

    // SECURITY: build ONE combined WHERE. A second `.where()` on a Drizzle query
    // OVERWRITES the first (it sets config.where, not AND) — so the previous
    // `.where(ownerId).where(status)` DROPPED the ownership scope whenever
    // ?status= was present, returning every user's walks (cross-tenant IDOR).
    // (2026-08-11)
    const scope = status
      ? and(eq(walkBookings.ownerId, userId), eq(walkBookings.status, status as string))
      : eq(walkBookings.ownerId, userId);

    const bookings = await db
      .select()
      .from(walkBookings)
      .where(scope)
      .orderBy(desc(walkBookings.createdAt));

    res.json({ success: true, bookings });
  } catch (error: any) {
    console.error('[Walk My Pet] Get owner walks (mine) error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Legacy route — kept for backwards compatibility with existing clients.
// Issue #153 PR-WALK-1 added requireAuth + path-uid match check; mismatch
// returns 403. Admin callers (super_admin / management / staff via
// req.user.role) bypass the match check so internal tools can still
// read another user's walks for support flows.
router.get('/users/:userId/walks', requireAuth, async (req: any, res) => {
  try {
    const callerUid: string = req.user?.uid || req.firebaseUser?.uid;
    if (!callerUid) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { userId } = req.params;
    const callerRole: string = req.user?.role || req.userRole?.role?.name || '';
    const isAdmin = ['super_admin', 'management', 'staff', 'admin'].includes(
      String(callerRole).toLowerCase(),
    );
    if (callerUid !== userId && !isAdmin) {
      console.warn('[Walk My Pet] BOLA blocked on legacy /users/:userId/walks', {
        callerUid, requestedUserId: userId,
      });
      return res.status(403).json({ error: 'Cannot read another user\'s walks' });
    }
    const { status } = req.query;

    // SECURITY: one combined WHERE — a second `.where()` overwrites the first in
    // Drizzle, which previously dropped the ownerId scope when ?status= was set
    // (cross-tenant IDOR). (2026-08-11)
    const scope = status
      ? and(eq(walkBookings.ownerId, userId), eq(walkBookings.status, status as string))
      : eq(walkBookings.ownerId, userId);

    const bookings = await db
      .select()
      .from(walkBookings)
      .where(scope)
      .orderBy(desc(walkBookings.createdAt));

    res.json({ success: true, bookings });
  } catch (error: any) {
    console.error('[Walk My Pet] Get user bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get walker's bookings
router.get('/walkers/:walkerId/walks', requireAuth, async (req: any, res) => {
  try {
    const { walkerId } = req.params;
    const { status } = req.query;
    const uid = req.firebaseUser?.uid || req.user?.uid;

    // OWNERSHIP: a walker's bookings contain owner PII, addresses, pet details and
    // amounts. Only that walker (or a verified admin) may list them — this was an
    // open, unauthenticated enumeration endpoint.
    const [wp] = await db
      .select({ userId: walkerProfiles.userId })
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, walkerId))
      .limit(1);
    if (!wp || (wp.userId !== uid && !isSuperAdminVerified(req))) {
      return res.status(403).json({ error: 'Not authorized to view these bookings' });
    }

    // SECURITY: one combined WHERE — a second `.where()` overwrites the first in
    // Drizzle, which previously dropped the walkerId scope when ?status= was set
    // (cross-tenant IDOR). (2026-08-11)
    const scope = status
      ? and(eq(walkBookings.walkerId, walkerId), eq(walkBookings.status, status as string))
      : eq(walkBookings.walkerId, walkerId);

    const bookings = await db
      .select()
      .from(walkBookings)
      .where(scope)
      .orderBy(desc(walkBookings.createdAt));

    res.json({ success: true, bookings });
  } catch (error: any) {
    console.error('[Walk My Pet] Get walker bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// =================== WALK-MY-PET API (Frontend Compatible) ===================

// Get walker profile by numeric ID with reviews (for WalkerDetail.tsx)
router.get('/walker-detail/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid walker ID' });
    }
    
    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.id, id))
      .limit(1);

    if (!walker) {
      return res.status(404).json({ error: 'Walker not found' });
    }

    // Fetch reviews for this walker
    const reviews = await db
      .select()
      .from(walkerReviews)
      .where(eq(walkerReviews.walkerId, walker.walkerId))
      .orderBy(desc(walkerReviews.createdAt))
      .limit(10);

    // DTO round 1 (2026-08-22): previously echoed `walker.email`,
    // `walker.phone`, and `walker.userId` on this UNAUTHENTICATED
    // endpoint. Numeric-ID enumeration harvested every walker's real
    // phone / email for spam and revealed their Firebase UID. Now
    // routed through the shared `projectPublicWalker` allowlist —
    // same DTO the search endpoints emit. Contact-reach flows go
    // through the authenticated /booking-requests/:id/provider-contact
    // gate (owner + status-window check) rather than a raw phone leak.
    const walkerForFrontend = projectPublicWalker(walker);
    if (!walkerForFrontend) {
      return res.status(404).json({ error: 'Walker not available' });
    }

    const reviewsForFrontend = reviews.map(r => ({
      id: r.id,
      customerName: 'Verified Customer',
      rating: r.overallRating,
      comment: r.reviewText || '',
      createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
      petType: 'Dog',
    }));

    res.json({ walker: walkerForFrontend, reviews: reviewsForFrontend });
  } catch (error: any) {
    console.error('[Walk My Pet] Get walker by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch walker profile' });
  }
});

router.get('/walkers-list', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const offset = (page - 1) * limit;
    const city = req.query.city as string | undefined;

    const conditions = [eq(walkerProfiles.isActive, true)];
    if (city && city !== 'all') {
      conditions.push(eq(walkerProfiles.city, city));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [countResult, walkers] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(walkerProfiles)
        .where(whereClause),
      db.select()
        .from(walkerProfiles)
        .where(whereClause)
        .orderBy(desc(walkerProfiles.averageRating))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    const walkersForFrontend = walkers.map(w => ({
      id: w.id,
      userId: w.userId,
      firstName: w.firstName || 'Walker',
      lastName: w.lastName || '',
      city: w.city || 'Tel Aviv',
      bio: w.bio || '',
      yearsOfExperience: w.yearsOfExperience || 0,
      pricePerWalkCents: w.pricePerWalkCents || 5000,
      profilePictureUrl: w.profilePhotoUrl,
      rating: w.averageRating || '4.9',
      totalWalks: w.totalWalks || 0,
      isActive: w.isActive !== false,
      isVerified: w.verificationStatus === 'verified',
    }));

    res.json({
      providers: walkersForFrontend,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error('[Walk My Pet] List walkers error:', error);
    res.status(500).json({ error: 'Failed to fetch walkers' });
  }
});

// =================== WALKER DASHBOARD ENDPOINTS ===================

// GET /api/walk-my-pet/walker/requests — pending walk requests for the authenticated walker
router.get('/walker/requests', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const requests = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} = 'pending'`
      ))
      .orderBy(desc(bookingRequests.createdAt))
      .limit(50);

    const formatted = requests.map(r => ({
      id: r.requestId,
      dbId: r.id,
      ownerName: (r.petDetails as any)?.ownerName || 'Pet Owner',
      ownerPhoto: null,
      ownerPhone: '',
      petName: (r.petDetails as any)?.petName || 'Pet',
      petType: (r.petDetails as any)?.petType || 'dog',
      petBreed: (r.petDetails as any)?.petBreed || '',
      scheduledTime: r.startDate,
      duration: Math.round(Number(r.totalHours || 1) * 60),
      pickupAddress: (r.petDetails as any)?.address || '',
      dropoffAddress: (r.petDetails as any)?.address || '',
      status: 'scheduled',
      earnings: (r.subtotalCents || 0) / 100,
      currency: r.currency || 'ILS',
      specialInstructions: r.ownerMessage || null,
      distance: 0,
    }));

    res.json(formatted);
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching requests', error);
    res.status(500).json({ error: 'Failed to fetch walk requests' });
  }
});

// GET /api/walk-my-pet/walker/active — currently active walk
router.get('/walker/active', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const [active] = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} IN ('accepted', 'in_progress')`
      ))
      .orderBy(desc(bookingRequests.serviceStartedAt))
      .limit(1);

    if (!active) return res.json(null);

    res.json({
      id: active.requestId,
      dbId: active.id,
      ownerName: (active.petDetails as any)?.ownerName || 'Pet Owner',
      ownerPhoto: null,
      ownerPhone: '',
      petName: (active.petDetails as any)?.petName || 'Pet',
      petType: (active.petDetails as any)?.petType || 'dog',
      petBreed: (active.petDetails as any)?.petBreed || '',
      scheduledTime: active.startDate,
      duration: Math.round(Number(active.totalHours || 1) * 60),
      pickupAddress: (active.petDetails as any)?.address || '',
      dropoffAddress: (active.petDetails as any)?.address || '',
      status: active.status === 'in_progress' ? 'in_progress' : 'scheduled',
      earnings: (active.subtotalCents || 0) / 100,
      currency: active.currency || 'ILS',
      specialInstructions: active.ownerMessage || null,
      distance: 0,
    });
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching active walk', error);
    res.status(500).json({ error: 'Failed to fetch active walk' });
  }
});

// GET /api/walk-my-pet/walker/completed — completed walks history
router.get('/walker/completed', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const completed = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} = 'completed'`
      ))
      .orderBy(desc(bookingRequests.serviceCompletedAt))
      .limit(100);

    const formatted = completed.map(r => ({
      id: r.requestId,
      dbId: r.id,
      ownerName: (r.petDetails as any)?.ownerName || 'Pet Owner',
      ownerPhoto: null,
      ownerPhone: '',
      petName: (r.petDetails as any)?.petName || 'Pet',
      petType: (r.petDetails as any)?.petType || 'dog',
      petBreed: (r.petDetails as any)?.petBreed || '',
      scheduledTime: r.startDate,
      completedAt: r.serviceCompletedAt,
      duration: Math.round(Number(r.totalHours || 1) * 60),
      pickupAddress: (r.petDetails as any)?.address || '',
      dropoffAddress: (r.petDetails as any)?.address || '',
      status: 'completed',
      earnings: (r.subtotalCents || 0) / 100,
      currency: r.currency || 'ILS',
      specialInstructions: null,
      distance: 0,
      rating: r.ownerRating ? Number(r.ownerRating) : null,
      review: r.ownerReview || null,
    }));

    res.json(formatted);
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching completed walks', error);
    res.status(500).json({ error: 'Failed to fetch completed walks' });
  }
});

// GET /api/walk-my-pet/walker/earnings — earnings summary
router.get('/walker/earnings', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const allCompleted = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} = 'completed'`
      ));

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalCents = allCompleted.reduce((sum, r) => sum + (r.subtotalCents || 0), 0);
    const weeklyCents = allCompleted
      .filter(r => r.serviceCompletedAt && new Date(r.serviceCompletedAt) >= startOfWeek)
      .reduce((sum, r) => sum + (r.subtotalCents || 0), 0);
    const monthlyCents = allCompleted
      .filter(r => r.serviceCompletedAt && new Date(r.serviceCompletedAt) >= startOfMonth)
      .reduce((sum, r) => sum + (r.subtotalCents || 0), 0);

    const pending = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} IN ('accepted', 'in_progress')`
      ));

    const pendingCents = pending.reduce((sum, r) => sum + (r.subtotalCents || 0), 0);

    res.json({
      total: totalCents / 100,
      weekly: weeklyCents / 100,
      monthly: monthlyCents / 100,
      pending: pendingCents / 100,
      currency: 'ILS',
      totalWalks: allCompleted.length,
    });
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching earnings', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// GET /api/walk-my-pet/walker/reviews — reviews received by the walker
router.get('/walker/reviews', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const reviewed = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        isNotNull(bookingRequests.ownerRating)
      ))
      .orderBy(desc(bookingRequests.serviceCompletedAt))
      .limit(50);

    const formatted = reviewed.map(r => ({
      id: r.requestId,
      ownerName: (r.petDetails as any)?.ownerName || 'Pet Owner',
      ownerPhoto: null,
      rating: r.ownerRating ? Number(r.ownerRating) : 5,
      comment: r.ownerReview || '',
      petName: (r.petDetails as any)?.petName || 'Pet',
      date: r.serviceCompletedAt || r.updatedAt,
    }));

    const avgRating = formatted.length > 0
      ? formatted.reduce((sum, r) => sum + r.rating, 0) / formatted.length
      : 5.0;

    res.json({
      reviews: formatted,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: formatted.length,
    });
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching reviews', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET /api/walk-my-pet/walker/achievements — walker achievements
router.get('/walker/achievements', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const allCompleted = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} = 'completed'`
      ));

    const totalWalks = allCompleted.length;
    const reviewed = allCompleted.filter(r => r.ownerRating);
    const avgRating = reviewed.length > 0
      ? reviewed.reduce((sum, r) => sum + Number(r.ownerRating || 0), 0) / reviewed.length
      : 5.0;

    res.json([
      {
        id: 'first_walk',
        title: 'First Walk',
        description: 'Complete your first dog walk',
        icon: 'paw',
        progress: Math.min(totalWalks, 1),
        target: 1,
        earned: totalWalks >= 1,
      },
      {
        id: 'ten_walks',
        title: 'Pack Leader',
        description: 'Complete 10 walks',
        icon: 'star',
        progress: Math.min(totalWalks, 10),
        target: 10,
        earned: totalWalks >= 10,
      },
      {
        id: 'fifty_walks',
        title: 'Marathon Walker',
        description: 'Complete 50 walks',
        icon: 'trophy',
        progress: Math.min(totalWalks, 50),
        target: 50,
        earned: totalWalks >= 50,
      },
      {
        id: 'top_rated',
        title: 'Top Rated',
        description: 'Maintain a 4.9+ rating with 5+ reviews',
        icon: 'award',
        progress: reviewed.length >= 5 && avgRating >= 4.9 ? 1 : 0,
        target: 1,
        earned: reviewed.length >= 5 && avgRating >= 4.9,
      },
    ]);
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching achievements', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// POST /api/walk-my-pet/walker/accept/:walkId — accept a pending walk request
router.post('/walker/accept/:walkId', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const { walkId } = req.params;

    const [updated] = await db.update(bookingRequests)
      .set({
        status: 'accepted',
        providerResponse: req.body.message || 'Walk accepted',
        updatedAt: new Date(),
      })
      .where(and(
        eq(bookingRequests.requestId, walkId),
        eq(bookingRequests.providerId, walkerId),
        sql`${bookingRequests.status} = 'pending'`
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Walk request not found or cannot be accepted' });
    }

    res.json({ success: true, walk: updated });
  } catch (error) {
    logger.error('[Walker Dashboard] Error accepting walk', error);
    res.status(500).json({ error: 'Failed to accept walk' });
  }
});

// POST /api/walk-my-pet/walker/reject/:walkId — reject a pending walk request
router.post('/walker/reject/:walkId', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const { walkId } = req.params;

    const [pendingWalk] = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.requestId, walkId),
        eq(bookingRequests.providerId, walkerId),
        sql`${bookingRequests.status} = 'pending'`
      ))
      .limit(1);

    if (!pendingWalk) {
      return res.status(404).json({ error: 'Walk request not found or cannot be rejected' });
    }

    const preRefundCents: number = pendingWalk.totalCents ?? 0;
    if (pendingWalk.ownerId && preRefundCents > 0) {
      if (!assertOperatingControl(req, res, {
        actionType: 'CUSTOMER_REFUND',
        route: 'POST /api/walk-my-pet/walker/reject/:walkId',
        targetId: `walk-reject-refund:${walkId}`,
        facts: {
          originalOrderOrPaymentExists: true,
          refundReasonSelected: true,
          evidenceAttachedIfRequired: true,
          approvalThresholdApplied: true,
        },
        money: {
          amountCents: preRefundCents,
        },
      })) {
        return;
      }
    }

    const [updated] = await db.update(bookingRequests)
      .set({
        status: 'cancelled',
        cancelledBy: 'provider',
        cancellationReason: req.body.reason || 'Walker unavailable',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(bookingRequests.requestId, walkId),
        eq(bookingRequests.providerId, walkerId),
        sql`${bookingRequests.status} = 'pending'`
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Walk request not found or cannot be rejected' });
    }

    // Walker-declined a PENDING walk request. Refund money-side effects
    // (evil-hunt 2026-08-20):
    //
    // The previous code did a raw `UPDATE wallet_accounts SET cash_wallet_
    // balance_cents = cash_wallet_balance_cents + totalCents` here — that is
    // exactly what the money-invariants skill forbids:
    //   (a) it bypasses WalletLedger (no hash-chain, no double-entry, no
    //       division tracking, no audit row);
    //   (b) it has no idempotency key, so a retry double-mints;
    //   (c) most importantly, this route is guarded on `status='pending'`
    //       (walker has not yet accepted → NO money has been captured on
    //       walk-my-pet at all — this arm doesn't use holdBookingWallet on
    //       request-create). Crediting the customer's cash wallet on a
    //       walker-decline of a pending walk therefore MINTS wallet credit
    //       from nothing.
    //
    // If a real wallet hold ever exists for a walk, we release it through
    // WalletLedger (idempotency key keys on the walk id). Otherwise there is
    // nothing to refund — the request never charged the customer.
    const customerId: string | null = updated.ownerId ?? null;
    const holdCents = Number((updated as any).walletHoldCents) || 0;
    const debitedCents = Number((updated as any).walletDebitedCents) || 0;
    const financeState = (updated as any).financeState as string | null;

    if (customerId && financeState === 'hold_active' && holdCents > 0) {
      try {
        const { walletService } = await import('../services/WalletService');
        await walletService.releaseBookingHold({
          userId: customerId, amountCents: holdCents, bookingId: walkId,
          divisionCode: 'walkers', ipAddress: req.ip ?? null,
        });
        logger.info('[Walk My Pet] Wallet hold released on walker reject', { customerId, holdCents, walkId });
      } catch (walletErr: any) {
        logger.error('[Walk My Pet] Wallet hold release failed on reject', { walkId, error: walletErr.message });
      }
    } else if (customerId && financeState === 'debited' && debitedCents > 0) {
      try {
        const { walletService } = await import('../services/WalletService');
        await walletService.refundBookingWallet({
          userId: customerId, amountCents: debitedCents, bookingId: walkId,
          divisionCode: 'walkers', reason: 'walker_rejected', ipAddress: req.ip ?? null,
        });
        logger.info('[Walk My Pet] Wallet refunded on walker reject', { customerId, debitedCents, walkId });
      } catch (walletErr: any) {
        logger.error('[Walk My Pet] Wallet refund failed on reject', { walkId, error: walletErr.message });
      }
    } else {
      logger.info('[Walk My Pet] Walker rejected pending walk — no money to refund (no hold, no debit)', {
        walkId, customerId, financeState,
      });
    }

    // Notify customer that their walk was cancelled by the walker
    if (customerId) {
      const smsBody = buildBookingCancelledSms({
        bookingRef: walkId.slice(0, 8).toUpperCase(),
        serviceName: 'טיול כלבים',
      });
      dispatchNotifications({
        event: 'booking_cancelled',
        entityId: walkId,
        channels: ['sms'],
        userId: customerId,
        smsBody,
        idempotencyKey: `walk-rejected-customer-${walkId}`,
      }).catch(e => logger.warn('[Walk My Pet] Customer rejection SMS failed', e));
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error('[Walker Dashboard] Error rejecting walk', error);
    res.status(500).json({ error: 'Failed to reject walk' });
  }
});

// POST /api/walk-my-pet/walker/start/:walkId — start an accepted walk
router.post('/walker/start/:walkId', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const { walkId } = req.params;

    const [updated] = await db.update(bookingRequests)
      .set({
        status: 'in_progress',
        serviceStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(bookingRequests.requestId, walkId),
        eq(bookingRequests.providerId, walkerId),
        sql`${bookingRequests.status} = 'accepted'`
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Walk not found or not in accepted state' });
    }

    res.json({ success: true, walk: updated });
  } catch (error) {
    logger.error('[Walker Dashboard] Error starting walk', error);
    res.status(500).json({ error: 'Failed to start walk' });
  }
});

export default router;
