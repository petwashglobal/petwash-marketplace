/**
 * Mobile Field Operations API Routes
 * Handles field updates, photo uploads, and station management for mobile technicians
 */
import { Router } from 'express';
import multer from 'multer';
import { FieldOperationsService } from '../../services/FieldOperationsService';
import { validateFirebaseToken } from '../../middleware/firebase-auth';
import { logger } from '../../lib/logger';
import { insertFieldUpdateSchema, insertStaffDeviceSchema } from '@shared/schema';
const router = Router();
// Configure multer for photo uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per photo
        files: 10, // Max 10 photos per request
    },
    fileFilter: (req, file, cb) => {
        // Only allow image files
        if (!file.mimetype.match(/^image\/(jpeg|jpg|png|webp)$/)) {
            return cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
        }
        cb(null, true);
    },
});
/**
 * POST /api/mobile/field-updates
 * Create a field update with optional photos
 *
 * Body (multipart/form-data):
 * - stationId: number (required)
 * - taskId: number (optional)
 * - message: string (required)
 * - status: "before" | "during" | "after" | "issue" (optional)
 * - tags: string[] (optional, JSON array)
 * - metadata: object (optional, JSON object with deviceInfo, gpsCoords, etc.)
 * - photos: file[] (optional, up to 10 photos, 5MB each)
 */
