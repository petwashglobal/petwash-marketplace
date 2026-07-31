/**
 * PET WASH™ BOOKING REQUESTS API
 * 
 * Complete booking flow:
 * 1. Create request (owner → provider)
 * 2. Provider accepts/declines
 * 3. Schedule Meet & Greet
 * 4. Complete Meet & Greet
 * 5. Payment (escrow)
 * 6. Service in progress
 * 7. Service completion
 * 8. Review
 */

import { Router } from 'express';
import { db } from '../db';
import { IsraeliDigitalReceiptService } from '../services/IsraeliDigitalReceiptService';
import { 
  bookingRequests,
  bookingRequestPets,
  bookingRequestAddons,
  sitterProfiles,
  walkerProfiles,
  trainers,
  users,
  superAppNotifications,
  rebookTriggers,
  referrals,
  winbackQueue,
  experimentEvents,
  providerProfiles,
  createBookingRequestSchema,
  providerBookingResponseSchema,
  type BookingRequest,
  hostStayDetails,
  bookingHandoverEvents,
  octopusBookings,
  octopusLedger,
  userAddresses,
} from '@shared/schema';
import { formatUserAddress, bookingSnapshotToAddress } from '@shared/formatAddress';
import { eq, and, desc, sql, or, inArray, ne } from 'drizzle-orm';
import { calculateQuote, persistBookingQuote } from '../services/quoteEngine';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { isSuperAdminVerified } from '../middleware/rbac';
import { nanoid } from 'nanoid';
import { createHash, randomBytes } from 'crypto';

// Enterprise service integrations
import EscrowService from '../services/EscrowService';
import { createEarningRecord } from '../services/payoutLedger';
import { assertServiceApproved, providerHasAnyServiceRows } from '../services/providerServiceApproval';
import { checkProviderDeclarationsSigned } from '../services/providerDeclarationGate';
import { isReconfirmationOverdue } from '../services/reconfirmationService';
import { recordAcceptance, recordStatusEvent, recordRefund } from '../services/DealGateService';
import { closeLead } from '../services/ConversionLeadService';
import type { LeadType } from '../../shared/schema-conversion';

// Map a booking serviceType → the Booking-Rescue lead type (for closeLead).
function serviceToLeadType(serviceType?: string | null): LeadType | null {
  const s = String(serviceType || '').toLowerCase();
  if (s.includes('walk')) return 'WALK_MY_PET_BOOKING';
  if (s.includes('train') || s.includes('academy')) return 'ACADEMY_COURSE';
  if (s.includes('sit')) return 'PET_SITTER_BOOKING';
  return null;
}
import { dispatchNotification } from '../lib/notificationDispatcher';
import { logBookingEvent, type BookingEventPayload } from '../services/bookingEventLogger';
import { twilioSMSService } from '../services/TwilioSMSService';
import { scheduleRebookTrigger } from '../jobs/rebook-scheduler';
import { EmailService } from '../emailService';
import { awardLoyaltyCredit, getStreakCounts, redeemLoyaltyCredit } from '../utils/loyaltyLedger';
import { updateLoyalty } from '../actions/loyaltySync';
import { calendarIntegrationService } from '../services/CalendarIntegrationService';
import { applyTransition, type BookingActor, type BookingStatus } from '@shared/lib/bookingStateMachine';
import { maskCustomerLocationForProvider } from '@shared/lib/bookingPii';
import { cityKey, stripHebrewStreetPrefix, normalizeIsraeliPostalCode } from '@shared/lib/address';
import { BLOCKING_STATUSES } from '@shared/lib/bookingOverlap';
import { acquireSlotLock, releaseSlotLock, BookingSlotConflictError } from '../lib/marketplaceSlotLock';
import { checkBookingProximity, BOOKING_MAX_DISTANCE_KM } from '../lib/proximity';
import { walletService } from '../services/WalletService';
import { eventPublisher } from '../services/EventPublisher';
import { DomainEventType } from '@shared/events';
import { eventBus } from '../services/EventBus';
import { recomputeCustomerProfile, advanceJourneyState } from '../services/CustomerIntelligenceService';
import { SUPPORT_EMAIL as CANONICAL_SUPPORT_EMAIL } from '@shared/support-contact';
import VATCalculatorService from '../services/VATCalculatorService';
import { providerTypeToFiscalPlatform } from '@shared/serviceDivisions';

function getDivisionCode(serviceType?: string | null): 'petsitter' | 'walkers' | 'academy' | 'pettrek' | 'general' {
  switch (serviceType) {
    case 'sitting':   return 'petsitter';
    case 'walking':   return 'walkers';
    case 'training':  return 'academy';
    case 'pettrek':   return 'pettrek';
    default:          return 'general';
  }
}

const ISRAEL_TIMEZONE = 'Asia/Jerusalem';

/**
 * Deterministic idempotency fingerprint for a booking-create request.
 *
 * Double-tap / network-retry protection (booking-hardening 2026-06-20):
 * if the caller supplies an `Idempotency-Key` header we trust THAT (scoped to
 * the owner so two users can never collide on the same key). Otherwise we
 * derive a stable key from the natural identity of the booking
 * (owner + provider + window + service). Either way the same logical request
 * maps to the same fingerprint, and the partial-unique index on
 * booking_requests.booking_fingerprint blocks the duplicate row.
 *
 * Always returns a value (≤200 chars). NEVER throws — a fingerprint failure
 * must not block a booking, so the caller treats a thrown error as "no key".
 */
function computeBookingFingerprint(input: {
  headerKey?: string | null;
  ownerId: string;
  providerId: string;
  startISO: string;
  endISO: string;
  serviceType: string;
}): string {
  const headerKey = (input.headerKey ?? '').trim();
  if (headerKey && /^[a-zA-Z0-9\-_]{1,128}$/.test(headerKey)) {
    // Scope the client key to the owner so a guessed/shared key from another
    // account can never short-circuit this user's booking.
    return `idem:${input.ownerId}:${headerKey}`.slice(0, 200);
  }
  const basis = [
    input.ownerId,
    input.providerId,
    input.startISO,
    input.endISO,
    input.serviceType,
  ].join('|');
  return `fp:${createHash('sha256').update(basis).digest('hex')}`; // ~67 chars
}

function buildEventPayload(booking: any): BookingEventPayload {
  return {
    requestId: booking.requestId,
    providerType: booking.providerType,
    serviceType: booking.serviceType,
    ownerId: booking.ownerId,
    providerId: booking.providerId,
    startDate: booking.startDate?.toISOString?.() || String(booking.startDate),
    endDate: booking.endDate?.toISOString?.() || String(booking.endDate),
    totalDays: booking.totalDays || 1,
    totalCents: booking.totalCents,
    subtotalCents: booking.subtotalCents,
    serviceFeeCents: booking.serviceFeeCents,
    currency: booking.currency || 'ILS',
    status: booking.status,
    message: booking.ownerMessage || undefined,
  };
}

const router = Router();

