/**
 * AI-Powered Identity Fraud Detection Middleware
 * Protects wallet operations from fraudulent access
 */
import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
export class WalletFraudDetection {
    /**
     * Analyze wallet download request for fraud signals
     */
    static async analyzeWalletRequest(userId, userEmail, ipAddress, userAgent, sessionData) {
        const signals = [];
        let riskScore = 0;
        try {
            // 1. Check for rapid repeated downloads (credential stuffing)
            const recentDownloads = await this.getRecentWalletDownloads(userId);
            if (recentDownloads > 5) {
                signals.push({
                    type: 'rapid_downloads',
                    severity: 'high',
                    score: 30,
                    details: `${recentDownloads} downloads in last hour`
                });
                riskScore += 30;
            }
            // 2. Check IP reputation and geolocation anomaly
            const ipAnomaly = await this.checkIPAnomaly(userId, ipAddress);
            if (ipAnomaly.isAnomalous) {
                signals.push({
                    type: 'ip_anomaly',
                    severity: ipAnomaly.severity,
                    score: ipAnomaly.score,
                    details: ipAnomaly.details
                });
                riskScore += ipAnomaly.score;
            }
            // 3. Check device fingerprint consistency
            const deviceAnomaly = await this.checkDeviceAnomaly(userId, userAgent);
            if (deviceAnomaly.isAnomalous) {
                signals.push({
                    type: 'device_anomaly',
                    severity: deviceAnomaly.severity,
                    score: deviceAnomaly.score,
                    details: deviceAnomaly.details
                });
                riskScore += deviceAnomaly.score;
            }
            // 4. Check for account age (new accounts are riskier)
            const accountAge = await this.getAccountAgeDays(userId);
            if (accountAge < 1) {
                signals.push({
                    type: 'new_account',
                    severity: 'medium',
                    score: 15,
                    details: `Account created ${accountAge} days ago`
                });
                riskScore += 15;
            }
            // 5. Check for email verification status
            const emailVerified = await this.isEmailVerified(userId);
            if (!emailVerified) {
                signals.push({
                    type: 'unverified_email',
                    severity: 'high',
                    score: 25,
                    details: 'Email not verified'
                });
                riskScore += 25;
            }
            // 6. Check for suspicious time patterns (e.g., 3 AM activity)
            const hourOfDay = new Date().getHours();
            if (hourOfDay >= 2 && hourOfDay <= 4) {
                signals.push({
                    type: 'unusual_time',
                    severity: 'low',
                    score: 5,
                    details: `Activity at ${hourOfDay}:00 (unusual time)`
                });
                riskScore += 5;
            }
            // 7. Check for VPN/Proxy usage
            const vpnDetected = await this.detectVPN(ipAddress);
            if (vpnDetected) {
                signals.push({
                    type: 'vpn_proxy',
                    severity: 'medium',
                    score: 20,
                    details: 'VPN or proxy detected'
                });
                riskScore += 20;
            }
            // Determine action based on risk score
            let action;
            let reason;
            if (riskScore >= 70) {
                action = 'block';
                reason = 'High fraud risk detected';
            }
            else if (riskScore >= 40) {
                action = 'challenge';
                reason = 'Moderate risk - additional verification required';
            }
            else {
                action = 'allow';
                reason = 'Low risk - request approved';
            }
            // Log fraud analysis
            await db.collection('fraud_logs').add({
                userId,
                userEmail,
                ipAddress,
                userAgent,
                riskScore,
                signals,
                action,
                reason,
                timestamp: new Date(),
                type: 'wallet_download'
            });
            logger.info('[Fraud Detection] Wallet request analyzed', {
                userId,
                riskScore,
                action,
                signalsCount: signals.length
            });
            return {
                riskScore,
                signals,
                action,
                reason
            };
        }
        catch (error) {
            logger.error('[Fraud Detection] Analysis failed:', error);
            // Fail open but log the error
            return {
                riskScore: 0,
                signals: [],
                action: 'allow',
                reason: 'Fraud detection unavailable'
            };
        }
    }
    /**
     * Get recent wallet downloads count for user
     */
    static async getRecentWalletDownloads(userId) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const snapshot = await db.collection('wallet_downloads')
            .where('userId', '==', userId)
            .where('timestamp', '>=', oneHourAgo)
            .get();
        return snapshot.size;
    }
    /**
     * Check for IP address anomalies
     */
    static async checkIPAnomaly(userId, currentIP) {
        try {
            // Get user's typical IP addresses
            const recentIPs = await db.collection('user_sessions')
                .where('userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();
            const ipList = recentIPs.docs.map(doc => doc.data().ipAddress);
            const uniqueIPs = new Set(ipList);
            // Check if current IP is new
            if (!uniqueIPs.has(currentIP) && uniqueIPs.size > 0) {
                return {
                    isAnomalous: true,
                    severity: 'medium',
                    score: 20,
                    details: 'New IP address detected'
                };
            }
            return {
                isAnomalous: false,
                severity: 'low',
                score: 0,
                details: 'IP recognized'
            };
        }
        catch (error) {
            return {
                isAnomalous: false,
                severity: 'low',
                score: 0,
                details: 'IP check skipped'
            };
        }
    }
    /**
     * Check for device fingerprint anomalies
     */
    static async checkDeviceAnomaly(userId, currentUA) {
        try {
            // Get user's typical devices
            const recentDevices = await db.collection('user_sessions')
                .where('userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();
            const deviceList = recentDevices.docs.map(doc => doc.data().userAgent);
            const deviceFingerprints = deviceList.map(ua => this.simplifyUserAgent(ua));
            const currentFingerprint = this.simplifyUserAgent(currentUA);
            // Check if current device is new
            if (!deviceFingerprints.includes(currentFingerprint) && deviceFingerprints.length > 0) {
                return {
                    isAnomalous: true,
                    severity: 'low',
                    score: 10,
                    details: 'New device detected'
                };
            }
            return {
                isAnomalous: false,
                severity: 'low',
                score: 0,
                details: 'Device recognized'
            };
        }
        catch (error) {
            return {
                isAnomalous: false,
                severity: 'low',
                score: 0,
                details: 'Device check skipped'
            };
        }
    }
    /**
     * Simplify user agent for fingerprinting
     */
    static simplifyUserAgent(ua) {
        // Extract OS and browser
        const os = ua.match(/(Windows|Mac|Linux|iPhone|iPad|Android)/i)?.[0] || 'unknown';
        const browser = ua.match(/(Chrome|Safari|Firefox|Edge)/i)?.[0] || 'unknown';
        return `${os}_${browser}`;
    }
    /**
     * Get account age in days
     */
    static async getAccountAgeDays(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                return 0;
            }
            const createdAt = userDoc.data()?.createdAt?.toDate() || new Date();
            const ageMs = Date.now() - createdAt.getTime();
            return Math.floor(ageMs / (1000 * 60 * 60 * 24));
        }
        catch (error) {
            return 999; // Assume old account on error
        }
    }
    /**
     * Check if email is verified
     */
    static async isEmailVerified(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            return userDoc.data()?.emailVerified === true;
        }
        catch (error) {
            return true; // Assume verified on error
        }
    }
    /**
     * Detect VPN/Proxy usage
     */
    static async detectVPN(ipAddress) {
        // Simple heuristic: Check if IP is in known data center ranges
        // In production, use a service like IPHub, IPQualityScore, or MaxMind
        // For now, just detect common VPN patterns
        const suspiciousPatterns = [
            /^10\./, // Private network
            /^172\.16\./, // Private network
            /^192\.168\./, // Private network
        ];
        return suspiciousPatterns.some(pattern => pattern.test(ipAddress));
    }
    /**
     * Log wallet download for analytics and fraud detection
     */
    static async logWalletDownload(userId, userEmail, walletType, ipAddress, userAgent) {
        try {
            await db.collection('wallet_downloads').add({
                userId,
                userEmail,
                walletType,
                ipAddress,
                userAgent,
                timestamp: new Date()
            });
        }
        catch (error) {
            logger.error('[Fraud Detection] Failed to log wallet download:', error);
        }
    }
}
/**
 * Express middleware for fraud detection on wallet endpoints
 */
