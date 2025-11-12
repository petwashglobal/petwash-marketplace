/**
 * Paw Finder™ Routes
 * LOYALTY MEMBER EXCLUSIVE SERVICE
 * Connect Lost Pets with Finders - Only for Verified Loyalty Members
 * NO platform fees - Pet Wash™ just facilitates the connection
 */

import { Router } from 'express';
import { db as firestore } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { requireLoyaltyMember } from '../middleware/loyalty';
import { geocodeAddress } from '../services/location/MapsService';
import { buildAllNavigationLinks } from '../utils/navigation';
import admin from 'firebase-admin';

const router = Router();

// Validation schemas
const reportPetSchema = z.object({
  type: z.enum(['lost', 'found']),
  pet: z.object({
    species: z.string().min(1, 'Pet species is required'),
    name: z.string().min(1, 'Pet name is required'),
    color: z.string().optional(),
    breed: z.string().optional(),
    age: z.number().optional(),
    description: z.string().optional(),
  }),
  lastSeen: z.object({
    city: z.string().min(1, 'City is required'),
    coords: z.array(z.number()).length(2).optional(), // [longitude, latitude]
    address: z.string().optional(),
    timestamp: z.string().optional(),
  }),
  contact: z.object({
    name: z.string().min(1, 'Contact name is required'),
    phone: z.string().min(1, 'Contact phone is required'),
    email: z.string().email().optional(),
  }),
  reward: z.string().optional(),
  photos: z.array(z.string()).optional(),
  lang: z.enum(['he', 'en']).default('en'),
});

