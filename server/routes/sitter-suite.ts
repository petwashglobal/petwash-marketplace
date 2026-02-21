/**
 * THE SITTER SUITE™ - Backend API Routes
 * 
 * Revolutionary pet sitting marketplace with Nayax split payments
 * Like Booking.com/Airbnb - Apple-level premium experience
 */

import { Router, Request } from 'express';
import { db } from '../db';
import {
  sitterProfiles,
  petProfilesForSitting,
  sitterBookings,
  sitterReviews,
  insertSitterProfileSchema,
  insertPetProfileForSittingSchema,
  insertSitterBookingSchema,
  insertSitterReviewSchema,
  type SitterProfile,
  type PetProfileForSitting,
  type SitterBooking,
  type SitterReview,
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { calendarIntegrationService } from '../services/CalendarIntegrationService';
import { nanoid } from 'nanoid';
import { nayaxSitterMarketplace } from '../services/NayaxSitterMarketplaceService';
import { sitterAITriageService } from '../services/SitterAITriageService';
import { requireLoyaltyMember, enrichWithLoyalty } from '../middleware/loyalty';
import { requireAuth } from '../customAuth';
import { geocodeAddress } from '../services/location/MapsService';
import { buildAllNavigationLinks } from '../utils/navigation';
import { advancedBookingEngine as sitterAdvancedBookingEngine } from '../services/SitterAdvancedBookingEngine';
import { IsraeliDigitalReceiptService } from '../services/IsraeliDigitalReceiptService';
import { IsraeliContractorComplianceService } from '../services/IsraeliContractorCompliance';
import VATCalculatorService from '../services/VATCalculatorService';
import multer from 'multer';
import { storage, auth } from '../lib/firebase-admin';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    platform: 'Sitter Suite',
    status: 'active',
    version: '2.0',
    services: ['pet-sitting', 'house-sitting', 'overnight-care'],
    certified: true
  });
});

// Configure multer for file uploads
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype.toLowerCase())) {
      return cb(new Error(`Invalid file type. Allowed: JPEG, PNG, WebP, HEIC`));
    }
    cb(null, true);
  }
});

/**
 * POST /api/sitter-suite/upload/profile-photo - Upload profile photo
 * Requires Firebase authentication
 * Returns the URL to use for profile updates
 */
router.post('/upload/profile-photo', upload.single('photo'), async (req: Request, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    let user;
    try {
      user = await auth.verifyIdToken(token);
    } catch (authError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // AI Image Moderation (background check - relaxed, not harsh)
    try {
      const { contentModerationService } = await import('../services/ContentModerationService');
      const moderationResult = await contentModerationService.moderateImage(
        req.file.buffer,
        req.file.mimetype,
        { userId: user.uid, uploadType: 'profile_photo', platform: 'sitter-suite' }
      );

      if (!moderationResult.isApproved) {
        logger.warn('[Sitter Suite] Profile photo rejected by AI moderation', {
          userId: user.uid,
          flags: moderationResult.flags,
          explanation: moderationResult.explanation,
        });
        return res.status(400).json({
          error: 'התמונה לא עברה בדיקת תוכן. אנא העלה תמונה מתאימה.',
          errorEn: 'Image did not pass content review. Please upload an appropriate photo.',
          flags: moderationResult.flags,
        });
      }
    } catch (modErr) {
      logger.warn('[Sitter Suite] Image moderation failed (allowing upload)', modErr);
    }

    const bucket = storage.bucket('gs://signinpetwash.firebasestorage.app');
    const ext = req.file.mimetype.split('/')[1] || 'jpg';
    const fileName = `providers/${user.uid}/profile/photo_${Date.now()}.${ext}`;
    const fileRef = bucket.file(fileName);

    await fileRef.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
    });

    const [signedUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });

    logger.info('[Sitter Suite] Profile photo uploaded (AI approved)', { userId: user.uid, fileName, safetyScore: moderationResult.safetyScore });

    res.json({
      success: true,
      url: signedUrl,
      path: fileName,
      message: 'Profile photo uploaded successfully'
    });
  } catch (error: any) {
    logger.error('[Sitter Suite] Profile photo upload error', error);
    res.status(500).json({ error: error.message || 'Failed to upload photo' });
  }
});

