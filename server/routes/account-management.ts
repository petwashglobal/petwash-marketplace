import { Router } from 'express';
import { db } from '../db';
import { users, walletAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { z } from 'zod';
import {
  revokeAppleSignInForAccountDeletion,
  summarizeAppleSignInRevocation,
} from '../services/appleSignInRevocation';

const router = Router();

/**
 * ⁦Pet Wash™⁩ Enterprise Account Management
 * 
 * Big-brand level account management with:
 * - 30-day grace period before permanent deletion
 * - Account freeze/unfreeze functionality
 * - E-gift non-transferability enforcement
 * - Credit forfeiture warnings
 * - Audit trail for all account actions
 */

// ==========================================
// ACCOUNT DELETION - ENTERPRISE GRADE
// ==========================================

const deleteAccountSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  confirmPhrase: z.literal('DELETE MY ACCOUNT'),
  acknowledgeCreditsLoss: z.literal(true),
  acknowledgeDataLoss: z.literal(true),
  acknowledgeEgiftForfeiture: z.literal(true),
});

router.post('/delete-request', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const parseResult = deleteAccountSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: parseResult.error.flatten(),
        required: {
          confirmPhrase: 'Must be exactly "DELETE MY ACCOUNT"',
          acknowledgeCreditsLoss: 'Must acknowledge loss of all credits',
          acknowledgeDataLoss: 'Must acknowledge loss of all data',
          acknowledgeEgiftForfeiture: 'Must acknowledge e-gift forfeiture (non-transferable)',
        }
      });
    }

    const { reason } = parseResult.data;

    // Fetch user's current wallet to show what they're forfeiting
    const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, uid)).limit(1);

    const forfeitedCredits = {
      egiftBalanceCents: wallet?.egiftBalanceCents || 0,
      washPackageCredits: wallet?.washPackageCredits || 0,
      loyaltyPointsBalance: wallet?.loyaltyPointsBalance || 0,
      promoBalanceCents: wallet?.promoBalanceCents || 0,
      referralBalanceCents: wallet?.referralBalanceCents || 0,
      totalValueCents: (wallet?.egiftBalanceCents || 0) + 
                       (wallet?.promoBalanceCents || 0) + 
                       (wallet?.referralBalanceCents || 0) +
                       ((wallet?.loyaltyPointsBalance || 0) * 10), // 1 point = 10 agorot
    };

    // Calculate deletion date (30-day grace period)
    const gracePeriodDays = 30;
    const scheduledDeletionDate = new Date();
    scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + gracePeriodDays);

    // Store deletion request in Firestore for audit trail
    const firestore = admin.firestore();
    const appleSignInRevocation = summarizeAppleSignInRevocation(
      await revokeAppleSignInForAccountDeletion(uid)
    );

    await firestore.collection('account_deletion_requests').doc(uid).set({
      userId: uid,
      email: decodedToken.email,
      reason: reason || 'No reason provided',
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      scheduledDeletionDate: admin.firestore.Timestamp.fromDate(scheduledDeletionDate),
      status: 'pending',
      forfeitedCredits,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      canCancel: true,
      cancelDeadline: admin.firestore.Timestamp.fromDate(scheduledDeletionDate),
      appleSignInRevocation,
    });

    // Mark user account as pending deletion in Firestore
    await firestore.collection('users').doc(uid).set({
      accountStatus: 'pending_deletion',
      deletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
      scheduledDeletionDate: admin.firestore.Timestamp.fromDate(scheduledDeletionDate),
    }, { merge: true });

    // Log audit trail
    await firestore.collection('audit_trail').add({
      userId: uid,
      action: 'ACCOUNT_DELETION_REQUESTED',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        gracePeriodDays,
        scheduledDeletionDate: scheduledDeletionDate.toISOString(),
        forfeitedCredits,
        reason: reason || 'No reason provided',
        appleSignInRevocation,
      },
      ipAddress: req.ip,
    });

    logger.info('[AccountManagement] Deletion request created:', { 
      uid, 
      scheduledDeletionDate: scheduledDeletionDate.toISOString(),
      forfeitedCredits,
      appleSignInRevocation,
    });

    const warnings = [
      'All e-gift card balances will be permanently forfeited (non-transferable)',
      'All loyalty points will be permanently deleted',
      'All wash package credits will be forfeited',
      'All booking history will be anonymized',
      'This action cannot be undone after the grace period',
    ];

    if (appleSignInRevocation.manualRevocationRequired) {
      warnings.push('Sign in with Apple access may require manual revocation from Apple ID settings.');
    }

    res.json({
      success: true,
      message: 'Account deletion scheduled',
      scheduledDeletionDate: scheduledDeletionDate.toISOString(),
      gracePeriodDays,
      canCancelUntil: scheduledDeletionDate.toISOString(),
      forfeitedCredits,
      appleSignInRevocation,
      warnings,
    });
  } catch (error: any) {
    logger.error('[AccountManagement] Deletion request error:', error);
    res.status(500).json({ error: 'Failed to process deletion request' });
  }
});

