/**
 * Blockchain-Style Audit Ledger Service
 * 
 * Provides immutable, cryptographically-chained audit trail for Pet Wash™
 * - Hash-chained records (like blockchain)
 * - Double-spend prevention for vouchers/discounts
 * - Tamper detection
 * - Customer-visible audit trail
 * - Admin fraud monitoring
 */

import { db } from '../db';
import { 
  auditLedger, 
  voucherRedemptions, 
  discountUsageLog,
  merkleSnapshots,
  type InsertAuditLedger,
  type InsertVoucherRedemption,
  type InsertDiscountUsageLog,
} from '@shared/schema';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import crypto from 'crypto';
import { nanoid } from 'nanoid';

export interface AuditEvent {
  eventType: 'wallet_generated' | 'voucher_redeemed' | 'loyalty_updated' | 'discount_used' | 'package_redeemed' | 'points_earned' | 'points_spent' | 'tier_changed' | 'auth_biometric_failure';
  userId: string;
  entityType: 'voucher' | 'loyalty_card' | 'discount' | 'wash_package' | 'wallet_pass' | 'points' | 'biometric_auth';
  entityId: string;
  action: 'created' | 'updated' | 'redeemed' | 'deleted' | 'generated' | 'earned' | 'spent' | 'upgraded' | 'failed';
  previousState?: any;
  newState: any;
  metadata?: any;
  
  // Security context
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  fraudScore?: number;
  fraudSignals?: string[];
}

export interface ChainVerificationResult {
  isValid: boolean;
  brokenAt?: number;
  totalRecords: number;
  verifiedRecords: number;
  errors: string[];
}

export class AuditLedgerService {
  
  /**
   * Record an immutable audit event in the blockchain-style ledger
   * Uses SERIALIZABLE transaction with SELECT FOR UPDATE to prevent chain forks
   */
  static async recordEvent(event: AuditEvent): Promise<number> {
    return await db.transaction(async (tx) => {
      try {
        // Lock the tail of the chain to prevent concurrent forks
        // Use FOR UPDATE to serialize access
        const lastRecord = await tx
          .select()
          .from(auditLedger)
          .orderBy(desc(auditLedger.blockNumber))
          .limit(1)
          .for('update'); // CRITICAL: Prevents race conditions
        
        const previousHash = lastRecord[0]?.currentHash || null;
        const blockNumber = lastRecord[0] ? lastRecord[0].blockNumber + 1 : 1;
        
        // Create hash payload
        const hashPayload = JSON.stringify({
          blockNumber,
          previousHash,
          eventType: event.eventType,
          userId: event.userId,
          entityType: event.entityType,
          entityId: event.entityId,
          action: event.action,
          newState: event.newState,
          timestamp: new Date().toISOString(),
        });
        
        // Generate SHA-256 hash
        const currentHash = crypto
          .createHash('sha256')
          .update(hashPayload)
          .digest('hex');
        
        // Insert into ledger (UNIQUE constraint on blockNumber prevents duplicates)
        const [record] = await tx
          .insert(auditLedger)
          .values({
            previousHash,
            currentHash,
            blockNumber,
            eventType: event.eventType,
            userId: event.userId,
            entityType: event.entityType,
            entityId: event.entityId,
            action: event.action,
            previousState: event.previousState || null,
            newState: event.newState,
            metadata: event.metadata || {},
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            deviceId: event.deviceId,
            fraudScore: event.fraudScore || 0,
            fraudSignals: event.fraudSignals || [],
            verified: true,
            verifiedAt: new Date(),
          })
          .returning();
        
        logger.info('[AuditLedger] Event recorded', {
          blockNumber,
          eventType: event.eventType,
          userId: event.userId,
          entityId: event.entityId,
        });
        
        return record.id;
        
      } catch (error) {
        logger.error('[AuditLedger] Failed to record event:', error);
        throw error;
      }
    });
  }
  
