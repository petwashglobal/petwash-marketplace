/**
 * PetTrek™ Dispatch Service
 * Driver matching and job dispatch with geo-indexed search
 * 
 * Features:
 * - Find nearby available drivers
 * - Multi-driver dispatch (send to top 3 drivers simultaneously)
 * - Auto-expire dispatch records after 30 seconds
 * - Track acceptance/decline responses
 * - Distance-based driver filtering
 * 
 * Dispatch Flow:
 * 1. Customer requests ride
 * 2. Find 3 nearest online drivers
 * 3. Send push notifications simultaneously
 * 4. First driver to accept gets the trip
 * 5. Auto-expire other dispatch records
 */

import { db } from '../db';
import { pettrekProviders, pettrekTrips, pettrekDispatchRecords } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

export interface NearbyDriver {
  id: number;
  providerId: string;
  firstName: string;
  lastName: string;
  vehicleType: string;
  vehicleCapacity: string;
  averageRating: string | null;
  distanceKm: number;
  estimatedArrivalMinutes: number;
  lastKnownLatitude: string | null;
  lastKnownLongitude: string | null;
}

export interface DispatchResult {
  success: boolean;
  tripId: number;
  dispatchedDrivers: NearbyDriver[];
  dispatchedCount: number;
  message: string;
}

export class PetTrekDispatchService {
  private readonly MAX_DISPATCH_DRIVERS = 3; // Send to top 3 drivers
  private readonly MAX_SEARCH_RADIUS = 15; // km
  private readonly DISPATCH_EXPIRY_SECONDS = 30; // Auto-expire after 30s

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if vehicle capacity matches pet size requirements
   */
  private isVehicleCompatible(vehicleCapacity: string, petSize: string): boolean {
    // Vehicle capacity tiers: small | medium | large | xlarge
    // Pet size tiers: small | medium | large | xlarge
    
    const capacityLevels: Record<string, number> = {
      small: 1,
      medium: 2,
      large: 3,
      xlarge: 4,
    };

    const vehicleLevel = capacityLevels[vehicleCapacity.toLowerCase()] || 0;
    const petLevel = capacityLevels[petSize.toLowerCase()] || 0;

    // Vehicle must be >= pet size
    return vehicleLevel >= petLevel;
  }

  /**
   * Find nearby available drivers
   * Filters by: online status, vetted status, transport service, vehicle capacity, distance
   */
  async findNearbyDrivers(
    pickupLat: number,
    pickupLon: number,
    petSize: string,
    maxRadius: number = this.MAX_SEARCH_RADIUS
  ): Promise<NearbyDriver[]> {
    try {
      // Get online, vetted, available TRANSPORT drivers with location
      const drivers = await db
        .select()
        .from(pettrekProviders)
        .where(
          and(
            eq(pettrekProviders.isOnline, true),
            eq(pettrekProviders.isAvailable, true),
            eq(pettrekProviders.isVetted, true),
            eq(pettrekProviders.offersTransport, true) // CRITICAL: Only transport providers
          )
        );

      // Calculate distances and filter by radius AND capacity
      const driversWithDistance = drivers
        .filter((driver) => {
          // Must have location data
          if (!driver.lastKnownLatitude || !driver.lastKnownLongitude) {
            return false;
          }

          // CRITICAL: Filter by vehicle capacity matching pet size
          if (!this.isVehicleCompatible(driver.vehicleCapacity, petSize)) {
            return false;
          }

          // CRITICAL: Filter by service radius
          const serviceRadiusKm = driver.serviceRadius || this.MAX_SEARCH_RADIUS;
          const distanceKm = this.calculateDistance(
            pickupLat,
            pickupLon,
            parseFloat(driver.lastKnownLatitude!),
            parseFloat(driver.lastKnownLongitude!)
          );
          
          if (distanceKm > serviceRadiusKm) {
            return false;
          }

          return true;
        })
        .map((driver) => {
          const driverLat = parseFloat(driver.lastKnownLatitude!);
          const driverLon = parseFloat(driver.lastKnownLongitude!);
          const distanceKm = this.calculateDistance(
            pickupLat,
            pickupLon,
            driverLat,
            driverLon
          );

          // Estimate arrival time: 40 km/h average city speed
          const estimatedArrivalMinutes = Math.ceil((distanceKm / 40) * 60);

          return {
            id: driver.id,
            providerId: driver.providerId,
            firstName: driver.firstName,
            lastName: driver.lastName,
            vehicleType: driver.vehicleType,
            vehicleCapacity: driver.vehicleCapacity,
            averageRating: driver.averageRating,
            distanceKm: Math.round(distanceKm * 100) / 100,
            estimatedArrivalMinutes,
            lastKnownLatitude: driver.lastKnownLatitude,
            lastKnownLongitude: driver.lastKnownLongitude,
          };
        })
        .filter((driver) => {
          // Filter by max radius
          if (driver.distanceKm > maxRadius) return false;

          return true;
        })
        .sort((a, b) => {
          // Sort by distance (closest first), then by rating
          if (a.distanceKm !== b.distanceKm) {
            return a.distanceKm - b.distanceKm;
          }
          const ratingA = parseFloat(a.averageRating || '0');
          const ratingB = parseFloat(b.averageRating || '0');
          return ratingB - ratingA; // Higher rating first
        });

      logger.info('[PetTrek Dispatch] Found nearby drivers', {
        pickupLat,
        pickupLon,
        totalFound: driversWithDistance.length,
        withinRadius: driversWithDistance.filter((d) => d.distanceKm <= maxRadius).length,
      });

      return driversWithDistance;
    } catch (error) {
      logger.error('[PetTrek Dispatch] Error finding nearby drivers:', error);
      throw error;
    }
  }