/**
 * POST /api/booking-requests - Create a new booking request
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // LEGAL BLOCK: PetTrek is not licensed in Israel — reject at booking-request creation layer
    const rawServiceType = req.body?.serviceType;
    if (rawServiceType === 'pettrek' || rawServiceType === 'pet_trek') {
      return res.status(403).json({
        error: 'service_legally_blocked',
        code: 'PETTREK_NOT_LICENSED',
        message: 'PetTrek™ bookings are not available — service pending licensing in Israel.',
      });
    }

    // ARCHITECTURE BLOCK (Phase B6): K9000 self-service kiosks must NEVER
    // create a marketplace booking_request row. K9000 is the Nayax + QR
    // self-service flow — two bays as kiosk capacity, no appointment, no
    // accept/decline cycle, no provider lifecycle. Walk-up customers tap
    // the Nayax terminal directly; registered customers redeem credit /
    // loyalty / e-gift via the Nayax QR reader.
    //
    // The legacy `'k9000'` value in the providerType enum exists for
    // reporting compatibility only. Reject it explicitly here so future
    // code can never accidentally pull K9000 into the marketplace flow.
    const rawProviderType = req.body?.providerType;
    if (rawProviderType === 'k9000' || rawServiceType === 'k9000_wash') {
      logger.warn('[BookingRequests] K9000 booking attempt rejected — kiosk flow only', {
        userId, providerType: rawProviderType, serviceType: rawServiceType,
      });
      return res.status(400).json({
        error: 'K9000 stations are self-service kiosks — no booking required.',
        code: 'K9000_NOT_A_BOOKING',
        message: 'Use the Nayax terminal at the station (tap-to-pay) or the mobile QR / numeric code redemption flow. K9000 sessions are not appointments.',
      });
    }

    const data = createBookingRequestSchema.parse(req.body);
    const requestId = nanoid(12);
    
    // Validate dates are not in the past (Israel timezone)
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    const todayIsrael = new Date().toLocaleDateString('en-CA', { timeZone: ISRAEL_TIMEZONE });
    const startDateStr = startDate.toLocaleDateString('en-CA', { timeZone: ISRAEL_TIMEZONE });
    if (startDateStr < todayIsrael) {
      return res.status(400).json({ error: 'Start date cannot be in the past' });
    }
    
    if (endDate < startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // ── Idempotency fingerprint + fast-path pre-check (booking-hardening) ──────
    // Double-tap / network-retry / back-button race protection. Compute a
    // deterministic key (optional Idempotency-Key header, else hash of the
    // booking's natural identity) and check for an existing row BEFORE we run
    // pricing or write anything. On a hit we return the EXISTING booking (200)
    // — never a duplicate. FAIL-SAFE: if the fingerprint compute or lookup
    // throws we proceed WITHOUT the fast path; the partial-unique index on the
    // insert below is the backstop, so the worst case is one extra recompute,
    // never a duplicate booking.
    let bookingFingerprint: string | null = null;
    try {
      bookingFingerprint = computeBookingFingerprint({
        headerKey: (req.headers['idempotency-key'] as string | undefined) ?? null,
        ownerId: userId,
        providerId: data.providerId,
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        serviceType: data.serviceType,
      });

      const [dup] = await db.select()
        .from(bookingRequests)
        .where(eq(bookingRequests.bookingFingerprint, bookingFingerprint))
        .limit(1);
      if (dup) {
        logger.info('[BookingRequests] Idempotent replay — returning existing booking', {
          requestId: dup.requestId, ownerId: userId, providerId: data.providerId,
        });
        return res.status(200).json({
          success: true,
          idempotent: true,
          booking: {
            requestId: dup.requestId,
            id: dup.id,
            status: dup.status,
            totalAmount: (dup.totalCents ?? 0) / 100,
            currency: dup.currency || 'ILS',
            startDate: dup.startDate,
            endDate: dup.endDate,
            petCount: dup.petCount,
            loyaltyRedeemedCents: dup.loyaltyRedeemedCents ?? 0,
          },
          message: 'This booking request was already submitted — no duplicate was created.',
        });
      }
    } catch (idemErr: any) {
      // Fail-safe: never block a booking on a fingerprint/lookup error. The
      // partial-unique index on insert still prevents duplicate rows.
      logger.warn('[BookingRequests] Idempotency pre-check skipped (non-fatal)', {
        error: idemErr?.message,
      });
      bookingFingerprint = bookingFingerprint ?? null;
    }

    // Check for conflicting bookings with same provider
    const existingRequests = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, data.providerId),
        sql`${bookingRequests.status} IN ('pending', 'accepted', 'confirmed', 'in_progress')`,
        sql`${bookingRequests.startDate} < ${endDate.toISOString()}::timestamp`,
        sql`${bookingRequests.endDate} > ${startDate.toISOString()}::timestamp`
      ));
    
    if (existingRequests.length > 0) {
      return res.status(409).json({
        error: 'Provider already has a booking for the selected dates',
        code: 'PROVIDER_UNAVAILABLE',
      });
    }
    
    // ── Pricing ────────────────────────────────────────────────────────────────
    // If the frontend passed finalQuote (from /api/quotes/preview), use it directly.
    // Otherwise fall back to simple legacy calculation.
    const fq = data.finalQuote;
    
    let subtotalCents: number;
    let serviceFeeCents: number;
    let totalCents: number;
    let totalDays: number;
    let dailyRateCents = 0;
    let hourlyRateCents = 0;
    const serviceFeePercent = 15;
    
    totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    if (fq && fq.success && typeof fq.totals?.totalCents === 'number') {
      // ── Safety checks before trusting the client-supplied quote ──────────────

      // 1. Provider mismatch — quote was generated for a different provider
      if (fq.providerId && fq.providerId !== data.providerId) {
        return res.status(400).json({
          error: 'Quote provider mismatch. Please restart your booking.',
          code: 'QUOTE_PROVIDER_MISMATCH',
        });
      }

      // 2. Service type mismatch — quote was generated for a different service
      if (fq.serviceType && fq.serviceType !== data.serviceType) {
        return res.status(400).json({
          error: 'Quote service type mismatch. Please restart your booking.',
          code: 'QUOTE_SERVICE_MISMATCH',
        });
      }

      // 3. ALWAYS recompute the quote server-side — NEVER trust client totals.
      // `finalQuote` is `z.any()` in the schema, so fq.totals is fully attacker-
      // controlled; the old code only repriced when the quote was >10min stale and
      // otherwise charged fq.totals.totalCents verbatim (a client could POST
      // totalCents:1 with a fresh quotedAt and book a multi-day multi-pet sit for
      // ₪0.01). We now re-run the pricing engine with the SERVER's own inputs and
      // use ITS numbers. The client total is a display value only: if it diverges
      // from the authoritative server total by more than a rounding agora we refuse
      // and surface the real price (blocks forgery AND honest stale quotes, and
      // never silently charges a surprise price — Consumer Protection §17a).
      const freshQuote = await calculateQuote({
        providerId: data.providerId,
        serviceType: data.serviceType,
        bookingWindow: { startAt: startDate.toISOString(), endAt: endDate.toISOString() },
        pets: data.petDetails ?? [],
        addons: data.selectedAddons ?? [],
        promoCode: data.promoCode ?? null,
        userId,
      });
      if (!freshQuote.success || typeof freshQuote.totals?.totalCents !== 'number') {
        return res.status(400).json({
          error: 'We could not price this booking right now. Please try again.',
          code: 'QUOTE_RECOMPUTE_FAILED',
        });
      }
      if (Math.abs(freshQuote.totals.totalCents - fq.totals.totalCents) > 1) {
        logger.warn('[BookingRequest] client quote total rejected — diverges from server recompute', {
          providerId: data.providerId,
          clientTotalCents: fq.totals.totalCents,
          serverTotalCents: freshQuote.totals.totalCents,
        });
        return res.status(409).json({
          error: 'The price has changed since your quote. Please review the updated price before confirming.',
          code: 'QUOTE_PRICE_CHANGED',
          freshQuote,
        });
      }
      // Authoritative SERVER totals — never the client's. The engine now
      // includes the 15% platform fee INSIDE totalCents (quoteEngine 6b) and
      // reports it separately — the old `serviceFeeCents = 0 // already
      // included` comment was false (the engine added NO fee), so every
      // wizard booking collected 0% commission and its receipt declared
      // ₪0 VAT (2026-07-30 audit).
      subtotalCents = freshQuote.totals.subtotalCents;
      serviceFeeCents = freshQuote.totals.serviceFeeCents ?? 0;
      totalCents = freshQuote.totals.totalCents;
    } else {
      // Legacy fallback (2026-07-30 rewrite): the profile is resolved by the
      // TARGET provider's uid, never by a client-supplied profile id alone.
      // Before: (a) BookingContact sends no providerProfileId, so every
      // contact-path request skipped the lookups and priced at a fictional
      // hardcoded ₪150/day; (b) providerProfileId was trusted unchecked — a
      // caller could book an expensive sitter at any cheaper sitter's rate.
      if (data.providerType === 'sitter') {
        const [sitter] = await db.select().from(sitterProfiles)
          .where(eq(sitterProfiles.userId, data.providerId)).limit(1);
        if (sitter) dailyRateCents = sitter.pricePerDayCents || 0;
        if (data.providerProfileId && sitter && sitter.id !== data.providerProfileId) {
          return res.status(400).json({ error: 'Provider profile mismatch.', code: 'PROVIDER_PROFILE_MISMATCH' });
        }
      } else if (data.providerType === 'walker') {
        const [walker] = await db.select().from(walkerProfiles)
          .where(eq(walkerProfiles.userId, data.providerId)).limit(1);
        if (walker) hourlyRateCents = parseInt(walker.hourlyRate || '0');
        if (data.providerProfileId && walker && walker.id !== data.providerProfileId) {
          return res.status(400).json({ error: 'Provider profile mismatch.', code: 'PROVIDER_PROFILE_MISMATCH' });
        }
      } else if (data.providerType === 'trainer') {
        const [trainer] = await db.select().from(trainers)
          .where(eq(trainers.userId, data.providerId)).limit(1);
        if (trainer) hourlyRateCents = parseFloat(trainer.hourlyRate || '0') * 100;
        if (data.providerProfileId && trainer && trainer.id !== data.providerProfileId) {
          return res.status(400).json({ error: 'Provider profile mismatch.', code: 'PROVIDER_PROFILE_MISMATCH' });
        }
      }

      if (dailyRateCents > 0) {
        subtotalCents = dailyRateCents * totalDays * data.petCount;
      } else if (hourlyRateCents > 0) {
        subtotalCents = hourlyRateCents * data.petCount;
      } else {
        // No published rate — refuse to invent a price (§17a: the number the
        // customer commits to must be the provider's real one).
        return res.status(422).json({
          error: 'This provider has not published a rate yet. Please contact them via chat first.',
          code: 'PROVIDER_RATE_MISSING',
        });
      }
      serviceFeeCents = Math.round(subtotalCents * serviceFeePercent / 100);
      totalCents = subtotalCents + serviceFeeCents;
    }
    
    // Derive petDetails persisted on the booking row (used for display, not pricing)
    const petDetailsForRow = data.petDetails && data.petDetails.length > 0
      ? data.petDetails
      : null;
    
    // ── Phase B6 — customer address snapshot ──────────────────────────────────
    // Freeze the customer's address at booking-create time so the booking
    // row has a permanent record of WHERE the service was requested,
    // independent of the customer's mutable profile address. All fields
    // optional — legacy callers without the autocomplete keep working.
    let addrSrc = (data as any).customerAddress ?? null;
    // No address in the body (the live clients never send one — 2026-07-30
    // audit: every snapshot column was NULL, so reminders/receipts showed a
    // placeholder) → enrich server-side from the customer's saved address
    // book (user_addresses, default first). Fail-soft: no address, no block.
    let savedAccessFields: { floor?: string | null; entrance?: string | null; notes?: string | null } = {};
    if (!addrSrc) {
      try {
        const [saved] = await db.select().from(userAddresses)
          .where(eq(userAddresses.userId, userId))
          .orderBy(desc(userAddresses.isDefault), desc(userAddresses.lastUsedAt))
          .limit(1);
        if (saved) {
          addrSrc = {
            formattedAddress: saved.address,
            street: saved.street,
            streetNumber: saved.streetNumber,
            apartment: saved.apartment,
            city: saved.city,
            postalCode: saved.postalCode,
            latitude: saved.lat != null ? Number(saved.lat) : undefined,
            longitude: saved.lng != null ? Number(saved.lng) : undefined,
          };
          savedAccessFields = { floor: saved.floor, entrance: saved.entrance, notes: saved.notes };
        }
      } catch (addrErr: any) {
        logger.warn('[BookingRequest] saved-address enrichment failed (non-blocking)', { error: addrErr?.message });
      }
    }
    const addressSnapshot = addrSrc ? {
      customerAddress:      addrSrc.formattedAddress?.slice(0, 5000) ?? null,
      customerStreet:       addrSrc.street ? stripHebrewStreetPrefix(addrSrc.street).slice(0, 200) : null,
      customerStreetNumber: addrSrc.streetNumber?.toString().slice(0, 40) ?? null,
      customerApartment:    addrSrc.apartment?.toString().slice(0, 80) ?? null,
      customerCity:         addrSrc.city?.toString().slice(0, 120) ?? null,
      customerCityKey:      addrSrc.city ? cityKey(addrSrc.city).slice(0, 60) : null,
      customerCountry:      addrSrc.country?.toString().slice(0, 2).toUpperCase() ?? null,
      customerPostalCode:   normalizeIsraeliPostalCode(addrSrc.postalCode ?? null),
      customerLatitude:     typeof addrSrc.latitude === 'number' && Number.isFinite(addrSrc.latitude)
                              ? String(addrSrc.latitude) : null,
      customerLongitude:    typeof addrSrc.longitude === 'number' && Number.isFinite(addrSrc.longitude)
                              ? String(addrSrc.longitude) : null,
      customerPlaceId:      addrSrc.placeId?.toString().slice(0, 200) ?? null,
      // Access fields (mig 0108) — body value wins, saved address fills gaps.
      customerFloor:        (addrSrc.floor ?? savedAccessFields.floor)?.toString().slice(0, 30) ?? null,
      customerEntrance:     (addrSrc.entrance ?? savedAccessFields.entrance)?.toString().slice(0, 30) ?? null,
      customerAddressNotes: (addrSrc.notes ?? savedAccessFields.notes)?.toString().slice(0, 2000) ?? null,
    } : {};

    // ── Proximity guard at booking creation (FAIL OPEN) ───────────────────────
    // Search filters providers by distance, but until now nothing re-checked it
    // when the booking ROW was written — a stale search result (or a provider who
    // moved) could create an out-of-range booking. Re-check with the SAME
    // haversine the search uses. FAIL OPEN: only rejects when BOTH customer and
    // provider have real coords AND distance clearly exceeds the allowed radius
    // (+ buffer). Missing coords → skip + allow. Admin override via x-admin-booking.
    // STRICT: no pricing/payment/wallet logic here — pure read-only distance.
    try {
      // Customer coords: prefer the SERVICE address captured for this booking,
      // fall back to the customer's profile coordinates.
      let cLat: number | string | null =
        addrSrc && typeof addrSrc.latitude === 'number' ? addrSrc.latitude : null;
      let cLng: number | string | null =
        addrSrc && typeof addrSrc.longitude === 'number' ? addrSrc.longitude : null;
      if (cLat == null || cLng == null) {
        const [custRow] = await db
          .select({ lat: users.latitude, lng: users.longitude })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        cLat = custRow?.lat ?? null;
        cLng = custRow?.lng ?? null;
      }

      // Provider coords: users.latitude/longitude is usually NULL — providers
      // are geocoded in their PROFILE tables, which is exactly what search
      // ranks on. Reading only `users` meant the geofence fail-opened
      // (skipped:'no-coords') for practically every real provider — the guard
      // silently never fired (audit finding, 2026-07-24). Fall back to the
      // profile coordinates so the service-area check actually works.
      let [provRow] = await db
        .select({ lat: users.latitude, lng: users.longitude })
        .from(users)
        .where(eq(users.id, data.providerId))
        .limit(1);

      if (provRow?.lat == null || provRow?.lng == null) {
        const svc = String(data.serviceType || '').toLowerCase();
        if (svc.includes('walk')) {
          const [wp] = await db
            .select({ lat: walkerProfiles.currentLatitude, lng: walkerProfiles.currentLongitude })
            .from(walkerProfiles)
            .where(eq(walkerProfiles.userId, data.providerId))
            .limit(1);
          if (wp?.lat != null && wp?.lng != null) provRow = { lat: wp.lat as any, lng: wp.lng as any };
        } else {
          const [sp] = await db
            .select({ lat: sitterProfiles.latitude, lng: sitterProfiles.longitude })
            .from(sitterProfiles)
            .where(eq(sitterProfiles.userId, data.providerId))
            .limit(1);
          if (sp?.lat != null && sp?.lng != null) provRow = { lat: sp.lat as any, lng: sp.lng as any };
        }
      }

      // Radius: walkers travel to the pet and declare a service radius — use it.
      // Other domains have no per-provider radius → generous env default.
      let maxKm: number | null = BOOKING_MAX_DISTANCE_KM;
      if (String(data.serviceType || '').toLowerCase().includes('walk')) {
        const [wp] = await db
          .select({ r: walkerProfiles.serviceRadiusKm })
          .from(walkerProfiles)
          .where(eq(walkerProfiles.userId, data.providerId))
          .limit(1);
        if (wp?.r != null && wp.r > 0) maxKm = wp.r;
      }

      // Admin-created bookings may bypass the geofence (e.g. concierge placing a
      // booking on behalf of a customer). MUST be a VERIFIED super-admin — the
      // header alone is spoofable by any client, which defeated the service-area
      // geofence. isSuperAdminVerified checks a real, email-verified admin claim.
      const adminBypass =
        String(req.headers['x-admin-booking'] || '').toLowerCase() === 'true' &&
        isSuperAdminVerified(req as any);

      const prox = checkBookingProximity({
        customerLat: cLat,
        customerLng: cLng,
        providerLat: provRow?.lat ?? null,
        providerLng: provRow?.lng ?? null,
        maxKm,
        bypass: adminBypass,
      });

      if (!prox.ok) {
        logger.warn('[BookingRequests] proximity reject at creation', {
          requestId, providerId: data.providerId,
          distanceKm: Math.round(prox.distanceKm), maxKm: prox.maxKm,
        });
        return res.status(400).json({
          error: 'OUT_OF_RANGE',
          code: 'OUT_OF_RANGE',
          message: `This provider serves up to ${prox.maxKm} km, but the booking address is about ${Math.round(prox.distanceKm)} km away. Please choose a closer provider.`,
          distanceKm: Math.round(prox.distanceKm),
          maxKm: prox.maxKm,
        });
      }
      if (prox.ok && prox.skipped === 'no-coords') {
        logger.info('[BookingRequests] proximity check skipped — missing coords (fail open)', { requestId });
      }
    } catch (proxErr: any) {
      // Any unexpected error in the guard must NEVER block a booking.
      logger.warn('[BookingRequests] proximity check error — fail open', {
        requestId, error: proxErr?.message,
      });
    }

    // ── Create booking request row + atomic slot lock ──────────────────────────
    // Wraps both in a single transaction. The slot-lock table has a
    // Postgres EXCLUDE constraint (migration 0028) — overlapping inserts
    // for the same provider fail at the DB level, rolling back the whole
    // transaction (lock + booking). Closes the hostile-audit critical
    // "two customers booking the same provider at the same minute".
    let booking: typeof bookingRequests.$inferSelect | undefined;
    try {
      booking = await db.transaction(async (tx) => {
        await acquireSlotLock(tx as unknown as typeof db, {
          providerId: data.providerId,
          startAt: startDate,
          endAt: endDate,
          bookingRef: requestId,
          serviceType: data.serviceType,
        });

        const [row] = await tx.insert(bookingRequests).values({
          requestId,
          ownerId: userId,
          bookingFingerprint, // idempotency key (nullable; partial-unique index)
          providerId: data.providerId,
          providerProfileId: data.providerProfileId || null,
          providerType: data.providerType,
          serviceType: data.serviceType,
          startDate,
          endDate,
          ...addressSnapshot,
          petIds: data.petIds || (data.petDetails?.map(p => String(p.petId ?? '')).filter(Boolean) ?? []),
          petCount: data.petCount,
          petDetails: petDetailsForRow,
          dailyRateCents: dailyRateCents || null,
          hourlyRateCents: hourlyRateCents || null,
          totalDays,
          totalHours: null,
          subtotalCents,
          serviceFeePercent: serviceFeePercent.toString(),
          serviceFeeCents,
          totalCents,
          // Quote engine columns (stored when finalQuote is provided)
          ...(fq && fq.success ? {
            quoteSubtotalCents: fq.totals.subtotalCents,
            quoteDiscountCents: fq.totals.discountCents,
            quoteCreditCents: fq.totals.walletCreditAppliedCents,
            quoteGiftCardCents: fq.totals.giftCardAppliedCents,
            quoteTaxCents: fq.totals.taxCents,
            quoteTotalCents: fq.totals.totalCents,
            quoteCurrency: fq.currency || 'ILS',
            quoteBreakdown: fq,
            pricingVersion: fq.pricingVersion || 'v1.0.0',
            promoCode: data.promoCode || null,
            loyaltyRedeemedCents: fq.totals.loyaltyRedeemedCents ?? 0,
          } : {}),
          currency: 'ILS',
          status: 'pending',
          statusHistory: [{ status: 'pending', timestamp: new Date().toISOString(), note: 'Booking request created' }],
          ownerMessage: data.message || null,
          specialRequirements: data.specialRequirements || null,
          searchId: data.searchId || null,
        })
        // ── Idempotency backstop (booking-hardening) ──────────────────────────
        // If a concurrent request with the SAME fingerprint already inserted a
        // row, the partial-unique index fires and ON CONFLICT DO NOTHING returns
        // 0 rows instead of throwing. We detect that below and return the winner.
        // Only applies when a fingerprint is present (NULL never conflicts).
        .onConflictDoNothing(
          bookingFingerprint
            ? { target: bookingRequests.bookingFingerprint }
            : undefined,
        )
        .returning();
        return row; // may be undefined when the fingerprint lost the race
      });
    } catch (err) {
      if (err instanceof BookingSlotConflictError) {
        return res.status(409).json({
          error: 'Slot conflict',
          message: 'This provider is already booked for an overlapping time window.',
          providerId: err.providerId,
          startAt: err.startAt.toISOString(),
          endAt: err.endAt.toISOString(),
        });
      }
      throw err;
    }

    // ── Idempotency race resolution ─────────────────────────────────────────
    // The insert was a no-op (ON CONFLICT DO NOTHING) because a concurrent
    // duplicate won. The slot lock was rolled back with the empty insert's
    // transaction, so re-fetch the winning row by fingerprint and return it
    // (200) rather than a duplicate or a 500. FAIL-SAFE: prefers blocking the
    // duplicate over crashing.
    if (!booking) {
      const [winner] = bookingFingerprint
        ? await db.select()
            .from(bookingRequests)
            .where(eq(bookingRequests.bookingFingerprint, bookingFingerprint))
            .limit(1)
        : [];
      if (winner) {
        logger.info('[BookingRequests] Idempotent insert collision — returning winning booking', {
          requestId: winner.requestId, ownerId: userId,
        });
        return res.status(200).json({
          success: true,
          idempotent: true,
          booking: {
            requestId: winner.requestId,
            id: winner.id,
            status: winner.status,
            totalAmount: (winner.totalCents ?? 0) / 100,
            currency: winner.currency || 'ILS',
            startDate: winner.startDate,
            endDate: winner.endDate,
            petCount: winner.petCount,
            loyaltyRedeemedCents: winner.loyaltyRedeemedCents ?? 0,
          },
          message: 'This booking request was already submitted — no duplicate was created.',
        });
      }
      // No fingerprint and no row should be impossible (insert without conflict
      // target always returns a row). Treat as a transient failure.
      logger.error('[BookingRequests] Insert returned no row and no fingerprint winner', { requestId });
      return res.status(409).json({
        error: 'DUPLICATE_OR_CONFLICT',
        message: 'Your booking could not be created. If you already submitted it, check your bookings.',
      });
    }

    // ── Sync to the Octopus main brain (financial ledger) ──────────────────────
    // The DIRECT marketplace booking_requests path wrote ZERO octopus rows (only
    // walk+sitter did, inline), so marketplace + grooming revenue was invisible to
    // /admin/octopus. Idempotent on requestId (unique idempotencyKey); non-blocking;
    // fires only for a genuinely-new booking (past the dedup guard above). (2026-07-27)
    try {
      const obId = `OB-MKT-${randomBytes(4).toString('hex').toUpperCase()}`;
      const priceCents = booking.totalCents ?? totalCents ?? 0;
      const feeCents = booking.serviceFeeCents ?? serviceFeeCents ?? 0;
      const octPlatform = booking.serviceType || booking.providerType || 'marketplace';
      const [ob] = await db.insert(octopusBookings).values({
        id: obId,
        platform: octPlatform,
        status: 'DRAFT',
        userId: booking.ownerId || userId,
        providerId: booking.providerId || data.providerId || null,
        price: priceCents,
        platformFee: feeCents,
        providerShare: Math.max(0, priceCents - feeCents),
        idempotencyKey: `br:${booking.requestId}`,
      }).onConflictDoNothing({ target: octopusBookings.idempotencyKey }).returning();
      if (ob) {
        await db.insert(octopusLedger).values({
          id: `OL-${randomBytes(4).toString('hex')}`,
          type: 'BOOKING_CREATED',
          bookingId: ob.id,
          amount: priceCents,
          platform: octPlatform,
          metadata: { bookingRequestId: booking.requestId, ownerId: booking.ownerId || userId, providerType: booking.providerType },
        });
      }
    } catch (octErr) { logger.warn('[Octopus Brain] marketplace record failed (non-blocking)', { err: String(octErr) }); }

    // ── Persist multi-pet rows ─────────────────────────────────────────────────
    // Map clientRef → DB row ID so we can attach per-pet addons
    const petRowMap: Record<string, string> = {};
    
    if (data.petDetails && data.petDetails.length > 0 && booking.id) {
      const petLineItems: Record<string, any> = {};
      if (fq?.success && Array.isArray(fq.lineItems?.pets)) {
        for (const li of fq.lineItems.pets) {
          petLineItems[li.clientRef] = li;
        }
      }
      
      for (const pd of data.petDetails) {
        const li = petLineItems[pd.clientRef] || {};
        const [petRow] = await db.insert(bookingRequestPets).values({
          bookingRequestId: booking.id,
          petId: pd.petId ? Number(pd.petId) : null,
          petName: pd.petName,
          petType: pd.petType,
          breed: pd.breed || null,
          sizeCategory: pd.sizeCategory || null,
          ageYears: pd.ageYears ? String(pd.ageYears) : null,
          weightKg: pd.weightKg ? String(pd.weightKg) : null,
          gender: pd.gender || null,
          specialNotes: [pd.specialNotes, pd.feedingInstructions, pd.currentSkills, pd.trainingGoals]
            .filter(Boolean).join(' | ') || null,
          requiresMedication: !!pd.requiresMedication,
          hasBehaviorFlag: !!pd.hasBehaviorFlag,
          hasSpecialNeeds: !!pd.hasSpecialNeeds,
          quantity: 1,
          basePriceCents: li.basePriceCents || 0,
          adjustmentPriceCents: li.adjustmentPriceCents || 0,
          subtotalPriceCents: li.subtotalPriceCents || 0,
          currency: 'ILS',
          pricingSnapshot: li.pricingSnapshot || null,
        }).returning();
        petRowMap[pd.clientRef] = petRow.id;
      }
    }
    
    // ── Persist addon rows ─────────────────────────────────────────────────────
    if (data.selectedAddons && data.selectedAddons.length > 0 && booking.id) {
      const addonLineItems: Record<string, any> = {};
      if (fq?.success && Array.isArray(fq.lineItems?.addons)) {
        for (const li of fq.lineItems.addons) {
          addonLineItems[li.addonCode] = li;
        }
      }
      
      for (const addon of data.selectedAddons) {
        const li = addonLineItems[addon.addonCode] || {};
        const petRowId = addon.scope === 'pet' && addon.petRef
          ? (petRowMap[addon.petRef] || null)
          : null;
          
        await db.insert(bookingRequestAddons).values({
          bookingRequestId: booking.id,
          bookingRequestPetId: petRowId,
          addonCode: addon.addonCode,
          addonName: addon.addonName,
          addonScope: addon.scope,
          quantity: addon.quantity || 1,
          unitPriceCents: addon.unitPriceCents || li.unitPriceCents || 0,
          subtotalPriceCents: li.subtotalPriceCents || (addon.unitPriceCents * (addon.quantity || 1)) || 0,
          currency: 'ILS',
          pricingSnapshot: li,
        });
      }
    }

    logger.info('[BookingRequests] Created new booking request', {
      requestId,
      ownerId: userId,
      providerId: data.providerId,
      serviceType: data.serviceType,
      totalCents,
      petCount: data.petDetails?.length || data.petCount,
      addonCount: data.selectedAddons?.length || 0,
      usedQuoteEngine: !!(fq?.success),
    });

    logBookingEvent('created', buildEventPayload(booking), {
      customerRequestedAt: new Date().toISOString(),
    }).catch(() => {});

    eventPublisher.publishEvent(
      DomainEventType.BOOKING_CREATED,
      {
        bookingId: requestId,
        userId: booking.ownerId,
        providerId: booking.providerId,
        serviceType: booking.serviceType,
        totalCents: booking.totalCents,
      },
      { source: 'booking-requests/create', aggregateType: 'booking', aggregateId: requestId, userId: booking.ownerId },
    ).catch((e: any) => logger.error('[BookingRequests] BOOKING_CREATED event publish failed', { error: e?.message, requestId }));

    // Communication Hub: spawn the canonical entity-linked BOOKING thread for this
    // enquiry so the conversation shows in the inbox tied to a REAL booking record
    // (the core rule). Non-blocking + fail-safe — goes live once migration 0084
    // (chat_threads) is applied; until then this just no-ops with a warning.
    setImmediate(async () => {
      try {
        const { getOrCreateThread } = await import('../services/chatThreadService');
        await getOrCreateThread({
          threadType: 'BOOKING',
          bookingId: requestId,
          customerUserId: booking.ownerId,
          providerUserId: booking.providerId ?? null,
        });
      } catch (e: any) {
        logger.warn('[BookingRequests] BOOKING chat thread create skipped (non-blocking)', { error: e?.message, requestId });
      }
    });

    // ── LINK-TWO-USERS FRAUD SIGNAL (CEO 2026-07-03) ─────────────────────────
    // If the booker and provider are different accounts sharing the SAME saved
    // address, flag a self-dealing / duplicate-account risk for admin review.
    // Best-effort + non-blocking — never affects the booking. De-duped: one open
    // case per (owner, provider) pair.
    if (booking.providerId && booking.ownerId && booking.providerId !== booking.ownerId) {
      const bOwnerId = booking.ownerId;
      const bProviderId = booking.providerId;
      void (async () => {
        try {
          const { checkBookingAddressMatch } = await import('../lib/addressMatch');
          const verdict = await checkBookingAddressMatch(bOwnerId, bProviderId);
          if (!verdict.match || !verdict.evidence) return;
          const ev = verdict.evidence;
          // GUARDRAIL: a LOW-confidence match (backed only by free-text, no
          // matching structured/postal fields) is the most likely legitimate
          // overlap (same building, coincidental format) — log it, but do NOT
          // open a case, to avoid falsely accusing real customers.
          if (verdict.confidence === 'low') {
            logger.info('[BookingRequests] address-match LOW confidence — logged, no case', {
              requestId, reasonCode: ev.reasonCode, matchedFields: ev.matchedFields,
            });
            return;
          }
          const { incidentReports } = await import('@shared/schema-incidents');
          const existing = await db.select({ id: incidentReports.id }).from(incidentReports)
            .where(and(
              eq(incidentReports.incidentType, 'linked_account_address_match'),
              eq(incidentReports.memberId, bOwnerId),
              eq(incidentReports.providerId, bProviderId),
              eq(incidentReports.status, 'open'),
            )).limit(1);
          if (existing.length > 0) return;
          const { openIncident } = await import('../services/incidentService');
          // Full evidence bundle in the description so a human can judge without
          // guessing — raw addresses (spelling visible), reason code, confidence,
          // matched fields, and account-age (staleness) signals.
          const description = [
            `REVIEW REQUIRED — non-punitive. Do NOT auto-terminate. Booker and provider are different accounts with the same saved address (possible self-dealing / duplicate account, but could be a shared household/building — a human must decide).`,
            `Booking: ${requestId}`,
            `Reason code: ${ev.reasonCode} · Confidence: ${ev.confidence}`,
            `Matched structured fields: ${ev.matchedFields.join(', ') || '(free-text only)'}`,
            `Owner address: "${ev.ownerRaw}"`,
            `Provider address: "${ev.providerRaw}"`,
            `Normalized match: "${ev.normalized}"`,
            `Owner account last updated: ${ev.ownerAccountUpdatedAt ?? 'unknown'} · Provider: ${ev.providerAccountUpdatedAt ?? 'unknown'}`,
            `Checked at: ${ev.checkedAt}`,
          ].join('\n');
          const inc = await openIncident({
            // High-confidence (postal + street number) → medium severity; otherwise low.
            type: 'linked_account_address_match',
            severity: verdict.confidence === 'high' ? 'medium' : 'low',
            description,
            bookingId: String(requestId), memberId: bOwnerId, providerId: bProviderId,
            reportedBy: 'system:address-match',
          });
          logger.warn('[BookingRequests] Same-address fraud signal — case opened', {
            requestId, caseId: inc.incidentId, confidence: ev.confidence, reasonCode: ev.reasonCode,
          });
        } catch (e: any) {
          logger.warn('[BookingRequests] address-match check failed (non-blocking)', { requestId, error: e?.message });
        }
      })();
    }

    // Notify provider of new booking request — in-app + email + SMS (non-blocking, best-effort)
    if (booking.providerId) {
      // Fetch provider contact details for email/SMS channels
      const [providerUser] = await db
        .select({ email: users.email, phone: users.phone })
        .from(users)
        .where(eq(users.id, booking.providerId))
        .limit(1)
        .catch(() => []);

      const serviceLabel = data.serviceType?.replace(/_/g, ' ') || 'service';
      const notifBody = `You have a new ${serviceLabel} booking request. Check your dashboard to accept or decline.`;

      dispatchNotification({
        uid: booking.providerId,
        email: providerUser?.email ?? undefined,
        phone: providerUser?.phone ?? undefined,
        type: 'booking_request',
        title: '📅 New Booking Request',
        bodyHtml: `<p>You have a new <strong>${serviceLabel}</strong> booking request.</p><p>Please <a href="${process.env.APP_URL || 'https://petwash.co.il'}/provider/bookings/${requestId}">review and respond</a> within 24 hours.</p>`,
        bodyText: notifBody,
        ctaText: 'View Booking',
        // Deep-link straight to the provider job-detail screen (accept/decline lives there).
        ctaUrl: `${process.env.APP_URL || 'https://petwash.co.il'}/provider/jobs/${requestId}`,
        // 'in_app' was a silent no-op — the dispatcher's channel is named 'inbox',
        // so providers were getting email+SMS but NO inbox message. Fixed, and
        // 'push' added so the Provider app buzzes like a real work app (spec §11).
        channels: ['inbox', 'email', 'sms', 'push'],
        priority: 10,
        meta: { bookingId: requestId },
      }).catch((notifErr: any) =>
        logger.warn('[BookingRequests] Provider notification failed (non-blocking)', { error: notifErr?.message, requestId })
      );
    }

    // Notify the CUSTOMER that their booking REQUEST (enquiry) was sent —
    // pre-acceptance, pre-payment. Original PetWash wording, bright gold,
    // bilingual (He-first). NO competitor terms, NO insurance/guarantee claim.
    // Reassures "you haven't been charged" and lays out the next steps the
    // master booking-lifecycle spec defines. Non-blocking, best-effort: a
    // notification failure must never break booking creation.
    if (booking.ownerId) {
      const [ownerUser] = await db
        .select({ email: users.email, phone: users.phone, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, booking.ownerId))
        .limit(1)
        .catch(() => []);

      const svc = data.serviceType?.replace(/_/g, ' ') || 'service';
      const petName = data.petDetails?.[0]?.petName || '';
      const fmtDate = (d: any) => { try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return ''; } };
      const dateRange = `${fmtDate(booking.startDate)} – ${fmtDate(booking.endDate)}`;
      const appUrl = process.env.APP_URL || 'https://petwash.co.il';
      const detailsUrl = `${appUrl}/booking/confirmation/${requestId}`;
      const gold = '#D4AF37';
      const hi = ownerUser?.firstName ? ` ${ownerUser.firstName}` : '';

      const customerBodyHtml =
        `<p>שלום${hi}, בקשת ההזמנה שלך נשלחה בהצלחה ושותפה עם הספק לבדיקה. נעדכן אותך ברגע שתתקבל תשובה. <strong>עדיין לא בוצע חיוב.</strong></p>` +
        `<p style="margin:12px 0;padding:12px 14px;border-right:3px solid ${gold};background:#faf7ec">` +
        `<strong>פרטי הבקשה</strong><br/>שירות: ${svc}${petName ? `<br/>חיית מחמד: ${petName}` : ''}<br/>תאריכים: ${dateRange}<br/>מספר בקשה: ${requestId}</p>` +
        `<p><strong>מה קורה עכשיו?</strong><br/>1. השלמת פרופיל חיית המחמד · 2. תיאום פגישת היכרות · 3. הספק בודק ומגיב · 4. אישור ותשלום מאובטח דרך PetWash בלבד.</p>` +
        `<p style="color:#666;font-size:13px">לביטחונך — תקשורת ותשלום תמיד דרך PetWash. כך נשמרים ההזמנה, פרטי הטיפול והתיעוד.</p>` +
        `<hr/>` +
        `<p><em>Hi${hi}, your booking request has been sent and shared with the provider for review. We'll notify you as soon as they respond. <strong>You haven't been charged.</strong></em></p>` +
        `<p><em>Service: ${svc}${petName ? ` · Pet: ${petName}` : ''} · Dates: ${dateRange} · Ref: ${requestId}</em></p>` +
        `<p><em>What happens next? 1) Complete your pet profile 2) Arrange a Meet &amp; Greet 3) Provider reviews &amp; responds 4) Confirm &amp; pay securely — always inside PetWash.</em></p>`;

      const customerSms = `PetWash: your ${svc} booking request was sent to the provider. Ref ${requestId}. We'll let you know when they respond: ${detailsUrl}`;

      dispatchNotification({
        uid: booking.ownerId,
        email: ownerUser?.email ?? undefined,
        phone: ownerUser?.phone ?? undefined,
        type: 'booking_request_sent',
        title: 'בקשת ההזמנה נשלחה · Booking request sent',
        bodyHtml: customerBodyHtml,
        bodyText: customerSms,
        ctaText: 'View booking',
        ctaUrl: detailsUrl,
        channels: ['inbox', 'email', 'sms'],
        priority: 8,
      }).catch((notifErr: any) =>
        logger.warn('[BookingRequests] Customer enquiry-sent notification failed (non-blocking)', { error: notifErr?.message, requestId })
      );
    }

    // Intelligence — advance customer journey state to ready_to_book
    if (booking.ownerId) {
      advanceJourneyState(booking.ownerId, 'ready_to_book').catch(err => logger.warn('[BookingRequests] advanceJourneyState ready_to_book failed', { ownerId: booking.ownerId, err: err?.message }));
    }

    // ── Loyalty credit redemption — synchronous debit after booking row exists ──
    // Amount was already reflected in the quote's totalCents.
    // Idempotency fingerprint prevents double-spend on retries.
    let loyaltyApplied = 0;
    const quotedLoyalty = (fq && fq.success) ? (fq.totals.loyaltyRedeemedCents ?? 0) : 0;
    if (data.applyLoyaltyCredits && quotedLoyalty > 0 && userId) {
      try {
        const redeemResult = await redeemLoyaltyCredit({
          userId:          userId,
          amountCents:     quotedLoyalty,
          bookingId:       booking.id,
          orderTotalCents: fq!.totals.subtotalCents,
          fingerprint:     `loyalty_redeem:${booking.requestId}`,
        });
        loyaltyApplied = redeemResult.applied;

        // If the applied amount differs from what was quoted (race condition),
        // update the booking row to reflect the actual debit.
        if (loyaltyApplied !== quotedLoyalty) {
          await db.update(bookingRequests)
            .set({ loyaltyRedeemedCents: loyaltyApplied })
            .where(eq(bookingRequests.id, booking.id));
          logger.warn('[Loyalty] Applied amount differs from quoted amount', {
            bookingId: booking.id, quotedLoyalty, loyaltyApplied,
          });
        }
      } catch (err: any) {
        logger.error('[Loyalty] Redemption failed after booking created', {
          bookingId: booking.id, error: err.message,
        });
        // Non-fatal: booking still succeeded. Credit stays in user's balance.
      }
    }

    // ── Wallet hold — freeze wallet credits for the duration of the booking ────
    // Amount comes from the quote engine's walletCreditAppliedCents.
    // Server re-validates the cap (50% of subtotal) before holding.
    // On ACCEPT: debitFromHold. On DECLINE/CANCEL: releaseHold.
    const quotedWalletCredit = (fq && fq.success) ? (fq.totals.walletCreditAppliedCents ?? 0) : 0;
    let walletHoldApplied = 0;
    if (quotedWalletCredit > 0 && userId) {
      try {
        const divisionCode = getDivisionCode(data.serviceType);
        // Re-validate cap server-side (protect against tampered quotes)
        const preview = await walletService.previewRedemption({
          userId,
          subtotalCents: subtotalCents,
          divisionCode,
        });
        walletHoldApplied = Math.min(quotedWalletCredit, preview.applicableCents);

        if (walletHoldApplied > 0) {
          const holdResult = await walletService.holdBookingWallet({
            userId,
            amountCents:  walletHoldApplied,
            bookingId:    booking.requestId,
            divisionCode,
            ipAddress:    req.ip ?? null,
          });

          await db.update(bookingRequests)
            .set({
              walletHoldCents: walletHoldApplied,
              walletHoldKey:   holdResult.txnId,
              financeState:    'hold_active',
              updatedAt:       new Date(),
            })
            .where(eq(bookingRequests.id, booking.id));

          logger.info('[BookingRequests] Wallet hold created', {
            bookingId: booking.requestId, walletHoldApplied, txnId: holdResult.txnId,
          });
        }
      } catch (holdErr: any) {
        // Non-fatal: booking still created. Log for alerting. Wallet credit simply not applied.
        logger.error('[BookingRequests] Wallet hold failed', {
          bookingId: booking.requestId, error: holdErr.message,
        });
      }
    }
    
    res.status(201).json({
      success: true,
      booking: {
        requestId: booking.requestId,
        id: booking.id,
        status: booking.status,
        totalAmount: totalCents / 100,
        currency: 'ILS',
        startDate: booking.startDate,
        endDate: booking.endDate,
        petCount: data.petDetails?.length || data.petCount,
        loyaltyRedeemedCents: loyaltyApplied,
      },
      message: 'Booking request sent successfully. The provider will respond soon.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error creating booking', { error: error.message });
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid booking data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create booking request' });
  }
});

/**
 * GET /api/booking-requests - Get user's booking requests
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // role determines which side of the booking to filter on (owner vs provider).
    // Either way, the query is scoped to the authenticated user's own UID — no IDOR risk.
    const role = req.query.role as string; // 'provider' or anything else → defaults to owner
    const status = req.query.status as string;
    
    let conditions;
    if (role === 'provider') {
      conditions = eq(bookingRequests.providerId, userId);
    } else {
      conditions = eq(bookingRequests.ownerId, userId);
    }
    
    let bookings = await db.select()
      .from(bookingRequests)
      .where(conditions)
      .orderBy(desc(bookingRequests.createdAt))
      .limit(50);
    
    if (status) {
      bookings = bookings.filter(b => b.status === status);
    }

    // Batch-resolve provider names from users table
    const providerIds = [...new Set(bookings.map(b => b.providerId).filter(Boolean))];
    const providerNameMap: Record<string, string> = {};
    if (providerIds.length > 0) {
      const providerUsers = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(inArray(users.id, providerIds));
      providerUsers.forEach(u => {
        providerNameMap[u.id] = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'ספק';
      });
    }
    
    // Batch-resolve addon codes for rebook prefill (single query, not N+1)
    const bookingIds = bookings.map(b => b.id).filter(Boolean) as number[];
    const addonCodeMap: Record<number, string[]> = {};
    if (bookingIds.length > 0) {
      const addonRows = await db
        .select({ bookingRequestId: bookingRequestAddons.bookingRequestId, addonCode: bookingRequestAddons.addonCode })
        .from(bookingRequestAddons)
        .where(inArray(bookingRequestAddons.bookingRequestId, bookingIds));
      addonRows.forEach(r => {
        if (!r.bookingRequestId) return;
        addonCodeMap[r.bookingRequestId] = addonCodeMap[r.bookingRequestId] || [];
        addonCodeMap[r.bookingRequestId].push(r.addonCode);
      });
    }

    res.json({
      bookings: bookings.map(b => ({
        requestId: b.requestId,
        status: b.status,
        serviceType: b.serviceType,
        startDate: b.startDate,
        endDate: b.endDate,
        petCount: b.petCount,
        subtotalCents: b.subtotalCents,
        serviceFeeCents: b.serviceFeeCents,
        totalCents: b.totalCents,
        currency: b.currency,
        ownerMessage: b.ownerMessage,
        providerResponse: b.providerResponse,
        meetGreetDate: b.meetGreetDate,
        meetGreetLocation: b.meetGreetLocation,
        meetGreetNotes: b.meetGreetNotes,
        cancellationReason: b.cancellationReason || null,
        cancelledBy: b.cancelledBy || null,
        refundCents: b.refundCents || 0,
        statusHistory: b.statusHistory || [],
        createdAt: b.createdAt,
        providerId: b.providerId,
        providerName: providerNameMap[b.providerId] || null,
        // Wallet lifecycle fields
        financeState: b.financeState || 'none',
        walletHoldCents: b.walletHoldCents || 0,
        walletDebitedCents: b.walletDebitedCents || 0,
        walletRefundedCents: b.walletRefundedCents || 0,
        loyaltyRedeemedCents: b.loyaltyRedeemedCents || 0,
        // Rebook prefill fields
        petIds: (b.petIds as string[] | null) || [],
        addonCodes: (b.id ? addonCodeMap[b.id] : null) || [],
      })),
      total: bookings.length,
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error fetching bookings', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/booking-requests/my-completed-count - Count completed bookings for logged-in user
 * NOTE: Must be registered BEFORE /:requestId to prevent shadowing
 */
