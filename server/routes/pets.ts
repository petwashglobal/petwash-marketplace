import { Router } from 'express';
import { db as firestore } from '../lib/firebase-admin';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { z } from 'zod';
import { FIRESTORE_PATHS, insertPetProfileSchema } from '@shared/firestore-schema';
import { logger } from '../lib/logger';

const router = Router();

// ============================================
// PET PROFILE ROUTES
// ============================================

// Get all pets for user
router.get('/', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    
    const petsRef = firestore.collection(FIRESTORE_PATHS.PETS(uid));
    const snapshot = await petsRef
      .where('deletedAt', '==', null)
      .orderBy('createdAt', 'desc')
      .get();
    
    const pets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      birthday: doc.data().birthday || null,
    }));
    
    res.json({ pets });
  } catch (error) {
    logger.error('Error fetching pets', error);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

// Get single pet
router.get('/:petId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId } = req.params;
    
    const petRef = firestore.doc(FIRESTORE_PATHS.PETS(uid, petId));
    const doc = await petRef.get();
    
    if (!doc.exists || doc.data()?.deletedAt) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    const data = doc.data()!;
    res.json({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    });
  } catch (error) {
    logger.error('Error fetching pet', error);
    res.status(500).json({ error: 'Failed to fetch pet' });
  }
});

// Create new pet
router.post('/', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    
    // Validate request body
    const petData = insertPetProfileSchema.parse({
      ...req.body,
      uid,
    });
    
    const petRef = firestore.collection(FIRESTORE_PATHS.PETS(uid)).doc();
    await petRef.set({
      ...petData,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    
    logger.info('Pet profile created', { uid, petId: petRef.id, name: petData.name });
    
    res.status(201).json({
      success: true,
      petId: petRef.id,
      pet: {
        id: petRef.id,
        ...petData,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid pet data', 
        details: error.errors 
      });
    }
    logger.error('Error creating pet', error);
    res.status(500).json({ error: 'Failed to create pet' });
  }
});

// Update pet
router.patch('/:petId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId } = req.params;
    
    const petRef = firestore.doc(FIRESTORE_PATHS.PETS(uid, petId));
    const doc = await petRef.get();
    
    if (!doc.exists || doc.data()?.deletedAt) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    // Validate birthday format if provided
    if (req.body.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.birthday)) {
      return res.status(400).json({ error: 'Birthday must be in YYYY-MM-DD format' });
    }
    
    const updates = {
      ...req.body,
      updatedAt: new Date(),
    };
    
    // Don't allow changing uid or id
    delete updates.uid;
    delete updates.id;
    delete updates.createdAt;
    delete updates.deletedAt;
    
    await petRef.update(updates);
    
    logger.info('Pet profile updated', { uid, petId, updates: Object.keys(updates) });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating pet', error);
    res.status(500).json({ error: 'Failed to update pet' });
  }
});

// Delete pet (soft delete)
router.delete('/:petId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId } = req.params;
    
    const petRef = firestore.doc(FIRESTORE_PATHS.PETS(uid, petId));
    const doc = await petRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    await petRef.update({
      deletedAt: new Date(),
      updatedAt: new Date(),
    });
    
    logger.info('Pet profile soft-deleted', { uid, petId });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting pet', error);
    res.status(500).json({ error: 'Failed to delete pet' });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

const isAdmin = (req: any, res: any, next: any) => {
  const adminEmail = req.firebaseUser?.email;
  if (adminEmail === 'nirhadad1@gmail.com' || adminEmail?.includes('@petwash.co.il')) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// Admin: Get all pets (read-only)
router.get('/admin/all', validateFirebaseToken, isAdmin, async (req, res) => {
  try {
    const { uid } = req.query;
    
    if (uid) {
      // Get pets for specific user
      const petsRef = firestore.collection(FIRESTORE_PATHS.PETS(uid as string));
      const snapshot = await petsRef.get();
      
      const pets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        deletedAt: doc.data().deletedAt?.toDate() || null,
      }));
      
      return res.json(pets);
    }
    
    // TODO: Implement pagination for all pets
    res.json({ message: 'Use uid query parameter to get pets for specific user' });
  } catch (error) {
    logger.error('Error fetching all pets (admin)', error);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

export default router;
