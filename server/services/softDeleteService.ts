import { db } from '../db';
import { users } from '@shared/schema';
import { eq, and, lt, isNotNull } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { logSecurityEvent } from './securityEventsService';
import crypto from 'crypto';

export async function softDeleteUser(userId: string, deletedBy: string): Promise<{ success: boolean; error?: string }> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return { success: false, error: 'USER_NOT_FOUND' };
    if ((user as any).legalHold) {
      logger.warn(`[SoftDelete] Cannot delete user ${userId} - legal hold active`);
      return { success: false, error: 'LEGAL_HOLD_ACTIVE' };
    }
    if ((user as any).softDeleteAt) {
      return { success: false, error: 'ALREADY_DELETED' };
    }

    await db.update(users).set({ softDeleteAt: new Date() } as any).where(eq(users.id, userId));
    logSecurityEvent({ userId, eventType: 'user_soft_deleted', riskScore: 0, metadata: { deletedBy } });
    logger.info(`[SoftDelete] User ${userId} soft deleted by ${deletedBy}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`[SoftDelete] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function setLegalHold(userId: string, hold: boolean, setBy: string): Promise<{ success: boolean }> {
  try {
    await db.update(users).set({ legalHold: hold } as any).where(eq(users.id, userId));
    logSecurityEvent({ userId, eventType: hold ? 'legal_hold_set' : 'legal_hold_removed', riskScore: 0, metadata: { setBy } });
    logger.info(`[LegalHold] User ${userId} legal hold ${hold ? 'SET' : 'REMOVED'} by ${setBy}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`[LegalHold] Error: ${error.message}`);
    return { success: false };
  }
}

export async function anonymizeUser(userId: string, anonymizedBy: string): Promise<{ success: boolean; error?: string }> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return { success: false, error: 'USER_NOT_FOUND' };
    if ((user as any).legalHold) return { success: false, error: 'LEGAL_HOLD_ACTIVE' };
    if (!(user as any).softDeleteAt) return { success: false, error: 'NOT_SOFT_DELETED' };

    const anonHash = crypto.createHash('sha256').update(userId).digest('hex').slice(0, 8);
    await db.update(users).set({
      firstName: `ANON_${anonHash}`,
      lastName: 'REDACTED',
      email: `anon_${anonHash}@redacted.petwash.internal`,
      phone: null,
      profileImageUrl: null,
      dateOfBirth: null,
      address: null,
      city: null,
    } as any).where(eq(users.id, userId));

    logSecurityEvent({ userId, eventType: 'user_anonymized', riskScore: 0, metadata: { anonymizedBy } });
    logger.info(`[Anonymize] User ${userId} anonymized by ${anonymizedBy}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`[Anonymize] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function getAnonymizationCandidates(daysAfterDeletion: number = 90): Promise<any[]> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysAfterDeletion);
    const candidates = await db.select({ id: users.id, softDeleteAt: (users as any).softDeleteAt })
      .from(users)
      .where(and(
        isNotNull((users as any).softDeleteAt),
        lt((users as any).softDeleteAt, cutoff)
      ));
    return candidates;
  } catch (error: any) {
    logger.error(`[Anonymize] Error getting candidates: ${error.message}`);
    return [];
  }
}