router.get('/my-completed-count', async (req, res) => {
  const userId = req.user?.uid || req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.ownerId, userId),
          inArray(bookingRequests.status as any, ['completed', 'reviewed']),
        ),
      );
    res.json({ count: result[0]?.count ?? 0 });
  } catch (err: any) {
    logger.warn('[BookingRequests] my-completed-count error', { error: err.message });
    res.json({ count: 0 });
  }
});

/**
 * GET /api/booking-requests/:requestId - Get booking details
 */
/**
 * Provider contact for a customer's own ACTIVE booking (2026-07-26).
 *
 * Privacy-gated so the provider's phone/email is only ever released to the
 * customer who owns the booking, and only while the two genuinely need to
 * coordinate (accepted → completed). Never for pending/cancelled/declined
 * bookings, and never to anyone but the owner. The client fetches this on demand
 * (when the customer taps "Contact provider") rather than embedding the number
 * in every booking list row — so a provider phone is never shipped to a browser
 * that has no live reason to hold it.
 */
router.get('/:requestId/provider-contact', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Owner-only — the customer contacting THEIR provider.
    if (booking.ownerId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Only while coordination is legitimate — never pending/cancelled/declined.
    const CONTACTABLE = new Set([
      'accepted', 'confirmed', 'in_progress', 'meet_greet_completed',
      'provider_marked_complete', 'completed',
    ]);
    if (!CONTACTABLE.has(String(booking.status))) {
      return res.status(409).json({ error: 'Contact is available once your booking is confirmed.', code: 'NOT_CONTACTABLE' });
    }

    if (!booking.providerId) {
      return res.status(404).json({ error: 'No provider assigned yet' });
    }
    const [providerUser] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, phone: users.phone, email: users.email })
      .from(users)
      .where(eq(users.id, booking.providerId))
      .limit(1);
    if (!providerUser) return res.status(404).json({ error: 'Provider not found' });

    return res.json({
      providerName: [providerUser.firstName, providerUser.lastName].filter(Boolean).join(' ') || null,
      phone: providerUser.phone || null,
      email: providerUser.email || null,
    });
  } catch (error: any) {
    logger.error('[BookingRequests] provider-contact failed', { error: error?.message });
    return res.status(500).json({ error: 'Failed to load provider contact' });
  }
});

router.get('/:requestId', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;

    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check authorization
    if (booking.ownerId !== userId && booking.providerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this booking' });
    }

    // Resolve provider display name
    let providerName: string | null = null;
    if (booking.providerId) {
      const [providerUser] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, booking.providerId))
        .limit(1);
      if (providerUser) {
        providerName = [providerUser.firstName, providerUser.lastName].filter(Boolean).join(' ') || null;
      }
    }

    // Resolve addon codes for rebook prefill
    let addonCodes: string[] = [];
    if (booking.id) {
      const addonRows = await db
        .select({ addonCode: bookingRequestAddons.addonCode })
        .from(bookingRequestAddons)
        .where(eq(bookingRequestAddons.bookingRequestId, booking.id));
      addonCodes = addonRows.map(r => r.addonCode);
    }
    
    res.json({
      // Gate precise customer location for a provider who hasn't accepted yet.
      booking: maskCustomerLocationForProvider({
        ...booking,
        providerName,
        petIds: (booking.petIds as string[] | null) || [],
        addonCodes,
      }, userId)
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error fetching booking', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/**
 * PATCH /api/booking-requests/:requestId - Pet owner submits a rating/review
 * after the service is completed. Owner-only; completed bookings only.
 */
router.patch('/:requestId', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { requestId } = req.params;

    const ratingNum = Number(req.body?.ownerRating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'ownerRating must be a number 1–5' });
    }
    const review = typeof req.body?.ownerReview === 'string'
      ? req.body.ownerReview.slice(0, 2000)
      : null;

    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the pet owner can review this booking' });
    }
    if (booking.status !== 'completed') {
      return res.status(409).json({ error: 'You can only review a completed booking' });
    }

    await db.update(bookingRequests)
      .set({ ownerRating: String(ratingNum), ownerReview: review })
      .where(eq(bookingRequests.requestId, requestId));

    return res.json({ ok: true, requestId, ownerRating: ratingNum, ownerReview: review });
  } catch (err: any) {
    logger.error('[BookingRequests] PATCH review error', { err: err?.message });
    return res.status(500).json({ error: 'Failed to save review' });
  }
});

/**
 * POST /api/booking-requests/:requestId/respond - Provider accepts/declines
 */
