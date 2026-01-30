/**
 * 🐙 Unified API Gateway Service
 * Central entry point for all platform services
 * Handles authentication, routing, rate limiting, and analytics
 */
import { logger } from '../lib/logger';
export class APIGateway {
    services = new Map();
    constructor() {
        this.registerServices();
    }
    /**
     * Register all platform services with their routes
     */
    registerServices() {
        const platforms = [
            { platform: 'walk-my-pet', basePath: '/api/walk-my-pet', version: 'v1', status: 'active' },
            { platform: 'sitter-suite', basePath: '/api/sitter-suite', version: 'v1', status: 'active' },
            { platform: 'pettrek', basePath: '/api/pettrek', version: 'v1', status: 'active' },
            { platform: 'academy', basePath: '/api/academy', version: 'v1', status: 'active' },
            { platform: 'k9000', basePath: '/api/k9000', version: 'v1', status: 'active' },
            { platform: 'wash-hub', basePath: '/api/packages', version: 'v1', status: 'active' },
            { platform: 'plush-lab', basePath: '/api/avatars', version: 'v1', status: 'active' },
            { platform: 'franchise', basePath: '/api/franchise', version: 'v1', status: 'active' },
            { platform: 'enterprise-hr', basePath: '/api/enterprise/hr', version: 'v1', status: 'active' },
            { platform: 'enterprise-finance', basePath: '/api/enterprise/finance', version: 'v1', status: 'active' },
            { platform: 'enterprise-logistics', basePath: '/api/enterprise/logistics', version: 'v1', status: 'active' },
            { platform: 'enterprise-operations', basePath: '/api/enterprise/operations', version: 'v1', status: 'active' },
        ];
        platforms.forEach(service => {
            this.services.set(service.platform, service);
        });
        logger.info(`[API Gateway] Registered ${this.services.size} platform services`);
    }
    /**
     * Route request to appropriate service
     */
    routeRequest(req) {
        const path = req.path;
        for (const [platform, service] of this.services) {
            if (path.startsWith(service.basePath)) {
                return service;
            }
        }
        return null;
    }
    /**
     * Middleware: Service discovery and routing
     */
    discoveryMiddleware = (req, res, next) => {
        const service = this.routeRequest(req);
        if (service) {
            // Attach service metadata to request
            req.platformService = service;
            // Check service status
            if (service.status === 'maintenance') {
                return res.status(503).json({
                    error: 'Service Maintenance',
                    message: `${service.platform} is currently under maintenance`,
                    platform: service.platform
                });
            }
            if (service.status === 'deprecated') {
                res.setHeader('X-API-Deprecated', 'true');
                res.setHeader('X-API-Sunset', '2026-01-01');
            }
        }
        next();
    };
    /**
     * Middleware: Track cross-platform analytics
     */
    analyticsMiddleware = (req, res, next) => {
        const service = req.platformService;
        const startTime = Date.now();
        // Track request
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            if (service) {
                logger.info('[API Gateway] Request', {
                    platform: service.platform,
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    userId: req.user?.uid || 'anonymous'
                });
            }
        });
        next();
    };
    /**
     * Get all registered services
     */
    getServices() {
        return Array.from(this.services.values());
    }
    /**
     * Get service health status
     */
    async getServiceHealth() {
        const health = {};
        for (const [platform, service] of this.services) {
            health[platform] = {
                status: service.status,
                version: service.version,
                basePath: service.basePath
            };
        }
        return health;
    }
}
// Singleton instance
export const apiGateway = new APIGateway();
