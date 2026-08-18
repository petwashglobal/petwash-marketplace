import { db } from '../db';
import crypto from 'crypto';
import { walkBookings, users, walkBlockchainAudit, walkerProfiles } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * SafeLiveSessionDTO — the projection returned to authorized callers for
 * an active walk. Never contains raw walkBookings columns (which include
 * pricing internals, walker profile FKs, and other fields no client
 * needs to see). Kept in-service so the route handler cannot forget to
 * project. See P0-1 fix, 2026-08-18.
 */
export interface SafeLiveSessionDTO {
  walkId: number;
  bookingId: string;
  status: string;
  petId: string | null;
  petName: string | null;
  scheduledDate: string | null;
  durationMinutes: number | null;
  actualStartTime: string | null;
  elapsedTime: number;         // seconds since actualStartTime
  estimatedRemaining: number;  // seconds
  currentLocation: unknown;    // jsonb {latitude, longitude, accuracy, timestamp}
  lastGPSUpdate: string | null;
  totalDistanceMeters: number;
  vitalDataSummary: unknown;   // jsonb — summary only, not raw sequence
  routePolyline: string;
  isLiveTrackingActive: boolean;
  /** Whether the caller is the owner or the walker. Never both. */
  callerRole: 'owner' | 'walker';
}

interface CheckInData {
  walkId: number; // Primary key (serial)
  walkerId: string;
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  deviceInfo: string;
}

interface CheckOutData {
  walkId: number; // Primary key (serial)
  walkerId: string;
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  totalDistance: number; // meters
  totalDuration: number; // seconds
  vitalData: {
    heartRateAvg: number;
    heartRateMax: number;
    steps: number;
    hydrationStops: number;
    photosTaken: number;
  };
  routePolyline: string; // Encoded GPS coordinates
}

interface WalkSessionLog {
  walkId: number;
  action: 'check_in' | 'check_out' | 'gps_update' | 'vital_update' | 'photo_upload' | 'emergency_alert';
  timestamp: Date;
  data: any;
  ipAddress: string;
  userAgent: string;
}

export class WalkSessionService {
  /**
   * P1-14 helper (2026-08-18): translate a caller's Firebase UID into the
   * WALKER-uuid stored in walk_bookings.walkerId. Returns null when the
   * caller isn't a registered walker.
   *
   * Route handlers pass req.user.uid (a Firebase UID) as `walkerId`, but
   * the walk_bookings column stores a `WALKER-<uuid>` string (references
   * walker_profiles.walkerId). Every prior string-compare between the
   * two was silently false, so walker-facing write paths were dead —
   * check-in / check-out / gps-update / vital-update / bathroom-marker
   * all rejected the assigned walker.
   */
  private async resolveWalkerUuid(callerUid: string): Promise<string | null> {
    if (!callerUid) return null;
    // Adversarial-review Q10 (2026-08-18): walker_profiles.userId has NO
    // unique constraint (schema.ts:4735-4842 — only walkerId is unique).
    // A duplicate row for the same Firebase UID is physically possible,
    // and `.limit(1)` without ORDER BY returns implementation-defined
    // row — the same walker could resolve to a different WALKER-uuid
    // across requests and quietly bypass the walk_bookings.walkerId
    // assignment check. Fetch two + throw on ambiguity so ops SEE it.
    const rows = await db
      .select({ walkerId: walkerProfiles.walkerId })
      .from(walkerProfiles)
      .where(eq(walkerProfiles.userId, callerUid))
      .limit(2);
    if (rows.length === 0) return null;
    if (rows.length > 1) {
      throw new Error('resolveWalkerUuid: duplicate walker_profiles rows for userId — refusing to auto-pick');
    }
    return (rows[0].walkerId || null) as string | null;
  }

