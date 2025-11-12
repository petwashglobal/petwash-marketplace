import { Router } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { z } from 'zod';
import { db } from '../db';
import { petAvatars, insertPetAvatarSchema, type PetAvatar } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import multer from 'multer';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import { storage } from '../lib/firebase-admin';
import { getOutfitById, getAccessoryById } from '@shared/outfitLibrary';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// Initialize Gemini AI for image generation (Replit AI Integrations)
const genAI = new GoogleGenAI(
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY || ''
);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ============================================
// THE PLUSH LAB - PET AVATAR ROUTES
// ============================================

// PUBLIC ENDPOINT: Get all available avatar presets (No Auth Required)
// IMPORTANT: This must come BEFORE /:avatarId route to avoid conflict
router.get('/presets', async (req, res) => {
  try {
    const { AVATAR_PRESETS } = await import('../data/avatarPresets.js');
    
    logger.info('[Plush Lab] Presets requested', { count: AVATAR_PRESETS.length });
    
    res.status(200).json({
      success: true,
      presets: AVATAR_PRESETS,
      count: AVATAR_PRESETS.length,
    });
  } catch (error) {
    logger.error('[Plush Lab] Error fetching presets', error);
    res.status(500).json({ error: 'Failed to fetch presets' });
  }
});

// Get all avatars for current user
router.get('/', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    
    const avatars = await db
      .select()
      .from(petAvatars)
      .where(eq(petAvatars.userId, uid))
      .orderBy(desc(petAvatars.createdAt));
    
    res.json({ avatars });
  } catch (error) {
    logger.error('[Plush Lab] Error fetching avatars', error);
    res.status(500).json({ error: 'Failed to fetch avatars' });
  }
});

// Get single avatar by ID
router.get('/:avatarId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const avatarId = parseInt(req.params.avatarId);
    
    if (isNaN(avatarId)) {
      return res.status(400).json({ error: 'Invalid avatar ID' });
    }
    
    const [avatar] = await db
      .select()
      .from(petAvatars)
      .where(and(
        eq(petAvatars.id, avatarId),
        eq(petAvatars.userId, uid)
      ));
    
    if (!avatar) {
      return res.status(404).json({ error: 'Avatar not found' });
    }
    
    res.json({ avatar });
  } catch (error) {
    logger.error('[Plush Lab] Error fetching avatar', error);
    res.status(500).json({ error: 'Failed to fetch avatar' });
  }
});

// GUEST ENDPOINT: Create avatar preview without authentication or persistence
router.post('/guest', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required' });
    }
    
    // Validate pet name
    const petName = req.body.petName?.trim();
    if (!petName) {
      return res.status(400).json({ error: 'Pet name is required' });
    }
    
    // Process image (resize and create thumbnail)
    const processedImage = await sharp(req.file.buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    
    const thumbnailImage = await sharp(req.file.buffer)
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    // Convert to base64 data URLs for immediate display
    const photoDataUrl = `data:image/jpeg;base64,${processedImage.toString('base64')}`;
    const thumbnailDataUrl = `data:image/jpeg;base64,${thumbnailImage.toString('base64')}`;
    
    logger.info('[Plush Lab] Guest avatar created', { petName });
    
    // Return processed images as data URLs (no persistence)
    res.status(200).json({
      success: true,
      avatar: {
        id: 'guest-preview',
        petName,
        photoUrl: photoDataUrl,
        thumbnailUrl: thumbnailDataUrl,
        status: 'active',
        isGuest: true,
        message: 'Sign in to save your avatar permanently!',
      },
    });
  } catch (error) {
    logger.error('[Plush Lab] Error creating guest avatar', error);
    res.status(500).json({ error: 'Failed to create avatar' });
  }
});

// AI GENERATION ENDPOINT: Generate avatar from preset (PUBLIC - No Auth Required)
// Note: Currently returns placeholder; full implementation requires Gemini image generation model
router.post('/generate-from-preset', async (req, res) => {
  try {
    const { presetId, petName } = req.body;
    
    if (!presetId) {
      return res.status(400).json({ error: 'Preset ID is required' });
    }
    
    if (!petName?.trim()) {
      return res.status(400).json({ error: 'Pet name is required' });
    }
    
    // Import presets dynamically (server-side)
    const { AVATAR_PRESETS } = await import('../data/avatarPresets.js');
    const preset = AVATAR_PRESETS.find((p: any) => p.id === presetId);
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    logger.info('[Plush Lab AI] Preset selected', { 
      presetId, 
      petName: petName.trim(),
      style: preset.style 
    });
    
    // TODO: Implement Gemini 2.5 Flash Image generation when available
    // For now, return a styled response indicating the feature is coming soon
    
    res.status(200).json({
      success: true,
      avatar: {
        id: 'ai-preview-coming-soon',
        petName: petName.trim(),
        preset: {
          id: preset.id,
          label_en: preset.label_en,
          label_he: preset.label_he,
          style: preset.style,
          palette: preset.palette,
        },
        status: 'pending',
        message: 'AI avatar generation coming soon! For now, upload your pet photo.',
      },
    });
  } catch (error) {
    logger.error('[Plush Lab AI] Error with preset selection', error);
    res.status(500).json({ error: 'Failed to process preset' });
  }
});