  /**
   * Record voucher redemption with double-spend prevention
   */
  static async recordVoucherRedemption(params: {
    voucherId: string;
    userId: string;
    amount: number;
    stationId?: string;
    franchiseId?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ success: boolean; redemptionCode?: string; error?: string }> {
    try {
      // 🔒 SECURITY: Check if voucher was already redeemed by ANYONE (not just this user)
      // This prevents voucher from being used multiple times by different users
      const existing = await db
        .select()
        .from(voucherRedemptions)
        .where(eq(voucherRedemptions.voucherId, params.voucherId))
        .limit(1);
      
      if (existing.length > 0) {
        logger.warn('[AuditLedger] Double-spend attempt detected', {
          voucherId: params.voucherId,
          userId: params.userId,
          originalUser: existing[0].userId,
          attemptingUser: params.userId,
        });
        
        return {
          success: false,
          error: 'Voucher already redeemed',
        };
      }
      
      // Generate one-time redemption code
      const redemptionCode = nanoid(32);
      
      // Create redemption hash
      const redemptionHash = crypto
        .createHash('sha256')
        .update(`${params.voucherId}|${params.userId}|${redemptionCode}|${Date.now()}`)
        .digest('hex');
      
      // Record in audit ledger first
      const auditId = await this.recordEvent({
        eventType: 'voucher_redeemed',
        userId: params.userId,
        entityType: 'voucher',
        entityId: params.voucherId,
        action: 'redeemed',
        newState: {
          amount: params.amount,
          redemptionCode,
          stationId: params.stationId,
          redeemedAt: new Date().toISOString(),
        },
        metadata: params.metadata,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      
      // Record redemption (database will enforce unique constraint to prevent race conditions)
      try {
        await db.insert(voucherRedemptions).values({
          voucherId: params.voucherId,
          userId: params.userId,
          redemptionCode,
          auditLedgerId: auditId,
          amount: params.amount.toString(),
          stationId: params.stationId,
          franchiseId: params.franchiseId,
          redemptionHash,
          verified: true,
        });
      } catch (dbError: any) {
        // Handle unique constraint violation from concurrent requests
        if (dbError.code === '23505') { // PostgreSQL unique violation
          logger.warn('[AuditLedger] Concurrent voucher redemption blocked by DB constraint', {
            voucherId: params.voucherId,
            userId: params.userId,
          });
          
          return {
            success: false,
            error: 'Voucher already redeemed',
          };
        }
        throw dbError;
      }
      
      logger.info('[AuditLedger] Voucher redemption recorded', {
        voucherId: params.voucherId,
        userId: params.userId,
        amount: params.amount,
      });
      
      return {
        success: true,
        redemptionCode,
      };
      
    } catch (error) {
      logger.error('[AuditLedger] Voucher redemption failed:', error);
      return {
        success: false,
        error: 'Redemption failed',
      };
    }
  }
  
  /**
   * Record discount usage with one-time enforcement
   */
  static async recordDiscountUsage(params: {
    discountCode: string;
    userId: string;
    discountAmount: number;
    originalPrice: number;
    finalPrice: number;
    stationId?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    oneTimePerUser?: boolean; // If true, check per user; if false, check globally
  }): Promise<{ success: boolean; usageToken?: string; error?: string }> {
    try {
      // 🔒 SECURITY: Check discount usage based on policy
      // oneTimePerUser=true: Each user can use once (marketing codes)
      // oneTimePerUser=false: Code can only be used once globally (gift codes)
      const whereCondition = params.oneTimePerUser !== false
        ? and(
            eq(discountUsageLog.discountCode, params.discountCode),
            eq(discountUsageLog.userId, params.userId)
          )
        : eq(discountUsageLog.discountCode, params.discountCode);
      
      const existing = await db
        .select()
        .from(discountUsageLog)
        .where(whereCondition)
        .limit(1);
      
      if (existing.length > 0) {
        logger.warn('[AuditLedger] Discount usage limit exceeded', {
          discountCode: params.discountCode,
          userId: params.userId,
          policy: params.oneTimePerUser !== false ? 'one-per-user' : 'one-time-global',
        });
        
        return {
          success: false,
          error: params.oneTimePerUser !== false 
            ? 'You have already used this discount code' 
            : 'This discount code has already been used',
        };
      }
      
      // Generate one-time usage token
      const usageToken = nanoid(32);
      
      // Create usage hash
      const usageHash = crypto
        .createHash('sha256')
        .update(`${params.discountCode}|${params.userId}|${usageToken}|${Date.now()}`)
        .digest('hex');
      
      // Record in audit ledger
      const auditId = await this.recordEvent({
        eventType: 'discount_used',
        userId: params.userId,
        entityType: 'discount',
        entityId: params.discountCode,
        action: 'redeemed',
        newState: {
          discountAmount: params.discountAmount,
          originalPrice: params.originalPrice,
          finalPrice: params.finalPrice,
          usedAt: new Date().toISOString(),
        },
        metadata: params.metadata,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      
      // Record usage (database will enforce unique constraint to prevent race conditions)
      try {
        await db.insert(discountUsageLog).values({
          discountCode: params.discountCode,
          userId: params.userId,
          usageToken,
          auditLedgerId: auditId,
          discountAmount: params.discountAmount.toString(),
          originalPrice: params.originalPrice.toString(),
          finalPrice: params.finalPrice.toString(),
          stationId: params.stationId,
          usageHash,
          verified: true,
        });
      } catch (dbError: any) {
        // Handle unique constraint violation from concurrent requests
        if (dbError.code === '23505') { // PostgreSQL unique violation
          logger.warn('[AuditLedger] Concurrent discount usage blocked by DB constraint', {
            discountCode: params.discountCode,
            userId: params.userId,
          });
          
          return {
            success: false,
            error: params.oneTimePerUser !== false 
              ? 'You have already used this discount code' 
              : 'This discount code has already been used',
          };
        }
        throw dbError;
      }
      
      logger.info('[AuditLedger] Discount usage recorded', {
        discountCode: params.discountCode,
        userId: params.userId,
        discountAmount: params.discountAmount,
      });
      
      return {
        success: true,
        usageToken,
      };
      
    } catch (error) {
      logger.error('[AuditLedger] Discount usage recording failed:', error);
      return {
        success: false,
        error: 'Usage recording failed',
      };
    }
  }
  
  /**
   * Get user's complete audit trail
   */
  static async getUserAuditTrail(userId: string, limit: number = 100) {
    try {
      const records = await db
        .select()
        .from(auditLedger)
        .where(eq(auditLedger.userId, userId))
        .orderBy(desc(auditLedger.createdAt))
        .limit(limit);
      
      return records;
    } catch (error) {
      logger.error('[AuditLedger] Failed to get user audit trail:', error);
      return [];
    }
  }
  
  /**
   * Get audit trail for specific entity (voucher, loyalty card, etc.)
   */
  static async getEntityAuditTrail(entityType: string, entityId: string) {
    try {
      const records = await db
        .select()
        .from(auditLedger)
        .where(
          and(
            eq(auditLedger.entityType, entityType),
            eq(auditLedger.entityId, entityId)
          )
        )
        .orderBy(desc(auditLedger.createdAt));
      
      return records;
    } catch (error) {
      logger.error('[AuditLedger] Failed to get entity audit trail:', error);
      return [];
    }
  }
  
  /**
   * Verify integrity of the hash chain
   */
  static async verifyChainIntegrity(
    startBlock?: number,
    endBlock?: number
  ): Promise<ChainVerificationResult> {
    try {
      const query = db.select().from(auditLedger).orderBy(auditLedger.blockNumber);
      
      const records = startBlock && endBlock
        ? await query.where(
            and(
              gte(auditLedger.blockNumber, startBlock),
              lte(auditLedger.blockNumber, endBlock)
            )
          )
        : await query;
      
      if (records.length === 0) {
        return {
          isValid: true,
          totalRecords: 0,
          verifiedRecords: 0,
          errors: [],
        };
      }
      
      const errors: string[] = [];
      let verifiedRecords = 0;
      
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const previousRecord = i > 0 ? records[i - 1] : null;
        
        // Verify hash linkage
        if (previousRecord) {
          if (record.previousHash !== previousRecord.currentHash) {
            errors.push(
              `Block ${record.blockNumber}: Hash mismatch. ` +
              `Expected ${previousRecord.currentHash}, got ${record.previousHash}`
            );
            
            return {
              isValid: false,
              brokenAt: record.blockNumber,
              totalRecords: records.length,
              verifiedRecords,
              errors,
            };
          }
        } else {
          // First record should have null previousHash
          if (record.previousHash !== null) {
            errors.push(`Block ${record.blockNumber}: Genesis block should have null previousHash`);
          }
        }
        
        // Verify current hash
        const hashPayload = JSON.stringify({
          blockNumber: record.blockNumber,
          previousHash: record.previousHash,
          eventType: record.eventType,
          userId: record.userId,
          entityType: record.entityType,
          entityId: record.entityId,
          action: record.action,
          newState: record.newState,
          timestamp: record.createdAt.toISOString(),
        });
        
        const expectedHash = crypto
          .createHash('sha256')
          .update(hashPayload)
          .digest('hex');
        
        if (record.currentHash !== expectedHash) {
          errors.push(
            `Block ${record.blockNumber}: Record hash invalid. ` +
            `Data may have been tampered with.`
          );
          
          return {
            isValid: false,
            brokenAt: record.blockNumber,
            totalRecords: records.length,
            verifiedRecords,
            errors,
          };
        }
        
        verifiedRecords++;
      }
      
      logger.info('[AuditLedger] Chain verification complete', {
        totalRecords: records.length,
        verifiedRecords,
        isValid: errors.length === 0,
      });
      
      return {
        isValid: errors.length === 0,
        totalRecords: records.length,
        verifiedRecords,
        errors,
      };
      
    } catch (error) {
      logger.error('[AuditLedger] Chain verification failed:', error);
      return {
        isValid: false,
        totalRecords: 0,
        verifiedRecords: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }
  
  /**
   * Create daily Merkle snapshot for external verification
   */
  static async createDailySnapshot(date: Date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Get all records for the day
      const records = await db
        .select()
        .from(auditLedger)
        .where(
          and(
            gte(auditLedger.createdAt, startOfDay),
            lte(auditLedger.createdAt, endOfDay)
          )
        )
        .orderBy(auditLedger.blockNumber);
      
      if (records.length === 0) {
        logger.info('[AuditLedger] No records for snapshot date', { date });
        return null;
      }
      
      // Create Merkle tree and get root hash
      const hashes = records.map(r => r.currentHash);
      const merkleRoot = this.calculateMerkleRoot(hashes);
      
      // Save snapshot
      const [snapshot] = await db
        .insert(merkleSnapshots)
        .values({
          snapshotDate: startOfDay.toISOString().split('T')[0],
          startBlockNumber: records[0].blockNumber,
          endBlockNumber: records[records.length - 1].blockNumber,
          merkleRoot,
          recordCount: records.length,
          verified: true,
        })
        .returning();
      
      logger.info('[AuditLedger] Daily snapshot created', {
        date: snapshot.snapshotDate,
        recordCount: snapshot.recordCount,
        merkleRoot: snapshot.merkleRoot,
      });
      
      return snapshot;
      
    } catch (error) {
      logger.error('[AuditLedger] Snapshot creation failed:', error);
      return null;
    }
  }
  
  /**
   * Calculate Merkle root hash from array of hashes
   */
  private static calculateMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) return '';
    if (hashes.length === 1) return hashes[0];
    
    let currentLevel = [...hashes];
    
    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        
        const combined = crypto
          .createHash('sha256')
          .update(left + right)
          .digest('hex');
        
        nextLevel.push(combined);
      }
      
      currentLevel = nextLevel;
    }
    
    return currentLevel[0];
  }
  
  /**
   * Get fraud monitoring dashboard data
   */
  static async getFraudMonitoringStats(timeframe: 'today' | 'week' | 'month' = 'today') {
    try {
      const now = new Date();
      let startDate: Date;
      
      switch (timeframe) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setDate(now.getDate() - 30));
          break;
      }
      
      // Get high-risk events
      const highRiskEvents = await db
        .select()
        .from(auditLedger)
        .where(
          and(
            gte(auditLedger.createdAt, startDate),
            gte(auditLedger.fraudScore, 50)
          )
        )
        .orderBy(desc(auditLedger.fraudScore));
      
      // Get event type distribution
      const eventDistribution = await db
        .select({
          eventType: auditLedger.eventType,
          count: sql<number>`count(*)`,
        })
        .from(auditLedger)
        .where(gte(auditLedger.createdAt, startDate))
        .groupBy(auditLedger.eventType);
      
      // Get users with suspicious activity
      const suspiciousUsers = await db
        .select({
          userId: auditLedger.userId,
          totalEvents: sql<number>`count(*)`,
          avgFraudScore: sql<number>`avg(${auditLedger.fraudScore})`,
          maxFraudScore: sql<number>`max(${auditLedger.fraudScore})`,
        })
        .from(auditLedger)
        .where(gte(auditLedger.createdAt, startDate))
        .groupBy(auditLedger.userId)
        .having(sql`avg(${auditLedger.fraudScore}) > 30`)
        .orderBy(desc(sql`avg(${auditLedger.fraudScore})`));
      
      return {
        timeframe,
        startDate,
        highRiskEvents,
        eventDistribution,
        suspiciousUsers,
        totalEvents: eventDistribution.reduce((sum, e) => sum + Number(e.count), 0),
      };
      
    } catch (error) {
      logger.error('[AuditLedger] Failed to get fraud stats:', error);
      return null;
    }
  }
}
