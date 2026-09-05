import { db } from './lib/firebase-admin';
import { nanoid } from 'nanoid';
import { logger } from './lib/logger';
import { redactEmail } from './lib/redaction';

export interface BirthdayVoucher {
  code: string;
  uid: string;
  email: string;
  dogName?: string;
  discountPercent: number;
  birthdayYear: number;
  createdAt: Date;
  expiresAt: Date;
  isRedeemed: boolean;
  redeemedAt?: Date;
  orderId?: string;
}

export interface BirthdayEmailData {
  email: string;
  firstName?: string;
  dogName?: string;
  voucherCode: string;
  expiresAt: Date;
  birthdayYear: number;
}

/**
 * Thrown when a birthday voucher for (uid, birthdayYear) already exists.
 * Distinct from a real failure so the caller can skip quietly instead of
 * retrying or alerting.
 */
export class BirthdayVoucherAlreadyIssuedError extends Error {
  readonly existingCode: string;
  constructor(uid: string, birthdayYear: number, existingCode: string) {
    super(`Birthday voucher already issued for ${uid} in ${birthdayYear}`);
    this.name = 'BirthdayVoucherAlreadyIssuedError';
    this.existingCode = existingCode;
  }
}

/**
 * Generate unique birthday voucher code
 */
function generateBirthdayCode(dogName?: string): string {
  const prefix = 'BDAY';
  const namePart = dogName ? dogName.substring(0, 4).toUpperCase() : 'PET';
  const year = new Date().getFullYear();
  const uniqueId = nanoid(6).toUpperCase();
  
  return `${prefix}-${namePart}-${year}-${uniqueId}`;
}

/**
 * Create birthday voucher for a user
 */
export async function createBirthdayVoucher(
  uid: string,
  email: string,
  birthdayYear: number,
  dogName?: string
): Promise<BirthdayVoucher> {
  try {
    const voucherCode = generateBirthdayCode(dogName);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt);
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity
    
    const voucher: BirthdayVoucher = {
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
    
    // ── Exactly-once per (uid, birthdayYear) ────────────────────────────────
    // Callers used to guard with hasBirthdayVoucherThisYear() and then call
    // this function — a check-then-act race. Each voucher doc is keyed by a
    // RANDOM code, so two concurrent issuers both saw an empty query and both
    // wrote, landing on different doc ids: two 10%-off vouchers for one
    // birthday. The daily cron is not single-flighted (Cloud Run can hold more
    // than one instance, and Scheduler retries), so this was reachable.
    //
    // The duplicate check and the write now happen inside one Firestore
    // transaction. Reading the query THROUGH the transaction puts the read set
    // under contention control, so a concurrent issuer for the same
    // (uid, birthdayYear) is aborted and retried by the SDK, and on retry it
    // sees the committed voucher and bails. The guard lives here rather than in
    // the caller so every future caller inherits it.
    await db.runTransaction(async (tx) => {
      const dupQuery = db
        .collection('birthday_vouchers')
        .where('uid', '==', uid)
        .where('birthdayYear', '==', birthdayYear)
        .limit(1);
      const existing = await tx.get(dupQuery);
      if (!existing.empty) {
        throw new BirthdayVoucherAlreadyIssuedError(
          uid, birthdayYear, existing.docs[0].id,
        );
      }
      tx.set(db.collection('birthday_vouchers').doc(voucherCode), {
        ...voucher,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    });
    
    // Post-release 2026-09-03 (backlog P1 · AUDIT-LOG-4): the prior log
    // put the FULL voucher code + raw recipient email into stdout. The
    // voucher code is a one-shot bearer token — a leaked log line lets
    // any observer redeem it. The email is PII. Emit only the last-4 of
    // the code (enough for correlation) and a redacted email.
    const codeSuffix = voucherCode.slice(-4);
    logger.info('[BirthdayVoucher] created', {
      codeSuffix,
      email: redactEmail(email),
      dogName: dogName || 'Pet',
    });
    
    return voucher;
  } catch (error) {
    // Not a failure — the race backstop did its job. Let it through untouched
    // and unlogged-as-error so the caller can skip quietly.
    if (error instanceof BirthdayVoucherAlreadyIssuedError) throw error;
    logger.error('Error creating birthday voucher', error);
    throw error;
  }
}

/**
 * Check if user already has a birthday voucher for this year
 * Throws error on Firestore failure to prevent duplicate issuance
 */
export async function hasBirthdayVoucherThisYear(uid: string, birthdayYear: number): Promise<boolean> {
  try {
    const snapshot = await db
      .collection('birthday_vouchers')
      .where('uid', '==', uid)
      .where('birthdayYear', '==', birthdayYear)
      .limit(1)
      .get();
    
    return !snapshot.empty;
  } catch (error) {
    logger.error('CRITICAL: Error checking birthday voucher for', uid, error);
    // Throw error to prevent duplicate voucher creation on transient failures
    throw new Error(`Failed to check birthday voucher status: ${error}`);
  }
}

/**
 * Get birthday voucher by code
 */
export async function getBirthdayVoucher(code: string): Promise<BirthdayVoucher | null> {
  try {
    const doc = await db.collection('birthday_vouchers').doc(code).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    if (!data) return null;
    
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      expiresAt: new Date(data.expiresAt),
      redeemedAt: data.redeemedAt ? new Date(data.redeemedAt) : undefined
    } as BirthdayVoucher;
  } catch (error) {
    logger.error('Error getting birthday voucher', error);
    return null;
  }
}

/**
 * Validate birthday voucher (check if valid and not expired)
 */
export async function validateBirthdayVoucher(code: string): Promise<{
  isValid: boolean;
  voucher?: BirthdayVoucher;
  reason?: string;
}> {
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
  } catch (error) {
    logger.error('Error validating birthday voucher', error);
    return { isValid: false, reason: 'Validation error' };
  }
}

/**
 * Redeem birthday voucher
 */
export async function redeemBirthdayVoucher(
  code: string,
  orderId: string
): Promise<{ success: boolean; voucher?: BirthdayVoucher; error?: string }> {
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
  } catch (error) {
    logger.error('Error redeeming birthday voucher', error);
    return { success: false, error: 'Redemption error' };
  }
}

/**
 * Get user's birthday vouchers
 */
export async function getUserBirthdayVouchers(uid: string): Promise<BirthdayVoucher[]> {
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
      } as BirthdayVoucher;
    });
  } catch (error) {
    logger.error('Error getting user birthday vouchers', error);
    return [];
  }
}
