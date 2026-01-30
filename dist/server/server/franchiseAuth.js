import admin from './lib/firebase-admin';
import { db } from './lib/firebase-admin';
import { logger } from './lib/logger';
/**
 * Validate Firebase ID token from Authorization header
 */
export async function validateFirebaseToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Missing or invalid authorization header' });
        }
        const idToken = authHeader.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ message: 'No token provided' });
        }
        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        // Attach to request for subsequent middleware
        req.firebaseUid = uid;
        req.firebaseEmail = decodedToken.email || null;
        next();
    }
    catch (error) {
        logger.error('Firebase token validation error:', error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}
/**
 * Validate franchise access - user must belong to the franchise
 */
export async function validateFranchiseAccess(req, res, next) {
    try {
        const uid = req.firebaseUid;
        const requestedFranchiseId = req.query.franchiseId || req.body.franchiseId;
        if (!uid) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        if (!requestedFranchiseId) {
            return res.status(400).json({ message: 'Franchise ID required' });
        }
        // Get user profile from Firestore
        const userProfileDoc = await db
            .doc(`userProfiles/${uid}`)
            .get();
        if (!userProfileDoc.exists) {
            return res.status(403).json({ message: 'User profile not found' });
        }
        const userProfile = userProfileDoc.data();
        const userFranchiseId = userProfile?.franchiseId;
        const userRole = userProfile?.role || 'customer';
        // Check if user has franchise access
        if (!userFranchiseId) {
            return res.status(403).json({ message: 'No franchise access' });
        }
        // Validate that requested franchise matches user's franchise
        if (userFranchiseId !== requestedFranchiseId) {
            logger.warn(`Franchise access denied: User ${uid} attempted to access franchise ${requestedFranchiseId} but belongs to ${userFranchiseId}`);
            return res.status(403).json({ message: 'Access denied to this franchise' });
        }
        // Check role
        if (userRole !== 'franchise_owner' && userRole !== 'franchise_staff') {
            return res.status(403).json({ message: 'Insufficient franchise permissions' });
        }
        // Attach franchise user to request
        req.franchiseUser = {
            uid,
            email: req.firebaseEmail,
            franchiseId: userFranchiseId,
            role: userRole,
        };
        next();
    }
    catch (error) {
        logger.error('Franchise access validation error:', error);
        return res.status(500).json({ message: 'Authorization error' });
    }
}
/**
 * Combined middleware: validate token AND franchise access
 */
export const requireFranchiseAuth = [validateFirebaseToken, validateFranchiseAccess];