const searchPetsSchema = z.object({
  species: z.string().optional(),
  city: z.string().optional(),
  status: z.enum(['active', 'resolved', 'expired']).optional(),
  type: z.enum(['lost', 'found']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

/**
 * POST /api/paw-finder/reports
 * Submit a lost or found pet report (LOYALTY MEMBERS ONLY)
 */
router.post('/reports', requireLoyaltyMember, async (req, res) => {
  try {
    const data = reportPetSchema.parse(req.body);
    const loyaltyUser = req.loyaltyUser;

    // Geocode the location using Google Maps (using shared MapsService)
    let geocodedLocation = null;
    if (data.lastSeen?.city || data.lastSeen?.address) {
      const addressString = `${data.lastSeen.address || ''}, ${data.lastSeen.city || ''}`.trim();
      geocodedLocation = await geocodeAddress(addressString, data.lang || 'en');
    }

    // Create Firestore document
    const reportRef = await firestore.collection('pawFinderReports').add({
      ...data,
      status: 'active', // active, resolved, expired
      reportedBy: {
        userId: loyaltyUser.userId,
        email: loyaltyUser.email,
        tier: loyaltyUser.tier,
      },
      location: geocodedLocation ? {
        lat: geocodedLocation.lat,
        lng: geocodedLocation.lng,
        formattedAddress: geocodedLocation.formattedAddress,
        city: data.lastSeen.city,
        originalAddress: data.lastSeen.address,
      } : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0,
      contactAttempts: 0,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.info('[Paw Finder] New report submitted', {
      reportId: reportRef.id,
      type: data.type,
      species: data.pet.species,
      city: data.lastSeen.city,
      userId: loyaltyUser.userId,
      tier: loyaltyUser.tier,
      hasLocation: !!geocodedLocation,
    });

    // Send location-based alerts to nearby loyalty members
    if (geocodedLocation) {
      // Fire-and-forget notification to nearby users (within 5km radius)
      notifyNearbyMembers(geocodedLocation, data.type, data.pet.species).catch(err => {
        logger.warn('[Paw Finder] Nearby member notification failed (non-critical)', {
          error: err.message,
        });
      });
    }

    // Generate navigation links using shared utilities
    const navigationLinks = geocodedLocation 
      ? buildAllNavigationLinks({
          lat: geocodedLocation.lat,
          lng: geocodedLocation.lng,
          label: `${data.type === 'lost' ? 'Lost' : 'Found'} ${data.pet.species}: ${data.pet.name}`,
        })
      : null;

    res.status(201).json({
      success: true,
      id: reportRef.id,
      location: geocodedLocation,
      navigation: navigationLinks,
      message: data.lang === 'he'
        ? 'הדיווח נשלח בהצלחה! שלחנו התראות לחברי נאמנות באזור.'
        : 'Report submitted successfully! We\'ve alerted loyalty members in your area.',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('[Paw Finder] Report submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit report',
      message: error.message,
    });
  }
});

/**
 * Notify nearby loyalty members about lost/found pet
 */
async function notifyNearbyMembers(location: { lat: number; lng: number }, type: string, species: string) {
  try {
    // Get all loyalty members with FCM tokens
    const firestore = admin.firestore();
    const usersSnapshot = await firestore.collection('users')
      .where('fcmToken', '!=', null)
      .get();
    
    const notifications: Promise<any>[] = [];
    
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      
      // Calculate distance if user has location
      // For now, send to all members (TODO: implement distance filtering)
      
      const messaging = admin.messaging();
      const message = {
        token: userData.fcmToken,
        notification: {
          title: type === 'lost' 
            ? `🔍 ${species} אבוד באזור שלך / Lost ${species} in Your Area`
            : `🐾 ${species} נמצא באזור שלך / Found ${species} in Your Area`,
          body: type === 'lost'
            ? 'עזור למצוא חיית מחמד אבודה / Help find a lost pet'
            : 'עזור לאחד חיית מחמד עם הבעלים / Help reunite a pet with their family',
        },
        data: {
          type: 'paw_finder_alert',
          reportType: type,
          species,
          lat: location.lat.toString(),
          lng: location.lng.toString(),
        },
        android: {
          priority: 'high' as const,
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
        },
      };
      
      notifications.push(messaging.send(message));
    });
    
    await Promise.allSettled(notifications);
    
    logger.info('[Paw Finder] Nearby member notifications sent', {
      recipientCount: notifications.length,
      type,
      species,
    });
  } catch (error: any) {
    logger.error('[Paw Finder] Nearby notification failed', {
      error: error.message,
    });
  }
}

/**
 * GET /api/paw-finder/reports
 * Search and list pet reports (LOYALTY MEMBERS ONLY)
 */
router.get('/reports', requireLoyaltyMember, async (req, res) => {
  try {
    const params = searchPetsSchema.parse({
      species: req.query.species,
      city: req.query.city,
      status: req.query.status || 'active',
      type: req.query.type,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });

    let query = firestore.collection('pawFinderReports')
      .where('status', '==', params.status)
      .orderBy('createdAt', 'desc')
      .limit(params.limit);

    // Note: Firestore has limitations on compound queries
    // For production, you'd need composite indexes or client-side filtering
    
    const snapshot = await query.get();
    let reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Client-side filtering for additional criteria
    if (params.type) {
      reports = reports.filter(r => r.type === params.type);
    }
    if (params.species) {
      reports = reports.filter(r => r.pet?.species?.toLowerCase().includes(params.species!.toLowerCase()));
    }
    if (params.city) {
      reports = reports.filter(r => r.lastSeen?.city?.toLowerCase().includes(params.city!.toLowerCase()));
    }

    res.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error: any) {
    logger.error('[Paw Finder] Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search reports',
      message: error.message,
    });
  }
});

/**
 * GET /api/paw-finder/reports/:id
 * Get a specific pet report (LOYALTY MEMBERS ONLY)
 */
router.get('/reports/:id', requireLoyaltyMember, async (req, res) => {
  try {
    const reportRef = firestore.collection('pawFinderReports').doc(req.params.id);
    const doc = await reportRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Increment view count
    await reportRef.update({
      views: (doc.data()?.views || 0) + 1,
    });

    res.json({
      success: true,
      report: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error: any) {
    logger.error('[Paw Finder] Get report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get report',
      message: error.message,
    });
  }
});

/**
 * POST /api/paw-finder/reports/:id/contact
 * Record contact attempt (LOYALTY MEMBERS ONLY)
 */
router.post('/reports/:id/contact', requireLoyaltyMember, async (req, res) => {
  try {
    const reportRef = firestore.collection('pawFinderReports').doc(req.params.id);
    const doc = await reportRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Increment contact attempts
    await reportRef.update({
      contactAttempts: (doc.data()?.contactAttempts || 0) + 1,
    });

    logger.info('[Paw Finder] Contact attempt recorded', {
      reportId: req.params.id,
    });

    res.json({
      success: true,
      message: 'Contact recorded',
    });
  } catch (error: any) {
    logger.error('[Paw Finder] Contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record contact',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/paw-finder/reports/:id/resolve
 * Mark a report as resolved (LOYALTY MEMBERS ONLY)
 */
router.patch('/reports/:id/resolve', requireLoyaltyMember, async (req, res) => {
  try {
    const { resolved, note } = req.body;
    const reportRef = firestore.collection('pawFinderReports').doc(req.params.id);
    const doc = await reportRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    const newStatus = resolved === true ? 'resolved' : 'active';
    
    await reportRef.update({
      status: newStatus,
      resolvedAt: resolved === true ? new Date().toISOString() : null,
      resolvedNote: note || (resolved === true ? 'Pet reunited' : null),
      updatedAt: new Date().toISOString(),
    });

    logger.info('[Paw Finder] Report status updated', {
      reportId: req.params.id,
      newStatus,
    });

    res.json({
      success: true,
      status: newStatus,
      message: resolved === true ? 'Report marked as resolved' : 'Report reopened',
    });
  } catch (error: any) {
    logger.error('[Paw Finder] Resolve error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update report',
      message: error.message,
    });
  }
});

/**
 * GET /api/paw-finder/stats
 * Get Paw Finder statistics (success stories, active reports, etc.)
 */
router.get('/stats', async (req, res) => {
  try {
    const activeSnapshot = await firestore.collection('pawFinderReports')
      .where('status', '==', 'active')
      .get();

    const resolvedSnapshot = await firestore.collection('pawFinderReports')
      .where('status', '==', 'resolved')
      .get();

    res.json({
      success: true,
      stats: {
        activeReports: activeSnapshot.size,
        resolvedReports: resolvedSnapshot.size,
        successRate: resolvedSnapshot.size > 0
          ? Math.round((resolvedSnapshot.size / (activeSnapshot.size + resolvedSnapshot.size)) * 100)
          : 0,
      },
    });
  } catch (error: any) {
    logger.error('[Paw Finder] Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
      message: error.message,
    });
  }
});

export default router;
