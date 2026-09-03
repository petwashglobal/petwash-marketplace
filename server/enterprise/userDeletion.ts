/**
 * User Data Deletion Service
 * GDPR & Israeli Privacy Law Amendment 13 Compliance
 * "Right to Erasure" Implementation
 */

import { db as firestoreDb } from '../lib/firebase-admin';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { sendSanitizedError } from '../lib/sanitizeErrorResponse';
import type { Request, Response } from 'express';

interface DeletionResult {
  success: boolean;
  message: string;
  deletedCollections?: string[];
  deletedFiles?: number;
  error?: string;
}

/**
 * Delete a Firestore collection in batches
 * Firestore does not auto-delete subcollections, must be done iteratively
 */
async function deleteCollection(
  collectionPath: string,
  batchSize: number = 100
): Promise<number> {
  const collectionRef = firestoreDb.collection(collectionPath);
  const query = collectionRef.limit(batchSize);
  
  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
  
  async function deleteQueryBatch(
    query: FirebaseFirestore.Query,
    resolve: (value: number) => void
  ) {
    const snapshot = await query.get();
    
    const batchSize = snapshot.size;
    if (batchSize === 0) {
      // No more documents to delete
      resolve(0);
      return;
    }
    
    // Delete documents in a batch
    const batch = firestoreDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // Recurse on the next process tick to avoid exceeding stack
    process.nextTick(() => {
      deleteQueryBatch(query, resolve);
    });
  }
}

/**
 * Delete all user data from Firestore
 * Includes main profile and all subcollections
 */
async function deleteUserFirestoreData(uid: string): Promise<string[]> {
  const deletedCollections: string[] = [];
  
  try {
    // 1. Delete user's main profile
    await firestoreDb.collection('users').doc(uid).delete();
    deletedCollections.push('users/' + uid);
    
    // 2. Delete subcollections (must be done manually)
    const subcollections = [
      `users/${uid}/bookings`,
      `users/${uid}/pets`,
      `users/${uid}/appointments`,
      `users/${uid}/transactions`,
      `users/${uid}/vouchers`,
      `users/${uid}/reviews`,
      `users/${uid}/notifications`,
      `users/${uid}/preferences`,
      `users/${uid}/employee`, // If user was employee
    ];
    
    for (const collectionPath of subcollections) {
      try {
        await deleteCollection(collectionPath, 50);
        deletedCollections.push(collectionPath);
      } catch (error: any) {
        // Collection might not exist, that's okay
        if (error.code !== 5) { // NOT_FOUND = 5
          logger.warn(`[UserDeletion] Could not delete ${collectionPath}:`, error.message);
        }
      }
    }
    
    // 3. Delete user references in other collections
    // Firestore batches are capped at 500 ops. A user with >500 birthday
    // vouchers or >500 kyc docs would previously throw INVALID_ARGUMENT
    // and leave the account half-deleted — a GDPR right-to-erasure gap.
    // Helper below chunks the deletions into 400-op batches (headroom).
    async function chunkedDelete(collection: string) {
      const snap = await firestoreDb
        .collection(collection)
        .where('userId', '==', uid)
        .get();
      if (snap.size === 0) return 0;
      const CHUNK = 400;
      for (let i = 0; i < snap.docs.length; i += CHUNK) {
        const b = firestoreDb.batch();
        for (const doc of snap.docs.slice(i, i + CHUNK)) b.delete(doc.ref);
        await b.commit();
      }
      return snap.size;
    }

    const vouchersDeleted = await chunkedDelete('birthday_vouchers');
    if (vouchersDeleted > 0) {
      deletedCollections.push(`birthday_vouchers (${vouchersDeleted} docs)`);
    }

    const kycDeleted = await chunkedDelete('kyc');
    if (kycDeleted > 0) {
      deletedCollections.push(`kyc (${kycDeleted} docs)`);
    }
    
    logger.info(`[UserDeletion] Firestore data deleted for UID: ${uid}`, { 
      collections: deletedCollections 
    });
    
    return deletedCollections;
    
  } catch (error) {
    logger.error('[UserDeletion] Firestore deletion error:', error);
    throw error;
  }
}

/**
 * Delete user's uploaded files from Firebase Storage
 */
async function deleteUserStorageFiles(uid: string): Promise<number> {
  try {
    const bucket = admin.storage().bucket();
    
    // Define user file prefixes
    const filePrefixes = [
      `user_photos/${uid}/`,
      `pet_photos/${uid}/`,
      `kyc_documents/${uid}/`,
      `receipts/${uid}/`,
      `consent_forms/${uid}/`,
    ];
    
    let totalDeleted = 0;
    
    for (const prefix of filePrefixes) {
      try {
        const [files] = await bucket.getFiles({ prefix });
        
        // Delete all files with this prefix
        await Promise.all(
          files.map(file => file.delete().catch(err => {
            logger.warn(`[UserDeletion] Could not delete file ${file.name}:`, err.message);
          }))
        );
        
        totalDeleted += files.length;
        
        if (files.length > 0) {
          logger.info(`[UserDeletion] Deleted ${files.length} files from ${prefix}`);
        }
      } catch (error: any) {
        logger.warn(`[UserDeletion] Could not list files for prefix ${prefix}:`, error.message);
      }
    }
    
    logger.info(`[UserDeletion] Total storage files deleted: ${totalDeleted}`, { uid });
    
    return totalDeleted;
    
  } catch (error) {
    logger.error('[UserDeletion] Storage deletion error:', error);
    throw error;
  }
}

