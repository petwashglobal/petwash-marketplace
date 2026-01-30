import { db } from './lib/firebase-admin';
import { nanoid } from 'nanoid';
import { logger } from './lib/logger';
/**
 * Generate unique birthday voucher code
 */
function generateBirthdayCode(dogName) {
    const prefix = 'BDAY';
    const namePart = dogName ? dogName.substring(0, 4).toUpperCase() : 'PET';
    const year = new Date().getFullYear();
    const uniqueId = nanoid(6).toUpperCase();
    return `${prefix}-${namePart}-${year}-${uniqueId}`;
}
/**
 * Create birthday voucher for a user
 */
export async function createBirthdayVoucher(uid, email, birthdayYear, dogName) {
    try {
        const voucherCode = generateBirthdayCode(dogName);
        const createdAt = new Date();
        const expiresAt = new Date(createdAt);
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity
        const voucher = {
            code: voucherCode,
            uid,
            email,
            dogName,
            discountPercent: 10,
            birthdayYear,
            createdAt,
            expiresAt,
            isRedeemed: false
        };
        // Store in Firestore
        await db
            .collection('birthday_vouchers')
            .doc(voucherCode)
            .set({
            ...voucher,
            createdAt: createdAt.toISOString(),
            expiresAt: expiresAt.toISOString()
        });
        logger.info(`Birthday voucher created: ${voucherCode} for ${email} (${dogName || 'Pet'})`);
        return voucher;
    }
    catch (error) {
        logger.error('Error creating birthday voucher', error);
        throw error;
    }
}
/**
 * Check if user already has a birthday voucher for this year
 * Throws error on Firestore failure to prevent duplicate issuance
 */
export async function hasBirthdayVoucherThisYear(uid, birthdayYear) {
    try {
        const snapshot = await db
            .collection('birthday_vouchers')
            .where('uid', '==', uid)
            .where('birthdayYear', '==', birthdayYear)
            .limit(1)
            .get();
        return !snapshot.empty;
    }
    catch (error) {
        logger.error('CRITICAL: Error checking birthday voucher for', uid, error);
        // Throw error to prevent duplicate voucher creation on transient failures
        throw new Error(`Failed to check birthday voucher status: ${error}`);
    }
}
/**
 * Get birthday voucher by code
 */
export async function getBirthdayVoucher(code) {
    try {
        const doc = await db.collection('birthday_vouchers').doc(code).get();
        if (!doc.exists) {
            return null;
        }
        const data = doc.data();
        if (!data)
            return null;
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            expiresAt: new Date(data.expiresAt),
            redeemedAt: data.redeemedAt ? new Date(data.redeemedAt) : undefined
        };
    }
    catch (error) {
        logger.error('Error getting birthday voucher', error);
        return null;
    }
}
/**
 * Validate birthday voucher (check if valid and not expired)
 */
export async function validateBirthdayVoucher(code) {
    try {
        const voucher = await getBirthdayVoucher(code);
        if (!voucher) {
            return { isValid: false, reason: 'Voucher not found' };
        }
        if (voucher.isRedeemed) {
            return { isValid: false, reason: 'Voucher already redeemed', voucher };
        }
        const now = new Date();
        if (now > voucher.expiresAt) {
            return { isValid: false, reason: 'Voucher expired', voucher };
        }
        return { isValid: true, voucher };
    }
    catch (error) {
        logger.error('Error validating birthday voucher', error);
        return { isValid: false, reason: 'Validation error' };
    }
}
/**
 * Redeem birthday voucher
 */
export async function redeemBirthdayVoucher(code, orderId) {
    try {
        const validation = await validateBirthdayVoucher(code);
        if (!validation.isValid || !validation.voucher) {
            return { success: false, error: validation.reason };
        }
        // Mark as redeemed
        await db
            .collection('birthday_vouchers')
            .doc(code)
            .update({
            isRedeemed: true,
            redeemedAt: new Date().toISOString(),
            orderId
        });
        const updatedVoucher = {
            ...validation.voucher,
            isRedeemed: true,
            redeemedAt: new Date(),
            orderId
        };
        logger.info(`Birthday voucher redeemed: ${code} for order ${orderId}`);
        return { success: true, voucher: updatedVoucher };
    }
    catch (error) {
        logger.error('Error redeeming birthday voucher', error);
        return { success: false, error: 'Redemption error' };
    }
}
/**
 * Get user's birthday vouchers
 */
export async function getUserBirthdayVouchers(uid) {
    try {
        const snapshot = await db
            .collection('birthday_vouchers')
            .where('uid', '==', uid)
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                createdAt: new Date(data.createdAt),
                expiresAt: new Date(data.expiresAt),
                redeemedAt: data.redeemedAt ? new Date(data.redeemedAt) : undefined
            };
        });
    }
    catch (error) {
        logger.error('Error getting user birthday vouchers', error);
        return [];
    }
}
