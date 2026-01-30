/**
 * Health & Safety API Routes
 * Handles incident reporting, photo uploads, and H&S analytics
 */
import { Router } from 'express';
import multer from 'multer';
import { HealthSafetyService } from '../services/HealthSafetyService';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';
import { insertHealthSafetyIncidentSchema } from '@shared/schema';
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
 * POST /api/health-safety/incidents
 * Report a new health & safety incident with optional photos
 *
 * Body (multipart/form-data):
 * - stationId: number (required)
 * - title: string (required)
 * - description: string (required)
 * - type: "slip_and_fall" | "electrical" | "water_leak" | "injury" | "equipment_malfunction" | "other" (required)
 * - severity: "low" | "medium" | "high" | "critical" (required)
 * - photos: file[] (optional, up to 10 photos, 5MB each)
 */
router.post('/incidents', requireAuth, upload.array('photos', 10), async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Parse form data
        const stationId = parseInt(req.body.stationId);
        const title = req.body.title;
        const description = req.body.description;
        const type = req.body.type;
        const severity = req.body.severity;
        const photos = req.files;
        // Validate required fields
        if (!stationId || !title || !description || !type || !severity) {
            return res.status(400).json({
                error: 'stationId, title, description, type, and severity are required'
            });
        }
        // Validate using Zod schema
        const validationResult = insertHealthSafetyIncidentSchema.safeParse({
            stationId,
            reportedByUserId: userId,
            title,
            description,
            type,
            severity,
        });
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.errors
            });
        }
        // Report incident with photos
        const incident = await HealthSafetyService.reportIncident({
            stationId,
            reportedByUserId: userId,
            title,
            description,
            type,
            severity,
        }, photos);
        logger.info('[HealthSafety API] Incident reported', {
            incidentId: incident.id,
            incidentNumber: incident.incidentNumber,
            userId,
            photoCount: photos?.length || 0
        });
        res.status(201).json({
            success: true,
            data: incident,
        });
    }
    catch (error) {
        logger.error('[HealthSafety API] Failed to report incident', error);
        res.status(500).json({
            error: 'Failed to report incident',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/health-safety/incidents
 * List incidents with optional filters
 *
 * Query params:
 * - stationId: number (optional)
 * - status: "open" | "in_review" | "resolved" | "closed" (optional)
 * - severity: "low" | "medium" | "high" | "critical" (optional)
 * - type: string (optional)
 * - fromDate: ISO date string (optional)
 * - toDate: ISO date string (optional)
 */
router.get('/incidents', requireAuth, async (req, res) => {
    try {
        const filters = {};
        if (req.query.stationId) {
            filters.stationId = parseInt(req.query.stationId);
        }
        if (req.query.status) {
            filters.status = req.query.status;
        }
        if (req.query.severity) {
            filters.severity = req.query.severity;
        }
        if (req.query.type) {
            filters.type = req.query.type;
        }
        if (req.query.fromDate) {
            filters.fromDate = new Date(req.query.fromDate);
        }
        if (req.query.toDate) {
            filters.toDate = new Date(req.query.toDate);
        }
        const incidents = await HealthSafetyService.listIncidents(filters);
        logger.info('[HealthSafety API] Incidents listed', {
            count: incidents.length,
            filters
        });
        res.json({
            success: true,
            data: incidents,
        });
    }
    catch (error) {
        logger.error('[HealthSafety API] Failed to list incidents', error);
        res.status(500).json({
            error: 'Failed to list incidents',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/health-safety/incidents/:id
 * Get incident details with photos
 *
 * Params:
 * - id: incident ID
 */
router.get('/incidents/:id', requireAuth, async (req, res) => {
    try {
        const incidentId = parseInt(req.params.id);
        const incident = await HealthSafetyService.getIncidentById(incidentId);
        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }
        logger.info('[HealthSafety API] Incident retrieved', { incidentId });
        res.json({
            success: true,
            data: incident,
        });
    }
    catch (error) {
        logger.error('[HealthSafety API] Failed to get incident', error);
        res.status(500).json({
            error: 'Failed to get incident',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/health-safety/incidents/station/:stationId
 * Get all incidents for a specific station
 *
 * Params:
 * - stationId: station ID
 */
router.get('/incidents/station/:stationId', requireAuth, async (req, res) => {
    try {
        const stationId = parseInt(req.params.stationId);
        const incidents = await HealthSafetyService.listIncidents({ stationId });
        logger.info('[HealthSafety API] Station incidents retrieved', {
            stationId,
            count: incidents.length
        });
        res.json({
            success: true,
            data: incidents,
        });
    }
    catch (error) {
        logger.error('[HealthSafety API] Failed to get station incidents', error);
        res.status(500).json({
            error: 'Failed to get station incidents',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * PATCH /api/health-safety/incidents/:id/status
 * Update incident status
 *
 * Params:
 * - id: incident ID
 *
 * Body:
 * - status: "open" | "in_review" | "resolved" | "closed" (required)
 * - notes: string (optional)
 */
router.patch('/incidents/:id/status', requireAuth, async (req, res) => {
    try {
        const incidentId = parseInt(req.params.id);
        const { status, notes } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }
        const validStatuses = ['open', 'in_review', 'resolved', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }
        const incident = await HealthSafetyService.updateIncidentStatus(incidentId, status, notes);
        logger.info('[HealthSafety API] Incident status updated', {
            incidentId,
            status
        });
        res.json({
            success: true,
            data: incident,
        });
    }
    catch (error) {
        logger.error('[HealthSafety API] Failed to update incident status', error);
        res.status(500).json({
            error: 'Failed to update incident status',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * PATCH /api/health-safety/incidents/:id/assign
 * Assign incident to H&S team member
 *
 * Params:
 * - id: incident ID
 *
 * Body:
 * - userId: string (required) - Firebase UID of H&S team member
 */
router.patch('/incidents/:id/assign', requireAuth, async (req, res) => {
    try {
        const incidentId = parseInt(req.params.id);
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        const incident = await HealthSafetyService.assignIncident(incidentId, userId);
        logger.info('[HealthSafety API] Incident assigned', {
            incidentId,
            assignedTo: userId
        });
        res.json({
            success: true,
            data: incident,
        });
    }
    catch (error) {
        logger.error('[HealthSafety API] Failed to assign incident', error);
        res.status(500).json({
            error: 'Failed to assign incident',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * PATCH /api/health-safety/incidents/:id/resolve
 * Mark incident as resolved
 *
 * Params:
 * - id: incident ID
 *
 * Body:
 * - resolutionNotes: string (required)
 */
router.patch('/incidents/:id/resolve', requireAuth, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const incidentId = parseInt(req.params.id);
        const { resolutionNotes } = req.body;
        if (!resolutionNotes) {
            return res.status(400).json({ error: 'resolutionNotes is required' });
        }
        const incident = await HealthSafetyService.resolveIncident(incidentId, resolutionNotes, userId);
        logger.info('[HealthSafety API] Incident resolved', {
            incidentId,
            resolvedBy: userId
        });
        res.json({
            success: true,
            data: incident,
        });
    }
    catch (error) {
        logger.error('[HealthSafety API] Failed to resolve incident', error);
        res.status(500).json({
            error: 'Failed to resolve incident',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /api/health-safety/incidents/:id/photos
 * Upload additional photos to an existing incident
 *
 * Params:
 * - id: incident ID
 *
 * Body (multipart/form-data):
 * - photo: file (required, single photo, 5MB max)
 */
router.post('/incidents/:id/photos', requireAuth, upload.single('photo'), async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const incidentId = parseInt(req.params.id);
        const photo = req.file;
        if (!photo) {
            return res.status(400).json({ error: 'Photo file is required' });
        }
        const uploadedPhoto = await HealthSafetyService.uploadIncidentPhoto(incidentId, userId, photo);
        logger.info('[HealthSafety API] Photo uploaded', {
            photoId: uploadedPhoto.id,
            incidentId,
            userId
        });
        res.status(201).json({
            success: true,
            data: uploadedPhoto,
        });
    }
    catch (error) {
        logger.error('[HealthSafety API] Failed to upload photo', error);
        res.status(500).json({
            error: 'Failed to upload photo',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/health-safety/dashboard
 * Get H&S analytics dashboard
 */
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const dashboard = await HealthSafetyService.getIncidentDashboard();
        logger.info('[HealthSafety API] Dashboard retrieved', {
            totalIncidents: dashboard.totalIncidents
        });
        res.json({
            success: true,
            data: dashboard,
        });
    }
    catch (error) {
        logger.error('[HealthSafety API] Failed to get dashboard', error);
        res.status(500).json({
            error: 'Failed to get dashboard',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
export default router;