/**
 * Delete user from Firebase Authentication
 */
async function deleteUserAuth(uid: string): Promise<void> {
  try {
    await admin.auth().deleteUser(uid);
    logger.info(`[UserDeletion] Firebase Auth user deleted: ${uid}`);
  } catch (error) {
    logger.error('[UserDeletion] Auth deletion error:', error);
    throw error;
  }
}

/**
 * Complete user data erasure
 * Callable Cloud Function endpoint (adapted for Express)
 */
export async function deleteUserData(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { uid } = req.body;
    
    // CRITICAL: Security Check - Ensure the request is authenticated and authorized
    // Admin users are authenticated via requireAdmin middleware (req.adminUser)
    // Regular users are authenticated via Firebase (req.firebaseUser) or session (req.session.customerId)
    const isAdmin = req.session.adminId || req.adminUser;
    const requestingUid = req.firebaseUser?.uid || req.session.customerId;
    
    if (!requestingUid && !isAdmin) {
      res.status(401).json({ 
        error: 'unauthenticated', 
        message: 'Authentication required to delete account.' 
      });
      return;
    }
    
    // Verify user is deleting their own account (or is admin)
    
    if (requestingUid !== uid && !isAdmin) {
      res.status(403).json({ 
        error: 'permission-denied', 
        message: 'You can only delete your own account.' 
      });
      return;
    }
    
    logger.info(`[UserDeletion] Starting data erasure for UID: ${uid}`, {
      requestedBy: requestingUid,
      isAdmin: !!isAdmin
    });
    
    // 1. Delete Firestore data
    const deletedCollections = await deleteUserFirestoreData(uid);
    
    // 2. Delete Storage files
    const deletedFiles = await deleteUserStorageFiles(uid);
    
    // 3. Delete from Firebase Authentication (LAST - point of no return)
    await deleteUserAuth(uid);
    
    // 4. Log compliance event
    await firestoreDb.collection('compliance_events').add({
      type: 'user_data_erasure',
      userId: uid,
      requestedBy: requestingUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      deletedCollections,
      deletedFiles,
      status: 'completed',
      legalBasis: 'GDPR Article 17 / Israeli Privacy Law Amendment 13'
    });
    
    logger.info(`[UserDeletion] Complete data erasure successful for UID: ${uid}`, {
      collections: deletedCollections.length,
      files: deletedFiles
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'User data permanently deleted.',
      deletedCollections,
      deletedFiles
    });
    
  } catch (error: any) {
    logger.error('[UserDeletion] Data erasure failed:', error);
    
    res.status(500).json({ 
      error: 'internal', 
      message: 'Failed to complete data erasure.',
      details: error.message 
    });
  }
}

/**
 * Request user data export (GDPR Right to Access)
 */
export async function exportUserData(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { uid } = req.query;
    
    if (!uid || typeof uid !== 'string') {
      res.status(400).json({ error: 'Missing uid parameter' });
      return;
    }
    
    // Security check
    const requestingUid = req.firebaseUser?.uid || req.session.customerId;
    const isAdmin = req.session.adminId || req.adminUser;
    
    if (requestingUid !== uid && !isAdmin) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }
    
    // Collect all user data
    const userData: any = {
      uid,
      exportedAt: new Date().toISOString(),
      profile: null,
      bookings: [],
      pets: [],
      transactions: [],
      vouchers: [],
      reviews: [],
    };
    
    // Get user profile
    const userDoc = await firestoreDb.collection('users').doc(uid).get();
    if (userDoc.exists) {
      userData.profile = userDoc.data();
    }
    
    // Get subcollections
    const bookings = await firestoreDb.collection(`users/${uid}/bookings`).get();
    userData.bookings = bookings.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const pets = await firestoreDb.collection(`users/${uid}/pets`).get();
    userData.pets = pets.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const transactions = await firestoreDb.collection('transactions')
      .where('userId', '==', uid)
      .get();
    userData.transactions = transactions.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    logger.info(`[UserDeletion] Data export requested for UID: ${uid}`, {
      requestedBy: requestingUid
    });
    
    res.status(200).json(userData);
    
  } catch (error: any) {
    sendSanitizedError(res, error, 'USER_DATA_EXPORT_FAILED', { logContext: { op: 'user-data-export' } });
  }
}
