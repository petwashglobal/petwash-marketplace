import express from "express";
import { getCurrentUser } from "../simpleAuth";
import { logger } from "../lib/logger";
export const publicAuthRouter = express.Router();
/**
 * Sends guaranteed JSON response with a safe status code.
 * use200 = return HTTP 200 always (for unauthenticated cases)
 */
function sendSafeJSON(res, data, use200 = true) {
    if (use200) {
        return res.status(200).json(data);
    }
    else {
        return res.status(data.status || 400).json(data);
    }
}
/**
 * Authentication status endpoint
 * NEVER returns 401 for normal visitors
 * ONLY returns 401 if a token is present but INVALID
 *
 * Returns HTTP 200 for:
 * - Logged out users: {ok:true, authenticated:false, user:null}
 * - Logged in users: {ok:true, authenticated:true, user:{...}}
 */
publicAuthRouter.get("/api/simple-auth/me", async (req, res) => {
    try {
        const user = await getCurrentUser(req);
        // No session / user not logged in → normal → HTTP 200
        if (!user) {
            return sendSafeJSON(res, {
                ok: true,
                authenticated: false,
                user: null,
            });
        }
        // Valid session
        return sendSafeJSON(res, {
            ok: true,
            authenticated: true,
            user,
        });
    }
    catch (err) {
        logger.error('[PublicAuth] Error checking auth status:', err);
        // If this error indicates a bad token, return real 401
        if (String(err).includes("INVALID_TOKEN") || String(err).includes("Invalid session")) {
            return res.status(401).json({
                ok: false,
                error: "Invalid authentication token",
            });
        }
        // Other server error
        return res.status(500).json({
            ok: false,
            error: "Server error",
        });
    }
});
/**
 * Consent status endpoint
 * NEVER throws console errors for unauthenticated visitors
 *
 * Returns HTTP 200 for:
 * - Logged out users: {ok:true, authenticated:false, consent:null}
 * - Logged in users: {ok:true, authenticated:true, consent:{...}}
 */
publicAuthRouter.get("/api/consent", async (req, res) => {
    try {
        // Get Firebase user ID if authenticated
        const firebaseUser = req.firebaseUser;
        const userId = firebaseUser?.uid;
        // Not authenticated → normal → HTTP 200
        if (!userId) {
            return sendSafeJSON(res, {
                ok: true,
                authenticated: false,
                consent: null,
            });
        }
        // Authenticated → fetch consent from Firestore
        const { getFirestore } = await import('firebase-admin/firestore');
        const firestore = getFirestore();
        const snapshot = await firestore
            .collection('consent_records')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
        if (snapshot.empty) {
            return sendSafeJSON(res, {
                ok: true,
                authenticated: true,
                consent: null,
            });
        }
        const latestConsent = snapshot.docs[0].data();
        return sendSafeJSON(res, {
            ok: true,
            authenticated: true,
            consent: {
                necessary: latestConsent.necessary,
                functional: latestConsent.functional,
                analytics: latestConsent.analytics,
                marketing: latestConsent.marketing,
                location: latestConsent.location ?? false,
                camera: latestConsent.camera ?? false,
                washReminders: latestConsent.washReminders ?? false,
                vaccinationReminders: latestConsent.vaccinationReminders ?? false,
                promotionalNotifications: latestConsent.promotionalNotifications ?? false,
                timestamp: latestConsent.timestamp,
            },
        });
    }
    catch (err) {
        logger.error('[PublicAuth] Error fetching consent:', err);
        if (String(err).includes("INVALID_TOKEN") || String(err).includes("Invalid session")) {
            return res.status(401).json({
                ok: false,
                error: "Invalid authentication token",
            });
        }
        return res.status(500).json({
            ok: false,
            error: "Server error",
        });
    }
});
logger.info('[PublicAuth] ✅ Public auth routes initialized (clean console mode)');
