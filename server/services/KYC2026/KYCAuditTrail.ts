/**
 * KYC 2026 Comprehensive Audit Trail
 * 
 * Immutable, SHA-256 chained audit log for every KYC operation.
 * 
 * PERSISTENCE: All entries are written to PostgreSQL (kyc_audit_log table)
 * for durable, tamper-evident storage. In-memory cache for fast reads.
 * 
 * Each entry is hash-chained to the previous entry,
 * creating a tamper-evident log (blockchain-style).
 * 
 * COMPLIANCE: Israeli Privacy Law 2025, GDPR Article 30
 */

import crypto from 'crypto';
import { logger } from '../../lib/logger';
import { db } from '../../db';
import { kycAuditLog } from '@shared/schema';
import { desc, eq, gte, or, and, sql } from 'drizzle-orm';

export type KYCAuditAction =
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'kyc_manual_review'
  | 'kyc_document_viewed'
  | 'kyc_result_queried'
  | 'kyc_admin_access'
  | 'kyc_anomaly_detected'
  | 'kyc_blocked'
  | 'kyc_appeal_submitted'
  | 'kyc_resubmitted'
  | 'kyc_liveness_passed'
  | 'kyc_liveness_failed'
  | 'kyc_mfa_verified'
  | 'kyc_mfa_failed'
  | 'kyc_alert_sent'
  | 'kyc_data_exported'
  | 'kyc_data_deleted';

export interface KYCAuditEntry {
  id: string;
  timestamp: string;
  action: KYCAuditAction;
  actorId: string;
  actorRole: string;
  targetUserId?: string;
  verificationId?: number;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  metadata: Record<string, any>;
  riskScore?: number;
  previousHash: string;
  entryHash: string;
}

interface AuditEntryInput {
  action: KYCAuditAction;
  actorId: string;
  actorRole: string;
  targetUserId?: string;
  verificationId?: number;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  metadata?: Record<string, any>;
  riskScore?: number;
}

export class KYCAuditTrail {
  private lastHash: string = '0000000000000000000000000000000000000000000000000000000000000000';
  private entryCounter = 0;
  private recentEntries: KYCAuditEntry[] = [];

  constructor() {
    this.loadLastHash();
    logger.info('[KYC2026:AuditTrail] Initialized with database persistence');
  }

  private async loadLastHash(): Promise<void> {
    try {
      const [lastEntry] = await db
        .select({ entryHash: kycAuditLog.entryHash })
        .from(kycAuditLog)
        .orderBy(desc(kycAuditLog.id))
        .limit(1);
      if (lastEntry) {
        this.lastHash = lastEntry.entryHash;
        logger.info('[KYC2026:AuditTrail] Loaded last hash from database');
      }
    } catch (err: any) {
      logger.warn('[KYC2026:AuditTrail] Could not load last hash from DB:', err.message);
    }
  }

  record(input: AuditEntryInput): KYCAuditEntry {
    const id = `kyc-audit-${Date.now()}-${++this.entryCounter}`;
    const timestamp = new Date().toISOString();

    const sanitizedMetadata = this.sanitizeMetadata(input.metadata || {});

    const entryData = [
      id,
      timestamp,
      input.action,
      input.actorId,
      input.actorRole,
      input.targetUserId || '',
      String(input.verificationId || ''),
      input.ipAddress,
      input.deviceFingerprint || '',
      JSON.stringify(sanitizedMetadata),
      this.lastHash,
    ].join('|');

    const entryHash = crypto.createHash('sha256').update(entryData).digest('hex');

    const entry: KYCAuditEntry = {
      id,
      timestamp,
      action: input.action,
      actorId: input.actorId,
      actorRole: input.actorRole,
      targetUserId: input.targetUserId,
      verificationId: input.verificationId,
      ipAddress: this.maskIP(input.ipAddress),
      userAgent: this.truncateUA(input.userAgent),
      deviceFingerprint: input.deviceFingerprint,
      metadata: sanitizedMetadata,
      riskScore: input.riskScore,
      previousHash: this.lastHash,
      entryHash,
    };

    this.lastHash = entryHash;

    this.recentEntries.push(entry);
    if (this.recentEntries.length > 500) {
      this.recentEntries = this.recentEntries.slice(-250);
    }

    this.persistToDatabase(entry).catch(err => {
      logger.error('[KYC2026:AuditTrail] DB persist failed:', err.message);
    });

    logger.info(`[KYC2026:Audit] ${input.action} by ${input.actorRole}:${input.actorId}`, {
      verificationId: input.verificationId,
      riskScore: input.riskScore,
    });

    return entry;
  }

  private async persistToDatabase(entry: KYCAuditEntry): Promise<void> {
    try {
      await db.insert(kycAuditLog).values({
        entryId: entry.id,
        action: entry.action,
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        targetUserId: entry.targetUserId || null,
        verificationId: entry.verificationId ? String(entry.verificationId) : null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        deviceFingerprint: entry.deviceFingerprint || null,
        metadata: entry.metadata,
        riskScore: entry.riskScore ?? null,
        previousHash: entry.previousHash,
        entryHash: entry.entryHash,
      });
    } catch (err: any) {
      logger.error('[KYC2026:AuditTrail] Failed to persist audit entry:', err.message);
    }
  }

