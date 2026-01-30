/**
 * GPS Tracking Service for Walk My Pet™
 * Real-time location tracking with validation and security
 */
import { db as firestoreDb } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
export class GPSTrackingService {
    /**
     * Start a new walk session with check-in location
     */
    static async startWalkSession(params) {
        try {
            const sessionId = `walk_${Date.now()}_${params.walkerId.slice(0, 8)}`;
            const session = {
                sessionId,
                bookingId: params.bookingId,
                walkerId: params.walkerId,
                ownerId: params.ownerId,
                petId: params.petId,
                status: 'in_progress',
                startTime: new Date(),
                checkInLocation: params.location,
                routePath: [params.location],
            };
            await firestoreDb
                .collection('walk_sessions')
                .doc(sessionId)
                .set(session);
            logger.info('[GPS Tracking] Walk session started', {
                sessionId,
                walkerId: params.walkerId,
                location: `${params.location.latitude},${params.location.longitude}`,
            });
            return sessionId;
        }
        catch (error) {
            logger.error('[GPS Tracking] Failed to start session', error);
            throw error;
        }
    }
    /**
     * Update walker's real-time location during walk
     */
    static async updateLocation(params) {
        try {
            const sessionRef = firestoreDb.collection('walk_sessions').doc(params.sessionId);
            const sessionDoc = await sessionRef.get();
            if (!sessionDoc.exists) {
                throw new Error(`Walk session ${params.sessionId} not found`);
            }
            const session = sessionDoc.data();
            // Verify walker ID matches
            if (session.walkerId !== params.walkerId) {
                throw new Error('Unauthorized: Walker ID mismatch');
            }
            // Verify session is in progress
            if (session.status !== 'in_progress') {
                throw new Error(`Cannot update location for ${session.status} session`);
            }
            // Add location to route path
            const updatedPath = [...session.routePath, params.location];
            // Calculate distance traveled
            const totalDistance = this.calculateTotalDistance(updatedPath);
            await sessionRef.update({
                routePath: updatedPath,
                totalDistance,
                lastUpdated: new Date(),
            });
            logger.info('[GPS Tracking] Location updated', {
                sessionId: params.sessionId,
                pathPoints: updatedPath.length,
                totalDistance: `${totalDistance}m`,
            });
        }
        catch (error) {
            logger.error('[GPS Tracking] Failed to update location', error);
            throw error;
        }
    }
    /**
     * End walk session with check-out location
     */
    static async endWalkSession(params) {
        try {
            const sessionRef = firestoreDb.collection('walk_sessions').doc(params.sessionId);
            const sessionDoc = await sessionRef.get();
            if (!sessionDoc.exists) {
                throw new Error(`Walk session ${params.sessionId} not found`);
            }
            const session = sessionDoc.data();
            // Verify walker ID matches
            if (session.walkerId !== params.walkerId) {
                throw new Error('Unauthorized: Walker ID mismatch');
            }
            // Calculate final stats
            const finalPath = [...session.routePath, params.location];
            const totalDistance = this.calculateTotalDistance(finalPath);
            // Convert Firestore Timestamp to Date if needed
            const startTime = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
            const totalDuration = session.startTime
                ? Math.floor((new Date().getTime() - startTime.getTime()) / 1000)
                : 0;
            await sessionRef.update({
                status: 'completed',
                endTime: new Date(),
                checkOutLocation: params.location,
                routePath: finalPath,
                totalDistance,
                totalDuration,
            });
            logger.info('[GPS Tracking] Walk session ended', {
                sessionId: params.sessionId,
                totalDistance: `${totalDistance}m`,
                totalDuration: `${totalDuration}s`,
            });
            return {
                totalDistance,
                totalDuration,
                routePath: finalPath,
            };
        }
        catch (error) {
            logger.error('[GPS Tracking] Failed to end session', error);
            throw error;
        }
    }
    /**
     * Get real-time location for a walker (for owner to track)
     */
    static async getCurrentLocation(sessionId) {
        try {
            const sessionDoc = await firestoreDb
                .collection('walk_sessions')
                .doc(sessionId)
                .get();
            if (!sessionDoc.exists) {
                return null;
            }
            const session = sessionDoc.data();
            if (session.status !== 'in_progress') {
                return null;
            }
            const currentLocation = session.routePath[session.routePath.length - 1];
            // Convert Firestore Timestamp to Date if needed
            const startTime = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
            const duration = session.startTime
                ? Math.floor((new Date().getTime() - startTime.getTime()) / 1000)
                : 0;
            return {
                currentLocation,
                routePath: session.routePath,
                totalDistance: session.totalDistance || 0,
                duration,
            };
        }
        catch (error) {
            logger.error('[GPS Tracking] Failed to get current location', error);
            return null;
        }
    }
    /**
     * Validate location is within expected range
     */
    static validateLocation(currentLocation, expectedLocation, maxDistanceMeters = 5000 // 5km default
    ) {
        const distance = this.calculateDistance(currentLocation, expectedLocation);
        return distance <= maxDistanceMeters;
    }
    /**
     * Calculate distance between two GPS coordinates (Haversine formula)
     */
    static calculateDistance(coord1, coord2) {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (coord1.latitude * Math.PI) / 180;
        const φ2 = (coord2.latitude * Math.PI) / 180;
        const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
        const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in meters
    }
    /**
     * Calculate total distance traveled along route
     */
    static calculateTotalDistance(route) {
        if (route.length < 2)
            return 0;
        let total = 0;
        for (let i = 0; i < route.length - 1; i++) {
            total += this.calculateDistance(route[i], route[i + 1]);
        }
        return Math.round(total); // Return in meters
    }
    /**
     * Get walk history for a walker
     */
    static async getWalkerHistory(walkerId, limit = 20) {
        try {
            const snapshot = await firestoreDb
                .collection('walk_sessions')
                .where('walkerId', '==', walkerId)
                .where('status', '==', 'completed')
                .orderBy('startTime', 'desc')
                .limit(limit)
                .get();
            return snapshot.docs.map(doc => doc.data());
        }
        catch (error) {
            logger.error('[GPS Tracking] Failed to get walker history', error);
            return [];
        }
    }
    /**
     * Get active walk sessions for owner to track
     */
    static async getOwnerActiveWalks(ownerId) {
        try {
            const snapshot = await firestoreDb
                .collection('walk_sessions')
                .where('ownerId', '==', ownerId)
                .where('status', '==', 'in_progress')
                .get();
            return snapshot.docs.map(doc => doc.data());
        }
        catch (error) {
            logger.error('[GPS Tracking] Failed to get active walks', error);
            return [];
        }
    }
}
export default GPSTrackingService;