  /**
   * Dispatch trip to multiple drivers simultaneously
   * Sends push notifications to top N drivers
   */
  async dispatchTrip(
    tripId: number,
    pickupLat: number,
    pickupLon: number,
    petSize: string
  ): Promise<DispatchResult> {
    try {
      // Find nearby drivers
      const nearbyDrivers = await this.findNearbyDrivers(pickupLat, pickupLon, petSize);

      if (nearbyDrivers.length === 0) {
        logger.warn('[PetTrek Dispatch] No drivers available', { tripId });
        return {
          success: false,
          tripId,
          dispatchedDrivers: [],
          dispatchedCount: 0,
          message: 'No drivers available in your area. Please try again later.',
        };
      }

      // Select top N drivers
      const driversToDispatch = nearbyDrivers.slice(0, this.MAX_DISPATCH_DRIVERS);
      const expiresAt = new Date(Date.now() + this.DISPATCH_EXPIRY_SECONDS * 1000);

      // Create dispatch records
      const dispatchRecords = await Promise.all(
        driversToDispatch.map(async (driver) => {
          return db.insert(pettrekDispatchRecords).values({
            tripId,
            providerId: driver.id,
            dispatchedAt: new Date(),
            notificationSent: true, // Will be updated by notification service
            notificationMethod: 'push',
            responseStatus: 'pending',
            expiresAt,
            isExpired: false,
            distanceFromPickup: driver.distanceKm.toString(),
            estimatedArrivalTime: driver.estimatedArrivalMinutes,
          });
        })
      );

      // Update trip status to 'dispatched'
      await db
        .update(pettrekTrips)
        .set({ 
          status: 'dispatched',
          updatedAt: new Date()
        })
        .where(eq(pettrekTrips.id, tripId));

      // TODO: Send push notifications to drivers
      await this.sendPushNotifications(driversToDispatch, tripId);

      logger.info('[PetTrek Dispatch] Trip dispatched successfully', {
        tripId,
        dispatchedCount: driversToDispatch.length,
        driverIds: driversToDispatch.map((d) => d.providerId),
      });

      return {
        success: true,
        tripId,
        dispatchedDrivers: driversToDispatch,
        dispatchedCount: driversToDispatch.length,
        message: `Dispatched to ${driversToDispatch.length} nearby driver(s)`,
      };
    } catch (error) {
      logger.error('[PetTrek Dispatch] Error dispatching trip:', error);
      throw error;
    }
  }

