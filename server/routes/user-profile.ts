import { Router } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { z } from 'zod';

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
  twoFactorEnabled: z.boolean().optional(),
});

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

    const [user] = await db.select().from(users).where(eq(users.id, uid)).limit(1);

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

    const {
      displayName, phone, birthdate, preferredLanguage,
      address, street, streetNumber, apartment, city, postalCode, country, latitude, longitude,
      addressIsTemporary, temporaryAddress, temporaryLat, temporaryLng, temporaryPostal,
      notificationPreferences,
    } = parseResult.data;

    const [existingUser] = await db.select().from(users).where(eq(users.id, uid)).limit(1);

    const updateData: Record<string, any> = {};
    
    if (displayName !== undefined) {
      const nameParts = displayName.split(' ');
      updateData.firstName = nameParts[0] || '';
      updateData.lastName = nameParts.slice(1).join(' ') || '';
    }
    if (phone !== undefined) updateData.phone = phone;
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

    if (Object.keys(updateData).length > 0) {
      if (existingUser) {
        await db.update(users).set(updateData).where(eq(users.id, uid));
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
    const transactions = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        invoiceNumber: data.invoiceNumber || `PW-${new Date().getFullYear()}-${d.id.slice(-6).toUpperCase()}`,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
      };
    });
    return res.json(transactions);
  } catch (err: any) {
    logger.error('[UserProfile] Transactions fetch error', err.message);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