router.post('/:requestId/respond', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const data = providerBookingResponseSchema.parse({ ...req.body, requestId });
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only the provider can respond to this request' });
    }

    // T10: BGC enforcement — provider must have an approved background check before accepting
    if (data.action === 'accept') {
      const [profile] = await db
        .select({ backgroundCheckStatus: providerProfiles.backgroundCheckStatus })
        .from(providerProfiles)
        .where(eq(providerProfiles.userId, userId!))
        .limit(1);
      if (!profile || profile.backgroundCheckStatus !== 'approved') {
        logger.warn('[BookingRequests] Provider accept blocked — BGC not approved', { providerId: userId, backgroundCheckStatus: profile?.backgroundCheckStatus });
        return res.status(403).json({
          error: 'BACKGROUND_CHECK_REQUIRED',
          message: 'Your background check must be approved before you can accept bookings.',
        });
      }

      // ── PER-SERVICE BOOKING GATE (legal-spec core rule) ───────────────────
      // The provider must be approved-for-booking FOR THIS SPECIFIC SERVICE.
      // provider_services is keyed by Firebase UID, which is exactly booking.providerId
      // (== userId) here, and we normalise the service vocabulary inside the gate.
      //
      // LEGACY FAIL-OPEN (intentional): providers approved BEFORE this per-service
      // system existed have zero provider_services rows. Blocking them would break
      // live providers, so absence-of-rows ⇒ allow. But a provider who IS in the
      // system (has rows) and is NOT approved-for-booking on this service ⇒ BLOCK.
      // This is the ONLY fail-open in the chain; payout is strictly fail-closed.
      try {
        const gate = await assertServiceApproved(userId!, booking.serviceType, 'booking');
        if (!gate.ok) {
          const hasRows = await providerHasAnyServiceRows(userId!);
          if (hasRows) {
            logger.warn('[BookingRequests] Provider accept blocked — service not approved for booking', {
              providerId: userId, serviceType: booking.serviceType, reason: gate.reason, status: gate.status,
            });
            return res.status(403).json({
              error: 'SERVICE_NOT_APPROVED_FOR_BOOKING',
              message: 'This service is not yet approved for bookings on your account. Contact PetWash support.',
              reason: gate.reason,
            });
          }
          // No rows at all → legacy provider → allow (log for visibility).
          logger.info('[BookingRequests] Provider has no provider_services rows — legacy fail-open allow', {
            providerId: userId, serviceType: booking.serviceType,
          });
        }
      } catch (gateErr) {
        // A genuine lookup failure should NOT silently allow on a money-adjacent
        // gate; but to avoid breaking live providers on an infra blip we mirror
        // the legacy fail-open ONLY when the provider has no rows, else block.
        logger.error('[BookingRequests] Booking-gate lookup error', { gateErr, providerId: userId, serviceType: booking.serviceType });
        try {
          const hasRows = await providerHasAnyServiceRows(userId!);
          if (hasRows) {
            return res.status(503).json({ error: 'SERVICE_GATE_UNAVAILABLE', message: 'Could not verify service approval. Please retry.' });
          }
        } catch {
          // double failure → fall through to legacy-allow (no rows assumed)
        }
      }

      // ── 6-MONTH RE-CONFIRMATION GATE (CEO spec §7) ────────────────────────
      // A provider whose 6-month legal/tax/status re-confirmation is overdue may
      // not accept NEW jobs until they re-confirm. Self-healing (recording a
      // reconfirmation clears it). Flag-gated (RECONFIRMATION_ENFORCE, default
      // off = SHADOW log; on = BLOCK). Fail-safe: isReconfirmationOverdue returns
      // false on any lookup error, so an infra hiccup never blocks a live job.
      try {
        const overdue = await isReconfirmationOverdue(userId!);
        if (overdue) {
          const enforce = (process.env.RECONFIRMATION_ENFORCE || 'off').toLowerCase() === 'on';
          logger.warn(`[BookingRequests] reconfirmation ${enforce ? 'BLOCK' : 'WOULD BLOCK (shadow)'} accept`, { providerId: userId });
          if (enforce) {
            return res.status(403).json({
              error: 'RECONFIRMATION_REQUIRED',
              message: 'Please re-confirm your provider declarations (required every 6 months) before accepting new bookings.',
            });
          }
        }
      } catch { /* fail-open: advisory gate must never break a live accept on infra error */ }

      // ── PROVIDER PROTECTION DECLARATIONS GATE (epic #49) ──────────────────
      // A provider may not ACCEPT a booking (go live serving a job) until every
      // required Protection-Book declaration is signed. Uses the SAME flag as the
      // payout gate (PROVIDER_DECLARATIONS_ENFORCE, default off = SHADOW) so one
      // switch arms the whole epic — you never want acceptance allowed while payout
      // is held, or vice versa. When the flag is flipped on, this blocks ANY
      // provider (incl. legacy) who hasn't signed — which is the intended Protection
      // Book rule; run shadow first to see who would be blocked. Fail-safe:
      // checkProviderDeclarationsSigned never throws, and shadow only logs.
      try {
        const decl = await checkProviderDeclarationsSigned(userId!);
        if (!decl.ok) {
          const enforce = (process.env.PROVIDER_DECLARATIONS_ENFORCE || 'on').toLowerCase() === 'on';
          logger.warn(`[BookingRequests] declarations ${enforce ? 'BLOCK' : 'WOULD BLOCK (shadow)'} accept`, {
            providerId: userId, reason: decl.reason, missing: decl.missing,
          });
          if (enforce) {
            return res.status(403).json({
              error: 'DECLARATIONS_REQUIRED',
              message: 'Please sign your provider declarations before accepting bookings.',
              missing: decl.missing,
            });
          }
        }
      } catch { /* fail-open: advisory gate must never break a live accept on infra error */ }
    }

    const statusHistory = (booking.statusHistory as any[]) || [];
    let meetGreetDate = null;
    let meetGreetLocation = null;
    let newStatus: BookingStatus;

    switch (data.action) {
      case 'accept':
        if (data.meetGreetDate) {
          newStatus = 'meet_greet_scheduled';
          meetGreetDate = new Date(data.meetGreetDate);
          meetGreetLocation = data.meetGreetLocation || null;
        } else {
          newStatus = 'accepted';
        }
        break;
      case 'decline':
        newStatus = 'declined';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Centralised state-machine guard (Phase B2). Replaces the previous
    // bare `if (booking.status !== 'pending')` check. The machine knows
    // which actor is allowed to drive each transition AND which terminal
    // states block any further movement.
    const transition = applyTransition({
      from: booking.status,
      to: newStatus,
      actor: 'provider',
      actorId: userId ?? null,
      note: data.response || `Provider ${data.action}ed the request`,
    });
    if (!transition.result.ok) {
      logger.warn('[BookingRequests] Provider response rejected by state machine', {
        requestId, from: booking.status, to: newStatus, code: transition.result.code,
      });
      return res.status(transition.result.statusCode).json({
        error: transition.result.error,
        code: transition.result.code,
      });
    }
    statusHistory.push(transition.historyEntry);
    
    const updateData: any = {
      status: newStatus,
      statusHistory,
      providerResponse: data.response || null,
      updatedAt: new Date(),
    };
    
    if (meetGreetDate) {
      updateData.meetGreetDate = meetGreetDate;
      updateData.meetGreetLocation = meetGreetLocation;
    }

    // ── Phase B4 — Provider double-booking lock ──────────────────────────────
    // Wrap the status flip in a Postgres transaction with SELECT FOR UPDATE
    // so two parallel /respond accepts can never both succeed against the
    // same booking AND so we can atomically check whether the provider
    // already holds a conflicting active booking.
    //
    // For 'decline' we skip the overlap check entirely — declining never
    // conflicts with anything.
    if (data.action === 'accept') {
      try {
        await db.transaction(async (tx) => {
          // 1. Lock the row we are about to update — prevents a parallel
          //    accept from beating us to the status flip.
          const [locked] = await tx.select()
            .from(bookingRequests)
            .where(eq(bookingRequests.requestId, requestId))
            .for('update')
            .limit(1);
          if (!locked) throw new Error('BOOKING_NOT_FOUND_AFTER_LOCK');
          if (locked.status !== 'pending') {
            // Someone else moved the booking after our state-machine
            // check above. Re-throw a structured conflict.
            throw Object.assign(new Error('BOOKING_RACE_CONDITION'), {
              petwashCode: 'RACE_CONDITION',
              currentStatus: locked.status,
            });
          }

          // 2. Look for other ACTIVE bookings on the same provider whose
          //    [start, end) overlaps the candidate's [start, end).
          //    BLOCKING_STATUSES from shared/lib/bookingOverlap.
          const conflicts = await tx.select({
              requestId: bookingRequests.requestId,
              status:    bookingRequests.status,
              startDate: bookingRequests.startDate,
              endDate:   bookingRequests.endDate,
            })
            .from(bookingRequests)
            .where(and(
              eq(bookingRequests.providerId, booking.providerId),
              ne(bookingRequests.requestId, requestId),
              inArray(bookingRequests.status, BLOCKING_STATUSES as any),
              // half-open overlap — ranges touch (cand.end === existing.start)
              // do NOT count as conflict.
              sql`${bookingRequests.startDate} < ${locked.endDate}`,
              sql`${bookingRequests.endDate} > ${locked.startDate}`,
            ))
            .limit(1);

          if (conflicts.length > 0) {
            throw Object.assign(new Error('PROVIDER_DOUBLE_BOOKING'), {
              petwashCode: 'PROVIDER_DOUBLE_BOOKING',
              conflictingBookingId: conflicts[0].requestId,
              conflictingStatus:    conflicts[0].status,
            });
          }

          // 3. Status flip — INSIDE the transaction.
          await tx.update(bookingRequests)
            .set(updateData)
            .where(eq(bookingRequests.requestId, requestId));
        });
      } catch (lockErr: any) {
        const code = lockErr?.petwashCode;
        if (code === 'PROVIDER_DOUBLE_BOOKING') {
          logger.warn('[BookingRequests] Accept rejected — provider already booked at this time', {
            requestId,
            providerId: booking.providerId,
            conflictingBookingId: lockErr.conflictingBookingId,
          });
          return res.status(409).json({
            error: 'You already have another booking that overlaps this time slot.',
            code: 'PROVIDER_DOUBLE_BOOKING',
            conflictingBookingId: lockErr.conflictingBookingId,
          });
        }
        if (code === 'RACE_CONDITION') {
          logger.warn('[BookingRequests] Accept rejected — booking was modified concurrently', {
            requestId, currentStatus: lockErr.currentStatus,
          });
          return res.status(409).json({
            error: `Cannot respond — booking is already in status '${lockErr.currentStatus}'.`,
            code: 'RACE_CONDITION',
          });
        }
        // Anything else propagates up to the outer catch.
        throw lockErr;
      }
    } else {
      // 'decline' branch — single update, no overlap check.
      await db.update(bookingRequests)
        .set(updateData)
        .where(eq(bookingRequests.requestId, requestId));
      // Free the provider's calendar — a declined request must not keep its
      // EXCLUDE slot-lock, or the slot is poisoned forever. Idempotent, best-effort.
      await releaseSlotLock(db, requestId)
        .catch((e: any) => logger.warn('[BookingRequests] slot-lock release failed (decline)', { requestId, error: e?.message }));
    }

    // ── Calendar sync moved to payment-confirmation truth ────────────────────
    // Calendar events are NO LONGER created on provider accept. A booking is
    // not real until payment is confirmed, so creating a calendar event here
    // produced events for bookings that were never paid ("calendar before
    // payment truth"). The event is now created in the Nayax payment webhook
    // (server/routes/nayax-webhooks.ts → /nayax/booking-request-payment, on
    // payment.success → status 'confirmed'). Cancellation still deletes the
    // event by booking_id below.

    // ── Wallet lifecycle on provider response ──────────────────────────────────
    // ACCEPT → debitFromWalletHold (pending → realized debit, commercially locked)
    // DECLINE → releaseWalletHold (pending → available restored)
    // NOTE: holdCents is hoisted to THIS scope (not block-scoped inside the if)
    // because the customer-notification body further down references it to render
    // the "₪X charged/released" line. Previously it was declared inside the if,
    // so the notification block threw ReferenceError (swallowed by its try/catch),
    // silently dropping the booking_accepted/declined notification.
    const holdCents = Number((booking as any).walletHoldCents) || 0;
    if ((booking as any).financeState === 'hold_active' && (booking as any).walletHoldCents > 0) {
      const divisionCode = getDivisionCode(booking.serviceType);
      setImmediate(async () => {
        try {
          if (data.action === 'accept') {
            const debitResult = await walletService.debitBookingFromHold({
              userId:       booking.ownerId,
              amountCents:  holdCents,
              bookingId:    requestId,
              divisionCode,
              ipAddress:    req.ip ?? null,
            });
            await db.update(bookingRequests)
              .set({ walletDebitedCents: holdCents, walletDebitKey: debitResult.txnId, financeState: 'debited', updatedAt: new Date() })
              .where(eq(bookingRequests.requestId, requestId));
            logger.info('[BookingRequests] Wallet debited from hold on accept', { requestId, holdCents, txnId: debitResult.txnId });
          } else {
            const releaseResult = await walletService.releaseBookingHold({
              userId:       booking.ownerId,
              amountCents:  holdCents,
              bookingId:    requestId,
              divisionCode,
              ipAddress:    req.ip ?? null,
            });
            await db.update(bookingRequests)
              .set({ walletReleaseKey: releaseResult.txnId, financeState: 'released', updatedAt: new Date() })
              .where(eq(bookingRequests.requestId, requestId));
            logger.info('[BookingRequests] Wallet hold released on decline', { requestId, holdCents, txnId: releaseResult.txnId });
          }
        } catch (walletErr: any) {
          logger.error('[BookingRequests] Wallet lifecycle error on provider response', { requestId, action: data.action, error: walletErr.message });
          // Make this VISIBLE + RECOVERABLE rather than silently swallowed. The response
          // already returned 200 and the customer was told "charged", but the debit/
          // release didn't land and financeState is still 'hold_active' (looks normal).
          // Flag the row distinctly so a reconciliation sweep / ops can find it, and alert.
          const failedState = data.action === 'accept' ? 'debit_failed' : 'release_failed';
          try {
            await db.update(bookingRequests)
              .set({ financeState: failedState, updatedAt: new Date() })
              .where(eq(bookingRequests.requestId, requestId));
          } catch (flagErr: any) {
            logger.error('[BookingRequests] Could not flag wallet finance-state for reconciliation', { requestId, error: flagErr?.message });
          }
          try {
            const { sendSecurityAlert } = await import('../services/alerts');
            await sendSecurityAlert(
              `Wallet ${data.action} FAILED — booking ${requestId} needs reconciliation`,
              `<p>Wallet <b>${data.action}</b> of ${holdCents} agorot failed for booking <b>${requestId}</b>.</p>` +
              `<p>The booking response already returned 200; financeState set to <b>${failedState}</b>. ` +
              `A held amount is neither captured nor released — reconcile manually.</p>` +
              `<p>Error: ${walletErr?.message}</p>`,
            );
          } catch (alertErr: any) {
            logger.warn('[BookingRequests] reconciliation alert failed', { requestId, error: alertErr?.message });
          }
        }
      });
    }

    // Resolve provider display name for personalised copy. Hoisted ABOVE the
    // notification try so it is in scope for ALL customer-messaging blocks below
    // (in-app notification, acceptance email/SMS, and the decline-rebook nudge).
    // It was previously declared inside the notification try → ReferenceError in
    // those later blocks (swallowed by their own try/catch), silently dropping
    // acceptance emails and the decline recovery nudge.
    let providerName = 'הספק';
    try {
      if (booking.providerId) {
        const [providerUser] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, booking.providerId))
          .limit(1);
        if (providerUser) {
          providerName = [providerUser.firstName, providerUser.lastName].filter(Boolean).join(' ') || 'הספק';
        }
      }
    } catch (e: any) {
      logger.warn('[BookingRequests] provider name lookup failed (respond)', { requestId, error: e?.message });
    }

    // Notify customer via superAppNotifications (in-app bell)
    try {
      const isAccept = data.action === 'accept';

      await db.insert(superAppNotifications).values({
        userId: booking.ownerId,
        type: isAccept ? 'booking_accepted' : 'booking_declined',
        title: isAccept
          ? `✅ ${providerName} אישר את הבקשה!`
          : `${providerName} אינו זמין בתאריכים אלה`,
        titleHe: isAccept
          ? `✅ ${providerName} אישר את הבקשה!`
          : `${providerName} אינו זמין בתאריכים אלה`,
        body: isAccept
          ? `ההזמנה שלך אושרה — שוחח עם ${providerName} עכשיו והכן את הפגישה.${holdCents > 0 ? ` ₪${(holdCents / 100).toFixed(2)} חויבו מהארנק שלך.` : ''}`
          : `אל דאגה — יש לנו ספקים נוספים שיוכלו לעזור. חפש עכשיו.${holdCents > 0 ? ` ₪${(holdCents / 100).toFixed(2)} שוחררו חזרה לארנק שלך.` : ''}`,
        bodyHe: isAccept
          ? `ההזמנה שלך אושרה — שוחח עם ${providerName} עכשיו והכן את הפגישה.${holdCents > 0 ? ` ₪${(holdCents / 100).toFixed(2)} חויבו מהארנק שלך.` : ''}`
          : `אל דאגה — יש לנו ספקים נוספים שיוכלו לעזור. חפש עכשיו.${holdCents > 0 ? ` ₪${(holdCents / 100).toFixed(2)} שוחררו חזרה לארנק שלך.` : ''}`,
        actionUrl: `/booking/confirmation/${requestId}`,
        actionType: isAccept ? 'open_booking_chat' : 'open_booking',
        channels: ['in_app'],
        isRead: false,
        createdAt: new Date(),
      });
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] superAppNotifications insert failed (respond)', { error: notifErr.message });
    }

    // ── Non-blocking: email + SMS to customer on acceptance ──────────────────
    if (data.action === 'accept') {
      (async () => {
        try {
          const [ownerUser] = await db
            .select({ email: users.email, phone: users.phone, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, booking.ownerId))
            .limit(1);
          if (ownerUser) {
            const customerName = ownerUser.firstName || 'לקוח';
            const serviceDateStr = booking.startDate
              ? new Date(booking.startDate).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' })
              : '—';
            const amountStr = holdCents > 0 ? `₪${(holdCents / 100).toFixed(2)}` : `₪${(booking.totalCents / 100).toFixed(2)}`;
            const confirmUrl = `https://petwash.co.il/booking/confirmation/${requestId}`;
            const htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;background:#fff;color:#000;">
<h2 style="color:#000;">✅ ההזמנה שלך אושרה! — PetWash™</h2>
<p>שלום ${customerName},</p>
<p>${providerName} אישר/ה את בקשתך. כל הפרטים נמצאים למטה:</p>
<table style="border-collapse:collapse;width:100%;max-width:480px;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;">שירות</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${booking.serviceType || '—'}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;">ספק</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${providerName}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;">תאריך</td><td style="padding:8px;border-bottom:1px solid #eee;">${serviceDateStr}</td></tr>
  <tr><td style="padding:8px;">סכום</td><td style="padding:8px;font-weight:bold;">${amountStr}</td></tr>
</table>
<p><a href="${confirmUrl}" style="background:#000;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">פתח/י את ההזמנה</a></p>
<p style="margin-top:24px;font-size:12px;color:#888;">PetWash Ltd. | ${CANONICAL_SUPPORT_EMAIL} | petwash.co.il</p>
</body></html>`;
            await dispatchNotification({
              uid: booking.ownerId,
              email: ownerUser.email || undefined,
              phone: ownerUser.phone || undefined,
              type: 'booking_accepted',
              title: `✅ ${providerName} אישר את הבקשה! – PetWash™`,
              bodyHtml: htmlBody,
              bodyText: `ההזמנה שלך אושרה!\nספק: ${providerName}\nתאריך: ${serviceDateStr}\nסכום: ${amountStr}\nפרטים: ${confirmUrl}`,
              channels: ['email', 'sms'],
            });
          }
        } catch (multiChanErr: any) {
          logger.warn('[BookingRequests] email/SMS dispatch failed on acceptance (non-fatal)', { error: multiChanErr.message });
        }
      })();
    }

    // ── Non-blocking: email + SMS to customer on DECLINE (immediate) ─────────
    // The in-app bell fires for both accept+decline above, but email/SMS only
    // fired on accept — so a declined customer wasn't told promptly (only a
    // 1h-delayed rebook nudge). Mirror the acceptance dispatch for parity so the
    // customer hears "provider unavailable, here are others" right away.
    if (data.action === 'decline' && booking.ownerId) {
      (async () => {
        try {
          const [ownerUser] = await db
            .select({ email: users.email, phone: users.phone, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, booking.ownerId))
            .limit(1);
          if (ownerUser) {
            const customerName = ownerUser.firstName || 'לקוח';
            const releasedStr = holdCents > 0 ? ` ₪${(holdCents / 100).toFixed(2)} שוחררו חזרה לארנק שלך.` : '';
            const searchUrl = `https://petwash.co.il/search`;
            const htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;background:#fff;color:#000;">
<h2 style="color:#000;">${providerName} אינו זמין בתאריכים אלה — PetWash™</h2>
<p>שלום ${customerName},</p>
<p>${providerName} אינו זמין לבקשה זו. אל דאגה — יש לנו ספקים מאומתים נוספים באזור שלך.${releasedStr}</p>
<p><a href="${searchUrl}" style="background:#D4AF37;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">חיפוש ספקים נוספים</a></p>
<p style="margin-top:24px;font-size:12px;color:#888;">PetWash Ltd. | ${CANONICAL_SUPPORT_EMAIL} | petwash.co.il</p>
</body></html>`;
            await dispatchNotification({
              uid: booking.ownerId,
              email: ownerUser.email || undefined,
              phone: ownerUser.phone || undefined,
              type: 'booking_declined',
              title: `${providerName} אינו זמין — PetWash™`,
              bodyHtml: htmlBody,
              bodyText: `${providerName} אינו זמין בתאריכים אלה. יש לנו ספקים נוספים שיוכלו לעזור — חיפוש: ${searchUrl}${releasedStr}`,
              channels: ['email', 'sms'],
            });
          }
        } catch (e: any) {
          logger.warn('[BookingRequests] email/SMS dispatch failed on decline (non-fatal)', { error: e?.message });
        }
      })();
    }

    // ── Non-blocking: Schedule declined_recovery nudge (1 h later) ────────────
    if (newStatus === 'declined' && booking.ownerId) {
      scheduleRebookTrigger('declined_recovery', {
        userId: booking.ownerId,
        requestId,
        providerId: booking.providerId,
        providerName,
        serviceType: booking.serviceType,
        serviceDate: booking.startDate ?? undefined,
        delayMs: 60 * 60 * 1000,
      }).catch((e: any) => logger.warn('[RebookScheduler] declined_recovery schedule failed', { error: e.message }));
    }

    logger.info('[BookingRequests] Provider responded to booking', {
      requestId,
      action: data.action,
      newStatus,
    });

    const eventType = data.action === 'accept' ? 'provider_accepted' : 'provider_declined';
    const updatedBooking = { ...booking, status: newStatus, requestId };
    logBookingEvent(eventType as any, buildEventPayload(updatedBooking), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      providerRespondedAt: new Date().toISOString(),
    }).catch(() => {});

    // Real-time intelligence event — provider.accepted (spec §6.2)
    if (data.action === 'accept') {
      eventBus.publish({
        eventType: 'provider.accepted',
        timestamp: new Date().toISOString(),
        platform: 'marketplace',
        userId: booking.providerId ?? undefined,
        data: {
          requestId,
          ownerId: booking.ownerId,
          providerId: booking.providerId,
          serviceType: booking.serviceType,
          newStatus,
        },
      }).catch(() => {});

      // Advance owner journey state to 'booked' on acceptance
      if (booking.ownerId) {
        advanceJourneyState(booking.ownerId, 'booked').catch(err => logger.warn('[BookingRequests] advanceJourneyState booked failed', { ownerId: booking.ownerId, err: err?.message }));
        recomputeCustomerProfile(booking.ownerId).catch(err => logger.warn('[BookingRequests] recomputeCustomerProfile failed', { ownerId: booking.ownerId, err: err?.message }));
      }
    }
    
    // ── Deal Gate (§B/§L): record provider acceptance + audit the transition ──
    if (data.action === 'accept') {
      recordAcceptance({
        bookingId: requestId,
        customerUserId: booking.ownerId,
        providerUserId: booking.providerId ?? null,
        side: 'provider',
      }).catch(() => {});
    }
    recordStatusEvent({
      bookingId: requestId,
      oldStatus: booking.status,
      newStatus,
      changedBy: userId || booking.providerId,
      actorRole: 'provider',
      reason: data.action === 'accept' ? 'provider_accepted' : 'provider_declined',
    }).catch(() => {});

    res.json({
      success: true,
      status: newStatus,
      message: data.action === 'accept'
        ? (meetGreetDate ? 'Booking accepted! Meet & Greet scheduled.' : 'Booking accepted!')
        : 'Booking declined.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error responding to booking', { error: error.message });
    res.status(500).json({ error: 'Failed to respond to booking' });
  }
});

/**
 * POST /api/booking-requests/:requestId/meet-greet - Schedule or complete Meet & Greet
 */
router.post('/:requestId/meet-greet', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { action, date, location, notes, type } = req.body;

    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Both owner and provider can interact with meet & greet
    if (booking.ownerId !== userId && booking.providerId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    const actor: BookingActor = booking.ownerId === userId ? 'owner' : 'provider';

    if (action === 'request') {
      // Either side (typically the CUSTOMER) asks for a Meet & Greet before
      // payment. Soft state — the provider then confirms a time (→ scheduled).
      const meetType = ['video', 'phone', 'public', 'home'].includes(type) ? type : 'video';
      const transition = applyTransition({
        from: booking.status,
        to: 'meet_greet_requested',
        actor,
        actorId: userId ?? null,
        note: `Meet & Greet requested (${meetType})${date ? ` — preferred ${date}` : ''}`,
      });
      if (!transition.result.ok) {
        return res.status(transition.result.statusCode).json({
          error: transition.result.error,
          code: transition.result.code,
        });
      }
      statusHistory.push(transition.historyEntry);
      const noteParts = [`type: ${meetType}`, date ? `preferred: ${date}` : null, notes].filter(Boolean);
      await db.update(bookingRequests)
        .set({
          status: 'meet_greet_requested',
          meetGreetLocation: location || null,
          meetGreetNotes: noteParts.join(' · ') || null,
          statusHistory,
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.requestId, requestId));

      logBookingEvent('meet_greet_requested', buildEventPayload({ ...booking, status: 'meet_greet_requested' }), {
        customerRequestedAt: new Date().toISOString(),
      }).catch(() => {});

      // Notify the other party (best-effort, non-blocking)
      const otherId = actor === 'owner' ? booking.providerId : booking.ownerId;
      if (otherId) {
        db.select({ email: users.email, phone: users.phone, firstName: users.firstName })
          .from(users).where(eq(users.id, otherId)).limit(1)
          .then(([u]) => u && dispatchNotification({
            uid: otherId,
            email: u.email || undefined,
            phone: u.phone || undefined,
            type: 'meet_greet_requested',
            title: 'בקשת פגישת היכרות · Meet & Greet requested — PetWash™',
            bodyHtml: `<p>${actor === 'owner' ? 'A customer' : 'The provider'} requested a Meet &amp; Greet (${meetType})${date ? ` — preferred ${date}` : ''}. Open PetWash to coordinate a time.</p>`,
            bodyText: `PetWash: Meet & Greet requested (${meetType})${date ? ` — preferred ${date}` : ''}. Open the app to confirm a time.`,
            channels: ['inbox', 'email', 'sms'],
            priority: 7,
          })).catch(() => {});
      }

      return res.json({ success: true, message: 'Meet & Greet requested' });
    }

    if (action === 'schedule') {
      if (!date) {
        return res.status(400).json({ error: 'Meet & Greet date is required' });
      }

      const transition = applyTransition({
        from: booking.status,
        to: 'meet_greet_scheduled',
        actor,
        actorId: userId ?? null,
        note: `Meet & Greet scheduled for ${date}`,
      });
      if (!transition.result.ok) {
        logger.warn('[BookingRequests] Meet & Greet schedule rejected by state machine', {
          requestId, from: booking.status, actor, code: transition.result.code,
        });
        return res.status(transition.result.statusCode).json({
          error: transition.result.error,
          code: transition.result.code,
        });
      }

      statusHistory.push(transition.historyEntry);
      
      await db.update(bookingRequests)
        .set({
          status: 'meet_greet_scheduled',
          meetGreetDate: new Date(date),
          meetGreetLocation: location || null,
          meetGreetNotes: notes || null,
          statusHistory,
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.requestId, requestId));
      
      logBookingEvent('meet_greet_scheduled', buildEventPayload({ ...booking, status: 'meet_greet_scheduled' }), {
        customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      }).catch(() => {});

      res.json({ success: true, message: 'Meet & Greet scheduled!' });
      
    } else if (action === 'complete') {
      // Only provider can mark Meet & Greet as complete
      if (booking.providerId !== userId) {
        return res.status(403).json({ error: 'Only provider can complete Meet & Greet' });
      }

      const transition = applyTransition({
        from: booking.status,
        to: 'meet_greet_completed',
        actor: 'provider',
        actorId: userId ?? null,
        note: notes || 'Meet & Greet completed successfully',
      });
      if (!transition.result.ok) {
        logger.warn('[BookingRequests] Meet & Greet complete rejected by state machine', {
          requestId, from: booking.status, code: transition.result.code,
        });
        return res.status(transition.result.statusCode).json({
          error: transition.result.error,
          code: transition.result.code,
        });
      }

      statusHistory.push(transition.historyEntry);
      
      await db.update(bookingRequests)
        .set({
          status: 'meet_greet_completed',
          meetGreetCompletedAt: new Date(),
          meetGreetNotes: notes || booking.meetGreetNotes,
          statusHistory,
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.requestId, requestId));
      
      logBookingEvent('meet_greet_completed', buildEventPayload({ ...booking, status: 'meet_greet_completed' }), {
        customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      }).catch(() => {});

      res.json({ 
        success: true, 
        message: 'Meet & Greet completed! Awaiting payment from owner.',
      });
      
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "schedule" or "complete".' });
    }
  } catch (error: any) {
    logger.error('[BookingRequests] Meet & Greet error', { error: error.message });
    res.status(500).json({ error: 'Failed to update Meet & Greet' });
  }
});

/**
 * POST /api/booking-requests/:requestId/pay - Process payment (escrow)
 * 
 * ENTERPRISE INTEGRATION:
 * - Uses EscrowService for 72-hour payment hold
 * - Sends notifications to both parties
 * - Creates audit trail
 */
router.post('/:requestId/pay', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { paymentMethod, transactionId } = req.body;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // LEGAL BLOCK: PetTrek payments permanently blocked — not licensed in Israel
    if (booking.serviceType === 'pettrek' || booking.serviceType === 'pet_trek') {
      return res.status(403).json({
        error: 'service_legally_blocked',
        code: 'PETTREK_NOT_LICENSED',
        message: 'PetTrek™ payments are not available — service pending licensing in Israel.',
      });
    }
    
    if (booking.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the owner can make payment' });
    }
    
    if (!['meet_greet_completed', 'accepted'].includes(booking.status)) {
      return res.status(400).json({ 
        error: `Cannot pay for booking with status: ${booking.status}. Meet & Greet must be completed first.` 
      });
    }
    
    // Initiate a real Nayax hosted payment session.
    // Booking transitions to 'payment_pending' here.
    // It becomes 'confirmed' ONLY when Nayax calls POST /api/webhooks/nayax/booking-request-payment
    // with event = 'payment.success'.  No fake transaction IDs are generated.
    const { NayaxOnlinePaymentService } = await import('../services/NayaxOnlinePaymentService');
    const appUrl = process.env.APP_URL || 'https://petwash.co.il';

    // Fetch owner email for the payment session (optional — enriches Nayax receipt).
    const [ownerUser] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, booking.ownerId))
      .limit(1);

    const sessionResult = await NayaxOnlinePaymentService.createPaymentSession({
      bookingId: requestId,
      bookingNumber: requestId,
      amountCents: booking.totalCents,
      customerEmail: ownerUser?.email || undefined,
      customerName: ownerUser?.firstName || undefined,
      description: `PetWash™ ${booking.serviceType} — ${booking.petCount ?? 1} pet(s)`,
      returnUrl: `${appUrl}/booking/confirmation/${requestId}?payment=success`,
      cancelUrl: `${appUrl}/booking/confirmation/${requestId}?payment=cancelled`,
      webhookUrl: `${appUrl}/api/webhooks/nayax/booking-request-payment`,
    });

    if (!sessionResult.success) {
      logger.error('[BookingRequests] Nayax payment session creation failed', {
        requestId, error: sessionResult.error,
      });
      return res.status(502).json({
        error: 'Payment gateway unavailable. Please try again.',
        errorCode: 'PAYMENT_SESSION_FAILED',
      });
    }

    const sessionId = sessionResult.sessionId || `SESSION-${requestId}`;
    if (!sessionResult.sessionId) {
      logger.warn('[BookingRequests] Nayax session created without a sessionId — using fallback placeholder; webhook reconciliation may be affected', { requestId });
    }

    // Create the Firestore escrow record with the session ID as a placeholder.
    // The webhook will update it to the real transaction ID on confirmation.
    try {
      const escrow = await EscrowService.createEscrowPayment(
        requestId,
        booking.ownerId,
        booking.providerId,
        booking.totalCents / 100,
        sessionId, // placeholder until real txId arrives from webhook
        {
          serviceType: booking.serviceType,
          providerType: booking.providerType,
          startDate: booking.startDate,
          endDate: booking.endDate,
        }
      );
      logger.info('[BookingRequests] Escrow record created (pending payment confirmation)', {
        requestId, escrowId: escrow.id, amount: booking.totalCents / 100,
      });
    } catch (escrowError: any) {
      logger.error('[BookingRequests] Escrow creation FAILED — aborting payment initiation', {
        error: escrowError.message, requestId,
      });
      return res.status(500).json({
        error: 'Payment processing failed — escrow could not be established. No charge was made. Please retry.',
        errorCode: 'ESCROW_CREATION_FAILED',
      });
    }

    // Transition booking to payment_pending — NOT confirmed until webhook fires.
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'payment_pending',
      timestamp: new Date().toISOString(),
      note: `Payment session created via Nayax. Awaiting customer payment of ₪${(booking.totalCents / 100).toFixed(2)}.`,
    });

    await db.update(bookingRequests)
      .set({
        status: 'payment_pending',
        paymentMethod: paymentMethod || 'nayax',
        paymentTransactionId: sessionId, // placeholder; real txId set by webhook
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));

    logger.info('[BookingRequests] Payment session initiated — awaiting Nayax confirmation', {
      requestId, sessionId: sessionResult.sessionId, demoMode: sessionResult.demoMode,
    });

    logBookingEvent('payment_initiated', buildEventPayload({ ...booking, status: 'payment_pending' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      paymentInitiatedAt: new Date().toISOString(),
    }).catch(() => {});

    // ── Deal Gate (§B/§L): record customer acceptance (payment authorising) + audit ──
    recordAcceptance({
      bookingId: requestId,
      customerUserId: booking.ownerId,
      providerUserId: booking.providerId ?? null,
      side: 'customer',
      paymentProvider: 'NAYAX',
      paymentTransactionId: sessionId,
      paymentAuthorisedAt: new Date(),
      amountTotalCents: booking.totalCents ?? undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip,
      language: 'he',
    }).catch(() => {});
    recordStatusEvent({
      bookingId: requestId,
      oldStatus: booking.status,
      newStatus: 'payment_pending',
      changedBy: userId || booking.ownerId,
      actorRole: 'customer',
      reason: 'payment_initiated',
    }).catch(() => {});

    res.json({
      success: true,
      status: 'payment_pending',
      requiresRedirect: true,
      paymentUrl: sessionResult.paymentUrl,
      sessionId: sessionResult.sessionId,
      demoMode: sessionResult.demoMode,
      message: sessionResult.demoMode
        ? 'Demo payment — complete to confirm booking.'
        : 'Redirecting to secure payment page...',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Payment error', { error: error.message });
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

/**
 * POST /api/booking-requests/:requestId/start - Provider starts service
 */
router.post('/:requestId/start', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only provider can start service' });
    }
    
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: `Cannot start service with status: ${booking.status}` });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'in_progress',
      timestamp: new Date().toISOString(),
      note: 'Service started',
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'in_progress',
        serviceStartedAt: new Date(),
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));

    logBookingEvent('service_started', buildEventPayload({ ...booking, status: 'in_progress' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      serviceStartedAt: new Date().toISOString(),
    }).catch(() => {});
    
    res.json({ success: true, message: 'Service started!' });
  } catch (error: any) {
    logger.error('[BookingRequests] Start service error', { error: error.message });
    res.status(500).json({ error: 'Failed to start service' });
  }
});

/**
 /**
 * POST /api/booking-requests/:requestId/complete - Provider marks service as done
 *
 * Dual-approval gate (blueprint §13):
 *   Step 1 (this endpoint): Provider marks complete → status = provider_marked_complete
 *   Step 2 (/confirm or /approve-completion): Customer approves → status = completed + escrow released
 *
 * Auto-approval: if customer does nothing for 24 h, the cron job auto-approves.
 */
router.post('/:requestId/complete', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only provider can mark service as complete' });
    }
    
    if (booking.status !== 'in_progress') {
      return res.status(400).json({ error: `Cannot mark complete for booking with status: ${booking.status}` });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    const now = new Date();
    statusHistory.push({
      status: 'provider_marked_complete',
      timestamp: now.toISOString(),
      actorType: 'provider',
      actorId: userId,
      note: 'Provider marked service as done. Awaiting customer approval or 24-hour auto-approval.',
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'provider_marked_complete',
        serviceCompletedAt: now,
        providerCompletedAt: now,
        statusHistory,
        updatedAt: now,
      } as any)
      .where(eq(bookingRequests.requestId, requestId));

    logBookingEvent('service_completed', buildEventPayload({ ...booking, status: 'provider_marked_complete' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || now.toISOString(),
      serviceStartedAt: booking.serviceStartedAt?.toISOString() || undefined,
      serviceCompletedAt: now.toISOString(),
    }).catch(() => {});

    // Notify owner to approve or dispute within 24 hours
    try {
      await db.insert(superAppNotifications).values({
        userId: booking.ownerId,
        type: 'booking_completion_approval',
        title: '✅ השירות הושלם — אשרי את ההזמנה',
        titleHe: '✅ השירות הושלם — אשרי את ההזמנה',
        body: `הספק דיווח שהשירות הסתיים. אשרי כדי לשחרר את התשלום, או פתחי מחלוקת תוך 24 שעות.`,
        bodyHe: `הספק דיווח שהשירות הסתיים. אשרי כדי לשחרר את התשלום, או פתחי מחלוקת תוך 24 שעות.`,
        actionUrl: `/booking/confirmation/${requestId}`,
        actionType: 'approve_completion',
        channels: ['in_app'],
        isRead: false,
        createdAt: now,
      } as any);
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] Completion approval notification failed', { error: notifErr.message });
    }

    // KEEP-IN-LOOP (2026-07-09): the in-app row above reaches the customer ONLY
    // inside the app. But this is a MONEY deadline — if they do nothing, the
    // auto-approve cron releases their payment to the provider in 24h. So they
    // MUST be reachable off-app: also send EMAIL + SMS. dispatchNotification
    // resolves the owner's email/phone from their uid; non-fatal + fire-and-forget
    // (channels omit 'inbox' to avoid duplicating the row already written above).
    try {
      await dispatchNotification({
        uid: booking.ownerId,
        type: 'system',
        title: 'PetWash — אשרו את ההזמנה תוך 24 שעות / Confirm within 24h',
        bodyHtml:
          `<p>הספק דיווח שהשירות עבור הזמנה <strong>${requestId}</strong> הסתיים. ` +
          `אשרו כדי לשחרר את התשלום, או פתחו מחלוקת <strong>תוך 24 שעות</strong> — ` +
          `אחרת ההזמנה תאושר אוטומטית והתשלום ישוחרר לספק.</p>` +
          `<p>Your provider marked booking <strong>${requestId}</strong> complete. ` +
          `Confirm to release payment, or open a dispute <strong>within 24 hours</strong> — ` +
          `otherwise it auto-approves and payment is released.</p>`,
        ctaText: 'אשרו / Confirm',
        ctaUrl: `https://petwash.co.il/booking/confirmation/${requestId}`,
        channels: ['email', 'sms'],
        priority: 8,
        meta: { bookingId: requestId, actionType: 'approve_completion' },
      });
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] provider_marked_complete email/SMS failed (non-fatal)', { error: notifErr.message });
    }

    // ── Non-blocking: Schedule rebook nudges after service completion ─────────
    if (booking.ownerId) {
      const triggerBase = {
        userId: booking.ownerId,
        requestId,
        providerId: booking.providerId,
        providerName: booking.providerName || undefined,
        serviceType: booking.serviceType,
        serviceDate: booking.startDate ?? undefined,
      };
      scheduleRebookTrigger('post_completion', { ...triggerBase, delayMs: 24 * 60 * 60 * 1000 })
        .catch((e: any) => logger.warn('[RebookScheduler] post_completion schedule failed', { error: e.message }));
      scheduleRebookTrigger('weekly_rebook', { ...triggerBase, delayMs: 7 * 24 * 60 * 60 * 1000 })
        .catch((e: any) => logger.warn('[RebookScheduler] weekly_rebook schedule failed', { error: e.message }));
    }

    // ── Non-blocking: Refresh provider trust metrics cache ───────────────────
    setImmediate(async () => {
      try {
        const { refreshAndCacheProviderTrustMetrics } = await import('../utils/providerTrustMetrics');
        await refreshAndCacheProviderTrustMetrics(booking.providerId);
      } catch (metricsErr: any) {
        logger.warn(`[BookingRequests] Trust metrics refresh failed for provider=${booking.providerId}: ${metricsErr?.message}`);
      }
    });

    // ── Non-blocking: Google Sheets sync ─────────────────────────────────────
    setImmediate(async () => {
      try {
        const { logSitterBooking } = await import('../services/googleSheetsIntegration');
        await logSitterBooking({
          bookingId: requestId,
          customerName: `${(booking as any).ownerFirstName || ''} ${(booking as any).ownerLastName || ''}`.trim() || 'Owner',
          email: (booking as any).ownerEmail || '',
          phone: (booking as any).ownerPhone || '',
          petName: (booking as any).petNames || '',
          petType: (booking as any).petType || 'pet',
          sitterName: booking.providerName || booking.providerId || 'Provider',
          startDate: booking.startDate?.toISOString?.()?.slice(0, 10) || String(booking.startDate),
          endDate: booking.endDate?.toISOString?.()?.slice(0, 10) || String(booking.endDate),
          durationDays: booking.totalDays || 1,
          totalAmount: (booking.totalCents || 0) / 100,
          status: 'provider_marked_complete',
        });
      } catch (sheetsErr: any) {
        logger.warn(`[BookingRequests] Google Sheets sync failed (complete) bookingId=${requestId} reason=${sheetsErr?.message}`);
      }
    });
    
    res.json({ 
      success: true,
      status: 'provider_marked_complete',
      message: 'Service marked as completed. Customer has 24 hours to approve or open a dispute. Payment will be auto-released if no action is taken.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Complete service error', { error: error.message });
    res.status(500).json({ error: 'Failed to complete service' });
  }
});