/**
 * POST /api/sitter-suite/upload/document - Upload document (ID, certificates, etc.)
 * Requires Firebase authentication
 */
router.post('/upload/document', upload.single('document'), async (req: Request, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    let user;
    try {
      user = await auth.verifyIdToken(token);
    } catch (authError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const docType = req.body.documentType || 'general';
    const bucket = storage.bucket('gs://signinpetwash.firebasestorage.app');
    const ext = req.file.mimetype.split('/')[1] || 'jpg';
    const fileName = `providers/${user.uid}/documents/${docType}_${Date.now()}.${ext}`;
    const fileRef = bucket.file(fileName);

    await fileRef.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
    });

    const [signedUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
    });

    logger.info('[Sitter Suite] Document uploaded', { userId: user.uid, docType, fileName });

    res.json({
      success: true,
      url: signedUrl,
      path: fileName,
      documentType: docType,
      message: 'Document uploaded successfully'
    });
  } catch (error: any) {
    logger.error('[Sitter Suite] Document upload error', error);
    res.status(500).json({ error: error.message || 'Failed to upload document' });
  }
});

// ==================== SITTER PROFILES ====================

/**
 * GET /api/sitter-suite/sitters - Browse available sitters
 */
router.get('/sitters', async (req, res) => {
  try {
    const { city, specialization, minRating } = req.query;
    
    // SELECT only the columns that exist in our simplified schema
    const sitters = await db.select({
      id: sitterProfiles.id,
      userId: sitterProfiles.userId,
      firstName: sitterProfiles.firstName,
      lastName: sitterProfiles.lastName,
      email: sitterProfiles.email,
      phone: sitterProfiles.phone,
      city: sitterProfiles.city,
      bio: sitterProfiles.bio,
      yearsOfExperience: sitterProfiles.yearsOfExperience,
      pricePerDayCents: sitterProfiles.pricePerDayCents,
      profilePictureUrl: sitterProfiles.profilePictureUrl,
      rating: sitterProfiles.rating,
      totalBookings: sitterProfiles.totalBookings,
      isActive: sitterProfiles.isActive,
      isVerified: sitterProfiles.isVerified,
      createdAt: sitterProfiles.createdAt,
    })
    .from(sitterProfiles)
    .where(eq(sitterProfiles.isActive, true))
    .orderBy(desc(sitterProfiles.rating))
    .limit(50);
    
    logger.info('[Sitter Suite] Sitters browsed', {
      count: sitters.length,
      city,
      specialization,
    });
    
    res.json(sitters);
  } catch (error) {
    logger.error('[Sitter Suite] Error fetching sitters', error);
    res.status(500).json({ error: 'Failed to fetch sitters' });
  }
});

/**
 * GET /api/sitter-suite/sitters/:id - Get sitter profile
 * Supports both numeric ID (internal) and string userId (Firebase UID / provider ID)
 */
router.get('/sitters/:id', async (req, res) => {
  try {
    const idParam = req.params.id;
    const numericId = parseInt(idParam);
    const isNumeric = !isNaN(numericId) && String(numericId) === idParam;
    
    // SELECT only the columns that exist in our simplified schema
    const [sitter] = await db
      .select({
        id: sitterProfiles.id,
        userId: sitterProfiles.userId,
        firstName: sitterProfiles.firstName,
        lastName: sitterProfiles.lastName,
        email: sitterProfiles.email,
        phone: sitterProfiles.phone,
        city: sitterProfiles.city,
        bio: sitterProfiles.bio,
        yearsOfExperience: sitterProfiles.yearsOfExperience,
        pricePerDayCents: sitterProfiles.pricePerDayCents,
        profilePictureUrl: sitterProfiles.profilePictureUrl,
        rating: sitterProfiles.rating,
        totalBookings: sitterProfiles.totalBookings,
        isActive: sitterProfiles.isActive,
        isVerified: sitterProfiles.isVerified,
        createdAt: sitterProfiles.createdAt,
      })
      .from(sitterProfiles)
      .where(isNumeric ? eq(sitterProfiles.id, numericId) : eq(sitterProfiles.userId, idParam));
    
    if (!sitter) {
      return res.status(404).json({ error: 'Sitter not found' });
    }
    
    // Get reviews - SELECT only existing columns
    const reviews = await db
      .select({
        id: sitterReviews.id,
        sitterId: sitterReviews.sitterId,
        rating: sitterReviews.rating,
        comment: sitterReviews.comment,
        createdAt: sitterReviews.createdAt,
      })
      .from(sitterReviews)
      .where(eq(sitterReviews.sitterId, sitter.id))
      .orderBy(desc(sitterReviews.createdAt))
      .limit(10);
    
    res.json({
      sitter,
      reviews,
    });
  } catch (error) {
    logger.error('[Sitter Suite] Error fetching sitter', error);
    res.status(500).json({ error: 'Failed to fetch sitter' });
  }
});