  /**
   * Check-in: Walker starts the walk session
   * Creates blockchain audit entry and updates walk status
   *
   * P0-3 (2026-08-18): atomic transition. Previously SELECT + UPDATE with
   * a WHERE guarded only on `id` — two concurrent start taps both
   * observed status='confirmed' and both wrote. Now: conditional UPDATE
   * WHERE `status='confirmed' AND walkerId=<resolved WALKER-uuid>`
   * RETURNING; exactly one caller wins. Second concurrent tap detected
   * as "already started by same walker" → idempotent success (returns
   * the same sessionId/checkInTime the first caller established). Any
   * other state → 409 INVALID_TRANSITION.
   *
   * P1-14 (2026-08-18): walker identity check uses the resolved
   * WALKER-uuid (not the Firebase UID) so real walkers pass — see helper
   * above.
   */
  async checkIn(data: CheckInData): Promise<{
    success: boolean;
    sessionId: string;
    checkInTime: Date;
    estimatedCheckOut: Date;
    alreadyStarted?: boolean;
  }> {
    const checkInTime = data.timestamp;

    const walkerUuid = await this.resolveWalkerUuid(data.walkerId);
    if (!walkerUuid) {
      throw new Error('Not registered as walker');
    }

    // Atomic transition — the only writer for status: confirmed → in_progress
    // on this booking that also matches THIS walker's assignment.
    const winners = await db
      .update(walkBookings)
      .set({
        status: 'in_progress',
        actualStartTime: checkInTime,
        checkInLocation: data.location as any,
        isLiveTrackingActive: true,
        updatedAt: new Date(),
      })
      .where(and(
        eq(walkBookings.id, data.walkId),
        eq(walkBookings.status, 'confirmed'),
        eq(walkBookings.walkerId, walkerUuid),
      ))
      .returning();

    if (winners.length === 0) {
      // No row updated. Diagnose: does the row exist? is it assigned to
      // this walker? has it already been started by this walker?
      const [current] = await db
        .select()
        .from(walkBookings)
        .where(eq(walkBookings.id, data.walkId))
        .limit(1);
      if (!current) throw new Error('Walk booking not found');
      if (current.walkerId !== walkerUuid) throw new Error('Unauthorized: Walker ID mismatch');
      if (current.status === 'in_progress' && current.actualStartTime) {
        // Idempotent success — second concurrent tap sees the winner's state.
        const est = new Date(current.actualStartTime.getTime() + (current.durationMinutes || 60) * 60000);
        return {
          success: true,
          // sessionId is declared as `string` on the interface; use the
          // public bookingId (WALK-YYYY-NNNNNN) rather than the internal
          // numeric row PK. Falls back to a string cast if bookingId is
          // ever missing so we never crash here.
          sessionId: current.bookingId || String(data.walkId),
          checkInTime: current.actualStartTime,
          estimatedCheckOut: est,
          alreadyStarted: true,
        };
      }
      throw new Error(`Cannot check in from status "${current.status}"`);
    }

    // Winner path — proceed with side effects exactly once.
    const walk = winners[0];

    // Create blockchain audit entry for check-in
    await db.insert(walkBlockchainAudit).values({
      bookingId: walk.bookingId,
      blockHash: this.generateHash({
        walkId: data.walkId,
        action: 'check_in',
        timestamp: checkInTime,
        location: data.location,
      }),
      previousBlockHash: await this.getLatestWalkHash(walk.bookingId),
      actionType: 'check_in',
      actionData: JSON.stringify({
        location: data.location,
        deviceInfo: data.deviceInfo,
        scheduledStart: walk.scheduledDate,
      }),
      performedBy: data.walkerId,
      timestamp: checkInTime,
    } as any);

    // Create legacy audit entry for backward compatibility
    /*
    await db.insert(blockchainAuditTrail).values({
      userId: data.walkerId,
      action: 'walk_check_in',
      entityType: 'walk_booking',
      entityId: data.walkId.toString(),
      previousHash: await this.getLatestHash(data.walkerId),
      currentHash: this.generateHash({
        walkId: data.walkId,
        action: 'check_in',
        timestamp: checkInTime,
        location: data.location,
      }),
      metadata: JSON.stringify({
        location: data.location,
        deviceInfo: data.deviceInfo,
        scheduledStart: walk.scheduledDate,
      }),
      ipAddress: '',
      userAgent: data.deviceInfo,
    });
    */

    // Calculate estimated check-out time
    const estimatedCheckOut = new Date(checkInTime.getTime() + (walk.durationMinutes || 60) * 60000);

    // Log session start
    await this.logSessionAction({
      walkId: data.walkId,
      action: 'check_in',
      timestamp: checkInTime,
      data: {
        location: data.location,
        estimatedCheckOut,
      },
      ipAddress: '',
      userAgent: data.deviceInfo,
    });

    return {
      success: true,
      // Interface declares sessionId: string. Use bookingId (WALK-YYYY-…),
      // fall back to numeric-string if bookingId is somehow missing.
      sessionId: walk.bookingId || String(data.walkId),
      checkInTime,
      estimatedCheckOut,
    };
  }

