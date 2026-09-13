import Redis from 'ioredis';
import { logger } from '../lib/logger';

class RedisService {
  private client: Redis | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl) {
        logger.info('[Redis] REDIS_URL not configured - caching disabled (using in-memory fallback)');
        this.isEnabled = false;
        return;
      }

      this.client = new Redis(redisUrl, {
        retryStrategy: (times: number) => {
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

    } catch (error) {
      logger.error('[Redis] Failed to initialize:', error);
      this.isEnabled = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`[Redis] GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error(`[Redis] SET error for key ${key}:`, error);
      return false;
    }
  }

  /** Returns true when Redis is connected and commands will succeed. */
  isConnected(): boolean {
    return this.isEnabled;
  }

  /**
   * Atomic SET NX with TTL — returns true if key was newly set (this caller wins),
   * false if the key already existed (replay / another process already claimed it).
   * Uses a single Redis command (SET key value NX EX ttl) so there is no race window.
   * Falls back to false (conservative — treats as replay) when Redis is unavailable.
   */
  async setNx(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      const result = await this.client.set(key, serialized, 'NX', 'EX', ttlSeconds);
      return result === 'OK';
    } catch (error) {
      logger.error(`[Redis] SETNX error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Atomic SET NX with TTL, TRI-STATE.
   *
   * `setNx` above answers a boolean, which is fine for a cache but WRONG for a
   * one-shot security proof: it returns false both when the key already exists
   * (a replay) and when the command failed (infrastructure). Those are opposite
   * facts. Collapsing them means the caller either has to guess — and guessing
   * from `isConnected()` is not authoritative, because a command can time out
   * or return a ReplyError while the client still reports itself connected —
   * or has to blame the customer for our outage.
   *
   * So the distinction is made HERE, where it is actually knowable:
   *
   *   'SET'          the command SUCCEEDED and this caller won the key.
   *   'EXISTS'       the command SUCCEEDED and replied nil — the key was
   *                  already there. Only a successful `SET .. NX` can produce
   *                  this, so it is authoritative evidence of a replay.
   *   'UNAVAILABLE'  no client, or the command threw. NOTHING is known about
   *                  the key. Callers must fail closed.
   *
   * A failure NEVER reports as 'EXISTS'.
   */
  async setNxStrict(key: string, value: unknown, ttlSeconds: number): Promise<'SET' | 'EXISTS' | 'UNAVAILABLE'> {
    if (!this.isEnabled || !this.client) return 'UNAVAILABLE';

    try {
      const serialized = JSON.stringify(value);
      // Argument order is `EX <s> NX`, not `NX EX <s>`: Redis accepts either,
      // but only this one matches the ioredis overload, so the call is
      // type-checked rather than silently falling through to the loose
      // signature. Same single command, same atomicity.
      const result = await this.client.set(key, serialized, 'EX', ttlSeconds, 'NX');
      // The reply is 'OK' or nil, and only a completed command yields either.
      return result === 'OK' ? 'SET' : 'EXISTS';
    } catch (error) {
      logger.error(`[Redis] SETNX(strict) FAILED for key ${key} — reporting UNAVAILABLE, not EXISTS:`, error);
      return 'UNAVAILABLE';
    }
  }

  /**
   * EXISTS, TRI-STATE. Same reasoning as setNxStrict: "the key is not there"
   * and "I could not ask" must not be the same answer to a security question.
   *
   * Used to read legacy one-shot markers written under a previous key format,
   * so a proof spent before a key-namespace migration stays spent after it.
   */
  async existsStrict(key: string): Promise<'YES' | 'NO' | 'UNAVAILABLE'> {
    if (!this.isEnabled || !this.client) return 'UNAVAILABLE';

    try {
      const n = await this.client.exists(key);
      return n > 0 ? 'YES' : 'NO';
    } catch (error) {
      logger.error(`[Redis] EXISTS(strict) FAILED for key ${key} — reporting UNAVAILABLE, not NO:`, error);
      return 'UNAVAILABLE';
    }
  }

  /**
   * Atomic GETDEL — reads a key and deletes it in a single Redis round-trip.
   * Used for one-time consumption handoffs (e.g. AUDIT-LOG-13/#216 one-tap
   * custom-token) where the value must be usable exactly once and never
   * re-read even by a racing concurrent request.
   *
   * Returns null when Redis is unavailable OR the key doesn't exist / has
   * already been consumed — callers cannot distinguish these two, and MUST
   * treat both as "no valid handoff" so a Redis outage never turns into a
   * bypass of the one-shot semantic.
   */
  async getDel(key: string): Promise<string | null> {
    if (!this.isEnabled || !this.client) return null;
    try {
      return await this.client.getdel(key);
    } catch (error) {
      logger.error(`[Redis] GETDEL error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Atomic GETDEL, TRI-STATE. Same reasoning as setNxStrict: for a one-use
   * security value (a WebAuthn challenge), "the key is gone / already used"
   * and "I could not ask the store" are opposite facts. The first is the
   * caller's problem (400); the second is ours and must fail closed (503).
   *
   *   { state: 'VALUE', value }  the command SUCCEEDED; the key existed and is now deleted.
   *   { state: 'MISSING' }       the command SUCCEEDED and replied nil.
   *   { state: 'UNAVAILABLE' }   no client, or the command threw. Nothing is known.
   */
  async getDelStrict(
    key: string,
  ): Promise<{ state: 'VALUE'; value: string } | { state: 'MISSING' } | { state: 'UNAVAILABLE' }> {
    if (!this.isEnabled || !this.client) return { state: 'UNAVAILABLE' };
    try {
      const value = await this.client.getdel(key);
      return value === null ? { state: 'MISSING' } : { state: 'VALUE', value };
    } catch (error) {
      logger.error(`[Redis] GETDEL(strict) FAILED for key ${key} — reporting UNAVAILABLE, not MISSING:`, error);
      return { state: 'UNAVAILABLE' };
    }
  }

  async del(key: string | string[]): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false;
    }

    try {
      const keys = Array.isArray(key) ? key : [key];
      await this.client.del(...keys);
      return true;
    } catch (error) {
      logger.error(`[Redis] DEL error:`, error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<boolean> {
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
    } catch (error) {
      logger.error(`[Redis] Pattern invalidation error for ${pattern}:`, error);
      return false;
    }
  }

  async getRaw(key: string): Promise<string | null> {
    if (!this.isEnabled || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`[Redis] getRaw error for key ${key}:`, error);
      return null;
    }
  }

  async setRaw(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error(`[Redis] setRaw error for key ${key}:`, error);
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.isEnabled || !this.client) return 0;
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`[Redis] INCR error for key ${key}:`, error);
      return 0;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;
    try {
      await this.client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      logger.error(`[Redis] EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isEnabled || !this.client) return -2;
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`[Redis] TTL error for key ${key}:`, error);
      return -2;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      logger.info('[Redis] Disconnected');
    }
  }

  getStatus(): { enabled: boolean; connected: boolean } {
    return {
      enabled: this.isEnabled,
      connected: this.client?.status === 'ready',
    };
  }
}

export const redis = new RedisService();