router.post('/field-updates', validateFirebaseToken, upload.array('photos', 10), async (req, res) => {
    try {
        const userId = req.firebaseUser?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Parse form data
        const stationId = parseInt(req.body.stationId);
        const taskId = req.body.taskId ? parseInt(req.body.taskId) : undefined;
        const message = req.body.message;
        const status = req.body.status;
        const tags = req.body.tags ? JSON.parse(req.body.tags) : undefined;
        const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : undefined;
        const photos = req.files;
        // Validate required fields
        if (!stationId || !message) {
            return res.status(400).json({ error: 'stationId and message are required' });
        }
        // Validate using Zod schema
        const validationResult = insertFieldUpdateSchema.safeParse({
            stationId,
            taskId,
            createdByUserId: userId,
            message,
            status,
            tags,
            metadata,
        });
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.errors
            });
        }
        // Create field update with photos
        const fieldUpdate = await FieldOperationsService.createFieldUpdate({
            stationId,
            taskId,
            createdByUserId: userId,
            message,
            status,
            tags,
            metadata,
        }, photos);
        logger.info('[Mobile API] Field update created', {
            fieldUpdateId: fieldUpdate.id,
            userId,
            photoCount: photos?.length || 0
        });
        res.status(201).json({
            success: true,
            data: fieldUpdate,
        });
    }
    catch (error) {
        logger.error('[Mobile API] Failed to create field update', error);
        res.status(500).json({
            error: 'Failed to create field update',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /api/mobile/field-updates/:id/photos
 * Upload additional photos to an existing field update
 *
 * Params:
 * - id: field update ID
 *
 * Body (multipart/form-data):
 * - photo: file (required, single photo, 5MB max)
 */
router.post('/field-updates/:id/photos', validateFirebaseToken, upload.single('photo'), async (req, res) => {
    try {
        const userId = req.firebaseUser?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const fieldUpdateId = parseInt(req.params.id);
        const photo = req.file;
        if (!photo) {
            return res.status(400).json({ error: 'Photo file is required' });
        }
        const uploadedPhoto = await FieldOperationsService.uploadPhoto({
            fieldUpdateId,
            file: photo,
        });
        logger.info('[Mobile API] Photo uploaded', {
            photoId: uploadedPhoto.id,
            fieldUpdateId,
            userId
        });
        res.status(201).json({
            success: true,
            data: uploadedPhoto,
        });
    }
    catch (error) {
        logger.error('[Mobile API] Failed to upload photo', error);
        res.status(500).json({
            error: 'Failed to upload photo',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/mobile/field-updates/station/:stationId
 * Get timeline of field updates for a station
 *
 * Params:
 * - stationId: station ID
 */
router.get('/field-updates/station/:stationId', validateFirebaseToken, async (req, res) => {
    try {
        const stationId = parseInt(req.params.stationId);
        const timeline = await FieldOperationsService.getTimelineForStation(stationId);
        logger.info('[Mobile API] Station timeline retrieved', {
            stationId,
            updateCount: timeline.length
        });
        res.json({
            success: true,
            data: timeline,
        });
    }
    catch (error) {
        logger.error('[Mobile API] Failed to get station timeline', error);
        res.status(500).json({
            error: 'Failed to get station timeline',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/mobile/field-updates/task/:taskId
 * Get field updates for a specific task
 *
 * Params:
 * - taskId: logistics task ID
 */
router.get('/field-updates/task/:taskId', validateFirebaseToken, async (req, res) => {
    try {
        const taskId = parseInt(req.params.taskId);
        const updates = await FieldOperationsService.getFieldUpdatesForTask(taskId);
        logger.info('[Mobile API] Task updates retrieved', {
            taskId,
            updateCount: updates.length
        });
        res.json({
            success: true,
            data: updates,
        });
    }
    catch (error) {
        logger.error('[Mobile API] Failed to get task updates', error);
        res.status(500).json({
            error: 'Failed to get task updates',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/mobile/stations/:id/summary
 * Get mobile-optimized station summary with Waze integration
 *
 * Params:
 * - id: station ID
 */
router.get('/stations/:id/summary', validateFirebaseToken, async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const summary = await FieldOperationsService.getStationSummaryForMobile(stationId);
        logger.info('[Mobile API] Station summary retrieved', { stationId });
        res.json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        logger.error('[Mobile API] Failed to get station summary', error);
        res.status(500).json({
            error: 'Failed to get station summary',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/mobile/stations/nearby
 * Get nearby stations based on GPS coordinates
 *
 * Query params:
 * - latitude: number (required)
 * - longitude: number (required)
 * - radiusKm: number (optional, default 50km)
 */
router.get('/stations/nearby', validateFirebaseToken, async (req, res) => {
    try {
        const latitude = parseFloat(req.query.latitude);
        const longitude = parseFloat(req.query.longitude);
        const radiusKm = req.query.radiusKm
            ? parseFloat(req.query.radiusKm)
            : undefined;
        // Validate coordinates
        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({
                error: 'Valid latitude and longitude are required'
            });
        }
        if (latitude < -90 || latitude > 90) {
            return res.status(400).json({
                error: 'Latitude must be between -90 and 90'
            });
        }
        if (longitude < -180 || longitude > 180) {
            return res.status(400).json({
                error: 'Longitude must be between -180 and 180'
            });
        }
        const nearbyStations = await FieldOperationsService.getNearbyStations({
            latitude,
            longitude,
            radiusKm,
        });
        logger.info('[Mobile API] Nearby stations retrieved', {
            latitude,
            longitude,
            radiusKm,
            count: nearbyStations.length
        });
        res.json({
            success: true,
            data: nearbyStations,
        });
    }
    catch (error) {
        logger.error('[Mobile API] Failed to get nearby stations', error);
        res.status(500).json({
            error: 'Failed to get nearby stations',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /api/mobile/devices
 * Register device for push notifications
 *
 * Body:
 * - platform: "ios" | "android" (required)
 * - deviceModel: string (optional)
 * - osVersion: string (optional)
 * - appVersion: string (optional)
 * - pushToken: string (optional, FCM token)
 */
router.post('/devices', validateFirebaseToken, async (req, res) => {
    try {
        const userId = req.firebaseUser?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Validate using Zod schema
        const validationResult = insertStaffDeviceSchema.safeParse({
            ...req.body,
            userId,
        });
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.errors
            });
        }
        const device = await FieldOperationsService.registerDevice(validationResult.data);
        logger.info('[Mobile API] Device registered', {
            deviceId: device.id,
            userId,
            platform: device.platform
        });
        res.status(201).json({
            success: true,
            data: device,
        });
    }
    catch (error) {
        logger.error('[Mobile API] Failed to register device', error);
        res.status(500).json({
            error: 'Failed to register device',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * PATCH /api/mobile/devices/:id/token
 * Update FCM push token for a device
 *
 * Params:
 * - id: device ID
 *
 * Body:
 * - pushToken: string (required)
 */
router.patch('/devices/:id/token', validateFirebaseToken, async (req, res) => {
    try {
        const userId = req.firebaseUser?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const deviceId = parseInt(req.params.id);
        const { pushToken } = req.body;
        if (!pushToken) {
            return res.status(400).json({ error: 'pushToken is required' });
        }
        const device = await FieldOperationsService.updatePushToken(deviceId, pushToken);
        logger.info('[Mobile API] Push token updated', {
            deviceId,
            userId
        });
        res.json({
            success: true,
            data: device,
        });
    }
    catch (error) {
        logger.error('[Mobile API] Failed to update push token', error);
        res.status(500).json({
            error: 'Failed to update push token',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
export default router;
