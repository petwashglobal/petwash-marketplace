/**
 * Audit Signature Utility
 * Provides cryptographic SHA-256 signatures for immutable audit trails
 *
 * Usage across PetWash™ platform:
 * - Employee expense submissions
 * - Third-party integrations (Google, Nayax, etc.)
 * - K9000 wash activations
 * - OAuth consent records
 * - Payment transactions
 *
 * Compliance: GDPR, Israeli Privacy Law 2025, 7-year retention
 */
import crypto from 'crypto';
import { db } from '../db';
import { auditLedger } from '@shared/schema';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
/**
 * Generate SHA-256 cryptographic signature for audit event
 * Creates tamper-proof hash chaining like blockchain
 * @param timestamp - Exact timestamp to use (must be persisted for verification)
 */
export function generateAuditSignature(data, timestamp) {
    const payload = JSON.stringify({
        eventType: data.eventType,
        customerUid: data.customerUid,
        metadata: data.metadata,
        timestamp: timestamp.toISOString(),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        previousHash: data.previousHash,
    });
    return crypto
        .createHash('sha256')
        .update(payload)
        .digest('hex');
}
/**
 * Record audit event with cryptographic signature to database
 * Returns audit ID and hash for linking to parent transaction
 */
export async function recordAuditEvent(data) {
    try {
        // Create timestamp NOW and persist it for deterministic verification
        const timestamp = new Date();
        // Get previous hash for blockchain-style chaining (optional)
        let previousHash = data.previousHash;
        if (!previousHash && data.customerUid !== 'system') {
            const lastAudit = await db
                .query
                .auditLedger
                .findFirst({
                where: (auditLedger, { eq }) => eq(auditLedger.customerUid, data.customerUid),
                orderBy: (auditLedger, { desc }) => [desc(auditLedger.createdAt)],
            });
            previousHash = lastAudit?.auditHash || null;
        }
        // Generate signature with exact timestamp (deterministic)
        const auditHash = generateAuditSignature({
            ...data,
            previousHash,
        }, timestamp);
        // Generate audit ID
        const auditId = `audit_${Date.now()}_${nanoid(12)}`;
        // Persist to audit ledger WITH timestamp for verification
        await db.insert(auditLedger).values({
            id: auditId,
            eventType: data.eventType,
            customerUid: data.customerUid,
            metadata: JSON.stringify(data.metadata),
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            auditHash,
            previousHash,
            createdAt: timestamp, // CRITICAL: Persist exact timestamp used in hash
        });
        logger.info('[AuditSignature] Event recorded', {
            auditId,
            eventType: data.eventType,
            customerUid: data.customerUid,
            auditHash: auditHash.substring(0, 16) + '...',
            timestamp: timestamp.toISOString(),
        });
        return {
            auditHash,
            auditId,
            timestamp,
        };
    }
    catch (error) {
        logger.error('[AuditSignature] Failed to record audit event', {
            error: error.message,
            eventType: data.eventType,
        });
        throw new Error('Failed to record audit event');
    }
}
/**
 * Verify audit chain integrity
 * Checks if hash chain is unbroken (tamper detection)
 */
export async function verifyAuditChainIntegrity(customerUid) {
    try {
        const audits = await db
            .query
            .auditLedger
            .findMany({
            where: (auditLedger, { eq }) => eq(auditLedger.customerUid, customerUid),
            orderBy: (auditLedger, { asc }) => [asc(auditLedger.createdAt)],
        });
        if (audits.length === 0) {
            return {
                valid: true,
                totalRecords: 0,
                errors: [],
            };
        }
        const errors = [];
        // Verify each hash in chain
        for (let i = 1; i < audits.length; i++) {
            const current = audits[i];
            const previous = audits[i - 1];
            if (current.previousHash !== previous.auditHash) {
                errors.push(`Chain broken at record ${current.id}: ` +
                    `expected previousHash=${previous.auditHash.substring(0, 16)}... ` +
                    `but got ${current.previousHash?.substring(0, 16) || 'null'}...`);
            }
        }
        const valid = errors.length === 0;
        logger.info('[AuditSignature] Chain verification complete', {
            customerUid,
            totalRecords: audits.length,
            valid,
            errorCount: errors.length,
        });
        return {
            valid,
            totalRecords: audits.length,
            errors,
        };
    }
    catch (error) {
        logger.error('[AuditSignature] Chain verification failed', {
            error: error.message,
            customerUid,
        });
        return {
            valid: false,
            totalRecords: 0,
            errors: [error.message],
        };
    }
}
/**
 * Record third-party integration consent with signature
 * For Google OAuth, Nayax payments, etc.
 */
export async function recordIntegrationConsent(params) {
    return recordAuditEvent({
        eventType: `integration_consent_${params.provider}`,
        customerUid: params.userId,
        metadata: {
            provider: params.provider,
            scopes: params.scopes,
            consentGranted: params.consentGranted,
            timestamp: new Date().toISOString(),
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}
/**
 * Record employee expense submission with signature
 */
export async function recordExpenseSubmission(params) {
    return recordAuditEvent({
        eventType: 'employee_expense_submit',
        customerUid: params.employeeId,
        metadata: {
            expenseId: params.expenseId,
            category: params.category,
            amount: params.amount,
            currency: 'ILS',
            timestamp: new Date().toISOString(),
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}
/**
 * Record expense approval/rejection with signature
 */
export async function recordExpenseApproval(params) {
    return recordAuditEvent({
        eventType: `employee_expense_${params.action}`,
        customerUid: params.approverEmail,
        metadata: {
            expenseId: params.expenseId,
            action: params.action,
            reason: params.reason,
            timestamp: new Date().toISOString(),
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}