  /**
   * Check-out: Walker completes the walk session
   * Finalizes session, records distance/vitals, triggers payment
   * 
   * Commission: 15% platform commission, Walker gets 85%
   */
  async checkOut(data: CheckOutData): Promise<{
    success: boolean;
    sessionSummary: {
      checkInTime: Date;
      checkOutTime: Date;
      duration: number;
      distance: number;
      vitalData: any;
      earningsBreakdown: {
        totalPaid: number; // What owner paid (base + 15%)
        basePriceEstimate: number; // Estimated base price
        platformFee: number; // Our 15% commission
        walkerEarnings: number; // 85% to walker
        currency: string;
      };
    };
  }> {
    const checkOutTime = data.timestamp;

    // P1-14 fix — see helper above.
    const walkerUuid = await this.resolveWalkerUuid(data.walkerId);
    if (!walkerUuid) {
      throw new Error('Not registered as walker');
    }

    // P0-4 atomic transition: only walker who currently owns the
    // in_progress row wins. Second concurrent finish tap sees zero rows
    // updated → we diagnose and return idempotently or throw.
    const winners = await db
      .update(walkBookings)
      .set({
        status: 'completed',
        actualEndTime: checkOutTime,
        checkOutLocation: data.location as any,
        actualDurationMinutes: Math.floor(data.totalDuration / 60),
        totalDistanceMeters: data.totalDistance,
        vitalDataSummary: data.vitalData as any,
        routePolyline: data.routePolyline,
        isLiveTrackingActive: false,
        walkCompletedSuccessfully: true,
        ownerNotified: true,
        updatedAt: new Date(),
      })
      .where(and(
        eq(walkBookings.id, data.walkId),
        eq(walkBookings.status, 'in_progress'),
        eq(walkBookings.walkerId, walkerUuid),
      ))
      .returning();

    if (winners.length === 0) {
      const [current] = await db
        .select()
        .from(walkBookings)
        .where(eq(walkBookings.id, data.walkId))
        .limit(1);
      if (!current) throw new Error('Walk booking not found');
      if (current.walkerId !== walkerUuid) throw new Error('Unauthorized: Walker ID mismatch');
      if (current.status === 'completed') {
        // Idempotent — second concurrent finish tap, or same walker resubmitting.
        // We do NOT re-fire audit / earnings side effects — they belong to the
        // one winner. Return the current row's authoritative summary. The
        // money block is preserved unchanged for wire-compatibility with any
        // legacy client that still reads it (audit found none). See P0-5
        // note below the winner path.
        //
        // Adversarial-review Q2 (2026-08-18): a `completed` row without
        // actualStartTime is a data-integrity error, not something to
        // absorb silently — better to surface it than crash on `.getTime()`
        // downstream via the non-null assertion. Treat null as failure.
        if (!current.actualStartTime) {
          throw new Error('Completed walk has no actualStartTime — data-integrity error');
        }
        const idemTotal = parseFloat((current.totalCost as any) || '0');
        const idemBase = idemTotal / 1.15;
        const idemWalker = idemBase * 0.85;
        const idemFee = idemTotal - idemWalker;
        return {
          success: true,
          sessionSummary: {
            checkInTime: current.actualStartTime,
            checkOutTime: current.actualEndTime ?? checkOutTime,
            duration: (current.actualDurationMinutes ?? 0) * 60,
            distance: current.totalDistanceMeters ?? 0,
            vitalData: current.vitalDataSummary || {},
            earningsBreakdown: {
              totalPaid: idemTotal,
              basePriceEstimate: idemBase,
              platformFee: idemFee,
              walkerEarnings: idemWalker,
              currency: current.currency || 'ILS',
            },
          },
        } as any;
      }
      throw new Error(`Cannot check out from status "${current.status}"`);
    }

    const walk = winners[0];
    if (!walk.actualStartTime) {
      throw new Error('No check-in time found - cannot check out');
    }

    // P0-5 NOTE (2026-08-18, deferred to money-orchestrator work):
    // The commission math below reverse-engineers walker earnings from
    // totalCost * 0.85 / 1.15. Audit 2026-08-18 confirmed ZERO downstream
    // consumers of the returned earningsBreakdown (no client reads it, no
    // server callers read it; processNayaxPayment is commented-out dead
    // code). The canonical money authorities are quoteEngine +
    // UnifiedPricingService (pricing), EscrowService (holds), and
    // ProviderPayoutService (walker earnings). WalkSessionService MUST NOT
    // become a second commission engine. This block is preserved for
    // strict wire-compat this cycle; a follow-up money-orchestrator PR
    // (CEO §31, needs money approval) replaces the recompute with a read
    // from ProviderPayoutService.getWalkerPayout(walkId).
    const totalCostValue = walk.totalCost;
    if (!totalCostValue || isNaN(parseFloat(totalCostValue as any))) {
      throw new Error('Invalid or missing totalCost - cannot calculate payment');
    }
    const totalPaid = parseFloat(totalCostValue as any);
    const basePriceEstimate = totalPaid / 1.15;
    const walkerEarnings = basePriceEstimate * 0.85;
    const platformFee = totalPaid - walkerEarnings;

    // Create blockchain audit entry for check-out
    await db.insert(walkBlockchainAudit).values({
      bookingId: walk.bookingId,
      blockHash: this.generateHash({
        walkId: data.walkId,
        action: 'check_out',
        timestamp: checkOutTime,
        location: data.location,
        distance: data.totalDistance,
        duration: data.totalDuration,
        earnings: walkerEarnings,
      }),
      previousBlockHash: await this.getLatestWalkHash(walk.bookingId),
      actionType: 'check_out',
      actionData: JSON.stringify({
        location: data.location,
        totalDistance: data.totalDistance,
        totalDuration: data.totalDuration,
        vitalData: data.vitalData,
        paymentBreakdown: {
          totalPaid: totalPaid, // What owner paid
          basePriceEstimate: basePriceEstimate, // Estimated base price
          platformFee: platformFee, // 15% platform commission
          walkerEarnings: walkerEarnings, // 85% to walker
        },
      }),
      performedBy: data.walkerId,
      timestamp: checkOutTime,
    } as any);

    // Log session completion
    await this.logSessionAction({
      walkId: data.walkId,
      action: 'check_out',
      timestamp: checkOutTime,
      data: {
        location: data.location,
        distance: data.totalDistance,
        duration: data.totalDuration,
        vitalData: data.vitalData,
      },
      ipAddress: '',
      userAgent: '',
    });

    // TODO: Trigger Nayax payment split when API keys available
    // await this.processNayaxPayment(data.walkId, grossAmount, platformFee, walkerEarnings);

    // Guard at line ~338 already threw if walk.actualStartTime is null,
    // so the reference below is safe without the ! assertion.
    return {
      success: true,
      sessionSummary: {
        checkInTime: walk.actualStartTime,
        checkOutTime,
        duration: data.totalDuration,
        distance: data.totalDistance,
        vitalData: data.vitalData,
        earningsBreakdown: {
          totalPaid: totalPaid, // What owner paid (base + 15%)
          basePriceEstimate: basePriceEstimate, // Estimated base price
          platformFee: platformFee, // Our 15% commission
          walkerEarnings: walkerEarnings, // 85% to walker
          currency: walk.currency || 'ILS',
        },
      },
    };
  }