/**
 * POST /api/sitter-suite/sitters - Create sitter profile
 */
router.post('/sitters', async (req, res) => {
  try {
    const validatedData = insertSitterProfileSchema.parse(req.body);
    
    const [newSitter] = await db
      .insert(sitterProfiles)
      .values(validatedData)
      .returning();
    
    logger.info('[Sitter Suite] Sitter profile created', {
      sitterId: newSitter.id,
      city: newSitter.city,
    });
    
    res.status(201).json(newSitter);
  } catch (error) {
    logger.error('[Sitter Suite] Error creating sitter', error);
    res.status(400).json({ error: 'Failed to create sitter profile' });
  }
});

/**
 * PATCH /api/sitter-suite/sitters/:id - Update sitter profile
 * Supports updating profile photo and other profile fields
 */
router.patch('/sitters/:id', async (req, res) => {
  try {
    const idParam = req.params.id;
    const numericId = parseInt(idParam);
    const isNumeric = !isNaN(numericId) && String(numericId) === idParam;
    
    // Find the sitter first
    const [existingSitter] = await db
      .select()
      .from(sitterProfiles)
      .where(isNumeric ? eq(sitterProfiles.id, numericId) : eq(sitterProfiles.userId, idParam));
    
    if (!existingSitter) {
      return res.status(404).json({ error: 'Sitter not found' });
    }
    
    // Extract allowed update fields
    const {
      firstName,
      lastName,
      phone,
      city,
      bio,
      yearsOfExperience,
      pricePerDayCents,
      profilePictureUrl,
      isActive,
    } = req.body;
    
    // Build update object with only provided fields
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (city !== undefined) updateData.city = city;
    if (bio !== undefined) updateData.bio = bio;
    if (yearsOfExperience !== undefined) updateData.yearsOfExperience = yearsOfExperience;
    if (pricePerDayCents !== undefined) updateData.pricePerDayCents = pricePerDayCents;
    if (profilePictureUrl !== undefined) updateData.profilePictureUrl = profilePictureUrl;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const [updatedSitter] = await db
      .update(sitterProfiles)
      .set(updateData)
      .where(eq(sitterProfiles.id, existingSitter.id))
      .returning();
    
    logger.info('[Sitter Suite] Sitter profile updated', {
      sitterId: updatedSitter.id,
      fieldsUpdated: Object.keys(updateData).filter(k => k !== 'updatedAt'),
    });
    
    res.json(updatedSitter);
  } catch (error) {
    logger.error('[Sitter Suite] Error updating sitter', error);
    res.status(400).json({ error: 'Failed to update sitter profile' });
  }
});

// ==================== PET PROFILES ====================

/**
 * GET /api/sitter-suite/pets - Get user's pets for sitting
 */
