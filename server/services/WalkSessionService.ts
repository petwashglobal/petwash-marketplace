import { db } from '../db';
import { walkBookings, users, walkBlockchainAudit } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

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
   * Check-in: Walker starts the walk session
   * Creates blockchain audit entry and updates walk status
   */
  async checkIn(data: CheckInData): Promise<{
    success: boolean;
    sessionId: string;
    checkInTime: Date;
    estimatedCheckOut: Date;
  }> {
    const checkInTime = data.timestamp;
    
    // Get walk booking details
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.id, data.walkId))
      .limit(1);

    if (!walk) {
      throw new Error('Walk booking not found');
    }

    if (walk.walkerId !== data.walkerId) {
      throw new Error('Unauthorized: Walker ID mismatch');
    }

    if (walk.status !== 'confirmed') {
      throw new Error('Walk must be in confirmed status to check in');
    }

    // Update walk status to in_progress with check-in timestamp
    await db
      .update(walkBookings)
      .set({
        status: 'in_progress',
        actualStartTime: checkInTime,
        checkInLocation: data.location as any,
        isLiveTrackingActive: true,
        updatedAt: new Date(),
      })
      .where(eq(walkBookings.id, data.walkId));

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
      sessionId: data.walkId,
      checkInTime,
      estimatedCheckOut,
    };
  }

  /**
   * Check-out: Walker completes the walk session
   * Finalizes session, records distance/vitals, triggers payment
   * 
   * Commission: 24% total (6% owner fee + 18% walker fee), Walker gets 82%
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
        totalPaid: number; // What owner paid (base + 6%)
        basePriceEstimate: number; // Estimated base price
        platformFee: number; // Our 24% commission
        walkerEarnings: number; // 82% to walker
        currency: string;
      };
    };
  }> {
    const checkOutTime = data.timestamp;

    // Get walk booking details
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.id, data.walkId))
      .limit(1);

    if (!walk) {
      throw new Error('Walk booking not found');
    }

    if (walk.walkerId !== data.walkerId) {
      throw new Error('Unauthorized: Walker ID mismatch');
    }

    if (walk.status !== 'in_progress') {
      throw new Error('Walk must be in progress to check out');
    }

    if (!walk.actualStartTime) {
      throw new Error('No check-in time found - cannot check out');
    }

    // Calculate payment breakdown (24% total platform commission split as 6% owner + 18% walker)
    // Walker gets 82% of base price (base - 18% walker fee)
    const totalCostValue = walk.totalCost;
    if (!totalCostValue || isNaN(parseFloat(totalCostValue as any))) {
      throw new Error('Invalid or missing totalCost - cannot calculate payment');
    }
    const totalPaid = parseFloat(totalCostValue as any); // What owner paid (base + 6%)
    const basePriceEstimate = totalPaid / 1.06; // Reverse engineer base from owner payment
    const walkerEarnings = basePriceEstimate * 0.82; // Walker gets 82% of base
    const platformFee = totalPaid - walkerEarnings; // Platform keeps the difference

    // Update walk status to completed with check-out data
    await db
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
      .where(eq(walkBookings.id, data.walkId));

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
          platformFee: platformFee, // Our total commission (6% + 18%)
          walkerEarnings: walkerEarnings, // 82% to walker
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

    return {
      success: true,
      sessionSummary: {
        checkInTime: walk.actualStartTime!,
        checkOutTime,
        duration: data.totalDuration,
        distance: data.totalDistance,
        vitalData: data.vitalData,
        earningsBreakdown: {
          totalPaid: totalPaid, // What owner paid (base + 6%)
          basePriceEstimate: basePriceEstimate, // Estimated base price
          platformFee: platformFee, // Our 24% commission
          walkerEarnings: walkerEarnings, // 82% to walker
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
    // Verify walk is in progress
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(and(eq(walkBookings.id, walkId), eq(walkBookings.walkerId, walkerId)))
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
    // Verify walk is in progress
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(and(eq(walkBookings.id, walkId), eq(walkBookings.walkerId, walkerId)))
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
   * Record bathroom marker (Wag-style pee/poo flags)
   * 
   * USA Market Adoption: Inspired by Wag's GPS bathroom markers
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
    // Verify walk is in progress
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(and(eq(walkBookings.id, walkId), eq(walkBookings.walkerId, walkerId)))
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
  async getActiveSession(walkId: number): Promise<{
    walk: any;
    checkInTime: Date | null;
    elapsedTime: number;
    estimatedRemaining: number;
    currentLocation: any;
    totalDistance: number;
    vitalData: any;
    routePolyline: string;
  } | null> {
    const [walk] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.id, walkId))
      .limit(1);

    if (!walk || walk.status !== 'in_progress' || !walk.actualStartTime) {
      return null;
    }

    const now = new Date();
    const elapsedTime = Math.floor((now.getTime() - walk.actualStartTime.getTime()) / 1000); // seconds
    const plannedDuration = (walk.durationMinutes || 60) * 60; // convert minutes to seconds
    const estimatedRemaining = Math.max(0, plannedDuration - elapsedTime);

    return {
      walk,
      checkInTime: walk.actualStartTime,
      elapsedTime,
      estimatedRemaining,
      currentLocation: walk.lastKnownLocation || walk.checkInLocation || null,
      totalDistance: walk.totalDistanceMeters || 0,
      vitalData: walk.vitalDataSummary || {},
      routePolyline: walk.routePolyline || '',
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
      bathroomMarkers: walk.bathroomMarkers || [], // Wag-style pee/poo flags
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
   * Log session action with timestamp and protocol stamp
   */
  private async logSessionAction(log: WalkSessionLog): Promise<void> {
    // Store in system logs table (can be queried for audit)
    console.log(`[WALK SESSION LOG] ${log.action.toUpperCase()}`, {
      walkId: log.walkId,
      timestamp: log.timestamp.toISOString(),
      data: log.data,
      protocol: 'WALK_MY_PET_V1',
      stamp: this.generateProtocolStamp(log),
    });

    // TODO: Store in dedicated session_logs table if needed for compliance
  }

  /**
   * Generate protocol stamp for audit compliance
   */
  private generateProtocolStamp(log: WalkSessionLog): string {
    const crypto = require('crypto');
    const stampData = `${log.walkId}:${log.action}:${log.timestamp.toISOString()}:${JSON.stringify(log.data)}`;
    return crypto.createHash('sha256').update(stampData).digest('hex');
  }

  /**
   * Generate blockchain hash for audit trail
   */
  private generateHash(data: any): string {
    const crypto = require('crypto');
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
   * Process Nayax payment split (76% walker / 24% platform)
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
      platformFee: `${platformFee} ILS (24%)`,
      walkerEarnings: `${walkerEarnings} ILS (76%)`,
      provider: 'Nayax Israel',
    });

    // When API keys are available:
    // 1. Create Nayax payment intent for total amount
    // 2. Split payment: 76% to walker's account, 24% to platform account
    // 3. Record transaction in blockchain audit trail
    // 4. Send payment confirmation to both parties
    // 5. Generate receipt for tax compliance
  }
}

export const walkSessionService = new WalkSessionService();