/**
 * POST /api/booking-requests/:requestId/arriving
 * Provider signals they are on the way / have arrived.
 * Emits real-time `provider.arriving` event (spec §6.2).
 */
router.post('/:requestId/arriving', async (req, res) => {
  try {
    const userId = req.user?.uid || (req as any).firebaseUser?.uid;
    const { requestId } = req.params;
    const { eta } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [booking] = await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only the assigned provider can signal arrival' });
    }

    const allowedStatuses = ['accepted', 'confirmed', 'in_progress'];
    if (!allowedStatuses.includes(booking.status)) {
      return res.status(400).json({
        error: `Cannot signal arrival for booking with status: ${booking.status}`,
      });
    }

    // Emit real-time event — provider.arriving (spec §6.2)
    eventBus.publish({
      eventType: 'provider.arriving',
      timestamp: new Date().toISOString(),
      platform: 'marketplace',
      userId,
      data: {
        requestId,
        ownerId: booking.ownerId,
        providerId: userId,
        serviceType: booking.serviceType,
        eta: eta ?? null,
      },
    }).catch(() => {});

    logger.info('[BookingRequests] Provider arriving signal emitted', { requestId, userId });
    return res.json({ success: true, message: 'Arrival signal sent to customer' });
  } catch (error: any) {
    logger.error('[BookingRequests] Provider arriving error', { error: error.message });
    return res.status(500).json({ error: 'Failed to signal arrival' });
  }
});

/**
 * POST /api/booking-requests/:requestId/confirm - Owner confirms completion & releases payment
 * 
 * ENTERPRISE INTEGRATION:
 * - Releases escrow via EscrowService
 * - Creates earning record via payoutLedger
 * - Triggers provider payout after 72 hours
 * - Sends notifications to both parties
 */
