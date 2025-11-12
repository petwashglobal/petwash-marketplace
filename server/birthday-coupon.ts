// Birthday Coupon System - 10% discount once per year, 30-day validity window
import { db } from './lib/firebase-admin';
import { logger } from './lib/logger';

export interface BirthdayCouponStatus {
  isEligible: boolean;
  discountPercent: number;
  birthdayYear?: number;
  reason?: string;
  validUntil?: Date;
}

/**
 * Check if a date is within the birthday window (30 days before or after)
 */
function isWithinBirthdayWindow(dob: { month: number; day: number }, currentDate: Date = new Date()): boolean {
  const birthMonth = dob.month;  // Already 1-12 from parsing
  const birthDay = dob.day;
  
  // Create birthday dates for this year and next year (month is 0-11 in JS Date, so subtract 1)
  const thisYearBirthday = new Date(currentDate.getFullYear(), birthMonth - 1, birthDay);
  const nextYearBirthday = new Date(currentDate.getFullYear() + 1, birthMonth - 1, birthDay);
  const lastYearBirthday = new Date(currentDate.getFullYear() - 1, birthMonth - 1, birthDay);
  
  // Calculate days difference
  const daysDiff1 = Math.abs((currentDate.getTime() - thisYearBirthday.getTime()) / (1000 * 60 * 60 * 24));
  const daysDiff2 = Math.abs((currentDate.getTime() - nextYearBirthday.getTime()) / (1000 * 60 * 60 * 24));
  const daysDiff3 = Math.abs((currentDate.getTime() - lastYearBirthday.getTime()) / (1000 * 60 * 60 * 24));
  
  const minDiff = Math.min(daysDiff1, daysDiff2, daysDiff3);
  
  return minDiff <= 30;
}

/**
 * Get the current birthday year (which year's birthday window are we in?)
 * The birthday year is the year of the birthday that the current 30-day window belongs to.
 */
function getCurrentBirthdayYear(dob: { month: number; day: number }, currentDate: Date = new Date()): number {
  const birthMonth = dob.month - 1;  // Convert to 0-11 for JS Date
  const birthDay = dob.day;
  
  const thisYearBirthday = new Date(currentDate.getFullYear(), birthMonth, birthDay);
  const lastYearBirthday = new Date(currentDate.getFullYear() - 1, birthMonth, birthDay);
  const nextYearBirthday = new Date(currentDate.getFullYear() + 1, birthMonth, birthDay);
  
  // Calculate days from each birthday
  const daysFromThisYear = (currentDate.getTime() - thisYearBirthday.getTime()) / (1000 * 60 * 60 * 24);
  const daysFromLastYear = (currentDate.getTime() - lastYearBirthday.getTime()) / (1000 * 60 * 60 * 24);
  const daysFromNextYear = (currentDate.getTime() - nextYearBirthday.getTime()) / (1000 * 60 * 60 * 24);
  
  // Find which birthday is closest
  const absDaysThisYear = Math.abs(daysFromThisYear);
  const absDaysLastYear = Math.abs(daysFromLastYear);
  const absDaysNextYear = Math.abs(daysFromNextYear);
  
  // Return the year of the closest birthday (within 30 days)
  if (absDaysThisYear <= 30) {
    return currentDate.getFullYear();
  } else if (absDaysLastYear <= 30) {
    return currentDate.getFullYear() - 1;
  } else if (absDaysNextYear <= 30) {
    return currentDate.getFullYear() + 1;
  }
  
  // Fallback: use current year (shouldn't reach here if isWithinBirthdayWindow is true)
  return currentDate.getFullYear();
}

/**
 * Check if user has already used birthday coupon for current year
 */
async function hasUsedBirthdayCouponThisYear(uid: string, birthdayYear: number): Promise<boolean> {
  try {
    // Check loyalty_ledger for birthday coupon usage in this birthday year
    const ledgerSnapshot = await db
      .collection('users')
      .doc(uid)
      .collection('loyalty_ledger')
      .where('discountType', '==', 'birthday_coupon')
      .where('birthdayYear', '==', birthdayYear)
      .limit(1)
      .get();
    
    return !ledgerSnapshot.empty;
  } catch (error) {
    logger.error('Error checking birthday coupon usage', error);
    return false; // Default to not used on error (give benefit of doubt)
  }
}