// DELETE /api/account/delete
// Called by ConsentOnboarding when user declines consent and wants immediate account removal.
// Does not require the full confirmation flow — just a valid Firebase session.
router.delete('/delete', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionCookie = (req as any).cookies?.pw_session;

    let uid: string;
    try {
      if (authHeader?.startsWith('Bearer ')) {
        const decodedToken = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1], true);
        uid = decodedToken.uid;
      } else if (sessionCookie) {
        const decodedCookie = await admin.auth().verifySessionCookie(sessionCookie, true);
        uid = decodedCookie.uid;
      } else {
        return res.status(401).json({ error: 'Authentication required' });
      }
    } catch {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Mark account as scheduled for deletion in DB
    await db.update(users).set({
      userStatus: 'pending_deletion',
      updatedAt: new Date(),
    } as any).where(eq(users.id, uid));

    const appleSignInRevocation = summarizeAppleSignInRevocation(
      await revokeAppleSignInForAccountDeletion(uid)
    );

    // Immediately disable the Firebase account so the user cannot log back in
    try {
      await admin.auth().updateUser(uid, { disabled: true });
    } catch (fbErr) {
      logger.warn('[AccountManagement] Could not disable Firebase account during consent-decline delete', { uid, fbErr });
    }

    logger.info('[AccountManagement] Consent-decline account deletion initiated', { uid, appleSignInRevocation });
    res.json({
      ok: true,
      message: 'Account deletion initiated. Your data will be removed within 30 days.',
      appleSignInRevocation,
    });
  } catch (error: any) {
    logger.error('[AccountManagement] Consent-decline delete error:', error);
    res.status(500).json({ error: 'Failed to process account deletion' });
  }
});

router.post('/cancel-deletion', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const firestore = admin.firestore();
    const deletionDoc = await firestore.collection('account_deletion_requests').doc(uid).get();

    if (!deletionDoc.exists) {
      return res.status(404).json({ error: 'No pending deletion request found' });
    }

    const deletionData = deletionDoc.data();
    if (deletionData?.status !== 'pending') {
      return res.status(400).json({ error: 'Deletion request cannot be cancelled - already processed' });
    }

    // Cancel the deletion request
    await firestore.collection('account_deletion_requests').doc(uid).update({
      status: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Restore account status
    await firestore.collection('users').doc(uid).set({
      accountStatus: 'active',
      deletionRequestedAt: null,
      scheduledDeletionDate: null,
    }, { merge: true });

    // Audit trail
    await firestore.collection('audit_trail').add({
      userId: uid,
      action: 'ACCOUNT_DELETION_CANCELLED',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip,
    });

    logger.info('[AccountManagement] Deletion cancelled:', { uid });

    res.json({
      success: true,
      message: 'Account deletion cancelled - your account is fully restored',
    });
  } catch (error: any) {
    logger.error('[AccountManagement] Cancel deletion error:', error);
    res.status(500).json({ error: 'Failed to cancel deletion' });
  }
});

// ==========================================
// ACCOUNT FREEZE - TEMPORARY SUSPENSION
// ==========================================

const freezeAccountSchema = z.object({
  reason: z.enum(['vacation', 'financial', 'temporary_break', 'other']),
  customReason: z.string().max(500).optional(),
  freezeDurationDays: z.number().min(1).max(365).optional(), // Max 1 year, null = indefinite
});