async function handleConfirmCompletion(req: any, res: any): Promise<void> {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { rating, review } = req.body;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.ownerId !== userId) {
      return res.status(403).json({ error: 'Only owner can confirm completion' });
    }
    
    if (booking.status !== 'provider_marked_complete') {
      return res.status(400).json({ error: `Cannot confirm booking with status: ${booking.status}. Provider must mark the service as complete first.` });
    }

    // PAYOUT SAFETY (audit 2026-06-24 finding #5): never create an earning record
    // or release escrow for a booking that was never actually paid. A booking
    // should only reach provider_marked_complete AFTER payment (paymentHeldAt is
    // set by the Nayax confirm webhook). If it's missing, refuse to pay out —
    // otherwise a provider could be paid from escrow that never existed.
    if (!booking.paymentHeldAt) {
      logger.error('[BookingRequests] Confirm-completion blocked — no payment was held for this booking', {
        requestId, providerId: booking.providerId, status: booking.status,
      });
      return res.status(409).json({
        error: 'NO_PAYMENT_HELD',
        message: 'This booking has no held payment, so no payout can be released. Please contact PetWash support.',
      });
    }

    // ENTERPRISE: Create earning record via payoutLedger
    const platformFeePercent = 15; // 15% platform fee
    try {
      // Map providerType to payoutLedger's supported bookingType values.
      // 'pettrek' is NOT used here — it is a legally blocked service.
      // Non-sitter/non-walker types (trainer, groomer, etc.) map to 'walker'
      // as the nearest valid commercial model (time-based service).
      const bookingType: 'sitter' | 'walker' | 'pettrek' =
        booking.providerType === 'sitter' ? 'sitter' : 'walker';

      // Map providerType to payoutLedger's contractorType.
      // 'driver' is for PetTrek, which is blocked; trainers/groomers use 'walker'.
      const contractorType: 'sitter' | 'walker' | 'driver' =
        booking.providerType === 'sitter' ? 'sitter' : 'walker';

      await createEarningRecord({
        contractorId: booking.providerId,
        contractorType,
        bookingType,
        bookingId: requestId,
        baseAmount: booking.subtotalCents / 100,
        platformFeePercent,
        dayCount: booking.totalDays || undefined,
        hourCount: booking.totalHours ? parseFloat(booking.totalHours) : undefined,
      });
      
      logger.info('[BookingRequests] Earning record created via payoutLedger', {
        requestId,
        providerId: booking.providerId,
        baseAmount: booking.subtotalCents / 100,
        platformFeePercent,
      });
    } catch (earningError: any) {
      // FAIL-CLOSED (2026-07-03, CEO-approved money fix): do NOT silently
      // continue. If the provider earning record can't be created, we must NOT
      // fall through to release escrow / mark the booking complete — otherwise
      // the booking finishes, the money leaves escrow, and the provider is
      // silently NEVER recorded as owed (never paid). Instead: keep the booking
      // at provider_marked_complete (retryable), raise a critical alert + a
      // tracked case, and return an error the owner can retry.
      logger.error('[BookingRequests] Earning-record creation FAILED — refusing to complete (fail-closed)', {
        requestId, providerId: booking.providerId, error: earningError?.message,
      });
      try {
        const { alertManager } = await import('../services/alertManager');
        await alertManager.triggerAlert({
          name: 'PROVIDER_EARNING_RECORD_FAILED',
          message: `Earning record could not be created for booking ${requestId} — payout blocked, completion refused (fail-closed). Needs settlement repair.`,
          severity: 'critical', timestamp: new Date(),
          metadata: { requestId, providerId: booking.providerId, error: earningError?.message },
        }).catch(() => {});
      } catch { /* alerting best-effort */ }
      try {
        const { openIncident } = await import('../services/incidentService');
        await openIncident({
          type: 'payment_failure', severity: 'high',
          description: `Provider earning record FAILED on confirm-completion for booking ${requestId}. Escrow NOT released, booking NOT completed (fail-closed) so the provider is not silently unpaid. Repair settlement then retry. Error: ${earningError?.message}`,
          bookingId: String(requestId), memberId: booking.ownerId, providerId: booking.providerId,
          reportedBy: 'system:earning-fail-closed',
        });
      } catch { /* incident best-effort */ }
      return res.status(500).json({
        error: 'EARNING_RECORD_FAILED',
        message: 'We could not finalize the provider payout for this booking, so it has NOT been completed. Please try again shortly or contact PetWash support.',
      });
    }

    // ── Phase 6.3: Loyalty triggers (non-blocking, fire-and-forget) ──────────
    setImmediate(async () => {
      try {
        const ownerId = booking.ownerId;
        const bId = booking.id;

        // 0. Award spend-based loyalty points: 1 point per ₪ spent (100 cents = 1 point)
        const spendPoints = Math.floor((booking.totalCents || 0) / 100);
        if (spendPoints > 0) {
          await updateLoyalty(ownerId, spendPoints, 'booking_completed', { bookingId: bId });
          // ALSO feed the CANONICAL loyaltyProfiles store the Prestige UI reads —
          // updateLoyalty() above writes a different legacy store, so bookings
          // never showed up in a member's Prestige balance/tier. Idempotent per
          // bookingId; never throws. (Full 3-ledger consolidation is task #14.)
          const { awardLoyaltyPoints } = await import('../services/loyaltyEarn');
          await awardLoyaltyPoints({
            userId: ownerId,
            amount: spendPoints,
            source: 'booking_completed',
            sourceId: String(bId),
            description: 'Booking completed',
          });
        }

        // 1. Count owner's lifetime completed bookings
        const [{ completedCount }] = await db
          .select({ completedCount: sql<number>`count(*)::int` })
          .from(bookingRequests)
          .where(and(
            eq(bookingRequests.ownerId, ownerId),
            sql`status IN ('completed','reviewed')`,
          ));

        // 2. booking_2nd — exactly on the 2nd lifetime completed booking
        if (completedCount === 2) {
          await awardLoyaltyCredit({
            userId: ownerId,
            ruleKey: 'booking_2nd',
            fingerprint: `booking_2nd:${ownerId}`,
            bookingId: bId,
          });
        }

        // 3. Streak checks
        const streaks = await getStreakCounts(ownerId);

        // streak_same_provider_3 — 3 consecutive completed with same provider
        if (streaks.consecutiveSameProvider && streaks.consecutiveSameProvider.count === 3) {
          await awardLoyaltyCredit({
            userId: ownerId,
            ruleKey: 'streak_same_provider_3',
            fingerprint: `streak_same_provider_3:${ownerId}:${streaks.consecutiveSameProvider.providerId}`,
            bookingId: bId,
          });
        }

        // streak_walk_5 — 5th completed dog_walking booking
        if (streaks.walkBookings === 5) {
          await awardLoyaltyCredit({
            userId: ownerId,
            ruleKey: 'streak_walk_5',
            fingerprint: `streak_walk_5:${ownerId}`,
            bookingId: bId,
          });
        }

        // streak_sit_5 — 5th completed pet_sitting booking
        if (streaks.sitBookings === 5) {
          await awardLoyaltyCredit({
            userId: ownerId,
            ruleKey: 'streak_sit_5',
            fingerprint: `streak_sit_5:${ownerId}`,
            bookingId: bId,
          });
        }

        // 4. Referral completion — if this is invitee's 1st completed booking and they used a code
        if (completedCount === 1) {
          const [ownerRow] = await db
            .select({ referredByCode: users.referredByCode })
            .from(users)
            .where(eq(users.id, ownerId))
            .limit(1);

          if (ownerRow?.referredByCode) {
            // Find the referral record and credit the inviter if not already done
            const [referral] = await db
              .select()
              .from(referrals)
              .where(and(
                eq(referrals.code, ownerRow.referredByCode),
                sql`status NOT IN ('expired','abused')`,
              ))
              .limit(1);

            if (referral && !referral.inviterCreditedAt) {
              // Mark invitee as completing
              await db
                .update(referrals)
                .set({ status: 'completed', completedAt: new Date(), inviteeUserId: ownerId })
                .where(eq(referrals.id, referral.id));

              // Credit inviter
              await awardLoyaltyCredit({
                userId: referral.inviterUserId,
                ruleKey: 'referral_inviter',
                fingerprint: `referral_inviter:${referral.inviterUserId}:${ownerId}`,
                referralId: referral.id,
                bookingId: bId,
              });

              // Mark inviter as credited
              await db
                .update(referrals)
                .set({ inviterCreditedAt: new Date() })
                .where(eq(referrals.id, referral.id));

              logger.info('[Loyalty] Referral inviter credited', { inviterId: referral.inviterUserId, inviteeId: ownerId });
            }
          }
        }

        // 5a. Win-back attribution — if user clicked/rebook_started via a winback in
        //     the last 7 days, emit a 'completed' experiment event (fire-and-forget).
        {
          const recentClick = await db
            .select({
              experimentKey: experimentEvents.experimentKey,
              variant:       experimentEvents.variant,
            })
            .from(experimentEvents)
            .where(and(
              eq(experimentEvents.userId, ownerId),
              sql`${experimentEvents.event} IN ('clicked','rebook_started')`,
              sql`${experimentEvents.createdAt} > now() - interval '7 days'`,
            ))
            .orderBy(desc(experimentEvents.createdAt))
            .limit(1);

          if (recentClick.length > 0) {
            await db.insert(experimentEvents).values({
              experimentKey: recentClick[0].experimentKey,
              userId:        ownerId,
              variant:       recentClick[0].variant,
              event:         'completed',
              bookingId:     bId,
            });
            logger.info('[Loyalty] Winback experiment attributed', {
              ownerId, experimentKey: recentClick[0].experimentKey, variant: recentClick[0].variant,
            });
          }
        }

        // 5b. Win-back reset — cancel any pending win-back queue entries for this user
        await db
          .update(winbackQueue)
          .set({ status: 'converted', convertedAt: new Date() })
          .where(and(
            eq(winbackQueue.userId, ownerId),
            sql`status IN ('pending','sent')`,
          ));

      } catch (loyaltyErr: any) {
        logger.warn('[Loyalty] Booking-complete trigger error (non-blocking)', { error: loyaltyErr.message, bookingId: booking.id });
      }
    });

    // ── Domain event: BOOKING_COMPLETED ──────────────────────────────────────
    eventPublisher.publishEvent(
      DomainEventType.BOOKING_COMPLETED,
      {
        bookingId: requestId,
        userId: booking.ownerId,
        providerId: booking.providerId,
        serviceType: booking.serviceType,
        totalCents: booking.totalCents,
        rating: rating ?? null,
      },
      { source: 'booking-requests/confirm', aggregateType: 'booking', aggregateId: requestId, userId: booking.ownerId },
    ).catch((e: any) => logger.error('[BookingRequests] BOOKING_COMPLETED event publish failed', { error: e?.message, requestId }));

    // Review-request email — the DIRECT sender (2026-07-30): the event-driven
    // path depends on DB templates that were never seeded, so no customer was
    // ever asked for a review. Fail-soft, fire-and-forget.
    setImmediate(() => {
      import('../email/sendServiceCompletedReview')
        .then(({ sendServiceCompletedReview }) => sendServiceCompletedReview({
          requestId,
          ownerId: booking.ownerId,
          providerId: booking.providerId,
          serviceType: booking.serviceType,
          totalCents: booking.totalCents,
          petDetails: booking.petDetails,
          endDate: booking.endDate,
        }))
        .catch(() => {});
    });

    // Send inbox + email + SMS notifications via dispatchNotification
    const amountIls = (booking.subtotalCents / 100).toFixed(2);
    try {
      // Notify provider — payment released
      await dispatchNotification({
        uid: booking.providerId,
        type: 'receipt',
        title: '💰 תשלום שוחרר!',
        bodyHtml: `<p>סכום של <strong>₪${amountIls}</strong> שוחרר עבור הזמנה <strong>${requestId}</strong>.</p><p>ההעברה תגיע לחשבונך תוך 72 שעות.</p>`,
        channels: ['inbox'],
        priority: 5,
        meta: { bookingId: requestId, amount: parseFloat(amountIls), currency: 'ILS' },
      });
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] Provider inbox notification failed', { error: notifErr.message });
    }
    // LEGACY BRIDGE (2026-07-31): the customer just approved completion, so the
    // canonical booking is now truly 'completed'/'reviewed'. Sync that back to the
    // legacy sitter/walk/trainer row — this is what finally moves the customer's My
    // Bookings row to Past and OPENS the review gate (status === 'completed'). Before
    // this, a bridged booking's legacy row was stranded at 'accepted' forever.
    try {
      const { applyBridgeCompletion } = await import('../services/legacyBookingBridge');
      await applyBridgeCompletion((booking as any).quoteBreakdown, rating ? 'reviewed' : 'completed');
    } catch { /* canonical row already updated */ }

    try {
      // Notify owner — booking completed
      const ownerTitle = '✅ ההזמנה הושלמה!';
      const ownerBody = rating
        ? `<p>תודה על ביקורת ה-${rating} כוכבים! שמחים שנהנית מהשירות.</p>`
        : '<p>תודה שבחרת ב-PetWash™! מחכים לראותך שוב בקרוב.</p>';
      await dispatchNotification({
        uid: booking.ownerId,
        type: 'system',
        title: ownerTitle,
        bodyHtml: ownerBody,
        ctaText: 'הזמן שוב',
        ctaUrl: 'https://petwash.co.il/book',
        channels: ['inbox'],
        meta: { bookingId: requestId },
      });
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] Owner inbox notification failed', { error: notifErr.message });
    }

    // ENTERPRISE: Send SMS confirmation — phone must come from the authenticated user, not req.body
    const callerUserId = req.user?.uid || req.firebaseUser?.uid || '';
    if (booking.ownerId !== callerUserId) {
      logger.warn('[BookingRequests] Caller is not the booking owner — skipping confirmation SMS', { requestId, callerUserId, ownerId: booking.ownerId });
    }
    // Fallback to the users row (2026-07-30): these were read from req.body
    // ONLY, so a /confirm without them sent no SMS and (token-less flows) no
    // receipt email — the account's own contact details were never used.
    let { ownerPhone, ownerEmail } = req.body;
    if (!ownerPhone || !ownerEmail) {
      try {
        const [ownerRow] = await db
          .select({ email: users.email, phone: users.phone })
          .from(users)
          .where(or(eq(users.id, booking.ownerId), eq(users.firebaseUid, booking.ownerId)))
          .limit(1);
        ownerPhone = ownerPhone || ownerRow?.phone || undefined;
        ownerEmail = ownerEmail || ownerRow?.email || undefined;
      } catch { /* non-blocking — validation below handles absence */ }
    }
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    const emailRegex = /^[^@\s]{1,64}@[^@\s.]{1,63}(?:\.[^@\s.]{1,63})+$/;
    const validPhone = ownerPhone && phoneRegex.test(ownerPhone.replace(/[\s-]/g, ''));
    const validEmail = ownerEmail && emailRegex.test(ownerEmail);
    if (validPhone && booking.ownerId === callerUserId) {
      try {
        const smsBody = `PetWash™ ההזמנה אושרה!\n\nמזהה: ${requestId}\nשירות: ${booking.serviceType}\nתאריכים: ${booking.startDate ? new Date(booking.startDate).toLocaleDateString('he-IL', { timeZone: ISRAEL_TIMEZONE }) : 'N/A'} - ${booking.endDate ? new Date(booking.endDate).toLocaleDateString('he-IL', { timeZone: ISRAEL_TIMEZONE }) : 'N/A'}\nסכום: ₪${(booking.totalCents / 100).toFixed(2)}\nסטטוס: אושר ✅\n\nתודה שבחרת ב-PetWash™!`;
        await twilioSMSService.sendSMS(ownerPhone, smsBody, { userId: callerUserId, ip: req.ip, ua: req.headers['user-agent'] });
        logger.info('[BookingRequests] Confirmation SMS sent', { requestId, phone: ownerPhone.slice(0, 6) + '****' });
      } catch (smsErr: any) {
        logger.warn('[BookingRequests] SMS send failed', { error: smsErr.message });
      }
    }

    // ENTERPRISE: Send email receipt to owner
    const recipientEmail = validEmail ? ownerEmail : (req.user?.email || req.firebaseUser?.email);
    // Honest delivery flag. EmailService.send() returns FALSE on failure
    // (it does NOT throw), so we must read the boolean — reporting
    // emailSent based only on "an address exists" hides real failures
    // from a customer who paid and got no receipt.
    let receiptEmailDelivered = false;
    if (recipientEmail) {
      try {
        const receiptHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 24px; margin: 0;">PetWash™</h1>
              <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0;">Booking Receipt</p>
            </div>
            <div style="padding: 32px;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
                <p style="color: #16a34a; font-weight: 600; font-size: 18px; margin: 0;">✅ Booking Confirmed</p>
                <p style="color: #4ade80; font-size: 13px; margin: 4px 0 0;">Both parties confirmed</p>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Booking ID</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${requestId}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Service</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.serviceType}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">תאריך התחלה</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.startDate ? new Date(booking.startDate).toLocaleDateString('he-IL', { timeZone: ISRAEL_TIMEZONE }) : 'N/A'}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">תאריך סיום</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.endDate ? new Date(booking.endDate).toLocaleDateString('he-IL', { timeZone: ISRAEL_TIMEZONE }) : 'N/A'}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Pets</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.petCount}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Subtotal</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">₪${(booking.subtotalCents / 100).toFixed(2)}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Service Fee (15%)</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">₪${(booking.serviceFeeCents / 100).toFixed(2)}</td></tr>
                <tr><td style="padding: 10px 0; color: #1a1a2e; font-weight: 700; font-size: 16px;">Total</td><td style="padding: 10px 0; text-align: right; font-weight: 700; font-size: 16px; color: #1a1a2e;">₪${(booking.totalCents / 100).toFixed(2)}</td></tr>
              </table>
              ${rating ? `<div style="margin-top: 20px; padding: 12px; background: #fef9c3; border-radius: 8px; text-align: center;"><p style="margin: 0; color: #854d0e;">⭐ You rated this service ${rating}/5</p></div>` : ''}
              <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 12px;">
                <p style="color: #1e40af; font-weight: 600; margin: 0 0 4px;">💰 Provider Payout</p>
                <p style="color: #3b82f6; margin: 0; font-size: 13px;">₪${(booking.subtotalCents / 100).toFixed(2)} will be transferred to the provider within 72 hours.</p>
              </div>
            </div>
            <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Pet Wash™ Ltd | ${CANONICAL_SUPPORT_EMAIL}</p>
              <p style="color: #9ca3af; font-size: 11px; margin: 4px 0 0;">This is an automated receipt. Please keep for your records.</p>
            </div>
          </div>`;

        const delivered = await EmailService.send({
          to: recipientEmail,
          subject: `PetWash™ Booking Receipt - ${requestId}`,
          html: receiptHtml,
          from: 'noreply@petwash.co.il',
        });
        receiptEmailDelivered = delivered;
        if (delivered) {
          logger.info('[BookingRequests] Receipt email sent', { requestId, email: recipientEmail });
        } else {
          logger.error('[BookingRequests] Receipt email NOT delivered (EmailService returned false)', { requestId, email: recipientEmail });
        }
      } catch (emailErr: any) {
        logger.error('[BookingRequests] Email receipt failed', { requestId, error: emailErr.message });
      }
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    const finalStatus = rating ? 'reviewed' : 'completed';
    
    statusHistory.push({
      status: finalStatus,
      timestamp: new Date().toISOString(),
      note: rating 
        ? `Owner confirmed and left ${rating}-star review. Payment of ₪${(booking.subtotalCents / 100).toFixed(2)} released to provider.`
        : `Owner confirmed completion. Payment of ₪${(booking.subtotalCents / 100).toFixed(2)} released to provider.`,
    });

    // ── Real escrow release: update Firestore escrow status to 'released' ────
    // This keeps Firestore and PostgreSQL in sync.  A DB-only paymentReleasedAt
    // without the Firestore counterpart would cause admin reconciliation drift.
    try {
      const escrows = await EscrowService.getEscrowsByBooking(requestId);
      for (const escrow of escrows) {
        if (escrow.status === 'held') {
          await EscrowService.releaseEscrowPayment(escrow.id, userId);
          logger.info('[BookingRequests] Firestore escrow released', { requestId, escrowId: escrow.id });
        }
      }
    } catch (escrowReleaseErr: any) {
      // Non-blocking: DB state is the source of truth; Firestore drift is surfaced
      // as a 'warn' in admin reconciliation and can be patched by an admin.
      logger.warn('[BookingRequests] Firestore escrow release failed (non-blocking)', {
        error: escrowReleaseErr.message, requestId,
      });
    }

    // ── Write canonical pw_payments + pw_provider_payouts rows ───────────────
    // These tables are the financial audit trail.  Without them, the admin
    // reconciliation report is vacuously clean (no rows = no mismatches).
    try {
      const { writeBookingLedgerEntries } = await import('../services/bookingLedgerWriter');
      await writeBookingLedgerEntries({
        requestId,
        ownerId: booking.ownerId,
        providerId: booking.providerId,
        providerType: booking.providerType,
        totalCents: booking.totalCents,
        subtotalCents: booking.subtotalCents,
        serviceFeeCents: booking.serviceFeeCents,
        paymentTransactionId: booking.paymentTransactionId,
        paymentMethod: booking.paymentMethod,
      });
    } catch (ledgerErr: any) {
      // Non-blocking: missing ledger rows trigger a reconciliation warning,
      // not a booking failure.  Ops can replay from audit log.
      logger.warn('[BookingRequests] Ledger write failed (non-blocking)', {
        error: ledgerErr.message, requestId,
      });
    }
    
    await db.update(bookingRequests)
      .set({
        status: finalStatus,
        ownerConfirmedAt: new Date(),
        customerApprovedAt: new Date(),
        ownerRating: rating?.toString() || null,
        ownerReview: review || null,
        paymentReleasedAt: new Date(), // Release escrow
        statusHistory,
        updatedAt: new Date(),
      } as any)
      .where(eq(bookingRequests.requestId, requestId));
    
    // ── Deal Gate (§L): audit the completion transition ──
    recordStatusEvent({
      bookingId: requestId,
      oldStatus: booking.status,
      newStatus: 'COMPLETED',
      changedBy: userId || booking.ownerId,
      actorRole: 'customer',
      reason: 'owner_confirmed_completion',
      metadata: { finalStatus },
    }).catch(() => {});
    // Booking Rescue: a completed booking closes its lead as CONVERTED.
    {
      const lt = serviceToLeadType(booking.serviceType);
      if (lt && booking.ownerId) {
        closeLead({ userId: booking.ownerId, leadType: lt, relatedBookingId: requestId, outcome: 'CONVERTED' }).catch(() => {});
      }
    }

    logger.info('[BookingRequests] Owner confirmed with enterprise integration', {
      requestId,
      rating,
      paymentReleased: booking.subtotalCents,
      platformFee: booking.serviceFeeCents,
    });

    // ── VAT accounting: record marketplace VAT obligation at escrow release ─
    // Israeli law מועד החיוב: מע"מ is owed when the taxable transaction is
    // completed and funds are released — this is the canonical accounting event.
    // Use recordTransactionFromGross() with the actual customer-paid total
    // (totalCents includes subtotal + service fee) to avoid the back-calculation
    // understatement in recordTransaction().
    // Non-blocking — a failure here must never roll back the confirmed booking.
    {
      // Canonical mapping (shared/serviceDivisions.ts): trainer → 'academy'
      // (was mis-filed as 'sitter-suite', attributing Academy revenue to sitting).
      const vatPlatform = providerTypeToFiscalPlatform(booking.providerType);
      const grossCollectedILS = (booking.totalCents || booking.subtotalCents || 0) / 100;
      try {
        await VATCalculatorService.recordTransactionFromGross(
          vatPlatform,
          requestId,
          grossCollectedILS,
          requestId,
          { serviceType: booking.serviceType, bookingFlow: 'booking_requests', confirmedAt: new Date().toISOString() }
        );
      } catch (vatErr: any) {
        logger.warn('[BookingRequests] VAT ledger recording failed (non-blocking)', { error: vatErr.message, requestId });
      }
    }

    // ── Customer receipt (P0-3 fix, 2026-07-25) ──────────────────────────────
    // The escrow booking engine recorded only the P&L VAT row above and NEVER
    // issued the customer a receipt — a provider booking through this engine
    // produced no חשבונית/קבלה at all (unlike the sitter/walk/academy v1 routes).
    // Issue the disclosed-agent receipt now, at the same completion/escrow-release
    // event as the VAT obligation. VAT is commission-only per the CPA mapping
    // (PROVIDER_BOOKING_COMMISSION → resolveReceiptVat). generateReceipt has its
    // own exactly-once guard, so this is safe even if another path also fires.
    // Fire-and-forget + fail-soft: a receipt problem must never roll back the
    // confirmed booking or delay the response.
    setImmediate(async () => {
      try {
        const [owner] = await db
          .select({ email: users.email, first: users.firstName, last: users.lastName })
          .from(users)
          .where(eq(users.id, booking.ownerId))
          .limit(1);
        const commissionIls = (booking.serviceFeeCents || 0) / 100;
        await IsraeliDigitalReceiptService.generateReceipt({
          platform: 'booking-requests',
          paymentClass: 'PROVIDER_BOOKING_COMMISSION',
          bookingId: requestId,
          customerEmail: owner?.email || '',
          customerName: [owner?.first, owner?.last].filter(Boolean).join(' '),
          // Frozen customer-address snapshot on the booking row → receipt (display only).
          serviceAddress: formatUserAddress(bookingSnapshotToAddress(booking), { lang: 'he' }) || undefined,
          providerId: booking.providerId,
          providerType: booking.providerType,
          serviceDescription: `PetWash booking — ${booking.serviceType}`,
          serviceDescriptionHe: `הזמנת PetWash — ${booking.serviceType}`,
          subtotalAmount: (booking.subtotalCents || 0) / 100,
          platformFeeAmount: commissionIls,
          totalAmount: (booking.totalCents || booking.subtotalCents || 0) / 100,
          paymentMethod: 'Escrow (card)',
          providerPayoutAmount:
            (booking.providerPayoutCents ?? ((booking.subtotalCents || 0) - (booking.serviceFeeCents || 0))) / 100,
          brokerCommissionAmount: commissionIls,
        });
      } catch (receiptErr) {
        logger.warn('[BookingRequests] Customer receipt generation failed (non-blocking)', {
          requestId, error: String(receiptErr),
        });
      }
    });

    logBookingEvent('owner_confirmed', buildEventPayload({ ...booking, status: finalStatus }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      serviceCompletedAt: booking.serviceCompletedAt?.toISOString() || undefined,
      ownerConfirmedAt: new Date().toISOString(),
      paymentReleasedAt: new Date().toISOString(),
    }, { rating, review }).catch(() => {});

    // ── Non-blocking: Google Sheets sync on owner confirmation / payment release ─
    setImmediate(async () => {
      try {
        const { logSitterBooking } = await import('../services/googleSheetsIntegration');
        await logSitterBooking({
          bookingId: requestId,
          customerName: `${booking.ownerFirstName || ''} ${booking.ownerLastName || ''}`.trim() || 'Owner',
          email: booking.ownerEmail || '',
          phone: booking.ownerPhone || '',
          petName: booking.petNames || '',
          petType: booking.petType || 'pet',
          sitterName: booking.providerName || booking.providerId || 'Provider',
          startDate: booking.startDate?.toISOString?.()?.slice(0, 10) || String(booking.startDate),
          endDate: booking.endDate?.toISOString?.()?.slice(0, 10) || String(booking.endDate),
          durationDays: booking.totalDays || 1,
          totalAmount: (booking.totalCents || 0) / 100,
          status: finalStatus === 'disputed' ? 'disputed' : 'payment_released',
        });
      } catch (sheetsErr: any) {
        logger.warn(`[BookingRequests] Google Sheets sync failed (owner_confirm) bookingId=${requestId} reason=${sheetsErr?.message}`);
      }
    });
    
    res.json({
      success: true,
      status: finalStatus,
      payoutETA: '72 hours',
      smsSent: !!ownerPhone,
      emailSent: !!recipientEmail,
      // Honest delivery status: true ONLY when EmailService confirmed the
      // receipt actually went out (not merely that an address existed).
      emailDelivered: receiptEmailDelivered,
      message: 'Thank you! Payment has been released to the provider and will be transferred within 72 hours.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Confirm error', { error: error.message });
    res.status(500).json({ error: 'Failed to confirm completion' });
  }
}

router.post('/:requestId/confirm', handleConfirmCompletion);

/**
 * POST /api/booking-requests/:requestId/approve-completion
 * Blueprint-aligned alias for /confirm — customer approves completion and releases escrow.
 * Delegates directly to handleConfirmCompletion() (same logic, same auth, same DB writes).
 */
router.post('/:requestId/approve-completion', handleConfirmCompletion);

/**
 * POST /api/booking-requests/:requestId/dispute
 * Customer opens a dispute during the 24-hour approval window after provider marks complete.
 * Freezes escrow — no payout until admin resolves. (blueprint §14)
 */
router.post('/:requestId/dispute', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { requestId } = req.params;
    const rawReason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
    if (!rawReason) {
      return res.status(400).json({ error: 'A dispute reason is required.' });
    }

    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the booking owner can open a dispute' });
    }

    // Dispute is only valid while waiting for customer approval
    if (booking.status !== 'provider_marked_complete') {
      return res.status(400).json({
        error: `Disputes can only be opened when the booking is in the completion approval window (current status: ${booking.status}).`,
      });
    }

    const now = new Date();
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'disputed',
      timestamp: now.toISOString(),
      actorType: 'owner',
      actorId: userId,
      note: `Customer opened dispute: ${rawReason}`,
    });

    await db.update(bookingRequests)
      .set({
        status: 'disputed',
        disputeOpenedAt: now,
        disputeOpenedBy: 'owner',
        disputeReason: rawReason,
        statusHistory,
        updatedAt: now,
      } as any)
      .where(eq(bookingRequests.requestId, requestId));

    // Notify provider and admin
    try {
      await db.insert(superAppNotifications).values({
        userId: booking.providerId,
        type: 'booking_disputed',
        title: '⚠️ לקוח פתח מחלוקת',
        titleHe: '⚠️ לקוח פתח מחלוקת',
        body: `הלקוח פתח מחלוקת על הזמנה ${requestId}. התשלום מוקפא עד לפתרון.`,
        bodyHe: `הלקוח פתח מחלוקת על הזמנה ${requestId}. התשלום מוקפא עד לפתרון.`,
        actionUrl: `/booking/confirmation/${requestId}`,
        actionType: 'open_booking',
        channels: ['in_app'],
        isRead: false,
        createdAt: now,
      } as any);
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] Dispute notification failed', { error: notifErr.message });
    }

    logBookingEvent('dispute_opened' as any, buildEventPayload({ ...booking, status: 'disputed' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || now.toISOString(),
      disputeOpenedAt: now.toISOString(),
    }, { reason: rawReason, openedBy: 'owner' }).catch(() => {});

    logger.info('[BookingRequests] Dispute opened by customer', { requestId, userId });
    return res.json({
      success: true,
      status: 'disputed',
      message: 'Dispute opened. Escrow is frozen — our team will review within 48 hours.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Dispute error', { error: error.message });
    return res.status(500).json({ error: 'Failed to open dispute' });
  }
});

/**
 * POST /api/booking-requests/:requestId/provider-emergency-cancel
 *
 * Emergency cancellation by the provider (sudden illness, force majeure, safety concern).
 * Blueprint §9: distinguished from a normal cancellation.
 *
 * Rules:
 *   - Customer always receives full refund regardless of timing.
 *   - 1st emergency in 90 days: logged, no financial penalty.
 *   - 2nd in 90 days: ₪50 deducted from next provider payout.
 *   - 3rd in 90 days: booking pause pending admin review.
 */
router.post('/:requestId/provider-emergency-cancel', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { requestId } = req.params;
    const rawReason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
    if (!rawReason) {
      return res.status(400).json({ error: 'An emergency cancellation reason is required.' });
    }

    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only the assigned provider can submit an emergency cancellation' });
    }

    const nonCancellableStatuses = ['completed', 'reviewed', 'cancelled', 'disputed', 'refunded_full', 'refunded_partial'];
    if (nonCancellableStatuses.includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel booking with status: ${booking.status}` });
    }

    // Count provider emergency cancellations in last 90 days using statusHistory audit trail
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recentEmergencyBookings = await db
      .select({ requestId: bookingRequests.requestId })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.providerId, userId),
          eq(bookingRequests.status, 'cancelled'),
          sql`${bookingRequests.cancellationTier} LIKE 'provider_emergency%'`,
          sql`${bookingRequests.cancelledAt} > ${ninetyDaysAgo.toISOString()}::timestamp`,
        )
      );
    const offenseCount = recentEmergencyBookings.length; // prior offenses

    // Policy: financial penalty tiers
    const EMERGENCY_PENALTY_CENTS = 5000; // ₪50
    let penaltyCents = 0;
    let accountAction: string;
    let providerMessage: string;

    if (offenseCount === 0) {
      // First offense — warning only
      penaltyCents = 0;
      accountAction = 'warning_logged';
      providerMessage = 'Emergency cancellation logged. First offence — no penalty. Please ensure you can commit before accepting future bookings.';
    } else if (offenseCount === 1) {
      // Second offense in 90 days — ₪50 penalty from next payout
      penaltyCents = EMERGENCY_PENALTY_CENTS;
      accountAction = 'penalty_applied';
      providerMessage = `Emergency cancellation logged. Second offence in 90 days — ₪${(EMERGENCY_PENALTY_CENTS / 100).toFixed(2)} will be deducted from your next payout.`;
    } else {
      // Third+ offense — account review + bookings paused
      penaltyCents = EMERGENCY_PENALTY_CENTS;
      accountAction = 'booking_pause_review';
      providerMessage = 'Emergency cancellation logged. Third offence in 90 days — your account has been flagged for review. New booking requests are paused until resolved.';
    }

    const now = new Date();
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'cancelled',
      timestamp: now.toISOString(),
      actorType: 'provider',
      actorId: userId,
      note: `EMERGENCY CANCEL by provider. Reason: ${rawReason}. Offense #${offenseCount + 1} in 90 days. Action: ${accountAction}.`,
    });

    // Customer always gets full refund on emergency cancel
    const refundCents = booking.paymentHeldAt ? booking.totalCents : 0;

    await db.update(bookingRequests)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: 'provider',
        cancellationReason: rawReason,
        cancellationTier: `provider_emergency_offense_${offenseCount + 1}`,
        cancellationPenaltyCents: penaltyCents,
        emergencyCancelReason: rawReason,
        refundCents,
        // Amount OWED, not moved — only the executing wallet refund below may
        // stamp refundProcessedAt (card refunds have no automated rail yet).
        refundProcessedAt: null,
        statusHistory,
        updatedAt: now,
      } as any)
      .where(eq(bookingRequests.requestId, requestId));

    // Free the provider's calendar slot on emergency cancel. Idempotent, best-effort.
    await releaseSlotLock(db, requestId)
      .catch((e: any) => logger.warn('[BookingRequests] slot-lock release failed (emergency-cancel)', { requestId, error: e?.message }));

    // Real Firestore escrow refund — customer always gets full refund on emergency cancel
    if (refundCents > 0) {
      setImmediate(async () => {
        try {
          const escrows = await EscrowService.getEscrowsByBooking(requestId);
          for (const escrow of escrows) {
            if (escrow.status === 'held') {
              await EscrowService.refundEscrowPayment(
                escrow.id,
                `Provider emergency cancel. Reason: ${rawReason}. Full refund: ₪${(refundCents / 100).toFixed(2)}.`,
                userId,
              );
              logger.info('[BookingRequests] Firestore escrow refunded on emergency cancel', { requestId, escrowId: escrow.id });
            }
          }
        } catch (escrowRefundErr: any) {
          logger.warn('[BookingRequests] Firestore escrow refund failed on emergency cancel (non-blocking)', {
            error: escrowRefundErr.message, requestId,
          });
        }
      });
    }

    // Wallet/escrow refund to customer (same logic as normal cancel)
    const financeState = (booking as any).financeState as string | null;
    const holdCents = Number((booking as any).walletHoldCents) || 0;
    const debitedCents = Number((booking as any).walletDebitedCents) || 0;
    if (financeState === 'hold_active' && holdCents > 0) {
      setImmediate(async () => {
        try {
          const r = await walletService.releaseBookingHold({
            userId: booking.ownerId, amountCents: holdCents, bookingId: requestId,
            divisionCode: getDivisionCode(booking.serviceType), ipAddress: null,
          });
          await db.update(bookingRequests)
            .set({ walletReleaseKey: r.txnId, financeState: 'released', updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestId));
        } catch (e: any) {
          logger.error('[BookingRequests] Wallet release failed on emergency cancel', { requestId, error: e.message });
        }
      });
    } else if (financeState === 'debited' && debitedCents > 0) {
      setImmediate(async () => {
        try {
          const r = await walletService.refundBookingWallet({
            userId: booking.ownerId, amountCents: debitedCents, bookingId: requestId,
            divisionCode: getDivisionCode(booking.serviceType),
            reason: 'provider_emergency_cancel', ipAddress: null,
          });
          await db.update(bookingRequests)
            .set({ walletRefundedCents: debitedCents, walletRefundKey: r.txnId, financeState: 'refunded', refundProcessedAt: new Date(), updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestId));
        } catch (e: any) {
          logger.error('[BookingRequests] Wallet refund failed on emergency cancel', { requestId, error: e.message });
        }
      });
    }

    // Notify customer with full refund message and rebook suggestion
    try {
      await db.insert(superAppNotifications).values({
        userId: booking.ownerId,
        type: 'booking_cancelled',
        title: '🚨 הספק ביטל בחירום — החזר מלא',
        titleHe: '🚨 הספק ביטל בחירום — החזר מלא',
        body: `הספק דיווח על נסיבות חירום ולא יכול לתת שירות. קיבלת החזר מלא. נוכל לחפש ספק חלופי בשבילך.`,
        bodyHe: `הספק דיווח על נסיבות חירום ולא יכול לתת שירות. קיבלת החזר מלא. נוכל לחפש ספק חלופי בשבילך.`,
        actionUrl: `/search`,
        actionType: 'open_search',
        channels: ['in_app'],
        isRead: false,
        createdAt: now,
      } as any);
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] Emergency cancel customer notification failed', { error: notifErr.message });
    }

    // Schedule rebook nudge for customer (1 h later)
    scheduleRebookTrigger('cancelled_recovery', {
      userId: booking.ownerId, requestId, providerId: booking.providerId,
      providerName: booking.providerName || undefined, serviceType: booking.serviceType,
      serviceDate: booking.startDate ?? undefined, delayMs: 60 * 60 * 1000,
    }).catch((e: any) => logger.warn('[RebookScheduler] emergency_cancel recovery failed', { error: e.message }));

    logBookingEvent('cancelled' as any, buildEventPayload({ ...booking, status: 'cancelled' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || now.toISOString(),
      cancelledAt: now.toISOString(),
    }, { cancelledBy: 'provider', reason: rawReason, emergencyCancel: true, offenseCount: offenseCount + 1, penaltyCents, accountAction }).catch(() => {});

    logger.info('[BookingRequests] Emergency cancel processed', {
      requestId, userId, offenseCount: offenseCount + 1, penaltyCents, accountAction,
    });

    return res.json({
      success: true,
      status: 'cancelled',
      refundAmount: refundCents / 100,
      accountAction,
      message: providerMessage,
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Emergency cancel error', { error: error.message });
    return res.status(500).json({ error: 'Failed to process emergency cancellation' });
  }
});

