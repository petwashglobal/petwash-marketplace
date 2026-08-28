import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import admin, { db as firestore } from '../lib/firebase-admin';
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
import { db as pgDb, pool } from '../db';
import { pets as pgPets } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

const router = Router();

// Pet photo upload — in-memory, image-only, max 5MB.
const petPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files are allowed')),
});

// ============================================
// PET PROFILE ROUTES
// ============================================

// Upload a pet photo → returns { photoUrl } the client then saves on the pet
// (POST/PATCH /api/pets carries photoUrl, which the schema persists for the Pet Passport).
router.post('/photo', validateFirebaseToken, (req, res, next) => {
  petPhotoUpload.single('photo')(req, res, (err: any) => {
    if (err) {
      const msg = err?.code === 'LIMIT_FILE_SIZE' ? 'File too large. Maximum size is 5MB.' : (err.message || 'Invalid file');
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    if (!req.file) return res.status(400).json({ error: 'No photo file provided' });

    const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const bucket = admin.storage().bucket();
    const fileName = `pet-photos/${uid}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
    const file = bucket.file(fileName);

    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype, metadata: { uploadedBy: uid, uploadedAt: new Date().toISOString() } },
    });
    try { await file.makePublic(); } catch (e) { logger.warn('[Pets] Could not make pet photo public', e); }

    const photoUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    logger.info('[Pets] Pet photo uploaded', { uid, fileName });
    return res.json({ success: true, photoUrl });
  } catch (error) {
    logger.error('[Pets] Pet photo upload failed', error);
    return res.status(500).json({ error: 'Failed to upload pet photo' });
  }
});

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

// Update pet.
//
// SECURITY (2026-08-22): previously spread `req.body` into the Firestore
// update after only stripping `uid / id / createdAt / deletedAt`. Ownership
// is structural (`PETS(uid, petId)` scopes to the caller's own bucket), so
// cross-user IDOR is not possible — but the caller could inject arbitrary
// unknown fields (e.g. `isVerifiedVIP`, `medicalWaiverAccepted`,
// `internalNote`, `temperamentArchived`) onto their own pet doc, silently
// planting trust flags that later flow through into provider-visible
// screens. Fix: run req.body through `insertPetProfileSchema.partial()` and
// write only fields the shared Zod contract knows about.
router.patch('/:petId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId } = req.params;

    const petRef = firestore.doc(FIRESTORE_PATHS.PETS(uid, petId));
    const doc = await petRef.get();

    if (!doc.exists || doc.data()?.deletedAt) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    // Allowlist the writable field set to what the shared Zod schema
    // recognises. Anything not on the schema (mystery `isVerifiedVIP`,
    // `internalNote`, etc.) is dropped by `.parse()` on a strict shape or
    // simply ignored on a lax one — either way, silent trust-flag
    // escalation is impossible.
    let parsed: Record<string, unknown>;
    try {
      parsed = insertPetProfileSchema.partial().parse(req.body ?? {}) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid pet data', details: err.errors });
      }
      throw err;
    }

    // uid is not a schema field the owner can flip via .partial() either
    // (schema defaults require it on Create, and Firestore path already
    // pins it), but defence-in-depth: never let a body-supplied uid land.
    delete (parsed as any).uid;

    const updates = {
      ...parsed,
      updatedAt: new Date(),
    };

    await petRef.update(updates);

    logger.info('Pet profile updated', { uid, petId, updates: Object.keys(updates) });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating pet', error);
    res.status(500).json({ error: 'Failed to update pet' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// CEO §22 (2026-08-28) — owner-controlled medical-share consent.
//
// buildServerSafetySnapshot / projectStoredSafetyForProvider both gate on the
// PostgreSQL pets row's medicalShareConsent + medicalDataPrivate columns —
// but until this endpoint existed no code path let the owner ACTUALLY FLIP
// those flags with an audit trail. Consent silently stayed at the DB
// default (false) forever, so bookings could never carry medical fields
// even when the owner wanted them shared.
//
// Contract:
//   POST /api/pets/:petId/consent { medicalShareConsent: boolean }
//   • Ownership verified (pets.userId === caller uid). Cross-user returns 404.
//   • Sets medicalShareConsent, mirrors medicalDataPrivate (private = !share),
//     stamps medicalConsentUpdatedAt = NOW() for audit.
//   • Fail-closed: on any DB error the endpoint returns 502 and the flag is
//     NOT updated. Medical data must never leak because a write half-succeeded.
//
// This is CEO §4 architecture — ACCOUNT/PET preference for now. Booking-
// scoped consent (§4 second half) is a future layer on top of this flag.
// ────────────────────────────────────────────────────────────────────────────
router.post('/:petId/consent', validateFirebaseToken, async (req, res) => {
  const uid = req.firebaseUser!.uid;
  // Accept EITHER shape:
  //   • numeric petId in the URL (Postgres pets.id) — direct hit
  //   • Firestore-shaped petId string in the URL AND petName in the body
  //     (Firestore pets and Postgres pets are separate stores today; the
  //     client's /api/pets renders Firestore, but booking-time consent
  //     lives on Postgres. Lookup by (uid, name) so the client can flip
  //     consent without knowing the Postgres row id).
  const rawParam = req.params.petId;
  const petIdNum = Number(rawParam);
  const isNumericId = Number.isFinite(petIdNum) && petIdNum > 0;
  const petName = typeof req.body?.petName === 'string' && req.body.petName.trim()
    ? req.body.petName.trim().slice(0, 120) : null;
  if (!isNumericId && !petName) {
    return res.status(400).json({
      error: 'Provide a numeric petId in the URL OR petName in the body',
      errorCode: 'PET_LOOKUP_KEY_REQUIRED',
    });
  }
  const raw = req.body?.medicalShareConsent;
  if (typeof raw !== 'boolean') {
    return res.status(400).json({
      error: 'medicalShareConsent must be a boolean',
      errorCode: 'CONSENT_MUST_BE_BOOL',
    });
  }
  try {
    const r = isNumericId
      ? await pool.query(
          `UPDATE pets
              SET medical_share_consent = $1,
                  medical_data_private  = $2,
                  medical_consent_updated_at = NOW(),
                  updated_at            = NOW()
            WHERE id = $3 AND user_id = $4`,
          [raw, !raw, petIdNum, uid],
        )
      : await pool.query(
          // Cross-store lookup by (user_id, name). Ownership WHERE
          // clause pins the caller, so a name collision across owners
          // cannot flip somebody else's pet.
          `UPDATE pets
              SET medical_share_consent = $1,
                  medical_data_private  = $2,
                  medical_consent_updated_at = NOW(),
                  updated_at            = NOW()
            WHERE user_id = $3 AND name = $4`,
          [raw, !raw, uid, petName],
        );
    if ((r.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: 'Pet not found', errorCode: 'PET_NOT_FOUND' });
    }
    logger.info('[Pets] medical-share consent updated', {
      uid, petIdRef: isNumericId ? `id:${petIdNum}` : `name:${petName}`,
      medicalShareConsent: raw,
    });
    return res.json({
      ok: true,
      medicalShareConsent: raw,
      medicalDataPrivate: !raw,
    });
  } catch (err: any) {
    logger.error('[Pets] consent update FAILED — flag NOT written', {
      uid, error: err?.message,
    });
    return res.status(502).json({
      error: 'Failed to update consent — please retry',
      errorCode: 'CONSENT_UPDATE_FAILED',
    });
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
  const adminEmail: string | undefined = req.firebaseUser?.email;
  const emailVerified: boolean = !!req.firebaseUser?.email_verified;

  // SECURITY 2026-05-24 (CRITICAL fix from audit finding S1):
  //   1. Pre-fix used `adminEmail?.includes('@petwash.co.il')` — a
  //      SUBSTRING match — so a Firebase account with email like
  //      `attacker@petwash.co.il.evil.com` matched and got admin read
  //      on every pet record (PII, medical notes, GPS-via-walker).
  //      `.includes` → `.endsWith` closes the substring escape.
  //   2. Pre-fix did NOT require `email_verified`. Firebase Auth allows
  //      signup with an arbitrary unverified email; the admin SDK does
  //      NOT auto-reject. We now require email_verified=true so an
  //      attacker can't claim *@petwash.co.il without proving inbox
  //      control.
  //   3. The env-driven SUPER_ADMIN_EMAILS allowlist is still honored
  //      and ALSO gated on email_verified.
  //
  // SECURITY 2026-06-12 (audit M1): the `|| endsWith('@petwash.co.il')`
  // wildcard meant ANY verified company mailbox could read every pet's
  // PII / medical notes on /admin/all. Removed — access is now the
  // SUPER_ADMIN_EMAILS allowlist only (same source as the rest of the
  // system). To grant a staffer access, add them to SUPER_ADMIN_EMAILS.
  if (!emailVerified || !adminEmail) {
    return res.status(403).json({ error: 'Admin access required (verified email)' });
  }
  const lowered = adminEmail.toLowerCase();
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAllowed = superAdminEmails.includes(lowered);
  if (isAllowed) {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
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

// GET /api/pets/:petId/health-events/:eventId/ics — auth required.
// Issue #153 Mission-3 PR-2: previously this route was mounted with no
// middleware and accepted `uid` from the query string, returning a private
// medical-event iCal payload (pet name + event title/date) for any UID an
// attacker could guess. The route now uses validateFirebaseToken and reads
// the UID from the verified token, scoping the read to the caller's own
// pet. The earlier dead collectionGroup probe at this site is removed —
// it never used its result.
router.get('/:petId/health-events/:eventId/ics', validateFirebaseToken, async (req, res) => {
  try {
    const { petId, eventId } = req.params;
    const uid = req.firebaseUser!.uid;
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