router.post('/freeze', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const parseResult = freezeAccountSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
    }

    const { reason, customReason, freezeDurationDays } = parseResult.data;

    // Check if account is already frozen
    const firestore = admin.firestore();
    const userDoc = await firestore.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (userData?.accountStatus === 'frozen') {
      return res.status(400).json({ error: 'Account is already frozen' });
    }

    if (userData?.accountStatus === 'pending_deletion') {
      return res.status(400).json({ error: 'Cannot freeze account pending deletion' });
    }

    // Calculate auto-unfreeze date if duration specified
    let scheduledUnfreezeDate: Date | null = null;
    if (freezeDurationDays) {
      scheduledUnfreezeDate = new Date();
      scheduledUnfreezeDate.setDate(scheduledUnfreezeDate.getDate() + freezeDurationDays);
    }

    // Freeze the account
    await firestore.collection('users').doc(uid).set({
      accountStatus: 'frozen',
      frozenAt: admin.firestore.FieldValue.serverTimestamp(),
      freezeReason: reason,
      freezeCustomReason: customReason || null,
      scheduledUnfreezeDate: scheduledUnfreezeDate 
        ? admin.firestore.Timestamp.fromDate(scheduledUnfreezeDate) 
        : null,
    }, { merge: true });

    // Audit trail
    await firestore.collection('audit_trail').add({
      userId: uid,
      action: 'ACCOUNT_FROZEN',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        reason,
        customReason: customReason || null,
        freezeDurationDays: freezeDurationDays || 'indefinite',
        scheduledUnfreezeDate: scheduledUnfreezeDate?.toISOString() || null,
      },
      ipAddress: req.ip,
    });

    logger.info('[AccountManagement] Account frozen:', { uid, reason, freezeDurationDays });

    res.json({
      success: true,
      message: 'Account frozen successfully',
      frozenAt: new Date().toISOString(),
      scheduledUnfreezeDate: scheduledUnfreezeDate?.toISOString() || null,
      preservedData: [
        'All credits and e-gift balances preserved',
        'Loyalty tier and points preserved',
        'Booking history preserved',
        'Pet profiles preserved',
      ],
      restrictions: [
        'Cannot make new bookings',
        'Cannot purchase e-gift cards',
        'Cannot earn loyalty points',
        'Login access maintained for account management only',
      ],
    });
  } catch (error: any) {
    logger.error('[AccountManagement] Freeze error:', error);
    res.status(500).json({ error: 'Failed to freeze account' });
  }
});

router.post('/unfreeze', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const firestore = admin.firestore();
    const userDoc = await firestore.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (userData?.accountStatus !== 'frozen') {
      return res.status(400).json({ error: 'Account is not frozen' });
    }

    // Unfreeze the account
    await firestore.collection('users').doc(uid).set({
      accountStatus: 'active',
      frozenAt: null,
      freezeReason: null,
      freezeCustomReason: null,
      scheduledUnfreezeDate: null,
      unfrozenAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Audit trail
    await firestore.collection('audit_trail').add({
      userId: uid,
      action: 'ACCOUNT_UNFROZEN',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip,
    });

    logger.info('[AccountManagement] Account unfrozen:', { uid });

    res.json({
      success: true,
      message: 'Account reactivated successfully - welcome back!',
      restoredAccess: [
        'Full booking access restored',
        'All credits available for use',
        'Loyalty points earning resumed',
      ],
    });
  } catch (error: any) {
    logger.error('[AccountManagement] Unfreeze error:', error);
    res.status(500).json({ error: 'Failed to unfreeze account' });
  }
});

// ==========================================
// ACCOUNT STATUS CHECK
// ==========================================

