import { Router } from 'express';
import { db } from '../db';
import { users, purchases } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { encryptField, blindIndex } from '../services/secretFieldCrypto';
import { syncProfileAddressToBook } from '../lib/syncProfileAddressToBook';
import { decideMobileWrite } from './profile-settings';

const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  marketingEnabled: z.boolean().optional(),
  reminderEnabled: z.boolean().optional(),
  birthdayOffersEnabled: z.boolean().optional(),
  loyaltyUpdatesEnabled: z.boolean().optional(),
}).optional();

const profileUpdateSchema = z.object({
  displayName: z.string().optional(),
  phone: z.string().optional(),
  birthdate: z.string().optional(),
  preferredLanguage: z.string().optional(),
  // Permanent address
  address: z.string().optional(),
  street: z.string().optional(),
  streetNumber: z.string().optional(),
  apartment: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  // Temporary address (for users without permanent address / on the move)
  addressIsTemporary: z.boolean().optional(),
  temporaryAddress: z.string().optional(),
  temporaryLat: z.number().optional().nullable(),
  temporaryLng: z.number().optional().nullable(),
  temporaryPostal: z.string().optional(),
  email: z.string().email().optional(),
  photoURL: z.string().optional(),
  notificationPreferences: notificationPreferencesSchema,
  // Additional profile fields
  gender: z.string().optional(),
  idNumber: z.string().optional(),
  carPlate: z.string().optional(),
  carPlate2: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  marketingConsent: z.boolean().optional(),
  /**
   * DELIBERATELY NOT ACCEPTED HERE ANY MORE.
   *
   * `twoFactorEnabled` used to be a plain optional boolean on this schema,
   * applied straight into the UPDATE at the bottom of the handler. That let
   * ANY authenticated PATCH /api/user/profile turn a security control on or
   * off — bypassing mfa.ts entirely, which is where enabling 2FA actually
   * means something: an enable_2fa / disable_2fa challenge, TwoFactorAuthService
   * enrolment, and the metadata.action check that binds the verification to
   * the operation.
   *
   * A generic profile endpoint must never mutate security state. It is kept in
   * the schema only so the handler can refuse it with a message that says
   * where to go, rather than stripping it and returning a silent 200 that
   * looks like it worked.
   */
  twoFactorEnabled: z.boolean().optional(),
});

/**
 * Fields this endpoint refuses outright, with the canonical route to use.
 *
 * Silently ignoring them would be worse than refusing: the caller gets 200,
 * believes the security setting changed, and never finds out it did not.
 */
const SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW = {
  twoFactorEnabled: {
    code: 'TWO_FACTOR_REQUIRES_VERIFICATION',
    message:
      'Two-factor authentication cannot be changed from the profile endpoint. '
      + 'Use POST /api/mfa/enable or /api/mfa/disable, which require a verified challenge.',
  },
  email: {
    code: 'EMAIL_CHANGE_REQUIRES_VERIFICATION',
    message:
      'Email cannot be changed from the profile endpoint. '
      + 'Use POST /api/user/settings/email/request-change, which verifies the NEW address.',
  },
} as const;

const router = Router();

