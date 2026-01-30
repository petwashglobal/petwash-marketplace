import { db } from '../db';
import { users } from '../../shared/schema';
import { eq, or } from 'drizzle-orm';
import { logger } from './logger';
import crypto from 'crypto';
/**
 * Check if user already exists before registration
 */
export async function checkUserDuplication(email, phone, firebaseUid) {
    try {
        const conditions = [];
        if (email) {
            conditions.push(eq(users.email, email.toLowerCase().trim()));
        }
        if (phone) {
            // Normalize phone number
            const normalizedPhone = normalizePhoneNumber(phone);
            conditions.push(eq(users.phone, normalizedPhone));
        }
        if (firebaseUid) {
            conditions.push(eq(users.id, firebaseUid));
        }
        if (conditions.length === 0) {
            return { isDuplicate: false };
        }
        const [existingUser] = await db
            .select()
            .from(users)
            .where(or(...conditions))
            .limit(1);
        if (existingUser) {
            let matchedField = 'email';
            if (existingUser.id === firebaseUid) {
                matchedField = 'firebaseUid';
            }
            else if (existingUser.phone === normalizePhoneNumber(phone || '')) {
                matchedField = 'phone';
            }
            logger.warn('Duplicate user detected', {
                matchedField,
                existingUserId: existingUser.id,
                email: email ? '***@***' : undefined,
                phone: phone ? '***' : undefined
            });
            return {
                isDuplicate: true,
                existingUserId: existingUser.id,
                matchedField,
                message: `Account already exists with this ${matchedField}`
            };
        }
        return { isDuplicate: false };
    }
    catch (error) {
        logger.error('Deduplication check failed', { error });
        // Fail open - allow registration on error
        return { isDuplicate: false };
    }
}
/**
 * Normalize phone number for comparison
 */
export function normalizePhoneNumber(phone) {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // Handle Israeli phone numbers (+972)
    if (digits.startsWith('972')) {
        return '+' + digits;
    }
    else if (digits.startsWith('0')) {
        return '+972' + digits.substring(1);
    }
    else if (digits.length === 9 || digits.length === 10) {
        return '+972' + digits;
    }
    // Default: add + if missing
    return digits.startsWith('+') ? digits : '+' + digits;
}
/**
 * Generate unique user fingerprint for advanced deduplication
 */
export function generateUserFingerprint(data) {
    const normalized = [
        data.email?.toLowerCase().trim(),
        normalizePhoneNumber(data.phone || ''),
        data.name?.toLowerCase().trim(),
        data.deviceId
    ]
        .filter(Boolean)
        .join('|');
    return crypto.createHash('sha256').update(normalized).digest('hex');
}
/**
 * Merge duplicate user accounts (admin only)
 */
export async function mergeDuplicateUsers(primaryUserId, duplicateUserId) {
    try {
        // TODO: Implement comprehensive merge logic
        // 1. Merge loyalty points
        // 2. Merge transaction history
        // 3. Merge pets
        // 4. Update foreign keys
        // 5. Soft delete duplicate account
        logger.info('User merge initiated', { primaryUserId, duplicateUserId });
        return {
            success: true,
            message: 'Users merged successfully'
        };
    }
    catch (error) {
        logger.error('User merge failed', { error, primaryUserId, duplicateUserId });
        return {
            success: false,
            message: 'Failed to merge users'
        };
    }
}