router.get('/pets', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    const pets = await db
      .select()
      .from(petProfilesForSitting)
      .where(eq(petProfilesForSitting.userId, userId));
    
    res.json(pets);
  } catch (error) {
    logger.error('[Sitter Suite] Error fetching pets', error);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

/**
 * POST /api/sitter-suite/pets - Create pet profile for sitting
 */
router.post('/pets', async (req, res) => {
  try {
    const validatedData = insertPetProfileForSittingSchema.parse(req.body);
    
    const [newPet] = await db
      .insert(petProfilesForSitting)
      .values(validatedData)
      .returning();
    
    logger.info('[Sitter Suite] Pet profile created', {
      petId: newPet.id,
      name: newPet.name,
      userId: newPet.userId,
    });
    
    res.status(201).json(newPet);
  } catch (error) {
    logger.error('[Sitter Suite] Error creating pet profile', error);
    res.status(400).json({ error: 'Failed to create pet profile' });
  }
});

// ==================== BOOKINGS ====================

/**
 * POST /api/sitter-suite/bookings - Create new booking with AI triage (LOYALTY MEMBERS ONLY) - USING LUXURY ENGINE
 */
router.post('/bookings', requireAuth, requireLoyaltyMember, async (req, res) => {
  try {
    const {
      sitterId,
      petId,
      startDate,
      endDate,
      specialInstructions,
    } = req.body;
    
    const ownerId = (req as any).user?.uid || req.body.ownerId;
    
    const [sitter] = await db
      .select()
      .from(sitterProfiles)
      .where(eq(sitterProfiles.id, sitterId));
    
    const [pet] = await db
      .select()
      .from(petProfilesForSitting)
      .where(eq(petProfilesForSitting.id, petId));
    
    if (!sitter || !pet) {
      return res.status(404).json({ error: 'Sitter or pet not found' });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const availability = await sitterAdvancedBookingEngine.checkAvailability({
      providerId: sitterId.toString(),
      serviceType: 'pet_sitting',
      startDate: start,
      endDate: end,
      metadata: { 
        petType: pet.breed,
        specialNeeds: pet.specialNeeds,
        allergies: pet.allergies
      }
    });

    if (!availability.available) {
      return res.status(400).json({ error: availability.message });
    }

    const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                     req.socket.remoteAddress || 
                     '127.0.0.1';

    const pricing = await sitterAdvancedBookingEngine.quotePrice({
      providerId: sitterId.toString(),
      serviceType: 'pet_sitting',
      startDate: start,
      endDate: end,
      userId: ownerId,
      ipAddress: clientIP,
      metadata: {
        petId,
        specialInstructions,
        petType: pet.breed,
        specialNeeds: pet.specialNeeds
      }
    });
    
    let triageResult = { urgencyScore: 1, triageNotes: '' };
    try {
      triageResult = await sitterAITriageService.analyzeBookingUrgency({
        startDate: start,
        endDate: end,
        petType: pet.breed,
        specialNeeds: pet.specialNeeds || undefined,
        allergies: pet.allergies ? JSON.stringify(pet.allergies) : undefined,
        city: sitter.city,
        ownerMessage: specialInstructions,
      });
    } catch (triageErr) {
      logger.warn('[Sitter Suite] AI triage failed (non-blocking)', triageErr);
    }
    
    const bookingId = `SITTER_${nanoid(12)}`;
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // UBER-STYLE: Create booking in pending_provider status (NOT confirmed yet)
    // Payment is NOT captured until provider accepts
    const [newBooking] = await db
      .insert(sitterBookings)
      .values({
        bookingId,
        ownerId,
        sitterId,
        petId,
        startDate: start,
        endDate: end,
        totalDays,
        basePriceCents: Math.round(pricing.subtotal * 100),
        platformServiceFeeCents: Math.round(pricing.platformFee * 100),
        brokerCutCents: Math.round(pricing.platformFee * 100),
        sitterPayoutCents: Math.round(pricing.providerPayout * 100),
        totalChargeCents: Math.round(pricing.totalPrice * 100),
        paymentStatus: 'pending',
        urgencyScore: triageResult.urgencyScore,
        aiTriageNotes: triageResult.triageNotes,
        specialInstructions,
        status: 'pending_provider',
      })
      .returning();
    
    logger.info('[Sitter Suite] ✅ Booking request created - awaiting provider confirmation', {
      bookingId,
      ownerId,
      sitterId,
      totalDays,
      totalPrice: pricing.totalPrice,
    });

    // NOTIFY PROVIDER via SMS/WhatsApp (fire-and-forget)
    (async () => {
      try {
        if (sitter.phone) {
          const { TwilioSMSService } = await import('../services/TwilioSMSService');
          const smsService = new TwilioSMSService();
          const ownerName = (req as any).user?.email?.split('@')[0] || 'לקוח/ה';
          await smsService.sendSMS(
            sitter.phone,
            `🐾 ⁦Pet Wash™⁩ - בקשת הזמנה חדשה!\n` +
            `לקוח/ה: ${ownerName}\n` +
            `תאריכים: ${start.toLocaleDateString('he-IL')} - ${end.toLocaleDateString('he-IL')}\n` +
            `${totalDays} ימים · ₪${(pricing.subtotal).toFixed(0)}\n` +
            `אנא אשר/י את ההזמנה באפליקציה.`
          );
          logger.info('[Sitter Suite] ✅ Provider notification sent via SMS', { bookingId, phone: '***' });
        }
      } catch (notifErr) {
        logger.warn('[Sitter Suite] Provider notification failed (non-blocking)', notifErr);
      }
    })();
    
    res.status(201).json({
      booking: newBooking,
      status: 'pending_provider',
      message: 'הבקשה נשלחה לשמרטף/ית. תקבל/י עדכון כשההזמנה תאושר.',
      triage: triageResult,
      pricing: {
        totalPrice: pricing.totalPrice,
        basePrice: pricing.subtotal,
        loyaltyDiscount: pricing.loyaltyDiscount,
        platformFee: pricing.platformFee,
        sitterPayout: pricing.providerPayout,
        currency: pricing.currency,
        breakdown: pricing.breakdown,
      },
    });
    
  } catch (error) {
    logger.error('[Sitter Suite] Error creating booking', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

/**
 * PATCH /api/sitter-suite/bookings/:bookingId/provider-respond
 * Uber-style: Provider accepts or declines a booking request
 * Both parties must confirm for the booking to proceed
 */
router.patch('/bookings/:bookingId/provider-respond', requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { action, declineReason } = req.body; // action: 'accept' | 'decline'
    const providerUid = (req as any).user?.uid;
    
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or decline' });
    }

    const [booking] = await db
      .select()
      .from(sitterBookings)
      .where(eq(sitterBookings.bookingId, bookingId));
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.status !== 'pending_provider') {
      return res.status(400).json({ error: `Booking is already ${booking.status}` });
    }

    // Verify the responder is the provider for this booking
    const [sitter] = await db
      .select()
      .from(sitterProfiles)
      .where(eq(sitterProfiles.id, booking.sitterId));
    
    if (!sitter || sitter.userId !== providerUid) {
      return res.status(403).json({ error: 'Only the assigned provider can respond to this booking' });
    }
    
    if (action === 'accept') {
      // PROVIDER ACCEPTED - Process payment using owner's stored payment method
      // Provider does NOT supply payment token - we use the owner's Nayax account
      const pricePerDayCents = Math.round(booking.totalChargeCents / booking.totalDays);
      
      let paymentResult = { success: false, nayaxTransactionId: '', error: '' };
      try {
        paymentResult = await nayaxSitterMarketplace.processBookingPayment({
          bookingId: booking.bookingId,
          ownerId: booking.ownerId,
          sitterId: booking.sitterId,
          pricePerDayCents,
          totalDays: booking.totalDays,
        });
      } catch (paymentErr: any) {
        logger.error('[Sitter Suite] Payment capture on accept failed', { bookingId, error: paymentErr.message });
      }

      // Only confirm if payment was successful
      if (!paymentResult.success) {
        logger.error('[Sitter Suite] Cannot confirm booking - payment capture failed', { bookingId });
        await db
          .update(sitterBookings)
          .set({
            status: 'payment_failed',
            paymentStatus: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(sitterBookings.bookingId, bookingId));
        
        return res.status(400).json({
          success: false,
          status: 'payment_failed',
          message: 'חיוב התשלום נכשל. ההזמנה לא אושרה.',
          error: paymentResult.error || 'Payment capture failed',
        });
      }

      // Payment succeeded - confirm booking with escrow
      await sitterAdvancedBookingEngine.confirmBooking(
        booking.bookingId,
        {
          subtotal: booking.basePriceCents / 100,
          platformFee: booking.platformServiceFeeCents / 100,
          providerPayout: booking.sitterPayoutCents / 100,
          totalPrice: booking.totalChargeCents / 100,
          loyaltyDiscount: 0,
          currency: 'ILS',
          breakdown: [],
        },
        booking.ownerId
      );

      await db
        .update(sitterBookings)
        .set({
          status: 'confirmed',
          paymentStatus: 'captured',
          nayaxTransactionId: paymentResult.nayaxTransactionId || null,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sitterBookings.bookingId, bookingId));
      
      logger.info('[Sitter Suite] ✅ Provider ACCEPTED booking - payment captured', { bookingId, sitterId: sitter.id });

      calendarIntegrationService.createBookingEvent({
        platform: 'sitter-suite',
        bookingId: booking.bookingId,
        title: `⁦The Sitter Suite™⁩ - Pet Sitting (${booking.totalDays} days)`,
        description: `Pet sitting booking confirmed for ${booking.totalDays} day(s)`,
        startTime: new Date(booking.startDate),
        endTime: new Date(booking.endDate),
        providerName: `${sitter.firstName} ${sitter.lastName}`,
      }).catch(() => {});

      // Generate Israeli digital receipt (non-blocking)
      try {
        await IsraeliDigitalReceiptService.generateReceipt({
          platform: 'sitter-suite',
          bookingId: booking.bookingId,
          nayaxTransactionId: paymentResult.nayaxTransactionId,
          customerEmail: '',
          customerName: '',
          providerName: `${sitter.firstName} ${sitter.lastName}`,
          providerId: sitter.id.toString(),
          providerType: 'sitter',
          serviceDescription: `Pet sitting - ${booking.totalDays} day(s)`,
          serviceDescriptionHe: `שמרטפות - ${booking.totalDays} ${booking.totalDays === 1 ? 'יום' : 'ימים'}`,
          subtotalAmount: booking.basePriceCents / 100,
          platformFeeAmount: booking.platformServiceFeeCents / 100,
          totalAmount: booking.totalChargeCents / 100,
          paymentMethod: 'Nayax Card Payment',
          providerPayoutAmount: booking.sitterPayoutCents / 100,
          brokerCommissionAmount: booking.platformServiceFeeCents / 100,
        });
      } catch (receiptErr) {
        logger.warn('[Sitter Suite] Receipt generation after accept failed (non-blocking)', receiptErr);
      }

      // Record in P&L ledger (VAT accounting - non-blocking)
      try {
        await VATCalculatorService.recordTransaction(
          'sitter-suite',
          paymentResult.nayaxTransactionId || booking.bookingId,
          booking.basePriceCents / 100,
          booking.bookingId,
          {
            sitterId: booking.sitterId,
            totalDays: booking.totalDays,
          }
        );
      } catch (vatErr) {
        logger.warn('[Sitter Suite] VAT ledger recording after accept failed (non-blocking)', vatErr);
      }
      
      res.json({
        success: true,
        status: 'confirmed',
        message: 'ההזמנה אושרה! הלקוח/ה קיבל/ה הודעה.',
        booking: { ...booking, status: 'confirmed', confirmedAt: new Date() },
      });
      
    } else {
      // PROVIDER DECLINED
      await db
        .update(sitterBookings)
        .set({
          status: 'declined',
          cancellationReason: declineReason || 'Provider declined the booking request',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sitterBookings.bookingId, bookingId));
      
      logger.info('[Sitter Suite] ❌ Provider DECLINED booking', { bookingId, reason: declineReason });
      
      res.json({
        success: true,
        status: 'declined',
        message: 'ההזמנה נדחתה. הלקוח/ה יקבל/תקבל הודעה.',
      });
    }
  } catch (error) {
    logger.error('[Sitter Suite] Provider respond error', error);
    res.status(500).json({ error: 'Failed to process provider response' });
  }
});

/**
 * GET /api/sitter-suite/bookings/provider-pending
 * Get all pending booking requests for the authenticated provider
 */
router.get('/bookings/provider-pending', requireAuth, async (req, res) => {
  try {
    const providerUid = (req as any).user?.uid;
    
    const [sitter] = await db
      .select()
      .from(sitterProfiles)
      .where(eq(sitterProfiles.userId, providerUid));
    
    if (!sitter) {
      return res.json({ bookings: [] });
    }
    
    const pendingBookings = await db
      .select()
      .from(sitterBookings)
      .where(
        and(
          eq(sitterBookings.sitterId, sitter.id),
          eq(sitterBookings.status, 'pending_provider')
        )
      )
      .orderBy(desc(sitterBookings.createdAt));
    
    res.json({ bookings: pendingBookings, total: pendingBookings.length });
  } catch (error) {
    logger.error('[Sitter Suite] Fetch provider pending error', error);
    res.status(500).json({ error: 'Failed to fetch pending bookings' });
  }
});

/**
 * GET /api/sitter-suite/bookings - Get user's bookings
 */
router.get('/bookings', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const role = req.query.role as 'owner' | 'sitter'; // owner or sitter
    
    if (!userId || !role) {
      return res.status(400).json({ error: 'userId and role required' });
    }
    
    let bookings;
    
    if (role === 'owner') {
      bookings = await db
        .select()
        .from(sitterBookings)
        .where(eq(sitterBookings.ownerId, userId))
        .orderBy(desc(sitterBookings.createdAt));
    } else {
      // Get sitter profile first
      const [sitterProfile] = await db
        .select()
        .from(sitterProfiles)
        .where(eq(sitterProfiles.userId, userId));
      
      if (!sitterProfile) {
        return res.json([]);
      }
      
      bookings = await db
        .select()
        .from(sitterBookings)
        .where(eq(sitterBookings.sitterId, sitterProfile.id))
        .orderBy(desc(sitterBookings.createdAt));
    }
    
    res.json(bookings);
  } catch (error) {
    logger.error('[Sitter Suite] Error fetching bookings', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * PATCH /api/sitter-suite/bookings/:id/complete - Complete booking and trigger sitter payout
 * Israeli Law 2026: Applies withholding tax (ניכוי מס במקור), records commission, generates settlement
 * Subcontractor model (like Wolt Israel) - providers are independent contractors
 */
router.patch('/bookings/:id/complete', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    
    const [booking] = await db
      .select()
      .from(sitterBookings)
      .where(eq(sitterBookings.id, bookingId));
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Fetch sitter profile for tax info
    const [sitter] = await db
      .select()
      .from(sitterProfiles)
      .where(eq(sitterProfiles.id, booking.sitterId));

    // STEP 1: Calculate provider settlement with Israeli law deductions
    const grossPayoutCents = booking.sitterPayoutCents;
    const grossPayoutILS = grossPayoutCents / 100;
    const customerPaidILS = booking.totalChargeCents / 100;

    const settlementResult = await IsraeliDigitalReceiptService.recordProviderSettlement({
      bookingId: booking.bookingId,
      providerId: booking.sitterId.toString(),
      providerType: 'sitter',
      grossPayoutAmount: grossPayoutILS,
      hasWithholdingExemption: false,
      customerPaidAmount: customerPaidILS,
      bookingDbId: booking.id,
      commissionRate: 7.5,
    });

    if (!settlementResult.success) {
      logger.error('[Sitter Suite] Settlement recording failed', {
        bookingId: booking.bookingId,
        error: settlementResult.error,
      });
    }

    // STEP 2: Process sitter payout (net after withholding tax)
    const netPayoutCents = settlementResult.settlement
      ? Math.round(settlementResult.settlement.netPaymentToProvider * 100)
      : grossPayoutCents;

    const payoutResult = await nayaxSitterMarketplace.processSitterPayout({
      bookingId: booking.bookingId,
      sitterId: booking.sitterId,
      sitterPayoutCents: netPayoutCents,
      sitterBankAccount: 'TBD',
    });
    
    if (!payoutResult.success) {
      return res.status(500).json({ error: 'Payout failed' });
    }
    
    // STEP 3: Update booking status
    const [updatedBooking] = await db
      .update(sitterBookings)
      .set({
        status: 'completed',
        payoutStatus: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sitterBookings.id, bookingId))
      .returning();
    
    logger.info('[Sitter Suite] ✅ Booking completed - Israeli law 2026 compliant', {
      bookingId: booking.bookingId,
      grossPayoutILS,
      withholdingTaxILS: settlementResult.settlement?.withholdingTaxAmount || 0,
      withholdingTaxRate: settlementResult.settlement?.withholdingTaxRate
        ? `${(settlementResult.settlement.withholdingTaxRate * 100).toFixed(0)}%`
        : 'N/A',
      netPayoutILS: settlementResult.settlement?.netPaymentToProvider || grossPayoutILS,
      brokerCommissionILS: settlementResult.settlement?.brokerCommission || 0,
      commissionId: settlementResult.commissionId,
      sitterName: sitter?.displayName || sitter?.firstName || 'Unknown',
    });
    
    res.json({
      ...updatedBooking,
      settlement: settlementResult.settlement ? {
        commissionId: settlementResult.commissionId,
        grossPayout: settlementResult.settlement.grossPayout,
        withholdingTaxDeducted: settlementResult.settlement.withholdingTaxAmount,
        withholdingTaxRate: `${(settlementResult.settlement.withholdingTaxRate * 100).toFixed(0)}%`,
        netPaymentToProvider: settlementResult.settlement.netPaymentToProvider,
        brokerCommission: settlementResult.settlement.brokerCommission,
      } : undefined,
    });
    
  } catch (error) {
    logger.error('[Sitter Suite] Error completing booking', error);
    res.status(500).json({ error: 'Failed to complete booking' });
  }
});

// ==================== REVIEWS ====================

/**
 * POST /api/sitter-suite/reviews - Submit review for completed booking
 */
router.post('/reviews', async (req, res) => {
  try {
    const validatedData = insertSitterReviewSchema.parse(req.body);
    
    const [newReview] = await db
      .insert(sitterReviews)
      .values(validatedData)
      .returning();
    
    // Update sitter's average rating
    const allReviews = await db
      .select()
      .from(sitterReviews)
      .where(eq(sitterReviews.sitterId, validatedData.sitterId));
    
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    
    await db
      .update(sitterProfiles)
      .set({ 
        rating: avgRating.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(sitterProfiles.id, validatedData.sitterId));
    
    logger.info('[Sitter Suite] Review submitted', {
      sitterId: validatedData.sitterId,
      rating: validatedData.rating,
      newAvgRating: avgRating.toFixed(2),
    });
    
    res.status(201).json(newReview);
  } catch (error) {
    logger.error('[Sitter Suite] Error submitting review', error);
    res.status(400).json({ error: 'Failed to submit review' });
  }
});

// ==================== PROXIMITY SEARCH (Like Uber) ====================

/**
 * POST /api/sitter-suite/search/nearby - Find sitters near user location
 * LOYALTY MEMBERS ONLY
 */
router.post('/search/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radiusKm, loyaltyTier } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location coordinates required' });
    }

    // CRITICAL: Verify loyalty membership (only verified members can book)
    const { proximitySearch } = await import('../services/SitterProximitySearch');
    const isEligible = await proximitySearch.isEligibleToBook(
      req.session?.userId || 'anonymous',
      loyaltyTier
    );

    if (!isEligible) {
      logger.warn('[Proximity Search] Non-loyalty member attempted search', {
        userId: req.session?.userId,
        loyaltyTier,
      });
      return res.status(403).json({
        error: 'Loyalty membership required',
        message: 'Join our loyalty program to book pet sitters',
      });
    }

    const sitters = await proximitySearch.findSittersNearby(
      { latitude, longitude },
      radiusKm || 25
    );

    logger.info('[Proximity Search] Sitters found nearby', {
      count: sitters.length,
      radiusKm: radiusKm || 25,
    });

    res.json(sitters);
  } catch (error) {
    logger.error('[Proximity Search] Error', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/sitter-suite/sitters/:id/reviews - Get Uber-style reviews for sitter
 */
router.get('/sitters/:id/reviews', async (req, res) => {
  try {
    const sitterId = parseInt(req.params.id);
    
    const reviews = await db
      .select()
      .from(sitterReviews)
      .where(eq(sitterReviews.sitterId, sitterId))
      .orderBy(desc(sitterReviews.createdAt))
      .limit(50);
    
    // Calculate rating breakdown (like Uber)
    const ratingCounts = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      reviews,
      stats: {
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
        ratingBreakdown: ratingCounts,
      },
    });
  } catch (error) {
    logger.error('[Sitter Suite] Error fetching reviews', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

export default router;
