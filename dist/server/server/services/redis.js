import Redis from 'ioredis';
import { logger } from '../lib/logger';
class RedisService {
    client = null;
    isEnabled = false;
    constructor() {
        this.initialize();
    }
    initialize() {
        try {
            const redisUrl = process.env.REDIS_URL;
            if (!redisUrl) {
                logger.info('[Redis] REDIS_URL not configured - caching disabled (using in-memory fallback)');
                this.isEnabled = false;
                return;
            }
            this.client = new Redis(redisUrl, {
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                lazyConnect: false,
            });
            this.client.on('connect', () => {
                logger.info('[Redis] ✅ Connected successfully');
                this.isEnabled = true;
            });
            this.client.on('error', (err) => {
                logger.error('[Redis] ❌ Connection error:', err);
                this.isEnabled = false;
            });
            this.client.on('ready', () => {
                logger.info('[Redis] Ready to accept commands');
            });
        }
        catch (error) {
            logger.error('[Redis] Failed to initialize:', error);
            this.isEnabled = false;
        }
    }
    async get(key) {
        if (!this.isEnabled || !this.client) {
            return null;
        }
        try {
            const value = await this.client.get(key);
            if (!value)
                return null;
            return JSON.parse(value);
        }
        catch (error) {
            logger.error(`[Redis] GET error for key ${key}:`, error);
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        if (!this.isEnabled || !this.client) {
            return false;
        }
        try {
            const serialized = JSON.stringify(value);
            if (ttlSeconds) {
                await this.client.setex(key, ttlSeconds, serialized);
            }
            else {
                await this.client.set(key, serialized);
            }
            return true;
        }
        catch (error) {
            logger.error(`[Redis] SET error for key ${key}:`, error);
            return false;
        }
    }
    async del(key) {
        if (!this.isEnabled || !this.client) {
            return false;
        }
        try {
            const keys = Array.isArray(key) ? key : [key];
            await this.client.del(...keys);
            return true;
        }
        catch (error) {
            logger.error(`[Redis] DEL error:`, error);
            return false;
        }
    }
    async invalidatePattern(pattern) {
        if (!this.isEnabled || !this.client) {
            return false;
        }
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
                logger.info(`[Redis] Invalidated ${keys.length} keys matching pattern: ${pattern}`);
            }
            return true;
        }
        catch (error) {
            logger.error(`[Redis] Pattern invalidation error for ${pattern}:`, error);
            return false;
        }
    }
    async disconnect() {
        if (this.client) {
            await this.client.quit();
            logger.info('[Redis] Disconnected');
        }
    }
    getStatus() {
        return {
            enabled: this.isEnabled,
            connected: this.client?.status === 'ready',
        };
    }
}
export const redis = new RedisService();