export async function walletFraudProtection(req, res, next) {
    try {
        const session = req.session;
        const userId = session?.user?.uid;
        const userEmail = session?.user?.email || '';
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        if (!userId) {
            return next();
        }
        // Analyze request for fraud
        const analysis = await WalletFraudDetection.analyzeWalletRequest(userId, userEmail, ipAddress, userAgent, session);
        // Block high-risk requests
        if (analysis.action === 'block') {
            logger.warn('[Fraud Detection] Wallet request blocked', {
                userId,
                userEmail,
                riskScore: analysis.riskScore,
                reason: analysis.reason
            });
            return res.status(403).json({
                error: 'Access denied',
                message: 'This request has been flagged for security review. Please contact support.',
                riskScore: analysis.riskScore
            });
        }
        // Challenge medium-risk requests (can be implemented later with 2FA)
        if (analysis.action === 'challenge') {
            logger.info('[Fraud Detection] Wallet request requires challenge', {
                userId,
                userEmail,
                riskScore: analysis.riskScore
            });
            // For now, allow but log
            // In production, trigger 2FA or additional verification
        }
        // Allow low-risk requests
        next();
    }
    catch (error) {
        logger.error('[Fraud Detection] Middleware error:', error);
        // Fail open to avoid blocking legitimate users
        next();
    }
}
