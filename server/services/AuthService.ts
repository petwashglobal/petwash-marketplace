import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { redis } from './redis';
import { auth as firebaseAdmin } from '../lib/firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';
import crypto from 'crypto';

export class AuthService {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async verifyFirebaseToken(token: string): Promise<DecodedIdToken | null> {
    const tokenHash = this.hashToken(token);
    const cacheKey = `auth:token:${tokenHash}`;
    const cached = await redis.get<DecodedIdToken>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const decodedToken = await firebaseAdmin.verifyIdToken(token);
      await redis.set(cacheKey, decodedToken, 300);
      return decodedToken;
    } catch (error) {
      logger.error('[AuthService] Token verification failed:', error);
      return null;
    }
  }

  async getUserById(userId: string) {
    const cacheKey = `auth:user:${userId}`;
    const cached = await redis.get<typeof users.$inferSelect>(cacheKey);
    if (cached) {
      return cached;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user) {
      await redis.set(cacheKey, user, 600);
    }

    return user;
  }

  async getUserByEmail(email: string) {
    const cacheKey = `auth:email:${email.toLowerCase()}`;
    const cached = await redis.get<typeof users.$inferSelect>(cacheKey);
    if (cached) {
      return cached;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (user) {
      await redis.set(cacheKey, user, 600);
    }

    return user;
  }

  async createUser(data: {
    id: string;
    email: string;
    displayName?: string;
    phoneNumber?: string;
    photoURL?: string;
    role?: 'customer' | 'admin' | 'staff' | 'technician';
  }) {
    try {
      const [user] = await db.insert(users).values({
        id: data.id,
        email: data.email.toLowerCase(),
        displayName: data.displayName || null,
        phoneNumber: data.phoneNumber || null,
        photoURL: data.photoURL || null,
        role: data.role || 'customer',
        loyaltyPoints: 0,
        loyaltyTier: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      logger.info('[AuthService] User created', {
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      await this.invalidateUserCache(user.id);

      return user;
    } catch (error) {
      logger.error('[AuthService] Failed to create user:', error);
      throw error;
    }
  }

  async updateUser(userId: string, data: Partial<typeof users.$inferInsert>) {
    try {
      const [user] = await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      await this.invalidateUserCache(userId);

      logger.info('[AuthService] User updated', { userId });

      return user;
    } catch (error) {
      logger.error('[AuthService] Failed to update user:', error);
      throw error;
    }
  }

  async deleteUser(userId: string) {
    try {
      const user = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        throw new Error('User not found');
      }

      const userEmail = user[0].email.toLowerCase();

      await db.delete(users).where(eq(users.id, userId));
      
      await redis.del([
        `auth:user:${userId}`,
        `auth:email:${userEmail}`,
      ]);
      await redis.invalidatePattern(`auth:token:*`);

      logger.info('[AuthService] User deleted and cache cleared', { userId, email: userEmail });

      return true;
    } catch (error) {
      logger.error('[AuthService] Failed to delete user:', error);
      throw error;
    }
  }

  async invalidateUserCache(userId: string) {
    const user = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length > 0) {
      await redis.del([
        `auth:user:${userId}`,
        `auth:email:${user[0].email.toLowerCase()}`,
      ]);
    } else {
      await redis.del(`auth:user:${userId}`);
    }

    await redis.invalidatePattern(`auth:token:*`);

    logger.info('[AuthService] User cache invalidated', { userId });
  }

  async verifyWebAuthnCredential(credentialId: string): Promise<boolean> {
    const cacheKey = `webauthn:credential:${credentialId}`;
    const cached = await redis.get<boolean>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    return false;
  }

  async cacheWebAuthnCredential(credentialId: string, valid: boolean) {
    await redis.set(`webauthn:credential:${credentialId}`, valid, 3600);
  }
}

export const authService = new AuthService();