/**
 * POST /api/booking-requests/:requestId/cancel - Cancel booking
 */
router.post('/:requestId/cancel', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    // Validate and sanitize the optional reason to prevent HTML/log injection
    const rawReason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : null;
    const reason = rawReason || null;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.ownerId !== userId && booking.providerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }
    
    // If provider_marked_complete, customer should dispute instead of cancel
    if (booking.status === 'provider_marked_complete' && booking.ownerId === userId) {
      return res.status(400).json({
        error: 'The provider has already marked this service as complete. Use /dispute to open a dispute, or /confirm to approve and release payment.',
      });
    }

    const cancelledBy = booking.ownerId === userId ? 'owner' : 'provider';
    const statusHistory = (booking.statusHistory as any[]) || [];

    // Centralised state-machine guard (Phase B2). Rejects cancels from
    // terminal states (cancelled / declined / reviewed) and any actor
    // not permitted at the current status.
    const transitionCheck = applyTransition({
      from: booking.status,
      to: 'cancelled',
      actor: cancelledBy,
      actorId: userId ?? null,
      note: reason || null,
    });
    if (!transitionCheck.result.ok) {
      logger.warn('[BookingRequests] Cancel rejected by state machine', {
        requestId, from: booking.status, actor: cancelledBy, code: transitionCheck.result.code,
      });
      return res.status(transitionCheck.result.statusCode).json({
        error: transitionCheck.result.error,
        code: transitionCheck.result.code,
      });
    }

    // ── Time-based cancellation policy (blueprint §8) ─────────────────────────
    // Hours until service start (can be negative if service already started or passed)
    const hoursUntilService = booking.startDate
      ? (new Date(booking.startDate).getTime() - Date.now()) / (1000 * 60 * 60)
      : 0;

    let refundCents = 0;
    let cancellationTier = 'no_payment';
    let cancellationPenaltyCents = 0;
    const PROVIDER_LATE_CANCEL_PENALTY_CENTS = 5000; // ₪50

    if (booking.paymentHeldAt) {
      if (cancelledBy === 'owner') {
        // Customer cancellation tiers
        if (hoursUntilService > 72) {
          refundCents = booking.totalCents;   // Full refund — ample notice
          cancellationTier = 'customer_72h_plus';
        } else if (hoursUntilService > 24) {
          refundCents = Math.round(booking.totalCents * 0.5); // 50% refund — moderate notice
          cancellationTier = 'customer_24_to_72h';
        } else if (booking.status === 'in_progress') {
          refundCents = 0;  // Service already started — no refund
          cancellationTier = 'customer_in_progress';
        } else {
          refundCents = 0;  // Short notice — no refund; provider compensated
          cancellationTier = 'customer_under_24h';
        }
      } else {
        // Provider cancellation — customer always gets full refund
        refundCents = booking.totalCents;
        if (hoursUntilService <= 24) {
          cancellationPenaltyCents = PROVIDER_LATE_CANCEL_PENALTY_CENTS;
          cancellationTier = 'provider_under_24h';
        } else if (hoursUntilService <= 72) {
          cancellationTier = 'provider_24_to_72h';
        } else {
          cancellationTier = 'provider_72h_plus';
        }
      }
    }
    
    statusHistory.push({
      status: 'cancelled',
      timestamp: new Date().toISOString(),
      actorType: cancelledBy,
      actorId: userId,
      note: `Cancelled by ${cancelledBy}. Tier: ${cancellationTier}. Hours until service: ${hoursUntilService.toFixed(1)}. Refund: ₪${(refundCents / 100).toFixed(2)}${cancellationPenaltyCents > 0 ? `. Provider penalty: ₪${(cancellationPenaltyCents / 100).toFixed(2)}` : ''}. Reason: ${reason || 'No reason provided'}`,
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: reason || null,
        cancellationTier,
        cancellationPenaltyCents,
        refundCents,
        // NOT stamped here (2026-07-30 audit): refundCents is the amount OWED,
        // not moved. Only the rail that actually executes a refund may stamp
        // refundProcessedAt (the wallet blocks below do; the card path has NO
        // automated refund rail yet — stamping it forged a reconciliation
        // record for money still sitting with us).
        refundProcessedAt: null,
        statusHistory,
        updatedAt: new Date(),
      } as any)
      .where(eq(bookingRequests.requestId, requestId));

    // ── Deal Gate (§L/§16): audit the cancellation + record the refund/fee split ──
    // recordRefund writes shadow_only while AUTO_REFUNDS_ENABLED=false (no live money
    // moved here — the existing escrow/wallet rails below still handle the actual refund).
    recordStatusEvent({
      bookingId: requestId,
      oldStatus: booking.status,
      newStatus: cancelledBy === 'provider' ? 'CANCELLED_BY_PROVIDER' : 'CANCELLED_BY_CUSTOMER',
      changedBy: userId,
      actorRole: cancelledBy === 'provider' ? 'provider' : 'customer',
      reason: reason || cancellationTier,
      metadata: { cancellationTier, refundCents, cancellationPenaltyCents, hoursUntilService },
    }).catch(() => {});
    // Booking Rescue: a cancelled booking closes its lead as LOST.
    {
      const lt = serviceToLeadType(booking.serviceType);
      if (lt && booking.ownerId) {
        closeLead({ userId: booking.ownerId, leadType: lt, relatedBookingId: requestId, outcome: 'LOST' }).catch(() => {});
      }
    }
    if (refundCents > 0 || cancellationPenaltyCents > 0) {
      recordRefund({
        bookingId: requestId,
        requestedBy: userId,
        reason: reason || cancellationTier,
        originalAmountCents: booking.totalCents ?? 0,
        cancellationFeeCents: Math.max(0, (booking.totalCents ?? 0) - refundCents),
        providerCompensationCents: cancellationPenaltyCents,
        refundAmountCents: refundCents,
        refundProvider: 'NAYAX',
        policyVersion: 'tiered-v1',
      }).catch(() => {});
    }

    // Free the provider's calendar slot — a cancelled booking must release its
    // EXCLUDE slot-lock so the time becomes re-bookable. Idempotent, best-effort.
    await releaseSlotLock(db, requestId)
      .catch((e: any) => logger.warn('[BookingRequests] slot-lock release failed (cancel)', { requestId, error: e?.message }));

    // ── Calendar sync on CANCEL (Phase B1) ───────────────────────────────────
    // Remove the Google Calendar event so a stale invite doesn't sit on
    // the provider's calendar after the booking is dead. Lookup is by
    // booking_id (extendedProperties), so we don't need to read the event
    // id back from the row. Non-blocking, never throws.
    setImmediate(async () => {
      try {
        const removed = await calendarIntegrationService.deleteBookingEvent(requestId);
        if (removed) {
          await db.update(bookingRequests)
            .set({ platformCalendarEventId: null, updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestId));
        }
      } catch (calErr: any) {
        logger.warn('[BookingRequests] Calendar delete failed on cancel (non-blocking)', {
          requestId, error: calErr?.message,
        });
      }
    });

    // ── Real escrow refund: update Firestore escrow status to 'refunded' ─────
    // For card-based bookings, the Firestore escrow document must be updated to
    // 'refunded' so admin reconciliation shows the correct state.
    // Wallet-only bookings may have no Firestore escrow; getEscrowsByBooking()
    // returns [] in that case and this block is a no-op.
    if (refundCents > 0) {
      setImmediate(async () => {
        try {
          const escrows = await EscrowService.getEscrowsByBooking(requestId);
          for (const escrow of escrows) {
            if (escrow.status === 'held') {
              await EscrowService.refundEscrowPayment(
                escrow.id,
                `Booking cancelled by ${cancelledBy}. Tier: ${cancellationTier}. Refund: ₪${(refundCents / 100).toFixed(2)}.`,
                userId,
              );
              logger.info('[BookingRequests] Firestore escrow refunded on cancel', { requestId, escrowId: escrow.id, refundCents });
            }
          }
        } catch (escrowRefundErr: any) {
          // Non-blocking: Firestore drift surfaced in admin reconciliation as a warn.
          logger.warn('[BookingRequests] Firestore escrow refund failed on cancel (non-blocking)', {
            error: escrowRefundErr.message, requestId,
          });
        }
      });
    }

    // ── Domain event: BOOKING_CANCELLED ──────────────────────────────────────
    eventPublisher.publishEvent(
      DomainEventType.BOOKING_CANCELLED,
      {
        bookingId: requestId,
        userId: booking.ownerId,
        providerId: booking.providerId,
        serviceType: booking.serviceType,
        cancelledBy,
        refundCents,
        reason: reason || null,
      },
      { source: 'booking-requests/cancel', aggregateType: 'booking', aggregateId: requestId, userId: booking.ownerId },
    ).catch((e: any) => logger.error('[BookingRequests] BOOKING_CANCELLED event publish failed', { error: e?.message, requestId }));

    // ── Wallet lifecycle on cancel ─────────────────────────────────────────────
    // hold_active → release (funds never spent, restore to available)
    // debited → refund (funds were charged, return to available)
    const financeState = (booking as any).financeState as string | null;
    const holdCents = Number((booking as any).walletHoldCents) || 0;
    const debitedCents = Number((booking as any).walletDebitedCents) || 0;
    if (financeState === 'hold_active' && holdCents > 0) {
      setImmediate(async () => {
        try {
          const releaseResult = await walletService.releaseBookingHold({
            userId: booking.ownerId, amountCents: holdCents, bookingId: requestId,
            divisionCode: getDivisionCode(booking.serviceType), ipAddress: req.ip ?? null,
          });
          await db.update(bookingRequests)
            .set({ walletReleaseKey: releaseResult.txnId, financeState: 'released', updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestId));
          logger.info('[BookingRequests] Wallet hold released on cancel', { requestId, holdCents, txnId: releaseResult.txnId });
        } catch (e: any) {
          logger.error('[BookingRequests] Wallet release failed on cancel', { requestId, error: e.message });
        }
      });
    } else if (financeState === 'debited' && debitedCents > 0) {
      setImmediate(async () => {
        try {
          const refundResult = await walletService.refundBookingWallet({
            userId: booking.ownerId, amountCents: debitedCents, bookingId: requestId,
            divisionCode: getDivisionCode(booking.serviceType),
            reason: `booking_cancelled_by_${cancelledBy}`, ipAddress: req.ip ?? null,
          });
          await db.update(bookingRequests)
            .set({ walletRefundedCents: debitedCents, walletRefundKey: refundResult.txnId, financeState: 'refunded', refundProcessedAt: new Date(), updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestId));
          logger.info('[BookingRequests] Wallet refunded on cancel', { requestId, debitedCents, txnId: refundResult.txnId });
        } catch (e: any) {
          logger.error('[BookingRequests] Wallet refund failed on cancel', { requestId, error: e.message });
        }
      });
    }

    // Notify the OTHER party about cancellation via superAppNotifications
    try {
      const notifyUid = cancelledBy === 'owner' ? booking.providerId : booking.ownerId;

      // Resolve provider display name for personalised copy
      let providerName = 'הספק';
      if (booking.providerId) {
        const [providerUser] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, booking.providerId))
          .limit(1);
        if (providerUser) {
          providerName = [providerUser.firstName, providerUser.lastName].filter(Boolean).join(' ') || 'הספק';
        }
      }

      // Customer cancelled → notify provider
      // Provider cancelled → notify customer
      const notifyingCustomer = cancelledBy === 'provider';
      const titleText = notifyingCustomer
        ? `🚫 ${providerName} ביטל את ההזמנה`
        : `🚫 הלקוח ביטל את ההזמנה`;
      const walletReturnLine =
        financeState === 'hold_active' && holdCents > 0
          ? ` ₪${(holdCents / 100).toFixed(2)} שוחררו חזרה לארנק שלך.`
          : financeState === 'debited' && debitedCents > 0
          ? ` ₪${(debitedCents / 100).toFixed(2)} הוחזרו לארנק שלך.`
          : '';
      const bodyText = notifyingCustomer
        ? `מצאנו ספקים דומים באזורך — לחץ לחיפוש.${walletReturnLine}${reason ? ` (${reason})` : ''}`
        : `ההזמנה בוטלה על ידי הלקוח.${reason ? ` סיבה: ${reason}` : ''}`;

      await db.insert(superAppNotifications).values({
        userId: notifyUid,
        type: 'booking_cancelled',
        title: titleText,
        titleHe: titleText,
        body: bodyText,
        bodyHe: bodyText,
        actionUrl: `/booking/confirmation/${requestId}`,
        actionType: 'open_booking',
        channels: ['in_app'],
        isRead: false,
        createdAt: new Date(),
      });

      // FCM push to the same party (spec §11: "booking cancelled" must buzz the
      // app, not just sit in the in-app list). Fire-and-forget; never blocks cancel.
      if (notifyUid) {
        import('../services/FCMService')
          .then(({ FCMService }) => FCMService.sendToUser({
            userId: notifyUid,
            title: titleText,
            body: bodyText.slice(0, 200),
            clickAction: notifyingCustomer ? `/booking/confirmation/${requestId}` : `/provider/jobs/${requestId}`,
            data: { type: 'booking_cancelled', bookingId: requestId },
          }))
          .catch((e: any) => logger.warn('[BookingRequests] cancel push failed (non-blocking)', { error: e?.message, requestId }));
      }
    } catch (notifErr: any) {
      logger.warn('[BookingRequests] superAppNotifications insert failed (cancel)', { error: notifErr.message });
    }

    // ── Non-blocking: cancelled_recovery nudge for customer (2 h later, only when provider cancels) ─
    if (cancelledBy === 'provider' && booking.ownerId) {
      scheduleRebookTrigger('cancelled_recovery', {
        userId: booking.ownerId,
        requestId,
        providerId: booking.providerId,
        providerName: booking.providerName || undefined,
        serviceType: booking.serviceType,
        serviceDate: booking.startDate ?? undefined,
        delayMs: 2 * 60 * 60 * 1000,
      }).catch((e: any) => logger.warn('[RebookScheduler] cancelled_recovery schedule failed', { error: e.message }));
    }

    logger.info('[BookingRequests] Booking cancelled', {
      requestId,
      cancelledBy,
      refundCents,
    });

    logBookingEvent('cancelled', buildEventPayload({ ...booking, status: 'cancelled' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      cancelledAt: new Date().toISOString(),
    }, { cancelledBy, reason, refundCents }).catch(() => {});
    
    res.json({
      success: true,
      status: 'cancelled',
      cancellationTier,
      refundAmount: refundCents / 100,
      penaltyAmount: cancellationPenaltyCents / 100,
      message: refundCents > 0
        ? `Booking cancelled. Refund of ₪${(refundCents / 100).toFixed(2)} will be processed.${cancellationPenaltyCents > 0 ? ` A penalty of ₪${(cancellationPenaltyCents / 100).toFixed(2)} will be deducted from the provider's next payout.` : ''}`
        : `Booking cancelled. No refund applies (${cancellationTier}).`,
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Cancel error', { error: error.message });
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * POST /api/booking-requests/:requestId/photo-update - Provider sends photo update
 */
router.post('/:requestId/photo-update', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { photoUrl, caption } = req.body;
    
    if (!photoUrl) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only provider can send photo updates' });
    }
    
    if (booking.status !== 'in_progress') {
      return res.status(400).json({ error: 'Photo updates can only be sent during service' });
    }
    
    const photoUpdates = (booking.photoUpdates as any[]) || [];
    photoUpdates.push({
      url: photoUrl,
      caption: caption || '',
      timestamp: new Date().toISOString(),
    });
    
    await db.update(bookingRequests)
      .set({
        photoUpdates,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));
    
    res.json({ success: true, message: 'Photo update sent to owner!' });
  } catch (error: any) {
    logger.error('[BookingRequests] Photo update error', { error: error.message });
    res.status(500).json({ error: 'Failed to send photo update' });
  }
});

