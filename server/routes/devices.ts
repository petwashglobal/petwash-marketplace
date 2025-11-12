/**
 * Device Monitoring & Management Routes
 * Apple-style device tracking for fraud prevention
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { eq, desc, and, isNull } from 'drizzle-orm';
import {
  userDevices,
  userDeviceEvents,
  type UserDevice,
} from '../../shared/schema';
import type { AuthenticatedRequest } from '../middleware/rbac';
import { requireAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { UserDeviceService, type DeviceTelemetry } from '../services/UserDeviceService';
import { z } from 'zod';

const router = Router();

// ========================================
// DEVICE TELEMETRY & FINGERPRINTING
// ========================================

/**
 * POST /api/devices/fingerprint - Register or update device telemetry
 * Called automatically on login/session start to track devices
 */
router.post('/fingerprint', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    
    // Validate telemetry data
    const telemetrySchema = z.object({
      platform: z.enum(['iOS', 'Android', 'Windows', 'macOS', 'Linux', 'Unknown']),
      browser: z.string().optional(),
      osVersion: z.string().optional(),
      browserVersion: z.string().optional(),
      webauthnCredentialId: z.string().optional(),
      ipAddress: z.string().optional(),
      ipLocation: z.object({
        city: z.string().optional(),
        country: z.string().optional(),
        region: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      }).optional(),
      wifiSsid: z.string().optional(),
      wifiBssid: z.string().optional(),
      userAgent: z.string().optional(),
      deviceLabel: z.string().optional(),
      metadata: z.any().optional(),
    });
    
    const validatedData = telemetrySchema.parse(req.body);
    
    // Get IP from request if not provided
    const ipAddress = validatedData.ipAddress || 
      req.headers['x-forwarded-for']?.toString().split(',')[0] || 
      req.ip || 
      req.socket.remoteAddress;
    
    const telemetry: DeviceTelemetry = {
      ...validatedData,
      userId,
      ipAddress,
      userAgent: validatedData.userAgent || req.headers['user-agent'],
    };
    
    // Register or update device
    const result = await UserDeviceService.registerDevice(telemetry);
    
    // Mark as current device
    await UserDeviceService.markAsCurrentDevice(result.device.id, userId);
    
    res.json({
      success: true,
      device: result.device,
      isNewDevice: result.isNewDevice,
      fraudScore: result.fraudScore,
      fraudSignals: result.fraudSignals,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid telemetry data', details: error.errors });
    }
    logger.error('[Devices API] Error recording device fingerprint:', error);
    res.status(500).json({ error: 'Failed to record device telemetry' });
  }
});

// ========================================
// DEVICE MANAGEMENT
// ========================================

/**
 * GET /api/devices - Get all user's devices
 * Returns list of devices with fraud scores and activity
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    
    const devices = await UserDeviceService.getUserDevices(userId);
    
    // Sanitize sensitive data before sending to client
    const sanitizedDevices = devices.map(device => ({
      id: device.id,
      deviceLabel: device.deviceLabel,
      platform: device.platform,
      browser: device.browser,
      osVersion: device.osVersion,
      browserVersion: device.browserVersion,
      ipAddress: device.ipAddress,
      ipLocation: device.ipLocation,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      sessionCount: device.sessionCount,
      trustScore: device.trustScore,
      fraudFlags: device.fraudFlags,
      isCurrentDevice: device.isCurrentDevice,
      // Don't send: fingerprint, encrypted data, internal metadata
    }));
    
    res.json(sanitizedDevices);
  } catch (error) {
    logger.error('[Devices API] Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * GET /api/devices/:id - Get specific device details
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const deviceId = req.params.id;
    
    const device = await UserDeviceService.getDeviceById(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Verify ownership
    if (device.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Sanitize and return
    const sanitizedDevice = {
      id: device.id,
      deviceLabel: device.deviceLabel,
      platform: device.platform,
      browser: device.browser,
      osVersion: device.osVersion,
      browserVersion: device.browserVersion,
      ipAddress: device.ipAddress,
      ipLocation: device.ipLocation,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      lastIpChangeAt: device.lastIpChangeAt,
      lastGeoChangeAt: device.lastGeoChangeAt,
      sessionCount: device.sessionCount,
      trustScore: device.trustScore,
      fraudFlags: device.fraudFlags,
      isCurrentDevice: device.isCurrentDevice,
      revokedAt: device.revokedAt,
      revokedReason: device.revokedReason,
    };
    
    res.json(sanitizedDevice);
  } catch (error) {
    logger.error('[Devices API] Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

/**
 * PATCH /api/devices/:id - Update device (rename)
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const deviceId = req.params.id;
    const { deviceLabel } = req.body;
    
    if (!deviceLabel || typeof deviceLabel !== 'string') {
      return res.status(400).json({ error: 'Device label is required' });
    }
    
    // Verify ownership
    const device = await UserDeviceService.getDeviceById(deviceId);
    if (!device || device.userId !== userId) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const success = await UserDeviceService.updateDeviceLabel(
      deviceId,
      userId,
      deviceLabel.trim()
    );
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to update device' });
    }
    
    // Fetch updated device
    const updatedDevice = await UserDeviceService.getDeviceById(deviceId);
    
    res.json({
      success: true,
      device: {
        id: updatedDevice!.id,
        deviceLabel: updatedDevice!.deviceLabel,
        platform: updatedDevice!.platform,
      },
    });
  } catch (error) {
    logger.error('[Devices API] Error updating device:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

/**
 * DELETE /api/devices/:id - Revoke/dismiss device
 * User-initiated removal of unrecognized device
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const deviceId = req.params.id;
    
    // Verify ownership
    const device = await UserDeviceService.getDeviceById(deviceId);
    if (!device || device.userId !== userId) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Get IP for audit trail
    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
      req.ip || 
      req.socket.remoteAddress;
    
    const success = await UserDeviceService.revokeDevice(
      deviceId,
      userId,
      'user_dismissed',
      ipAddress
    );
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to revoke device' });
    }
    
    res.json({
      success: true,
      message: 'Device dismissed successfully',
    });
  } catch (error) {
    logger.error('[Devices API] Error revoking device:', error);
    res.status(500).json({ error: 'Failed to revoke device' });
  }
});

/**
 * POST /api/devices/:id/dismiss - Alternative dismiss endpoint (same as DELETE)
 */
