/**
 * Data Subject Rights API - Israel Amendment 13 Compliance
 * Implements GDPR-like rights: access, deletion, portability, objection
 * ALL ENDPOINTS REQUIRE FIREBASE AUTHENTICATION
 */

import { Router } from 'express';
import { db as firestore } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { requireAuth } from '../customAuth';

const router = Router();

/**
 * POST /api/data-rights/access
 * User requests access to their personal data
 * REQUIRES: Authenticated user, can only access own data
 */
router.post('/access', requireAuth, async (req, res) => {
  try {
    // Get UID from authenticated session (Firebase auth)
    const uid = req.user?.uid;
    
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Collect all user data from Firestore
    const userData: any = {};
    
    // Get user profile
    const userDoc = await firestore.collection('users').doc(uid).get();
    if (userDoc.exists) {
      userData.profile = userDoc.data();
    }
    
    // Get user's pets
    const petsSnapshot = await firestore.collection('users').doc(uid)
      .collection('pets').get();
    userData.pets = petsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get user's loyalty data
    const loyaltyDoc = await firestore.collection('loyalty').doc(uid).get();
    if (loyaltyDoc.exists) {
      userData.loyalty = loyaltyDoc.data();
    }
    
    // Get user's inbox messages
    const inboxSnapshot = await firestore.collection('inbox')
      .where('customerId', '==', uid).get();
    userData.inbox = inboxSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get user's KYC data
    const kycDoc = await firestore.collection('kyc').doc(uid).get();
    if (kycDoc.exists) {
      userData.kyc = kycDoc.data();
    }
    
    logger.info(`Data access request fulfilled for user: ${uid}`);
    
    res.json({
      success: true,
      data: userData,
      message: 'Your personal data has been compiled',
      requestDate: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Data access request failed:', error);
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

/**
 * POST /api/data-rights/delete
 * User requests deletion of their data (Right to be forgotten)
 * REQUIRES: Authenticated user, can only delete own data
 */
router.post('/delete', requireAuth, async (req, res) => {
  try {
    // Get UID from authenticated session (Firebase auth)
    const uid = req.user?.uid;
    const { confirmDelete } = req.body;
    
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!confirmDelete) {
      return res.status(400).json({ error: 'Deletion confirmation required' });
    }
    
    // Log deletion request
    await firestore.collection('deletion_requests').add({
      uid,
      requestedAt: new Date(),
      status: 'pending',
      processedBy: null,
      processedAt: null
    });
    
    logger.warn(`Data deletion requested for user: ${uid}`);
    
    res.json({
      success: true,
      message: 'Your deletion request has been received. It will be processed within 30 days as required by law.',
      requestId: `DEL-${Date.now()}`,
      estimatedCompletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    
  } catch (error) {
    logger.error('Data deletion request failed:', error);
    res.status(500).json({ error: 'Failed to process deletion request' });
  }
});

/**
 * POST /api/data-rights/export
 * User requests portable data export (JSON format)
 * REQUIRES: Authenticated user, can only export own data
 */
router.post('/export', requireAuth, async (req, res) => {
  try {
    // Get UID from authenticated session (Firebase auth)
    const uid = req.user?.uid;
    
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Collect all user data (same as access)
    const userData: any = {};
    
    const userDoc = await firestore.collection('users').doc(uid).get();
    if (userDoc.exists) {
      userData.profile = userDoc.data();
    }
    
    const petsSnapshot = await firestore.collection('users').doc(uid)
      .collection('pets').get();
    userData.pets = petsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const loyaltyDoc = await firestore.collection('loyalty').doc(uid).get();
    if (loyaltyDoc.exists) {
      userData.loyalty = loyaltyDoc.data();
    }
    
    const inboxSnapshot = await firestore.collection('inbox')
      .where('customerId', '==', uid).get();
    userData.inbox = inboxSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    logger.info(`Data export request fulfilled for user: ${uid}`);
    
    // Return as downloadable JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="petwash-data-${uid}-${Date.now()}.json"`);
    res.json({
      exportDate: new Date().toISOString(),
      userId: uid,
      data: userData
    });
    
  } catch (error) {
    logger.error('Data export request failed:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

/**
 * POST /api/data-rights/withdraw-consent
 * User withdraws consent for specific data processing
 * REQUIRES: Authenticated user, can only withdraw own consent
 */
router.post('/withdraw-consent', requireAuth, async (req, res) => {
  try {
    // Get UID from authenticated session (Firebase auth)
    const uid = req.user?.uid;
    const { consentType } = req.body;
    
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!consentType) {
      return res.status(400).json({ error: 'Consent type required' });
    }
    
    // Update user's consent preferences
    await firestore.collection('users').doc(uid).update({
      [`consents.${consentType}`]: false,
      [`consents.${consentType}WithdrawnAt`]: new Date()
    });
    
    logger.info(`Consent withdrawn for user ${uid}: ${consentType}`);
    
    res.json({
      success: true,
      message: `Consent for ${consentType} has been withdrawn`,
      effectiveDate: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Consent withdrawal failed:', error);
    res.status(500).json({ error: 'Failed to withdraw consent' });
  }
});

export default router;