/**
 * POST /api/booking-requests/:requestId/reprice
 * Rebuilds the quote for an existing booking request and persists updated line items.
 * Call this when: promo code changes, wallet toggle changes, or after provider accepts.
 */
router.post('/:requestId/reprice', async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = (req as any).userId || req.user?.uid || null;

    const booking = await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);

    if (!booking.length) {
      return res.status(404).json({ error: 'Booking request not found' });
    }

    const br = booking[0];

    // AUTH + OWNERSHIP (IDOR fix): only the booking owner (or a verified admin) may
    // reprice. Without this, any caller could reprice any requestId and attach their
    // own promo/wallet/gift-card flags, overwriting the victim's persisted quote.
    if (!userId || (br.ownerId !== userId && !isSuperAdminVerified(req as any))) {
      return res.status(403).json({ error: 'Not authorized to reprice this booking' });
    }

    // Rebuild quote from saved pet details snapshot
    const savedPets: any[] = (br.petDetails as any[]) ?? [];
    if (!savedPets.length && (br.petCount ?? 0) > 0) {
      return res.status(400).json({
        error: 'No pet details stored on this booking. Cannot reprice.',
      });
    }

    const pets = savedPets.map((p: any, i: number) => ({
      clientRef: String(i),
      petId: p.petId ?? null,
      petName: p.petName ?? p.name ?? `Pet ${i + 1}`,
      petType: p.petType ?? p.species ?? 'dog',
      breed: p.breed ?? null,
      sizeCategory: p.sizeCategory ?? p.size ?? null,
      ageYears: p.ageYears ?? p.age ?? null,
      weightKg: p.weightKg ?? null,
      requiresMedication: p.requiresMedication ?? false,
      hasBehaviorFlag: p.hasBehaviorFlag ?? false,
      hasSpecialNeeds: p.hasSpecialNeeds ?? false,
      quantity: 1,
    }));

    const quote = await calculateQuote({
      providerId: br.providerId,
      serviceType: br.serviceType,
      currency: br.currency,
      bookingWindow: {
        startAt: br.startDate.toISOString(),
        endAt: br.endDate.toISOString(),
      },
      pets,
      addons: [],
      promoCode: req.body?.promoCode ?? br.promoCode ?? null,
      giftCardCode: req.body?.giftCardCode ?? null,
      useWalletCredit: req.body?.useWalletCredit ?? false,
      userId,
      bookingRequestId: br.id,
    });

    if (!quote.success) {
      return res.status(422).json(quote);
    }

    await persistBookingQuote(br.id, quote, pets, []);

    return res.json({ ...quote, bookingRequestId: br.id, requestId });
  } catch (error: any) {
    logger.error('[BookingRequests] Reprice error', { error: error.message });
    res.status(500).json({ error: 'Failed to reprice booking' });
  }
});

/* ── Rebook trigger tracking ─────────────────────────────────────────────── */

// POST /api/rebook-triggers/:id/clicked
// POST /api/rebook-triggers/:id/rebook-started
// POST /api/rebook-triggers/:id/rebook-completed
const REBOOK_TRACKING_FIELDS: Record<string, string> = {
  'clicked':          'clicked_at',
  'rebook-started':   'rebook_started_at',
  'rebook-completed': 'rebook_completed_at',
};

router.post('/rebook-triggers/:triggerId/:action', async (req, res) => {
  try {
    const { triggerId, action } = req.params;
    const userId = (req as any).user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const field = REBOOK_TRACKING_FIELDS[action];
    if (!field) return res.status(400).json({ error: 'Unknown tracking action' });

    const id = parseInt(triggerId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid trigger ID' });

    const [trigger] = await db
      .select({ id: rebookTriggers.id, userId: rebookTriggers.userId })
      .from(rebookTriggers)
      .where(eq(rebookTriggers.id, id))
      .limit(1);

    if (!trigger) return res.status(404).json({ error: 'Trigger not found' });
    if (trigger.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    await db
      .update(rebookTriggers)
      .set({ [field === 'clicked_at' ? 'clickedAt' : field === 'rebook_started_at' ? 'rebookStartedAt' : 'rebookCompletedAt']: new Date() } as any)
      .where(eq(rebookTriggers.id, id));

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[BookingRequests] Rebook tracking error', { error: err.message });
    return res.status(500).json({ error: 'Tracking failed' });
  }
});

// NOTE (2026-06-14): a duplicate GET '/my-completed-count' was registered here
// AND earlier in this file (~line 714). Express serves the first match, so this
// second copy was dead code. Removed to eliminate the shadowing conflict; the
// canonical handler earlier in the file is unchanged.

// ═══════════════════════════════════════════════════════════════════════════
// HOST STAY BOOKING JOURNEY (CEO 2026-07-02/03) — completes Pet Sitter Suite
// beyond "paid": care details, provider readiness, handover confirmations, and
// the computed safety checklist. Reference case: the founder's Kenzo booking.
// Payment confirmation is not the end — it starts the safety journey.
// ═══════════════════════════════════════════════════════════════════════════

/** Resolve a booking the caller is a party to (owner OR provider). */
async function loadBookingForParty(requestId: string, userId: string) {
  const [booking] = await db.select().from(bookingRequests)
    .where(eq(bookingRequests.requestId, requestId)).limit(1);
  if (!booking) return { booking: null as any, role: null as 'owner' | 'provider' | null };
  const role: 'owner' | 'provider' | null =
    booking.ownerId === userId ? 'owner' : booking.providerId === userId ? 'provider' : null;
  return { booking, role };
}

/** Overnight/long host-stays need the stronger safety set (vet, meds dosage). */
function isOvernightOrLong(booking: any): boolean {
  try {
    const start = booking.startDate ? new Date(booking.startDate).getTime() : 0;
    const end = booking.endDate ? new Date(booking.endDate).getTime() : 0;
    return end - start >= 20 * 60 * 60 * 1000; // ≥ ~overnight
  } catch { return false; }
}

/** Compute the safety checklist from the care details — single source of truth,
 *  no separate checklist table to drift. Returns which CRITICAL items are
 *  present/missing and whether the booking is ready to start. */
function computeChecklist(booking: any, d: any | null) {
  const has = (v: any) => v !== null && v !== undefined && String(v).trim().length > 0;
  const overnight = isOvernightOrLong(booking);
  const medsMentioned = has(d?.medication);

  const items: { key: string; label: string; required: boolean; present: boolean }[] = [
    { key: 'pickup_dropoff',    label: 'Pickup / drop-off time',     required: true,       present: has(d?.pickupAt) || has(d?.dropoffAt) },
    { key: 'meeting_location',  label: 'Meeting location',           required: true,       present: has(d?.meetingLocation) },
    { key: 'emergency_contact', label: 'Emergency contact',          required: true,       present: has(d?.emergencyContactName) && has(d?.emergencyContactPhone) },
    { key: 'vet',               label: 'Vet contact',                required: overnight,  present: has(d?.vetName) && has(d?.vetPhone) },
    { key: 'food',              label: 'Food instructions',          required: true,       present: has(d?.foodInstructions) },
    { key: 'medication_dosage', label: 'Medication dosage',          required: medsMentioned, present: !medsMentioned || has(d?.medicationDosage) },
    { key: 'behaviour',         label: 'Behaviour / safety notes',   required: true,       present: has(d?.behaviourNotes) },
  ];
  const missing = items.filter(i => i.required && !i.present).map(i => i.key);
  return { items, missing, ready: missing.length === 0, overnight };
}

// ── GET /:requestId/care-details — the journey pack + computed checklist ──────
router.get('/:requestId/care-details', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { booking, role } = await loadBookingForParty(req.params.requestId, userId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (!role) return res.status(403).json({ error: 'Not a party to this booking' });

    const [details] = await db.select().from(hostStayDetails)
      .where(eq(hostStayDetails.bookingRequestId, booking.id)).limit(1);
    const handovers = await db.select().from(bookingHandoverEvents)
      .where(eq(bookingHandoverEvents.bookingRequestId, booking.id));

    // Provider only sees the care pack once they've accepted (address-reveal rule).
    const accepted = ['confirmed', 'in_progress', 'completed'].includes(booking.status);
    const visibleDetails = (role === 'owner' || accepted) ? (details ?? null) : null;

    return res.json({
      ok: true,
      requestId: booking.requestId,
      role,
      status: booking.status,
      details: visibleDetails,
      handovers,
      checklist: computeChecklist(booking, details ?? null),
    });
  } catch (err: any) {
    logger.error('[HostStay] care-details GET error', { error: err?.message });
    return res.status(500).json({ error: 'Failed to load care details' });
  }
});

// ── POST /:requestId/care-details — OWNER upserts the care pack ───────────────
const careDetailsSchema = z.object({
  flowType:              z.enum(['HOST_HOME', 'CUSTOMER_HOME', 'WALK', 'ACADEMY']).optional(),
  pickupAt:              z.string().datetime().optional().nullable(),
  dropoffAt:             z.string().datetime().optional().nullable(),
  meetingLocation:       z.string().max(500).optional().nullable(),
  emergencyContactName:  z.string().max(160).optional().nullable(),
  emergencyContactPhone: z.string().max(40).optional().nullable(),
  vetName:               z.string().max(160).optional().nullable(),
  vetPhone:              z.string().max(40).optional().nullable(),
  foodInstructions:      z.string().max(4000).optional().nullable(),
  medication:            z.string().max(2000).optional().nullable(),
  medicationDosage:      z.string().max(1000).optional().nullable(),
  allergies:             z.string().max(2000).optional().nullable(),
  behaviourNotes:        z.string().max(4000).optional().nullable(),
  specialInstructions:   z.string().max(4000).optional().nullable(),
});

router.post('/:requestId/care-details', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { booking, role } = await loadBookingForParty(req.params.requestId, userId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (role !== 'owner') return res.status(403).json({ error: 'Only the pet owner can set care details' });

    const parsed = careDetailsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid care details', details: parsed.error.flatten() });
    const b = parsed.data;
    const toDate = (s?: string | null) => (s ? new Date(s) : null);

    const [existing] = await db.select({ id: hostStayDetails.id }).from(hostStayDetails)
      .where(eq(hostStayDetails.bookingRequestId, booking.id)).limit(1);

    const values: any = {
      bookingRequestId: booking.id,
      requestId: booking.requestId,
      ownerId: booking.ownerId,
      ...(b.flowType ? { flowType: b.flowType } : {}),
      pickupAt: toDate(b.pickupAt), dropoffAt: toDate(b.dropoffAt),
      meetingLocation: b.meetingLocation ?? null,
      emergencyContactName: b.emergencyContactName ?? null,
      emergencyContactPhone: b.emergencyContactPhone ?? null,
      vetName: b.vetName ?? null, vetPhone: b.vetPhone ?? null,
      foodInstructions: b.foodInstructions ?? null,
      medication: b.medication ?? null, medicationDosage: b.medicationDosage ?? null,
      allergies: b.allergies ?? null, behaviourNotes: b.behaviourNotes ?? null,
      specialInstructions: b.specialInstructions ?? null,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(hostStayDetails).set(values).where(eq(hostStayDetails.id, existing.id));
    } else {
      await db.insert(hostStayDetails).values(values);
    }

    const [details] = await db.select().from(hostStayDetails)
      .where(eq(hostStayDetails.bookingRequestId, booking.id)).limit(1);
    return res.json({ ok: true, details, checklist: computeChecklist(booking, details) });
  } catch (err: any) {
    logger.error('[HostStay] care-details POST error', { error: err?.message });
    return res.status(500).json({ error: 'Failed to save care details' });
  }
});

// ── POST /:requestId/provider-readiness — PROVIDER confirms home-ready set ─────
router.post('/:requestId/provider-readiness', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { booking, role } = await loadBookingForParty(req.params.requestId, userId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (role !== 'provider') return res.status(403).json({ error: 'Only the provider can confirm readiness' });
    if (!['confirmed', 'in_progress'].includes(booking.status)) {
      return res.status(409).json({ error: 'Confirm readiness only after accepting the booking' });
    }

    const readiness = (req.body && typeof req.body.readiness === 'object') ? req.body.readiness : {};
    const homeReady = req.body?.homeReady === true;

    const [existing] = await db.select({ id: hostStayDetails.id }).from(hostStayDetails)
      .where(eq(hostStayDetails.bookingRequestId, booking.id)).limit(1);
    if (existing) {
      await db.update(hostStayDetails)
        .set({ providerReadiness: readiness, providerHomeReady: homeReady, updatedAt: new Date() })
        .where(eq(hostStayDetails.id, existing.id));
    } else {
      await db.insert(hostStayDetails).values({
        bookingRequestId: booking.id, requestId: booking.requestId, ownerId: booking.ownerId,
        providerReadiness: readiness, providerHomeReady: homeReady,
      } as any);
    }
    return res.json({ ok: true, homeReady });
  } catch (err: any) {
    logger.error('[HostStay] provider-readiness error', { error: err?.message });
    return res.status(500).json({ error: 'Failed to save readiness' });
  }
});

// ── POST /:requestId/handover — confirm DROPOFF (start) or PICKUP (end) ───────
const handoverSchema = z.object({
  direction: z.enum(['DROPOFF', 'PICKUP']),
  notes:     z.string().max(2000).optional(),
  photoUrl:  z.string().url().max(1000).optional(),
});

router.post('/:requestId/handover', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { booking, role } = await loadBookingForParty(req.params.requestId, userId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (!role) return res.status(403).json({ error: 'Not a party to this booking' });

    const parsed = handoverSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid handover', details: parsed.error.flatten() });
    const { direction, notes, photoUrl } = parsed.data;

    // Idempotent per (booking, direction, role): a party confirms each handover once.
    const existing = await db.select({ id: bookingHandoverEvents.id }).from(bookingHandoverEvents)
      .where(and(
        eq(bookingHandoverEvents.bookingRequestId, booking.id),
        eq(bookingHandoverEvents.direction, direction),
        eq(bookingHandoverEvents.confirmedByRole, role),
      )).limit(1);
    if (existing.length) {
      return res.json({ ok: true, alreadyConfirmed: true, direction, role });
    }

    await db.insert(bookingHandoverEvents).values({
      bookingRequestId: booking.id, requestId: booking.requestId,
      direction, confirmedByRole: role, confirmedByUid: userId,
      notes: notes ?? null, photoUrl: photoUrl ?? null,
    } as any);

    // Notify the other party in-app (best-effort, non-blocking).
    const otherUid = role === 'owner' ? booking.providerId : booking.ownerId;
    if (otherUid) {
      const label = direction === 'DROPOFF' ? 'Pet drop-off confirmed' : 'Pet pickup confirmed';
      db.insert(superAppNotifications).values({
        userId: otherUid, type: 'booking_handover',
        title: `✅ ${label}`, titleHe: direction === 'DROPOFF' ? '✅ מסירת החיה אושרה' : '✅ איסוף החיה אושר',
        body: `${label} for booking ${booking.requestId}.`,
        bodyHe: `${direction === 'DROPOFF' ? 'מסירת החיה אושרה' : 'איסוף החיה אושר'} עבור הזמנה ${booking.requestId}.`,
        actionUrl: `/booking/confirmation/${booking.requestId}`, actionType: 'open_booking',
        channels: ['in_app'], isRead: false, createdAt: new Date(),
      } as any).catch((e: any) => logger.warn('[HostStay] handover notify failed', { error: e?.message }));
    }

    return res.json({ ok: true, direction, role, confirmedAt: new Date().toISOString() });
  } catch (err: any) {
    logger.error('[HostStay] handover error', { error: err?.message });
    return res.status(500).json({ error: 'Failed to confirm handover' });
  }
});

export default router;