router.post('/:id/dismiss', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const deviceId = req.params.id;
    
    const device = await UserDeviceService.getDeviceById(deviceId);
    if (!device || device.userId !== userId) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
      req.ip || 
      req.socket.remoteAddress;
    
    const success = await UserDeviceService.revokeDevice(
      deviceId,
      userId,
      'user_dismissed',
      ipAddress
    );
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to dismiss device' });
    }
    
    res.json({
      success: true,
      message: 'Device dismissed successfully',
    });
  } catch (error) {
    logger.error('[Devices API] Error dismissing device:', error);
    res.status(500).json({ error: 'Failed to dismiss device' });
  }
});

// ========================================
// DEVICE EVENTS & HISTORY
// ========================================

/**
 * GET /api/devices/:id/events - Get device activity history
 */
router.get('/:id/events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const deviceId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Verify ownership
    const device = await UserDeviceService.getDeviceById(deviceId);
    if (!device || device.userId !== userId) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const events = await UserDeviceService.getDeviceEvents(deviceId, limit);
    
    res.json(events);
  } catch (error) {
    logger.error('[Devices API] Error fetching device events:', error);
    res.status(500).json({ error: 'Failed to fetch device events' });
  }
});

// ========================================
// ADMIN ROUTES
// ========================================

/**
 * GET /api/devices/admin/suspicious - Get all suspicious devices (ADMIN ONLY)
 */
router.get('/admin/suspicious', requireAdmin, async (req: Request, res: Response) => {
  try {
    const devices = await UserDeviceService.getSuspiciousDevices();
    
    res.json(devices);
  } catch (error) {
    logger.error('[Devices API] Error fetching suspicious devices:', error);
    res.status(500).json({ error: 'Failed to fetch suspicious devices' });
  }
});

/**
 * GET /api/devices/admin/user/:userId - Get all devices for a user (ADMIN ONLY)
 */
router.get('/admin/user/:userId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const devices = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, userId))
      .orderBy(desc(userDevices.lastSeenAt));
    
    res.json(devices);
  } catch (error) {
    logger.error('[Devices API] Error fetching user devices:', error);
    res.status(500).json({ error: 'Failed to fetch user devices' });
  }
});

/**
 * POST /api/devices/admin/:id/revoke - Admin revoke device (ADMIN ONLY)
 */
router.post('/admin/:id/revoke', requireAdmin, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const { reason = 'suspicious_activity' } = req.body;
    
    const device = await UserDeviceService.getDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const success = await UserDeviceService.revokeDevice(
      deviceId,
      device.userId,
      reason,
      req.ip
    );
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to revoke device' });
    }
    
    res.json({
      success: true,
      message: 'Device revoked by admin',
    });
  } catch (error) {
    logger.error('[Devices API] Error revoking device (admin):', error);
    res.status(500).json({ error: 'Failed to revoke device' });
  }
});

export default router;