  /**
   * Update GPS location during active walk
   */
  async updateGPSLocation(
    walkId: number,
    walkerId: string,
    location: { latitude: number; longitude: number; accuracy: number; timestamp: Date }
  ): Promise<void> {
    // P1-14 fix — resolve WALKER-uuid so the assignment check works.
    const walkerUuid = await this.resolveWalkerUuid(walkerId);
    if (!walkerUuid) throw new Error('Not registered as walker');

    // Verify walk is in progress AND belongs to this walker.
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(and(eq(walkBookings.id, walkId), eq(walkBookings.walkerId, walkerUuid)))
      .limit(1);

    if (!walk || walk.status !== 'in_progress') {
      throw new Error('Walk is not in progress');
    }

    // Calculate distance from last GPS point (use lastKnownLocation or fallback to checkInLocation)
    let additionalDistance = 0;
    const lastLoc = (walk.lastKnownLocation || walk.checkInLocation) as any;
    if (lastLoc) {
      additionalDistance = this.calculateDistance(
        lastLoc.latitude,
        lastLoc.longitude,
        location.latitude,
        location.longitude
      );
    }

    // Update last known location, distance, and route
    const currentDistance = walk.totalDistanceMeters || 0;
    const newDistance = currentDistance + additionalDistance;

    // Append to route polyline (simplified - in production use proper encoding)
    const currentRoute = walk.routePolyline || '';
    const newRoutePoint = `${location.latitude},${location.longitude}`;
    const newRoute = currentRoute ? `${currentRoute};${newRoutePoint}` : newRoutePoint;

    await db
      .update(walkBookings)
      .set({
        lastGPSUpdate: location.timestamp,
        lastKnownLocation: location as any, // LIVE tracking - preserves checkInLocation integrity
        totalDistanceMeters: Math.floor(newDistance),
        routePolyline: newRoute,
        updatedAt: new Date(),
      })
      .where(eq(walkBookings.id, walkId));

    // Log GPS update
    await this.logSessionAction({
      walkId,
      action: 'gps_update',
      timestamp: location.timestamp,
      data: { ...location, distance: additionalDistance, totalDistance: newDistance },
      ipAddress: '',
      userAgent: '',
    });
  }