/**
 * Parse YYYY-MM-DD string into month/day without timezone conversion
 */
function parseDateString(dateStr: string): { month: number; day: number; year: number } | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  
  return { year, month, day };
}

/**
 * Get user's date of birth from profile (returns parsed date components)
 */
async function getUserDateOfBirth(uid: string): Promise<{ month: number; day: number; year: number } | null> {
  try {
    const profileDoc = await db
      .collection('users')
      .doc(uid)
      .collection('profile')
      .doc('data')
      .get();
    
    if (!profileDoc.exists) {
      return null;
    }
    
    const profileData = profileDoc.data();
    const dobString = profileData?.dateOfBirth || profileData?.dob;
    
    if (!dobString) {
      return null;
    }
    
    // Parse date string (YYYY-MM-DD) without timezone conversion
    const parsed = parseDateString(dobString);
    
    if (!parsed) {
      logger.error('Invalid date of birth format', dobString);
      return null;
    }
    
    return parsed;
  } catch (error) {
    logger.error('Error getting user date of birth', error);
    return null;
  }
}

/**
 * Check if user is eligible for birthday coupon discount
 */
export async function checkBirthdayCouponEligibility(uid: string): Promise<BirthdayCouponStatus> {
  try {
    // Get user's date of birth
    const dob = await getUserDateOfBirth(uid);
    
    if (!dob) {
      return {
        isEligible: false,
        discountPercent: 0,
        reason: 'No date of birth on file'
      };
    }
    
    // Check if within 30-day birthday window
    const currentDate = new Date();
    const inWindow = isWithinBirthdayWindow(dob, currentDate);
    
    if (!inWindow) {
      return {
        isEligible: false,
        discountPercent: 0,
        reason: 'Outside 30-day birthday window'
      };
    }
    
    // Get current birthday year
    const birthdayYear = getCurrentBirthdayYear(dob, currentDate);
    
    // Check if already used this year
    const alreadyUsed = await hasUsedBirthdayCouponThisYear(uid, birthdayYear);
    
    if (alreadyUsed) {
      return {
        isEligible: false,
        discountPercent: 0,
        reason: `Already used birthday coupon for ${birthdayYear}`
      };
    }
    
    // Calculate valid until date (30 days from birthday)
    const thisYearBirthday = new Date(currentDate.getFullYear(), dob.month - 1, dob.day);
    const validUntil = new Date(thisYearBirthday);
    validUntil.setDate(validUntil.getDate() + 30);
    
    // Eligible!
    return {
      isEligible: true,
      discountPercent: 10,
      birthdayYear,
      validUntil
    };
  } catch (error) {
    logger.error('Error checking birthday coupon eligibility', error);
    return {
      isEligible: false,
      discountPercent: 0,
      reason: 'Error checking eligibility'
    };
  }
}

/**
 * Mark birthday coupon as used for specified year
 */
export async function markBirthdayCouponUsed(
  uid: string, 
  orderId: string, 
  discountAmount: number,
  originalPrice: number,
  finalPrice: number,
  packageId: number,
  birthdayYear: number
): Promise<void> {
  try {
    // Log to loyalty ledger with provided birthdayYear
    await db
      .collection('users')
      .doc(uid)
      .collection('loyalty_ledger')
      .doc(orderId)
      .set({
        orderId,
        amount: discountAmount,
        discountPercent: 10,
        discountType: 'birthday_coupon',
        birthdayYear,
        timestamp: new Date(),
        type: 'discount_applied',
        packageId,
        originalPrice,
        finalPrice
      });
    
    logger.info(`Birthday coupon used: ${uid} - Year ${birthdayYear} - ₪${discountAmount.toFixed(2)}`);
  } catch (error) {
    logger.error('Error marking birthday coupon used', error);
    throw error;
  }
}