router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const firebaseUid = req.firebaseUser?.uid;
    
    let uid = firebaseUid;
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token, true);
        uid = decodedToken.uid;
      } catch (tokenError) {
        if (!uid) {
          return res.status(401).json({ error: 'Authentication required' });
        }
      }
    }

    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // PR-DANGER-8: explicit projection instead of SELECT *. The hand-typed
    // DTO literal at res.json below already filters to safe fields — but
    // SELECT * loaded EVERY column on `users` into server memory first
    // (including encrypted PII like idNumberEnc, national ID hash, bank-
    // related fields, and every future column added to the users table).
    // Any future refactor that spreads `user` into the response, or a
    // logger.debug that stringifies it, would auto-leak whatever the
    // schema has grown since. Projecting up-front means only the fields
    // this handler actually reads leave the database — a new PII column
    // never reaches this code path.
    const [user] = await db
      .select({
        firstName:             users.firstName,
        lastName:              users.lastName,
        email:                 users.email,
        phone:                 users.phone,
        address:               users.address,
        street:                users.street,
        streetNumber:          users.streetNumber,
        apartment:             users.apartment,
        city:                  users.city,
        postalCode:            users.postalCode,
        country:               users.country,
        latitude:              users.latitude,
        longitude:             users.longitude,
        addressIsTemporary:    users.addressIsTemporary,
        temporaryAddress:      users.temporaryAddress,
        temporaryLat:          users.temporaryLat,
        temporaryLng:          users.temporaryLng,
        temporaryPostal:       users.temporaryPostal,
        dateOfBirth:           users.dateOfBirth,
        profileImageUrl:       users.profileImageUrl,
        language:              users.language,
        gender:                users.gender,
        carPlate:              users.carPlate,
        carPlate2:             users.carPlate2,
        emergencyContactName:  users.emergencyContactName,
        emergencyContactPhone: users.emergencyContactPhone,
        marketingConsent:      users.marketingConsent,
        twoFactorEnabled:      users.twoFactorEnabled,
      })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    const defaultNotificationPrefs = {
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: true,
      marketingEnabled: true,
      reminderEnabled: true,
      birthdayOffersEnabled: true,
      loyaltyUpdatesEnabled: true,
    };

    let storedNotificationPrefs = {};
    try {
      const firestore = admin.firestore();
      const userPrefsDoc = await firestore.collection('users').doc(uid).get();
      storedNotificationPrefs = userPrefsDoc.data()?.notificationPreferences || {};
    } catch (firestoreError) {
      logger.warn('[UserProfile] Failed to fetch notification preferences from Firestore:', firestoreError);
    }

    const mergedNotificationPrefs = { ...defaultNotificationPrefs, ...storedNotificationPrefs };

    if (!user) {
      let firebaseUser;
      try {
        firebaseUser = await admin.auth().getUser(uid);
      } catch (e) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        displayName: firebaseUser.displayName || '',
        email: firebaseUser.email || '',
        phone: firebaseUser.phoneNumber || '',
        address: '',
        street: '',
        city: '',
        postalCode: '',
        country: 'IL',
        latitude: null,
        longitude: null,
        birthdate: '',
        photoURL: firebaseUser.photoURL || '',
        preferredLanguage: 'he',
        gender: '',
        carPlate: '',
        carPlate2: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        marketingConsent: false,
        twoFactorEnabled: false,
        notificationPreferences: mergedNotificationPrefs,
      });
    }

    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '';

    res.json({
      displayName,
      email: user.email || '',
      phone: user.phone || '',
      // Permanent address
      address: user.address || '',
      street: user.street || '',
      streetNumber: user.streetNumber || '',
      apartment: user.apartment || '',
      city: user.city || '',
      postalCode: user.postalCode || '',
      country: user.country || 'IL',
      latitude: user.latitude ? Number(user.latitude) : null,
      longitude: user.longitude ? Number(user.longitude) : null,
      // Temporary address
      addressIsTemporary: user.addressIsTemporary ?? false,
      temporaryAddress: user.temporaryAddress || '',
      temporaryLat: user.temporaryLat ? Number(user.temporaryLat) : null,
      temporaryLng: user.temporaryLng ? Number(user.temporaryLng) : null,
      temporaryPostal: user.temporaryPostal || '',
      birthdate: user.dateOfBirth || '',
      photoURL: user.profileImageUrl || '',
      preferredLanguage: user.language || 'he',
      // Extended profile fields — these are written by PATCH /profile but were
      // previously NOT returned here, so the edit form (hydrated from this GET)
      // rendered them blank after a reload and the user thought their save was
      // lost. They persisted fine; the read-back just omitted them. (2026-08-10)
      // NOTE: idNumber is deliberately still omitted — it is encrypted PII and is
      // never sent back to the client (see §5 money/PII invariants).
      gender: user.gender || '',
      carPlate: user.carPlate || '',
      carPlate2: user.carPlate2 || '',
      emergencyContactName: user.emergencyContactName || '',
      emergencyContactPhone: user.emergencyContactPhone || '',
      marketingConsent: user.marketingConsent ?? false,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      notificationPreferences: mergedNotificationPrefs,
    });
  } catch (error: any) {
    logger.error('[UserProfile] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const firebaseUid = req.firebaseUser?.uid;
    
    let uid = firebaseUid;
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token, true);
        uid = decodedToken.uid;
      } catch (tokenError) {
        if (!uid) {
          return res.status(401).json({ error: 'Authentication required' });
        }
      }
    }

    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parseResult = profileUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.flatten() });
    }

    // Security state is not profile data. Refuse loudly and name the route
    // that actually verifies the change, before touching anything.
    for (const [field, rule] of Object.entries(SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW)) {
      if ((req.body ?? {})[field] !== undefined) {
        logger.warn('[UserProfile] refused a security field on the generic profile PATCH', {
          uid, field, code: rule.code,
        });
        return res.status(400).json({ error: rule.message, code: rule.code });
      }
    }

    const {
      displayName, phone, birthdate, preferredLanguage,
      address, street, streetNumber, apartment, city, postalCode, country, latitude, longitude,
      addressIsTemporary, temporaryAddress, temporaryLat, temporaryLng, temporaryPostal,
      notificationPreferences,
      gender, idNumber, carPlate, carPlate2,
      emergencyContactName, emergencyContactPhone, marketingConsent,
    } = parseResult.data;

    // PR-DANGER-8: keep this projection MINIMAL — SELECT * would pull every
    // PII column into memory just to decide whether the row exists.
    //
    // `phone` is the one deliberate addition: decideMobileWrite() below needs
    // the current number to tell a first-set (allowed) from a change (refused).
    // Without it the guard reads `undefined` as "no number on file" and waves
    // every change through — which would be worse than having no guard, since
    // it would look like one.
    const [existingUser] = await db.select({ id: users.id, phone: users.phone })
      .from(users).where(eq(users.id, uid)).limit(1);

    const updateData: Record<string, any> = {};
    
    if (displayName !== undefined) {
      const nameParts = displayName.split(' ');
      updateData.firstName = nameParts[0] || '';
      updateData.lastName = nameParts.slice(1).join(' ') || '';
    }
    /**
     * THE BYPASS THIS CLOSES.
     *
     * This line used to be `updateData.phone = phone` — the raw request body
     * value written straight onto the canonical security phone number. The
     * sibling endpoint (PATCH /api/user/settings/profile) has guarded this
     * since the mobile-change audit via decideMobileWrite(); this one never
     * did, so the guard was one route away from being pointless.
     *
     * decideMobileWrite allows a FIRST set (a user with no number on file —
     * /booking-contact depends on that) and a same-number rewrite in a
     * different format, and refuses an actual CHANGE. A change now has to go
     * through the change_phone challenge, which proves control of the NEW
     * handset before it becomes the account's security number.
     */
    if (phone !== undefined) {
      const mobileDecision = decideMobileWrite(phone, existingUser?.phone);
      if (mobileDecision.action === 'reject') {
        const message = mobileDecision.code === 'INVALID_PHONE'
          ? 'That phone number is not valid.'
          : 'Changing your mobile number requires verifying the new number. '
            + 'Start a change_phone verification, then apply the change with the verified result.';
        logger.warn('[UserProfile] refused an unverified mobile write', {
          uid, code: mobileDecision.code,
        });
        return res.status(400).json({ error: message, code: mobileDecision.code });
      }
      if (mobileDecision.action === 'write') {
        updateData.phone = mobileDecision.phone;
      }
      // 'noop' — same subscriber, nothing to write.
    }
    if (birthdate !== undefined) updateData.dateOfBirth = birthdate;
    if (preferredLanguage !== undefined) updateData.language = preferredLanguage;
    // Permanent address
    if (address !== undefined) updateData.address = address;
    if (street !== undefined) updateData.street = street;
    if (streetNumber !== undefined) updateData.streetNumber = streetNumber;
    if (apartment !== undefined) updateData.apartment = apartment;
    if (city !== undefined) updateData.city = city;
    if (postalCode !== undefined) updateData.postalCode = postalCode;
    if (country !== undefined) updateData.country = country;
    if (latitude !== undefined) updateData.latitude = latitude !== null ? String(latitude) : null;
    if (longitude !== undefined) updateData.longitude = longitude !== null ? String(longitude) : null;
    // Temporary address
    if (addressIsTemporary !== undefined) updateData.addressIsTemporary = addressIsTemporary;
    if (temporaryAddress !== undefined) updateData.temporaryAddress = temporaryAddress;
    if (temporaryLat !== undefined) updateData.temporaryLat = temporaryLat !== null ? String(temporaryLat) : null;
    if (temporaryLng !== undefined) updateData.temporaryLng = temporaryLng !== null ? String(temporaryLng) : null;
    if (temporaryPostal !== undefined) updateData.temporaryPostal = temporaryPostal;
    // Extended profile fields
    if (gender !== undefined) updateData.gender = gender;
    if (idNumber !== undefined) {
      // National ID (Teudat Zehut) is sensitive PII — never store plaintext
      // (X-ray P1-6). Encrypt at rest + store a one-way blind index for the
      // identity-dedup lookup (findUsersByIdAndDob). The legacy plaintext
      // column is intentionally NOT written anymore.
      const idStr = String(idNumber).trim();
      if (idStr) {
        updateData.idNumberEnc = encryptField(idStr);
        updateData.idNumberHash = blindIndex(idStr);
      } else {
        updateData.idNumberEnc = null;
        updateData.idNumberHash = null;
      }
    }
    if (carPlate !== undefined) updateData.carPlate = carPlate;
    if (carPlate2 !== undefined) updateData.carPlate2 = carPlate2;
    if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone !== undefined) updateData.emergencyContactPhone = emergencyContactPhone;
    if (marketingConsent !== undefined) updateData.marketingConsent = marketingConsent;
    // twoFactorEnabled is refused above and never reaches an UPDATE from here.
    // See SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW.

    if (Object.keys(updateData).length > 0) {
      if (existingUser) {
        // CRIT-5 (save-integrity audit 2026-08-24): guard against silent no-op.
        // A .update().where() that matches ZERO rows still resolves — no throw,
        // no diagnostic. This is exactly the "profile edit doesn't stick"
        // symptom users have reported: the row was raced-deleted or the uid
        // was miscomputed, so nothing changes, and the API responds success:true.
        // .returning() + rowsAffected check makes the failure visible.
        const affected = await db.update(users).set(updateData).where(eq(users.id, uid)).returning({ id: users.id });
        if (affected.length === 0) {
          logger.warn('[UserProfile] update matched 0 rows — user row disappeared between preflight and write', { uid });
          return res.status(404).json({ error: 'User row not found; profile change was NOT saved.' });
        }
      } else {
        let firebaseUser;
        try {
          firebaseUser = await admin.auth().getUser(uid);
        } catch (e) {
          return res.status(404).json({ error: 'User not found in Firebase' });
        }

        const nameParts = (displayName || firebaseUser.displayName || '').split(' ');
        
        await db.insert(users).values({
          id: uid,
          email: firebaseUser.email || '',
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          phone: phone || firebaseUser.phoneNumber || '',
          dateOfBirth: birthdate || '',
          profileImageUrl: firebaseUser.photoURL || '',
          language: preferredLanguage || 'he',
          address: address || '',
          street: street || '',
          city: city || '',
          postalCode: postalCode || '',
          country: country || 'IL',
          latitude: latitude ? String(latitude) : null,
          longitude: longitude ? String(longitude) : null,
        });
      }
    }

    // Keep the saved-address book in sync so the profile address and the address
    // book can't silently disagree (board item #4). Only fires when this PATCH
    // actually carried an address (never on an unrelated save like a 2FA toggle),
    // and is fully fail-soft — it can never break the profile save above.
    if (address !== undefined || street !== undefined || city !== undefined) {
      const composed =
        address ||
        [[street, streetNumber].filter(Boolean).join(' '), city, postalCode]
          .filter(Boolean)
          .join(', ');
      await syncProfileAddressToBook(uid, {
        address: composed,
        street,
        streetNumber,
        apartment,
        city,
        postalCode,
        lat: latitude ?? undefined,
        lng: longitude ?? undefined,
      });
    }

    if (notificationPreferences) {
      try {
        const firestore = admin.firestore();
        const userPrefsRef = firestore.collection('users').doc(uid);
        const existingPrefs = (await userPrefsRef.get()).data()?.notificationPreferences || {};
        
        await userPrefsRef.set({
          notificationPreferences: {
            ...existingPrefs,
            ...notificationPreferences,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        
        logger.info('[UserProfile] Notification preferences saved to Firestore for user:', uid);
      } catch (firestoreError) {
        logger.warn('[UserProfile] Failed to save notification preferences to Firestore:', firestoreError);
      }
    }

    logger.info('[UserProfile] Profile updated for user:', uid);
    res.json({ success: true, message: 'Profile updated' });
  } catch (error: any) {
    if (error?.code === '23505' || error?.constraint === 'users_phone_unique') {
      return res.status(409).json({ error: 'Phone number already in use' });
    }
    logger.error('[UserProfile] PATCH error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/user/transactions — past transactions with invoice data
router.get('/transactions', async (req, res) => {
  const user = (req as any).firebaseUser || (req as any).user;
  if (!user?.uid) return res.status(401).json({ error: 'Unauthorized' });
  const uid = user.uid;
  try {
    const firestore = admin.firestore();
    const snap = await firestore.collection('transactions')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    // DTO round 2 (2026-08-22): previously spread `...data` — any
    // sumitCustomerId, stripeCustomerId, feeSnapshot, processor-debug
    // field on a transaction doc leaked to the buyer. Sibling handler
    // `/purchases` at line 466 already uses an explicit whitelist;
    // this one now matches it.
    const transactions = snap.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        invoiceNumber: data.invoiceNumber || `PW-${new Date().getFullYear()}-${d.id.slice(-6).toUpperCase()}`,
        type: data.type ?? null,
        description: data.description ?? null,
        amountCents: typeof data.amountCents === 'number' ? data.amountCents : null,
        currency: data.currency ?? 'ILS',
        status: data.status ?? null,
        method: data.method ?? null,
        cardBrand: data.cardBrand ?? null,
        cardLast4: data.cardLast4 ?? null,
        bookingId: data.bookingId ?? null,
        stationId: data.stationId ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt || null,
      };
    });
    return res.json(transactions);
  } catch (err: any) {
    logger.error('[UserProfile] Transactions fetch error', err.message);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/user/purchases — the buyer's own purchase history (wallet top-ups,
// eGift cards, wash packages, shop orders). Reads the CANONICAL `purchases`
// table — the real system-of-record — which until now had NO user-facing list
// (the only order screen pointed at a non-existent `shop_orders` table). This is
// a read-only, buyer-scoped browse: it never mutates money, and it deliberately
// returns only display-safe columns (no raw feeSnapshotJson / metadataJson,
// which can hold internal routing/PII). (2026-08-10)
router.get('/purchases', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let uid = req.firebaseUser?.uid;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token, true);
        uid = decodedToken.uid;
      } catch (tokenError) {
        if (!uid) return res.status(401).json({ error: 'Authentication required' });
      }
    }

    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const rows = await db
      .select()
      .from(purchases)
      .where(eq(purchases.buyerUserId, uid))
      .orderBy(desc(purchases.createdAt))
      .limit(100);

    // Whitelist the fields we expose — never spread the raw row.
    const items = rows.map((p) => ({
      id: p.id,
      surface: p.surface,
      productType: p.productType,
      amountCents: p.amountCents,
      vatCents: p.vatCents,
      currency: p.currency,
      status: p.status,
      paymentMethod: p.paymentMethod,
      receiptNumber: p.receiptNumber || null,
      transactionId: p.transactionId || null,
      isGift: !!p.receiverUserId && p.receiverUserId !== uid,
      createdAt: p.createdAt,
    }));

    return res.json({ purchases: items });
  } catch (error: any) {
    logger.error('[UserProfile] Purchases fetch error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

export default router;