  /**
   * Update vital data during active walk (heart rate, steps, etc.)
   */
  async updateVitalData(
    walkId: number,
    walkerId: string,
    vitalData: { heartRate?: number; steps?: number; hydrationStops?: number; timestamp: Date }
  ): Promise<void> {
    // P1-14 fix — resolve WALKER-uuid so the assignment check works.
    const walkerUuid = await this.resolveWalkerUuid(walkerId);
    if (!walkerUuid) throw new Error('Not registered as walker');

    // Verify walk is in progress AND belongs to this walker.
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(and(eq(walkBookings.id, walkId), eq(walkBookings.walkerId, walkerUuid)))
      .limit(1);

    if (!walk || walk.status !== 'in_progress') {
      throw new Error('Walk is not in progress');
    }

    // Update vital data summary incrementally
    const currentVitals = (walk.vitalDataSummary || {}) as any;
    const updatedVitals = {
      heartRateAvg: vitalData.heartRate || currentVitals.heartRateAvg || 0,
      heartRateMax: Math.max(vitalData.heartRate || 0, currentVitals.heartRateMax || 0),
      steps: vitalData.steps || currentVitals.steps || 0,
      hydrationStops: (currentVitals.hydrationStops || 0) + (vitalData.hydrationStops || 0),
      photosTaken: currentVitals.photosTaken || 0,
      lastUpdate: vitalData.timestamp,
    };

    await db
      .update(walkBookings)
      .set({
        vitalDataSummary: updatedVitals as any,
        updatedAt: new Date(),
      })
      .where(eq(walkBookings.id, walkId));

    // Log vital data update
    await this.logSessionAction({
      walkId,
      action: 'vital_update',
      timestamp: vitalData.timestamp,
      data: vitalData,
      ipAddress: '',
      userAgent: '',
    });
  }