// Create new avatar with photo upload (AUTHENTICATED)
router.post('/', validateFirebaseToken, upload.single('photo'), async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required' });
    }
    
    // Validate request body
    const petName = req.body.petName?.trim();
    if (!petName) {
      return res.status(400).json({ error: 'Pet name is required' });
    }
    
    const ttsVoice = req.body.ttsVoice || 'en-US-Neural2-A';
    const animationProfile = req.body.animationProfile ? 
      JSON.parse(req.body.animationProfile) : 
      { style: 'playful', intensity: 'medium', blinkRate: 3 };
    
    // PREMIUM CUSTOMIZATION (NEW)
    const characterType = req.body.characterType || 'pet';
    const outfitId = req.body.outfitId || null;
    const accessories = req.body.accessories ? JSON.parse(req.body.accessories) : [];
    const customization = req.body.customization ? 
      JSON.parse(req.body.customization) : 
      { colors: {}, patterns: {}, layering: [] };
    
    // VALIDATION: Verify outfit exists in library
    if (outfitId) {
      const outfit = getOutfitById(outfitId);
      if (!outfit) {
        return res.status(400).json({ error: `Invalid outfit ID: ${outfitId}` });
      }
      // Premium tier enforcement (server-side check)
      // TODO: Add user premium status check here when implemented
    }
    
    // VALIDATION: Verify all accessories exist in library
    if (accessories && accessories.length > 0) {
      for (const accessoryId of accessories) {
        const accessory = getAccessoryById(accessoryId);
        if (!accessory) {
          return res.status(400).json({ error: `Invalid accessory ID: ${accessoryId}` });
        }
        // Premium tier enforcement (server-side check)
        // TODO: Add user premium status check here when implemented
      }
    }
    
    // Generate unique filename
    const fileId = nanoid();
    const timestamp = Date.now();
    const bucket = storage().bucket();
    const originalFileName = `avatars/${uid}/${fileId}_${timestamp}_original.jpg`;
    const thumbnailFileName = `avatars/${uid}/${fileId}_${timestamp}_thumb.jpg`;
    
    // Process and upload original photo
    const processedImage = await sharp(req.file.buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    
    const originalFile = bucket.file(originalFileName);
    await originalFile.save(processedImage, {
      metadata: { contentType: 'image/jpeg' },
      public: true,
    });
    
    // Create thumbnail
    const thumbnailImage = await sharp(req.file.buffer)
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    const thumbnailFile = bucket.file(thumbnailFileName);
    await thumbnailFile.save(thumbnailImage, {
      metadata: { contentType: 'image/jpeg' },
      public: true,
    });
    
    const photoUrl = `https://storage.googleapis.com/${bucket.name}/${originalFileName}`;
    const thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${thumbnailFileName}`;
    
    // Create avatar record
    const [newAvatar] = await db
      .insert(petAvatars)
      .values({
        userId: uid,
        petName,
        photoUrl,
        thumbnailUrl,
        ttsVoice,
        animationProfile,
        characterType,
        outfitId,
        accessories,
        customization,
        status: 'processing', // Will be updated when landmarks are detected
      })
      .returning();
    
    logger.info('[Plush Lab] Avatar created', { 
      uid, 
      avatarId: newAvatar.id, 
      petName 
    });
    
    res.status(201).json({
      success: true,
      avatar: newAvatar,
    });
  } catch (error) {
    logger.error('[Plush Lab] Error creating avatar', error);
    res.status(500).json({ error: 'Failed to create avatar' });
  }
});

// Update avatar (landmarks, settings, etc.)
router.patch('/:avatarId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const avatarId = parseInt(req.params.avatarId);
    
    if (isNaN(avatarId)) {
      return res.status(400).json({ error: 'Invalid avatar ID' });
    }
    
    // Verify ownership
    const [existing] = await db
      .select()
      .from(petAvatars)
      .where(and(
        eq(petAvatars.id, avatarId),
        eq(petAvatars.userId, uid)
      ));
    
    if (!existing) {
      return res.status(404).json({ error: 'Avatar not found' });
    }
    
    // Build update object
    const updates: Partial<PetAvatar> = {
      updatedAt: new Date(),
    };
    
    if (req.body.petName) updates.petName = req.body.petName.trim();
    if (req.body.ttsVoice) updates.ttsVoice = req.body.ttsVoice;
    if (req.body.animationProfile) updates.animationProfile = req.body.animationProfile;
    if (req.body.landmarkConfig) updates.landmarkConfig = req.body.landmarkConfig;
    if (req.body.status) updates.status = req.body.status;
    
    // PREMIUM CUSTOMIZATION (NEW) - With Validation
    if (req.body.characterType) updates.characterType = req.body.characterType;
    
    // Outfit validation
    if (req.body.outfitId !== undefined) {
      if (req.body.outfitId !== null && req.body.outfitId !== '') {
        const outfit = getOutfitById(req.body.outfitId);
        if (!outfit) {
          return res.status(400).json({ error: `Invalid outfit ID: ${req.body.outfitId}` });
        }
      }
      updates.outfitId = req.body.outfitId;
    }
    
    // Accessories validation (fixed to allow clearing with empty array)
    if (req.body.accessories !== undefined) {
      const accessoryArray = Array.isArray(req.body.accessories) ? req.body.accessories : [];
      // Validate each accessory ID
      for (const accessoryId of accessoryArray) {
        const accessory = getAccessoryById(accessoryId);
        if (!accessory) {
          return res.status(400).json({ error: `Invalid accessory ID: ${accessoryId}` });
        }
      }
      updates.accessories = accessoryArray;
    }
    
    if (req.body.customization) updates.customization = req.body.customization;
    if (typeof req.body.isDefault === 'boolean') {
      updates.isDefault = req.body.isDefault;
      
      // If setting as default, unset other defaults
      if (req.body.isDefault) {
        await db
          .update(petAvatars)
          .set({ isDefault: false })
          .where(and(
            eq(petAvatars.userId, uid),
            eq(petAvatars.isDefault, true)
          ));
      }
    }
    
    const [updatedAvatar] = await db
      .update(petAvatars)
      .set(updates)
      .where(eq(petAvatars.id, avatarId))
      .returning();
    
    logger.info('[Plush Lab] Avatar updated', { uid, avatarId });
    
    res.json({
      success: true,
      avatar: updatedAvatar,
    });
  } catch (error) {
    logger.error('[Plush Lab] Error updating avatar', error);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// Delete avatar
router.delete('/:avatarId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const avatarId = parseInt(req.params.avatarId);
    
    if (isNaN(avatarId)) {
      return res.status(400).json({ error: 'Invalid avatar ID' });
    }
    
    // Verify ownership
    const [existing] = await db
      .select()
      .from(petAvatars)
      .where(and(
        eq(petAvatars.id, avatarId),
        eq(petAvatars.userId, uid)
      ));
    
    if (!existing) {
      return res.status(404).json({ error: 'Avatar not found' });
    }
    
    // Delete from database
    await db
      .delete(petAvatars)
      .where(eq(petAvatars.id, avatarId));
    
    // Clean up storage files (best effort, don't fail if they don't exist)
    try {
      const bucket = storage().bucket();
      if (existing.photoUrl) {
        const photoPath = existing.photoUrl.split(`${bucket.name}/`)[1];
        if (photoPath) await bucket.file(photoPath).delete().catch(() => {});
      }
      if (existing.thumbnailUrl) {
        const thumbPath = existing.thumbnailUrl.split(`${bucket.name}/`)[1];
        if (thumbPath) await bucket.file(thumbPath).delete().catch(() => {});
      }
    } catch (cleanupError) {
      logger.warn('[Plush Lab] Storage cleanup warning', cleanupError);
    }
    
    logger.info('[Plush Lab] Avatar deleted', { uid, avatarId });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('[Plush Lab] Error deleting avatar', error);
    res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

// Set default avatar
router.post('/:avatarId/set-default', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const avatarId = parseInt(req.params.avatarId);
    
    if (isNaN(avatarId)) {
      return res.status(400).json({ error: 'Invalid avatar ID' });
    }
    
    // Verify ownership
    const [existing] = await db
      .select()
      .from(petAvatars)
      .where(and(
        eq(petAvatars.id, avatarId),
        eq(petAvatars.userId, uid)
      ));
    
    if (!existing) {
      return res.status(404).json({ error: 'Avatar not found' });
    }
    
    // Unset all defaults first
    await db
      .update(petAvatars)
      .set({ isDefault: false })
      .where(and(
        eq(petAvatars.userId, uid),
        eq(petAvatars.isDefault, true)
      ));
    
    // Set this one as default
    const [updatedAvatar] = await db
      .update(petAvatars)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(petAvatars.id, avatarId))
      .returning();
    
    logger.info('[Plush Lab] Default avatar set', { uid, avatarId });
    
    res.json({
      success: true,
      avatar: updatedAvatar,
    });
  } catch (error) {
    logger.error('[Plush Lab] Error setting default avatar', error);
    res.status(500).json({ error: 'Failed to set default avatar' });
  }
});

export default router;
