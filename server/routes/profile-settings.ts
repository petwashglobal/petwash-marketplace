import { Router } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import admin from 'firebase-admin';
import { logger } from '../lib/logger';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

const profileUpdateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  birthdate: z.string().optional(),
  preferredLanguage: z.enum(['he', 'en', 'ar', 'ru', 'fr', 'es']).optional(),
});

const emailChangeRequestSchema = z.object({
  newEmail: z.string().email(),
});

const emailChangeConfirmSchema = z.object({
  verificationCode: z.string().length(6),
});


router.get('/settings/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const [user] = await db.select().from(users).where(eq(users.id, uid)).limit(1);

    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUser(uid);
    } catch (e) {
      return res.status(404).json({ error: 'User not found' });
    }

    let firestorePrefs: any = {};
    try {
      const firestore = admin.firestore();
      const userDoc = await firestore.collection('users').doc(uid).get();
      firestorePrefs = userDoc.data()?.notificationPreferences || {};
    } catch (e) {
      logger.warn('[ProfileSettings] Firestore fetch failed:', e);
    }

    const profile = {
      firstName: user?.firstName || firebaseUser.displayName?.split(' ')[0] || '',
      lastName: user?.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
      email: user?.email || firebaseUser.email || '',
      phone: user?.phone || firebaseUser.phoneNumber || '',
      address: firestorePrefs.address || '',
      city: firestorePrefs.city || '',
      birthdate: user?.dateOfBirth || '',
      photoURL: user?.profileImageUrl || firebaseUser.photoURL || '',
      preferredLanguage: user?.language || 'he',
      emailVerified: firebaseUser.emailVerified,
      createdAt: user?.createdAt || firebaseUser.metadata.creationTime,
      notificationPreferences: {
        pushEnabled: firestorePrefs.pushEnabled ?? true,
        emailEnabled: firestorePrefs.emailEnabled ?? true,
        smsEnabled: firestorePrefs.smsEnabled ?? true,
        marketingEnabled: firestorePrefs.marketingEnabled ?? true,
        reminderEnabled: firestorePrefs.reminderEnabled ?? true,
        birthdayOffersEnabled: firestorePrefs.birthdayOffersEnabled ?? true,
        loyaltyUpdatesEnabled: firestorePrefs.loyaltyUpdatesEnabled ?? true,
      },
    };

    res.json(profile);
  } catch (error: any) {
    logger.error('[ProfileSettings] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/settings/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const parseResult = profileUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
    }

    const updates = parseResult.data;
    const [existingUser] = await db.select().from(users).where(eq(users.id, uid)).limit(1);

    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUser(uid);
    } catch (e) {
      return res.status(404).json({ error: 'User not found' });
    }

    const changedFields: string[] = [];
    const previousValues: Record<string, any> = {};

    if (updates.firstName !== undefined && updates.firstName !== existingUser?.firstName) {
      changedFields.push('firstName');
      previousValues.firstName = existingUser?.firstName || '';
    }
    if (updates.lastName !== undefined && updates.lastName !== existingUser?.lastName) {
      changedFields.push('lastName');
      previousValues.lastName = existingUser?.lastName || '';
    }

    const updateData: Record<string, any> = {};
    if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.birthdate !== undefined) updateData.dateOfBirth = updates.birthdate;
    if (updates.preferredLanguage !== undefined) updateData.language = updates.preferredLanguage;

    if (updates.address !== undefined || updates.city !== undefined) {
      try {
        const firestore = admin.firestore();
        const firestoreUpdate: Record<string, any> = {};
        if (updates.address !== undefined) firestoreUpdate.address = updates.address;
        if (updates.city !== undefined) firestoreUpdate.city = updates.city;
        await firestore.collection('users').doc(uid).set(firestoreUpdate, { merge: true });
      } catch (e) {
        logger.warn('[ProfileSettings] Failed to save address/city to Firestore:', e);
      }
    }

    if (Object.keys(updateData).length > 0) {
      if (existingUser) {
        await db.update(users).set(updateData).where(eq(users.id, uid));
      } else {
        await db.insert(users).values({
          id: uid,
          email: firebaseUser.email || '',
          firstName: updates.firstName || firebaseUser.displayName?.split(' ')[0] || '',
          lastName: updates.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
          phone: updates.phone || firebaseUser.phoneNumber || '',
          address: updates.address || '',
          city: updates.city || '',
          dateOfBirth: updates.birthdate || '',
          profileImageUrl: firebaseUser.photoURL || '',
          language: updates.preferredLanguage || 'he',
        });
      }
    }

    if (changedFields.includes('firstName') || changedFields.includes('lastName')) {
      try {
        const firestore = admin.firestore();
        await firestore.collection('profile_change_audit').add({
          userId: uid,
          changedFields,
          previousValues,
          newValues: {
            firstName: updates.firstName,
            lastName: updates.lastName,
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          changeType: 'identity_update',
        });
        logger.info('[ProfileSettings] Identity change audit logged for user:', uid, 'fields:', changedFields);
      } catch (auditError) {
        logger.error('[ProfileSettings] Failed to log audit:', auditError);
      }
    }

    if (updates.firstName || updates.lastName) {
      try {
        const newDisplayName = [updates.firstName || existingUser?.firstName, updates.lastName || existingUser?.lastName]
          .filter(Boolean)
          .join(' ');
        await admin.auth().updateUser(uid, { displayName: newDisplayName });
      } catch (e) {
        logger.warn('[ProfileSettings] Failed to update Firebase displayName:', e);
      }
    }

    logger.info('[ProfileSettings] Profile updated for user:', uid);
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      identityChangeLogged: changedFields.length > 0,
    });
  } catch (error: any) {
    logger.error('[ProfileSettings] PATCH error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/settings/email/request-change', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const authTime = decodedToken.auth_time;
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
    
    if (authTime < fiveMinutesAgo) {
      logger.warn('[ProfileSettings] Email change denied - session too old for user:', uid);
      return res.status(403).json({ 
        error: 'Re-authentication required',
        message: 'Please sign out and sign in again before changing your email address.',
        code: 'REAUTH_REQUIRED',
      });
    }

    const parseResult = emailChangeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
    }

    const { newEmail } = parseResult.data;

    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUser(uid);
    } catch (e) {
      return res.status(404).json({ error: 'User not found' });
    }

    try {
      const existingUser = await admin.auth().getUserByEmail(newEmail);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    } catch (e: any) {
      if (e.code !== 'auth/user-not-found') {
        throw e;
      }
    }

    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const firestore = admin.firestore();
    
    await firestore.collection('pending_email_changes').doc(uid).set({
      newEmail,
      code: verificationCode,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      oldEmail: firebaseUser.email || '',
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    await firestore.collection('email_change_audit').add({
      userId: uid,
      oldEmail: firebaseUser.email,
      newEmail,
      status: 'requested',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    logger.info('[ProfileSettings] Email change requested for user:', uid, 'new email:', newEmail);
    if (process.env.NODE_ENV === 'development') {
      logger.info('[ProfileSettings] Verification code (DEV ONLY):', verificationCode);
    }

    res.json({
      success: true,
      message: 'Verification code sent to new email',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    logger.error('[ProfileSettings] Email change request error:', error);
    res.status(500).json({ error: 'Failed to initiate email change' });
  }
});

router.post('/settings/email/confirm-change', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const parseResult = emailChangeConfirmSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid verification code format' });
    }

    const { verificationCode } = parseResult.data;
    
    const firestore = admin.firestore();
    const pendingDoc = await firestore.collection('pending_email_changes').doc(uid).get();

    if (!pendingDoc.exists) {
      return res.status(400).json({ error: 'No pending email change request' });
    }

    const pending = pendingDoc.data() as any;
    const expiresAt = pending.expiresAt.toDate();

    if (new Date() > expiresAt) {
      await firestore.collection('pending_email_changes').doc(uid).delete();
      return res.status(400).json({ error: 'Verification code expired' });
    }

    if (pending.code !== verificationCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    await admin.auth().updateUser(uid, { email: pending.newEmail });

    await db.update(users).set({ email: pending.newEmail }).where(eq(users.id, uid));

    await firestore.collection('email_change_audit').add({
      userId: uid,
      oldEmail: pending.oldEmail,
      newEmail: pending.newEmail,
      status: 'completed',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    });

    await firestore.collection('pending_email_changes').doc(uid).delete();

    logger.info('[ProfileSettings] Email changed for user:', uid, 'from:', pending.oldEmail, 'to:', pending.newEmail);

    res.json({
      success: true,
      message: 'Email updated successfully',
      newEmail: pending.newEmail,
    });
  } catch (error: any) {
    logger.error('[ProfileSettings] Email change confirm error:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

router.patch('/settings/notifications', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const preferences = req.body;

    const firestore = admin.firestore();
    await firestore.collection('users').doc(uid).set({
      notificationPreferences: preferences,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    logger.info('[ProfileSettings] Notification preferences updated for user:', uid);
    res.json({ success: true, message: 'Notification preferences updated' });
  } catch (error: any) {
    logger.error('[ProfileSettings] Notifications update error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

router.get('/settings/change-history', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const firestore = admin.firestore();
    
    const profileChanges = await firestore.collection('profile_change_audit')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const emailChanges = await firestore.collection('email_change_audit')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const history = [
      ...profileChanges.docs.map(doc => ({
        id: doc.id,
        type: 'profile',
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || null,
      })),
      ...emailChanges.docs.map(doc => ({
        id: doc.id,
        type: 'email',
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || null,
      })),
    ].sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));

    res.json({ history });
  } catch (error: any) {
    logger.error('[ProfileSettings] Change history error:', error);
    res.status(500).json({ error: 'Failed to fetch change history' });
  }
});

router.post('/settings/phone/confirm-verification', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const firebaseUser = await admin.auth().getUser(uid);
    
    if (!firebaseUser.phoneNumber) {
      return res.status(400).json({ error: 'No phone number linked to account' });
    }

    await db.update(users).set({ 
      phone: firebaseUser.phoneNumber,
      updatedAt: new Date()
    }).where(eq(users.id, uid));

    const firestore = admin.firestore();
    await firestore.collection('phone_verification_audit').add({
      userId: uid,
      phone: firebaseUser.phoneNumber,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    logger.info('[ProfileSettings] Phone verified for user:', uid, 'phone:', firebaseUser.phoneNumber);

    res.json({
      success: true,
      phone: firebaseUser.phoneNumber,
      verified: true,
    });
  } catch (error: any) {
    logger.error('[ProfileSettings] Phone verification confirm error:', error);
    res.status(500).json({ error: 'Failed to confirm phone verification' });
  }
});

router.get('/settings/phone/status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const firebaseUser = await admin.auth().getUser(uid);
    
    res.json({
      phone: firebaseUser.phoneNumber || null,
      verified: !!firebaseUser.phoneNumber,
    });
  } catch (error: any) {
    logger.error('[ProfileSettings] Phone status error:', error);
    res.status(500).json({ error: 'Failed to get phone status' });
  }
});

export default router;