  /**
   * Record bathroom marker (PetWash™ pee/poo flags)
   * 
   * GPS bathroom markers for walk tracking
   * Allows walkers to flag when pet uses bathroom during walk
   */
  async addBathroomMarker(
    walkId: number,
    walkerId: string,
    marker: {
      type: 'pee' | 'poo';
      latitude: number;
      longitude: number;
      timestamp: Date;
      accuracy: number;
      notes?: string;
    }
  ): Promise<void> {
    // P1-14 fix — resolve WALKER-uuid so the assignment check works.
    const walkerUuid = await this.resolveWalkerUuid(walkerId);
    if (!walkerUuid) throw new Error('Not registered as walker');

    // Verify walk is in progress AND belongs to this walker.
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(and(eq(walkBookings.id, walkId), eq(walkBookings.walkerId, walkerUuid)))
      .limit(1);

    if (!walk || walk.status !== 'in_progress') {
      throw new Error('Walk is not in progress');
    }

    // Add new marker to existing markers array
    const currentMarkers = (walk.bathroomMarkers || []) as any[];
    const newMarker = {
      type: marker.type,
      latitude: marker.latitude,
      longitude: marker.longitude,
      timestamp: marker.timestamp.toISOString(),
      accuracy: marker.accuracy,
      notes: marker.notes || '',
    };
    
    const updatedMarkers = [...currentMarkers, newMarker];

    await db
      .update(walkBookings)
      .set({
        bathroomMarkers: updatedMarkers as any,
        updatedAt: new Date(),
      })
      .where(eq(walkBookings.id, walkId));

    // Log bathroom marker
    await this.logSessionAction({
      walkId,
      action: 'photo_upload', // Reuse existing action type
      timestamp: marker.timestamp,
      data: { markerType: 'bathroom', ...marker },
      ipAddress: '',
      userAgent: '',
    });
  }