  /**
   * Send push notifications to drivers
   * TODO: Integrate with FCM or your notification service
   */
  private async sendPushNotifications(
    drivers: NearbyDriver[],
    tripId: number
  ): Promise<void> {
    // TODO: Implement push notification sending
    logger.info('[PetTrek Dispatch] Push notifications sent', {
      tripId,
      driverCount: drivers.length,
    });
  }

  /**
   * Driver accepts a trip
   * Expires other dispatch records for this trip
   */
  async acceptTrip(dispatchRecordId: number, providerId: number): Promise<boolean> {
    try {
      // Get the dispatch record
      const dispatchRecord = await db
        .select()
        .from(pettrekDispatchRecords)
        .where(eq(pettrekDispatchRecords.id, dispatchRecordId))
        .limit(1);

      if (dispatchRecord.length === 0) {
        logger.error('[PetTrek Dispatch] Dispatch record not found', { dispatchRecordId });
        return false;
      }

      const record = dispatchRecord[0];

      // Check if already expired
      if (record.isExpired || (record.expiresAt && new Date() > record.expiresAt)) {
        logger.warn('[PetTrek Dispatch] Dispatch record expired', { dispatchRecordId });
        return false;
      }

      // Check if trip is still available
      const trip = await db
        .select()
        .from(pettrekTrips)
        .where(eq(pettrekTrips.id, record.tripId))
        .limit(1);

      if (trip.length === 0 || trip[0].status !== 'dispatched') {
        logger.warn('[PetTrek Dispatch] Trip no longer available', { 
          tripId: record.tripId,
          status: trip[0]?.status 
        });
        return false;
      }

      // Accept the trip
      await db
        .update(pettrekDispatchRecords)
        .set({
          responseStatus: 'accepted',
          respondedAt: new Date(),
        })
        .where(eq(pettrekDispatchRecords.id, dispatchRecordId));

      // Assign driver to trip
      await db
        .update(pettrekTrips)
        .set({
          providerId,
          status: 'accepted',
          updatedAt: new Date(),
        })
        .where(eq(pettrekTrips.id, record.tripId));

      // Expire other dispatch records for this trip
      await db
        .update(pettrekDispatchRecords)
        .set({
          isExpired: true,
          responseStatus: 'expired',
        })
        .where(
          and(
            eq(pettrekDispatchRecords.tripId, record.tripId),
            sql`${pettrekDispatchRecords.id} != ${dispatchRecordId}`
          )
        );

      logger.info('[PetTrek Dispatch] Trip accepted', {
        tripId: record.tripId,
        providerId,
        dispatchRecordId,
      });

      return true;
    } catch (error) {
      logger.error('[PetTrek Dispatch] Error accepting trip:', error);
      throw error;
    }
  }

  /**
   * Driver declines a trip
   */
  async declineTrip(
    dispatchRecordId: number,
    reason: string,
    notes?: string
  ): Promise<boolean> {
    try {
      await db
        .update(pettrekDispatchRecords)
        .set({
          responseStatus: 'declined',
          respondedAt: new Date(),
          declineReason: reason,
          declineNotes: notes,
        })
        .where(eq(pettrekDispatchRecords.id, dispatchRecordId));

      logger.info('[PetTrek Dispatch] Trip declined', {
        dispatchRecordId,
        reason,
      });

      return true;
    } catch (error) {
      logger.error('[PetTrek Dispatch] Error declining trip:', error);
      throw error;
    }
  }

  /**
   * Auto-expire old dispatch records
   * Should be run as a cron job every minute
   */
  async expireOldDispatches(): Promise<number> {
    try {
      const result = await db
        .update(pettrekDispatchRecords)
        .set({
          isExpired: true,
          responseStatus: 'expired',
        })
        .where(
          and(
            eq(pettrekDispatchRecords.responseStatus, 'pending'),
            eq(pettrekDispatchRecords.isExpired, false),
            sql`${pettrekDispatchRecords.expiresAt} < NOW()`
          )
        );

      logger.info('[PetTrek Dispatch] Expired old dispatch records', {
        count: result.rowCount || 0,
      });

      return result.rowCount || 0;
    } catch (error) {
      logger.error('[PetTrek Dispatch] Error expiring dispatches:', error);
      throw error;
    }
  }
}

export const dispatchService = new PetTrekDispatchService();
