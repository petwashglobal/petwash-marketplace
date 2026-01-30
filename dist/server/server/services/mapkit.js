import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger';
export class MapKitService {
    static instance;
    teamId = null;
    keyId = null;
    privateKey = null;
    constructor() {
        this.loadCredentials();
    }
    static getInstance() {
        if (!MapKitService.instance) {
            MapKitService.instance = new MapKitService();
        }
        return MapKitService.instance;
    }
    loadCredentials() {
        this.teamId = process.env.MAPKIT_JS_TEAM_ID || null;
        this.keyId = process.env.MAPKIT_JS_KEY_ID || null;
        this.privateKey = process.env.MAPKIT_JS_PRIVATE_KEY || null;
        if (!this.teamId || !this.keyId || !this.privateKey) {
            logger.warn('⚠️ MapKit JS credentials not configured - map features will be disabled');
            logger.warn('Please add MAPKIT_JS_TEAM_ID, MAPKIT_JS_KEY_ID, and MAPKIT_JS_PRIVATE_KEY to environment secrets');
        }
        else {
            logger.info('✅ MapKit JS service initialized successfully');
        }
    }
    /**
     * Check if MapKit is configured and available
     */
    isConfigured() {
        return !!(this.teamId && this.keyId && this.privateKey);
    }
    /**
     * Generate a JWT token for MapKit JS
     *
     * @param origin The origin domain for the request (e.g., "https://petwash.co.il")
     * @param ttl Token time-to-live in seconds (default: 1800 = 30 minutes)
     * @returns JWT token string
     */
    generateToken(origin, ttl = 1800) {
        if (!this.isConfigured()) {
            throw new Error('MapKit JS is not configured. Please add credentials to environment secrets.');
        }
        // Validate origin format
        if (!origin || (!origin.startsWith('http://') && !origin.startsWith('https://'))) {
            throw new Error('Invalid origin. Must be a valid URL (e.g., https://petwash.co.il)');
        }
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: this.teamId,
            iat: now,
            exp: now + ttl,
            origin: origin,
        };
        const token = jwt.sign(payload, this.privateKey, {
            algorithm: 'ES256',
            keyid: this.keyId,
        });
        logger.info(`[MapKit] Generated token for origin "${origin}" valid for ${ttl} seconds`);
        return token;
    }
    /**
     * Get MapKit initialization configuration
     *
     * @param origin The origin domain for the request
     * @returns Configuration object for MapKit JS
     */
    getMapKitConfig(origin) {
        if (!this.isConfigured()) {
            return {
                available: false,
                error: 'MapKit JS is not configured',
            };
        }
        return {
            available: true,
            token: this.generateToken(origin),
            language: 'he', // Hebrew
            colorScheme: 'light',
            origin: origin, // Return configured origin for frontend validation
        };
    }
    /**
     * Get list of allowed origins for MapKit
     * Should match the origins configured in Apple Developer Portal
     *
     * Can be configured via MAPKIT_ALLOWED_ORIGINS environment variable (comma-separated)
     * Example: "https://petwash.co.il,https://www.petwash.co.il"
     */
    getAllowedOrigins() {
        // Check for environment-configured origins
        const envOrigins = process.env.MAPKIT_ALLOWED_ORIGINS;
        if (envOrigins) {
            return envOrigins.split(',').map(origin => origin.trim());
        }
        // Default allowed origins
        const origins = [
            'https://petwash.co.il',
            'https://www.petwash.co.il',
            'http://localhost:5000',
        ];
        // Auto-detect Replit preview domain in development
        if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
            origins.push(`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
        }
        return origins;
    }
    /**
     * Check if an origin is allowed
     */
    isOriginAllowed(origin) {
        return this.getAllowedOrigins().includes(origin);
    }
}
export const mapKitService = MapKitService.getInstance();
