import { Router } from 'express';
import { db as firestore } from '../lib/firebase-admin';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { z } from 'zod';
import { FIRESTORE_PATHS, insertPetProfileSchema } from '@shared/firestore-schema';
import { logger } from '../lib/logger';
import {
  stripMedicalFields,
  withOwnerMedicalFields,
  filterPetForProvider,
  filterPetPublic,
} from '../lib/petPrivacy';

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
    
    const pets = snapshot.docs.map(doc => {
      const raw = {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        birthday: doc.data().birthday || null,
      };
      // Owners see all non-internal fields including their own medical data.
      // Internal audit fields (temperamentArchived) are still stripped.
      return withOwnerMedicalFields(raw);
    });
    
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
    // The pet owner receives their own data with medical fields included,
    // but internal audit fields (temperamentArchived) are stripped.
    const petForOwner = withOwnerMedicalFields({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    });
    res.json(petForOwner);
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
  // SECURITY (T07): Use env-driven super-admin list instead of hardcoded personal email
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if ((adminEmail && superAdminEmails.includes(adminEmail.toLowerCase())) || adminEmail?.includes('@petwash.co.il')) {
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
      
      const pets = snapshot.docs.map(doc => {
        // Admin view retains medical fields to support welfare checks.
        // Internal archive fields (temperamentArchived) are still stripped.
        const raw = {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          deletedAt: doc.data().deletedAt?.toDate() || null,
        };
        return withOwnerMedicalFields(raw);
      });
      
      return res.json(pets);
    }
    
    // Paginated cross-user pet list (admin)
    const limit  = Math.min(parseInt(req.query.limit  as string || '50', 10), 200);
    const offset = parseInt(req.query.offset as string || '0',  10);

    // Firestore doesn't support cross-collection queries natively;
    // Use the collectionGroup API if pets are stored per-user subcollections.
    // Fall back to a structured response guiding admins to use uid param.
    res.json({
      message: 'Cross-user pet listing requires a uid query parameter.',
      hint: 'Pass ?uid=<userId> to retrieve pets for a specific user. Pagination: ?limit=50&offset=0',
      pagination: { limit, offset },
    });
  } catch (error) {
    logger.error('Error fetching all pets (admin)', error);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

// ============================================
// PET INTAKE FORM (pre-booking health declaration)
// ============================================
router.post('/intake-form', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const data = req.body;
    if (!data.signatureName || !data.consentToTreatment || !data.consentToEmergencyVet) {
      return res.status(400).json({ error: 'Missing required consents or signature' });
    }
    const submissionId = `intake_${uid}_${Date.now()}`;
    await firestore.collection('pet_intake_forms').doc(submissionId).set({
      uid,
      submissionId,
      ...data,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
      submittedAt: new Date(),
      status: 'submitted',
    });
    logger.info('[PetIntake] Form submitted', { uid, submissionId, petName: data.petName });
    return res.json({ ok: true, submissionId });
  } catch (error) {
    logger.error('[PetIntake] Error', error);
    return res.status(500).json({ error: 'Failed to submit intake form' });
  }
});

// GET user's intake form history
router.get('/intake-forms', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const snap = await firestore.collection('pet_intake_forms')
      .where('uid', '==', uid)
      .orderBy('submittedAt', 'desc')
      .limit(20)
      .get();
    const forms = snap.docs.map(d => ({ id: d.id, ...d.data(), submittedAt: d.data().submittedAt?.toDate() }));
    return res.json({ forms });
  } catch (error) {
    logger.error('[PetIntake] Error fetching', error);
    return res.status(500).json({ error: 'Failed to fetch intake forms' });
  }
});

// ============================================
// PET HEALTH EVENTS — calendar-ready records
// ============================================

const healthEventSchema = z.object({
  type: z.enum(['vaccination', 'vet_visit', 'medication', 'deworming', 'grooming', 'reminder']),
  title: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
  nextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reminderEnabled: z.boolean().default(true),
});

