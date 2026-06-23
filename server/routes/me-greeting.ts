/**
 * server/routes/me-greeting.ts
 * Mounted at /api/me/greeting-context (Firebase auth).
 *
 * Feeds the smart homepage greeting the data it needs to celebrate:
 *   • the signed-in user's first name + birthday  (Postgres users.date_of_birth)
 *   • their pets' names + birthdays               (Firestore users/{uid}/pets)
 *
 * Both reads are independent + fault-tolerant: if one store is unreachable that
 * part is simply omitted (owner birthday still works without pets, and vice
 * versa). Day+month is all that matters for a birthday, so the client never
 * needs the birth year. READ-ONLY.
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { db as firestoreDb } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid) {
    // Not signed in — return an empty context so the client falls back to the
    // time-of-day greeting rather than erroring.
    return res.json({ ok: true, firstName: null, birthday: null, pets: [] });
  }

  let firstName: string | null = null;
  let birthday: string | null = null;
  try {
    const u = await db.query.users.findFirst({ where: eq(users.id, uid) });
    firstName = u?.firstName ?? null;
    birthday = (u as any)?.dateOfBirth ?? null;
  } catch (err: any) {
    logger.warn('[greeting-context] user read failed', { uid, error: err?.message });
  }

  let pets: Array<{ name: string; dob: string | null }> = [];
  try {
    const snap = await firestoreDb.collection(`users/${uid}/pets`).get();
    pets = snap.docs
      .map((d) => {
        const x = (d.data() || {}) as any;
        return { name: x.name || x.petName || 'Pet', dob: x.dateOfBirth || x.birthDate || x.dob || null };
      })
      .filter((p) => !!p.dob);
  } catch (err: any) {
    logger.warn('[greeting-context] pets read failed', { uid, error: err?.message });
  }

  res.json({ ok: true, firstName, birthday, pets });
});

export default router;