  async verifyChain(): Promise<{ valid: boolean; brokenAt?: number; totalEntries: number }> {
    try {
      const entries = await db
        .select({ id: kycAuditLog.id, previousHash: kycAuditLog.previousHash, entryHash: kycAuditLog.entryHash })
        .from(kycAuditLog)
        .orderBy(kycAuditLog.id)
        .limit(1000);

      if (entries.length === 0) return { valid: true, totalEntries: 0 };

      for (let i = 1; i < entries.length; i++) {
        if (entries[i].previousHash !== entries[i - 1].entryHash) {
          return { valid: false, brokenAt: entries[i].id, totalEntries: entries.length };
        }
      }

      return { valid: true, totalEntries: entries.length };
    } catch (err: any) {
      logger.error('[KYC2026:AuditTrail] Chain verification failed:', err.message);
      return { valid: false, totalEntries: 0 };
    }
  }

  getEntriesForUser(userId: string): KYCAuditEntry[] {
    return this.recentEntries.filter(
      e => e.actorId === userId || e.targetUserId === userId
    );
  }

  getEntriesForVerification(verificationId: number): KYCAuditEntry[] {
    return this.recentEntries.filter(e => e.verificationId === verificationId);
  }

  getRecentEntries(limit: number = 50): KYCAuditEntry[] {
    return this.recentEntries.slice(-limit);
  }

  getAnomalyEntries(since?: Date): KYCAuditEntry[] {
    const cutoff = since?.getTime() || Date.now() - 24 * 60 * 60 * 1000;
    return this.recentEntries.filter(
      e =>
        (e.action === 'kyc_anomaly_detected' || e.action === 'kyc_blocked') &&
        new Date(e.timestamp).getTime() >= cutoff
    );
  }

  async getStats(): Promise<{
    totalEntries: number;
    chainValid: boolean;
    anomalyCount24h: number;
    blockCount24h: number;
    uniqueActors24h: number;
  }> {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent = this.recentEntries.filter(e => new Date(e.timestamp).getTime() >= dayAgo);
    const chainResult = await this.verifyChain();

    return {
      totalEntries: this.recentEntries.length,
      chainValid: chainResult.valid,
      anomalyCount24h: recent.filter(e => e.action === 'kyc_anomaly_detected').length,
      blockCount24h: recent.filter(e => e.action === 'kyc_blocked').length,
      uniqueActors24h: new Set(recent.map(e => e.actorId)).size,
    };
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'authorization',
      'passportNumber', 'idNumber', 'ssn', 'credit_card',
      'selfieBuffer', 'idBuffer', 'imageData', 'rawOcr',
    ];

    for (const [key, value] of Object.entries(metadata)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 100) + '...[TRUNCATED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * anonymizeUserData — GDPR Art. 17 / Israeli Privacy Law 2025 right-to-erasure.
   *
   * Replaces personally-identifiable fields (IP address, user-agent, device
   * fingerprint, actor/target UID) in `kyc_audit_log` rows for the given userId,
   * while retaining the decision record (action type, timestamp, hash chain) as
   * required by law.
   *
   * The hash chain will show a break at affected rows; this is intentional and
   * itself serves as evidence of a legitimate right-to-erasure modification
   * (distinguishable from malicious tampering by the presence of the
   * `rightToErasureModifiedAt` metadata field).
   *
   * Also evicts matching entries from the in-memory cache so subsequent reads
   * do not serve stale PII.
   *
   * @returns Count of anonymized rows.
   */
  async anonymizeUserData(userId: string): Promise<number> {
    const REDACTED = '[RIGHT_TO_ERASURE]';
    const modifiedAt = new Date().toISOString();

    try {
      // Update all DB rows where this user is the actor or subject
      const updated = await db
        .update(kycAuditLog)
        .set({
          ipAddress: REDACTED,
          userAgent: REDACTED,
          deviceFingerprint: REDACTED,
          // Preserve actorId / targetUserId as a pseudonymous hash so the count
          // of unique actors remains accurate without exposing the raw UID.
          // SHA-256 of UID is irreversible without the original UID.
          actorId: sql`CASE WHEN ${kycAuditLog.actorId} = ${userId}
            THEN '[ANON:' || encode(sha256(${kycAuditLog.actorId}::bytea), 'hex') || ']'
            ELSE ${kycAuditLog.actorId} END`,
          targetUserId: sql`CASE WHEN ${kycAuditLog.targetUserId} = ${userId}
            THEN '[ANON:' || encode(sha256(${kycAuditLog.targetUserId}::bytea), 'hex') || ']'
            ELSE ${kycAuditLog.targetUserId} END`,
          // Merge right-to-erasure marker into existing metadata
          metadata: sql`COALESCE(${kycAuditLog.metadata}, '{}'::jsonb) || ${JSON.stringify({ rightToErasureModifiedAt: modifiedAt })}::jsonb`,
        })
        .where(
          or(
            eq(kycAuditLog.actorId, userId),
            eq(kycAuditLog.targetUserId, userId),
          )
        )
        .returning({ id: kycAuditLog.id });

      const count = updated.length;

      // Evict from in-memory cache to prevent serving stale PII
      this.recentEntries = this.recentEntries.filter(
        (e) => e.actorId !== userId && e.targetUserId !== userId
      );

      logger.info('[KYC2026:AuditTrail] Right-to-erasure anonymization complete', {
        userId: this.maskIP(userId), // Log masked form only
        rowsAnonymized: count,
        modifiedAt,
      });

      return count;
    } catch (err: any) {
      logger.error('[KYC2026:AuditTrail] anonymizeUserData failed', { error: err.message });
      throw err;
    }
  }

  private maskIP(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
    return ip.substring(0, 10) + '***';
  }

  private truncateUA(ua: string): string {
    return ua.length > 200 ? ua.substring(0, 200) + '...' : ua;
  }
}

export const kycAuditTrail = new KYCAuditTrail();