/** Build a Google Calendar deeplink from a health event */
function buildHealthEventCalendarLink(event: {
  title: string; date: string; notes?: string; type: string;
}, petName: string): string {
  const dateStr = event.date.replace(/-/g, '');
  const emoji: Record<string, string> = {
    vaccination: '💉', vet_visit: '🏥', medication: '💊',
    deworming: '🐛', grooming: '✂️', reminder: '📅',
  };
  const icon = emoji[event.type] || '📅';
  const title = encodeURIComponent(`${icon} ${petName} — ${event.title}`);
  const details = encodeURIComponent(
    `${event.notes ? event.notes + '\n\n' : ''}` +
    `🐾 PetWash™ Pet Health Tracker\nhttps://petwash.co.il/pets`
  );
  return (
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}&dates=${dateStr}/${dateStr}&details=${details}`
  );
}

/** Build an RFC 5545 iCalendar file string for iOS/macOS Calendar */
function buildICS(event: {
  title: string; date: string; notes?: string; type: string; id: string;
}, petName: string): string {
  const emoji: Record<string, string> = {
    vaccination: '💉', vet_visit: '🏥', medication: '💊',
    deworming: '🐛', grooming: '✂️', reminder: '📅',
  };
  const icon = emoji[event.type] || '📅';
  const dateStr = event.date.replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `${event.id}@petwash.co.il`;
  const summary = `${icon} ${petName} — ${event.title}`;
  const description = (event.notes || '') + '\\nPetWash™ Pet Health Tracker';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PetWash//PetHealth//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${dateStr}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// GET /api/pets/:petId/health-events
router.get('/:petId/health-events', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId } = req.params;
    const snap = await firestore
      .collection(`users/${uid}/pets/${petId}/health_events`)
      .orderBy('date', 'desc')
      .limit(50)
      .get();
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ events });
  } catch (error) {
    logger.error('[PetHealth] Error fetching events', error);
    return res.status(500).json({ error: 'Failed to fetch health events' });
  }
});

// POST /api/pets/:petId/health-events
router.post('/:petId/health-events', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId } = req.params;
    const data = healthEventSchema.parse(req.body);

    // Verify pet belongs to user
    const petDoc = await firestore.doc(`users/${uid}/pets/${petId}`).get();
    if (!petDoc.exists || petDoc.data()?.deletedAt) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    const petName: string = petDoc.data()?.name || 'Pet';

    const ref = await firestore
      .collection(`users/${uid}/pets/${petId}/health_events`)
      .add({ ...data, petId, createdAt: new Date().toISOString() });

    const eventId = ref.id;
    const calendarLink = buildHealthEventCalendarLink(data, petName);
    const icsUrl = `/api/pets/${petId}/health-events/${eventId}/ics`;

    logger.info('[PetHealth] Event created', { uid, petId, type: data.type });
    return res.status(201).json({ id: eventId, ...data, calendarLink, icsUrl });
  } catch (error: any) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: error.errors });
    logger.error('[PetHealth] Error creating event', error);
    return res.status(500).json({ error: 'Failed to create health event' });
  }
});

// DELETE /api/pets/:petId/health-events/:eventId
router.delete('/:petId/health-events/:eventId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId, eventId } = req.params;
    await firestore.doc(`users/${uid}/pets/${petId}/health_events/${eventId}`).delete();
    return res.json({ ok: true });
  } catch (error) {
    logger.error('[PetHealth] Error deleting event', error);
    return res.status(500).json({ error: 'Failed to delete health event' });
  }
});

// GET /api/pets/:petId/health-events/:eventId/ics — public, no auth (share-friendly)
router.get('/:petId/health-events/:eventId/ics', async (req, res) => {
  try {
    const { petId, eventId } = req.params;
    // We need uid — encode it in the event's stored data, or look it up via Firestore Group query
    const snap = await firestore.collectionGroup('health_events')
      .where(firestore.FieldPath.documentId(), '==',
        firestore.collection('placeholder').doc(eventId).id.length > 0 ? eventId : eventId)
      .limit(1)
      .get();
    // Fallback: let caller include uid as query param (lightweight approach)
    const uid = req.query.uid as string;
    if (!uid) return res.status(400).json({ error: 'uid required' });
    const doc = await firestore.doc(`users/${uid}/pets/${petId}/health_events/${eventId}`).get();
    if (!doc.exists) return res.status(404).send('Event not found');
    const ev = doc.data()!;
    const petDoc = await firestore.doc(`users/${uid}/pets/${petId}`).get();
    const petName: string = petDoc.data()?.name || 'Pet';
    const icsContent = buildICS({ ...ev as any, id: eventId }, petName);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${petName}-health.ics"`);
    return res.send(icsContent);
  } catch (error) {
    logger.error('[PetHealth] ICS generation error', error);
    return res.status(500).json({ error: 'Failed to generate ICS' });
  }
});

export default router;