  /**
   * Get all bathroom markers for a walk (owner view)
   */
  async getBathroomMarkers(walkId: number): Promise<any[]> {
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.id, walkId))
      .limit(1);

    if (!walk) {
      return [];
    }

    return (walk.bathroomMarkers || []) as any[];
  }

  /**
   * Get active walk session details
   */
  /**
   * Get active session details for an authorized caller.
   *
   * P0-1 fix (2026-08-18): the previous signature `getActiveSession(walkId)`
   * enforced ZERO ownership — any authenticated user could enumerate walk
   * IDs and pull another customer's live GPS + vitals. Now REQUIRES the
   * caller's Firebase UID and asserts the caller is either the walk's
   * owner or the assigned walker (whose UID is derived server-side via
   * the walker_profiles join — the walker table stores WALKER-uuid, not
   * a Firebase UID, so a direct compare against callerUid would have
   * silently locked walkers out).
   *
   * Returns null on:
   *   • walk not found
   *   • walk not currently in_progress (no active session)
   *   • caller neither owner nor assigned walker  ← "privacy 404"
   *
   * The route handler then 404s uniformly — same response for
   * "doesn't exist" and "not yours" — so trial-and-error enumeration
   * yields nothing.
   *
   * The return shape is a strict SafeLiveSessionDTO (see top of file),
   * NOT the raw walk row. Never let a route re-project raw columns.
   */
  async getActiveSession(walkId: number, callerUid: string): Promise<SafeLiveSessionDTO | null> {
    if (!callerUid) return null;

    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.id, walkId))
      .limit(1);

    if (!walk || walk.status !== 'in_progress' || !walk.actualStartTime) {
      return null;
    }

    // Resolve the walker's Firebase UID (walk_bookings.walkerId is a
    // WALKER-uuid, not a Firebase UID — this is the P1-14 mismatch the
    // CEO called out; comparing callerUid directly against walk.walkerId
    // would falsely reject the assigned walker).
    let walkerUid: string | null = null;
    if (walk.walkerId) {
      const [walkerRow] = await db
        .select({ userId: walkerProfiles.userId })
        .from(walkerProfiles)
        .where(eq(walkerProfiles.walkerId, walk.walkerId))
        .limit(1);
      walkerUid = (walkerRow?.userId || null) as string | null;
    }

    const isOwner = callerUid === walk.ownerId;
    const isWalker = walkerUid != null && callerUid === walkerUid;
    if (!isOwner && !isWalker) {
      return null; // privacy 404 — do not confirm the walk exists
    }

    const now = new Date();
    const elapsedTime = Math.floor((now.getTime() - walk.actualStartTime.getTime()) / 1000);
    const plannedDuration = (walk.durationMinutes || 60) * 60;
    const estimatedRemaining = Math.max(0, plannedDuration - elapsedTime);

    return {
      walkId: walk.id,
      bookingId: walk.bookingId,
      status: walk.status ?? 'in_progress',
      petId: (walk.petId ?? null) as string | null,
      petName: (walk.petName ?? null) as string | null,
      scheduledDate: walk.scheduledDate ? String(walk.scheduledDate) : null,
      durationMinutes: walk.durationMinutes ?? null,
      actualStartTime: walk.actualStartTime.toISOString(),
      elapsedTime,
      estimatedRemaining,
      currentLocation: walk.lastKnownLocation || walk.checkInLocation || null,
      lastGPSUpdate: walk.lastGPSUpdate ? new Date(walk.lastGPSUpdate).toISOString() : null,
      totalDistanceMeters: walk.totalDistanceMeters || 0,
      vitalDataSummary: walk.vitalDataSummary ?? null,
      routePolyline: walk.routePolyline || '',
      isLiveTrackingActive: !!walk.isLiveTrackingActive,
      callerRole: isOwner ? 'owner' : 'walker',
    };
  }

  /**
   * OWNER TRACKING: Get all active walks for an owner
   */
  async getOwnerActiveWalks(ownerId: string): Promise<any[]> {
    const activeWalks = await db
      .select()
      .from(walkBookings)
      .where(
        and(
          eq(walkBookings.ownerId, ownerId),
          eq(walkBookings.status, 'in_progress')
        )
      )
      .orderBy(sql`${walkBookings.actualStartTime} DESC`);

    return activeWalks.map(walk => ({
      id: walk.id,
      bookingId: walk.bookingId,
      walkerId: walk.walkerId,
      petId: walk.petId,
      scheduledDate: walk.scheduledDate,
      actualStartTime: walk.actualStartTime,
      durationMinutes: walk.durationMinutes,
      lastKnownLocation: walk.lastKnownLocation || walk.checkInLocation,
      lastGPSUpdate: walk.lastGPSUpdate,
      totalDistanceMeters: walk.totalDistanceMeters,
      vitalDataSummary: walk.vitalDataSummary,
      isLiveTrackingActive: walk.isLiveTrackingActive,
    }));
  }

  /**
   * OWNER TRACKING: Get real-time location and details for owner's pet
   */
  async getOwnerLiveTracking(walkId: number, ownerId: string): Promise<any | null> {
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(
        and(
          eq(walkBookings.id, walkId),
          eq(walkBookings.ownerId, ownerId)
        )
      )
      .limit(1);

    if (!walk) {
      return null;
    }

    if (walk.status !== 'in_progress') {
      return {
        status: 'not_active',
        message: `Walk is ${walk.status}`,
        walk: {
          id: walk.id,
          bookingId: walk.bookingId,
          status: walk.status,
          scheduledDate: walk.scheduledDate,
          actualStartTime: walk.actualStartTime,
          actualEndTime: walk.actualEndTime,
        },
      };
    }

    const now = new Date();
    const elapsedTime = walk.actualStartTime 
      ? Math.floor((now.getTime() - walk.actualStartTime.getTime()) / 1000) 
      : 0;
    
    const plannedDuration = (walk.durationMinutes || 60) * 60;
    const estimatedRemaining = Math.max(0, plannedDuration - elapsedTime);

    // Get walker details (would fetch from users table in production)
    // const walkerInfo = await this.getWalkerInfo(walk.walkerId);

    return {
      status: 'active',
      walk: {
        id: walk.id,
        bookingId: walk.bookingId,
        petId: walk.petId,
        walkerId: walk.walkerId,
        actualStartTime: walk.actualStartTime,
        elapsedTime,
        estimatedRemaining,
        durationMinutes: walk.durationMinutes,
      },
      location: {
        current: walk.lastKnownLocation || walk.checkInLocation,
        checkIn: walk.checkInLocation,
        lastUpdate: walk.lastGPSUpdate,
        routePolyline: walk.routePolyline,
        totalDistanceMeters: walk.totalDistanceMeters || 0,
      },
      vitals: walk.vitalDataSummary || {},
      bathroomMarkers: walk.bathroomMarkers || [], // PetWash™ pee/poo flags
      tracking: {
        isLiveTrackingActive: walk.isLiveTrackingActive,
        isVideoStreamActive: walk.isVideoStreamActive,
        isDroneMonitoringActive: walk.isDroneMonitoringActive,
      },
      safety: {
        geofenceViolationCount: walk.geofenceViolationCount,
        emergencyStopTriggered: walk.emergencyStopTriggered,
        emergencyStopReason: walk.emergencyStopReason,
      },
    };
  }

  /**
   * Calculate distance between two GPS coordinates (Haversine formula)
   * Returns distance in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * P0-6 (2026-08-18): operational log only — NO raw GPS / vitals / route.
   *
   * Before: console.log dumped the whole `log.data` object which, for
   * `gps_update`, contained live latitude/longitude/accuracy/timestamp,
   * and for `vital_update`, contained heart-rate / steps / hydration —
   * private customer + pet data going into ordinary Cloud Run logs.
   *
   * After: log only the operational fields (walkId, action, timestamp,
   * protocol stamp). The protocol stamp is still a hash over the full
   * payload — auditors verifying integrity can re-derive it from the
   * DB row where the data actually lives, without the log ever holding
   * the raw values. If richer audit is needed, store it in the dedicated
   * walk_blockchain_audit table (already used for check-in / check-out),
   * not in ordinary logs.
   */
  private async logSessionAction(log: WalkSessionLog): Promise<void> {
    console.log(`[WALK SESSION LOG] ${log.action.toUpperCase()}`, {
      walkId: log.walkId,
      timestamp: log.timestamp.toISOString(),
      protocol: 'WALK_MY_PET_V1',
      stamp: this.generateProtocolStamp(log),
    });
  }

  /**
   * Generate protocol stamp for audit compliance
   */
  private generateProtocolStamp(log: WalkSessionLog): string {
    const stampData = `${log.walkId}:${log.action}:${log.timestamp.toISOString()}:${JSON.stringify(log.data)}`;
    return crypto.createHash('sha256').update(stampData).digest('hex');
  }

  /**
   * Generate blockchain hash for audit trail
   */
  private generateHash(data: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Get latest blockchain hash for walk booking
   */
  private async getLatestWalkHash(bookingId: string): Promise<string | null> {
    const [latest] = await db
      .select()
      .from(walkBlockchainAudit)
      .where(eq(walkBlockchainAudit.bookingId, bookingId))
      .orderBy(sql`${walkBlockchainAudit.timestamp} DESC`)
      .limit(1);

    return latest?.blockHash || null;
  }

  /**
   * Process Nayax payment split (85% walker / 15% platform)
   * TODO: Implement when Nayax API keys are available
   */
  private async processNayaxPayment(
    walkId: string,
    grossAmount: number,
    platformFee: number,
    walkerEarnings: number
  ): Promise<void> {
    // Placeholder for Nayax Israel API integration
    console.log('[NAYAX PAYMENT] Split payment initiated', {
      walkId,
      grossAmount,
      platformFee: `${platformFee} ILS (15%)`,
      walkerEarnings: `${walkerEarnings} ILS (85%)`,
      provider: 'Nayax Israel',
    });

    // When API keys are available:
    // 1. Create Nayax payment intent for total amount
    // 2. Split payment: 85% to walker's account, 15% to platform account
    // 3. Record transaction in blockchain audit trail
    // 4. Send payment confirmation to both parties
    // 5. Generate receipt for tax compliance
  }
}

export const walkSessionService = new WalkSessionService();