router.get('/status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const firestore = admin.firestore();
    const userDoc = await firestore.collection('users').doc(uid).get();
    const userData = userDoc.data();

    // Check for pending deletion
    const deletionDoc = await firestore.collection('account_deletion_requests').doc(uid).get();
    const deletionData = deletionDoc.exists ? deletionDoc.data() : null;

    // Fetch wallet for credit summary
    const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, uid)).limit(1);

    const accountStatus = userData?.accountStatus || 'active';
    
    const response: any = {
      status: accountStatus,
      credits: {
        egiftBalanceCents: wallet?.egiftBalanceCents || 0,
        washPackageCredits: wallet?.washPackageCredits || 0,
        loyaltyPointsBalance: wallet?.loyaltyPointsBalance || 0,
        promoBalanceCents: wallet?.promoBalanceCents || 0,
        referralBalanceCents: wallet?.referralBalanceCents || 0,
      },
      egiftTransferPolicy: {
        transferable: false,
        reason: 'E-gift cards are permanently tied to your account and cannot be transferred to other users',
        onDeletion: 'All e-gift balances will be forfeited upon account deletion',
      },
    };

    if (accountStatus === 'frozen') {
      response.frozenAt = userData?.frozenAt?.toDate?.()?.toISOString() || null;
      response.freezeReason = userData?.freezeReason || null;
      response.scheduledUnfreezeDate = userData?.scheduledUnfreezeDate?.toDate?.()?.toISOString() || null;
    }

    if (accountStatus === 'pending_deletion' && deletionData?.status === 'pending') {
      response.deletionRequestedAt = deletionData?.requestedAt?.toDate?.()?.toISOString() || null;
      response.scheduledDeletionDate = deletionData?.scheduledDeletionDate?.toDate?.()?.toISOString() || null;
      response.canCancelDeletion = true;
      response.forfeitedOnDeletion = deletionData?.forfeitedCredits || null;
    }

    res.json(response);
  } catch (error: any) {
    logger.error('[AccountManagement] Status check error:', error);
    res.status(500).json({ error: 'Failed to fetch account status' });
  }
});

// ==========================================
// E-GIFT NON-TRANSFERABILITY ENFORCEMENT
// ==========================================

router.post('/egift/transfer', async (req, res) => {
  // This endpoint exists to explicitly deny transfer requests
  return res.status(403).json({
    error: 'E-gift transfer not permitted',
    policy: {
      transferable: false,
      reason: '⁦Pet Wash™⁩ e-gift cards are permanently tied to your account and cannot be transferred',
      alternatives: [
        'Purchase a new e-gift card for the recipient',
        'Use your balance for services and pay for their booking separately',
      ],
      legalReference: '⁦Pet Wash™⁩ Terms of Service Section 7.3 - Gift Card Non-Transferability',
    },
  });
});

// ==========================================
// DATA EXPORT (GDPR Compliance)
// ==========================================

router.get('/export', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    // Fetch all user data for export
    const [user] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, uid)).limit(1);

    const firestore = admin.firestore();
    const userDoc = await firestore.collection('users').doc(uid).get();
    const petsSnapshot = await firestore.collection('users').doc(uid).collection('pets').get();

    const exportData = {
      exportDate: new Date().toISOString(),
      personalInfo: {
        displayName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '',
        email: user?.email || decodedToken.email || '',
        phone: user?.phone || '',
        dateOfBirth: user?.dateOfBirth || '',
        language: user?.language || 'he',
        createdAt: user?.createdAt || null,
      },
      creditWallet: wallet ? {
        egiftBalanceCents: wallet.egiftBalanceCents,
        washPackageCredits: wallet.washPackageCredits,
        loyaltyPointsBalance: wallet.loyaltyPointsBalance,
        loyaltyTier: wallet.loyaltyTier,
        tierPointsThisYear: wallet.tierPointsThisYear,
        promoBalanceCents: wallet.promoBalanceCents,
        referralBalanceCents: wallet.referralBalanceCents,
      } : null,
      accountStatus: userDoc.data()?.accountStatus || 'active',
      notificationPreferences: userDoc.data()?.notificationPreferences || {},
      pets: petsSnapshot.docs.map(doc => ({
        name: doc.data().name,
        species: doc.data().species,
        breed: doc.data().breed,
        birthday: doc.data().birthday,
      })),
      policies: {
        egiftTransfer: 'E-gift cards are non-transferable per Terms of Service Section 7.3',
        dataRetention: 'Data retained for 7 years per Israeli Privacy Law 2025',
      },
    };

    // Audit trail
    await firestore.collection('audit_trail').add({
      userId: uid,
      action: 'DATA_EXPORTED',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error: any) {
    logger.error('[AccountManagement] Data export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;
