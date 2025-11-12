/**
 * Observance Evaluator
 * Evaluates pet holidays/observances and sends inbox messages with promo codes
 */

import { db as adminDb } from './lib/firebase-admin';
import { logger } from './lib/logger';
import type { ObservanceConfig, ObservanceEvent, DateRule } from '@shared/firestore-schema';

/**
 * Check if today matches a date rule
 */
function matchesDateRule(rule: DateRule, date: Date): boolean {
  if (rule.type === 'fixed_date') {
    return date.getMonth() + 1 === rule.month && date.getDate() === rule.day;
  }
  
  if (rule.type === 'last_weekday_in_month') {
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Get the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Map weekday string to JS day number (0 = Sunday)
    const weekdayMap: Record<string, number> = {
      'SUNDAY': 0,
      'MONDAY': 1,
      'TUESDAY': 2,
      'WEDNESDAY': 3,
      'THURSDAY': 4,
      'FRIDAY': 5,
      'SATURDAY': 6
    };
    
    const targetWeekday = weekdayMap[rule.weekday];
    
    // Find the last occurrence of this weekday in the month
    let lastOccurrence = lastDay.getDate();
    while (new Date(year, month, lastOccurrence).getDay() !== targetWeekday) {
      lastOccurrence--;
    }
    
    return date.getMonth() === rule.month - 1 && date.getDate() === lastOccurrence;
  }
  
  return false;
}

/**
 * Generate voucher code from template
 */
function generateVoucherCode(template: string, uid: string): string {
  const year = new Date().getFullYear();
  const random6 = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  return template
    .replace('{YYYY}', year.toString())
    .replace('{RND6}', random6)
    .replace('{UID}', uid.substring(0, 6).toUpperCase());
}

/**
 * Generate idempotency key from template
 */
function generateIdempotencyKey(template: string, uid: string): string {
  const year = new Date().getFullYear();
  
  return template
    .replace('{UID}', uid)
    .replace('{YYYY}', year.toString());
}

/**
 * Send observance message to user's inbox
 */
async function sendObservanceMessage(
  uid: string,
  event: ObservanceEvent,
  userLocale: 'he' | 'en',
  voucherCode?: string
): Promise<boolean> {
  try {
    const msgId = `obs_${event.key}_${Date.now()}`;
    const title = event.titles[userLocale];
    const bodyHtml = event.bodies[userLocale];
    
    // Prepare message data
    const messageData: any = {
      id: msgId,
      title,
      bodyHtml,
      type: event.promo.discount_percent && event.promo.discount_percent > 0 ? 'promo' : 'system',
      createdAt: new Date(),
      readAt: null,
      locale: userLocale,
      priority: 5, // High priority for special events
      attachments: [],
    };
    
    // Add voucher meta if applicable
    if (voucherCode && event.promo.discount_percent) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + event.promo.valid_days);
      
      messageData.meta = {
        voucherCode,
        discountPercent: event.promo.discount_percent,
        expiry: expiryDate,
      };
      
      messageData.ctaText = userLocale === 'he' ? 'השתמש בקופון' : 'Use Coupon';
      messageData.ctaUrl = '/payment';
    }
    
    // Send to user's inbox
    await adminDb
      .collection('userInbox')
      .doc(uid)
      .collection('messages')
      .doc(msgId)
      .set(messageData);
    
    logger.info(`Sent observance message to ${uid}: ${event.key}`);
    return true;
  } catch (error) {
    logger.error(`Error sending observance message to ${uid}`, error);
    return false;
  }
}

/**
 * Create voucher document for observance promotion
 */
async function createObservanceVoucher(
  uid: string,
  code: string,
  event: ObservanceEvent
): Promise<boolean> {
  try {
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + event.promo.valid_days);
    
    const voucherData = {
      code,
      type: 'CUSTOM',
      issuedToUid: uid,
      issuedAt: now,
      expiresAt,
      redeemedTxId: null,
      discountPercent: event.promo.discount_percent || 0,
      oneTime: true,
      status: 'active',
      campaignId: `observance_${event.key}`,
      createdBy: 'system',
      metadata: {
        observanceKey: event.key,
        observanceYear: now.getFullYear(),
      }
    };
    
    await adminDb.collection('vouchers').doc(code).set(voucherData);
    
    logger.info(`Created observance voucher: ${code} for ${uid}`);
    return true;
  } catch (error) {
    logger.error(`Error creating observance voucher`, error);
    return false;
  }
}

/**
 * Check if message already sent (idempotency)
 */
async function isAlreadySent(uid: string, idempotencyKey: string): Promise<boolean> {
  try {
    const doc = await adminDb
      .collection('observance_tracking')
      .doc(`${uid}_${idempotencyKey}`)
      .get();
    
    return doc.exists;
  } catch (error) {
    logger.error('Error checking observance idempotency', error);
    return false; // Assume not sent on error
  }
}

/**
 * Mark observance as sent
 */
async function markAsSent(uid: string, idempotencyKey: string): Promise<void> {
  try {
    await adminDb
      .collection('observance_tracking')
      .doc(`${uid}_${idempotencyKey}`)
      .set({
        sentAt: new Date(),
        idempotencyKey,
        uid,
      });
  } catch (error) {
    logger.error('Error marking observance as sent', error);
  }
}

/**
 * Process observances for a specific locale
 */
export async function processObservancesForLocale(
  locale: string
): Promise<{ sent: number; errors: number; skipped: number }> {
  let sent = 0;
  let errors = 0;
  let skipped = 0;
  
  try {
    // Fetch observances config for this locale
    const configDoc = await adminDb.collection('observances').doc(locale).get();
    
    if (!configDoc.exists) {
      logger.warn(`No observances config found for locale: ${locale}`);
      return { sent, errors, skipped };
    }
    
    const config = configDoc.data() as ObservanceConfig;
    const today = new Date();
    
    // Find matching events for today
    const matchingEvents = config.events.filter(event => 
      event.active && matchesDateRule(event.rule, today)
    );
    
    if (matchingEvents.length === 0) {
      logger.info(`No observances match today for locale: ${locale}`);
      return { sent, errors, skipped };
    }
    
    logger.info(`Found ${matchingEvents.length} observances for ${locale}: ${matchingEvents.map(e => e.key).join(', ')}`);
    
    // Get all users with this locale
    const usersSnapshot = await adminDb.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      const profileDoc = await adminDb.collection('users').doc(uid).collection('profile').doc('data').get();
      const profileData = profileDoc.data();
      
      // Check if user's locale matches
      const userLocale = profileData?.language || 'he';
      const localePrefix = locale.split('-')[0]; // 'en' from 'en-AU'
      
      if (userLocale !== localePrefix) {
        continue; // Skip users with different locale
      }
      
      // Process each matching event for this user
      for (const event of matchingEvents) {
        const idempotencyKey = generateIdempotencyKey(event.idempotency_key_template, uid);
        
        // Check if already sent this year
        const alreadySent = await isAlreadySent(uid, idempotencyKey);
        if (alreadySent) {
          skipped++;
          continue;
        }
        
        // Generate voucher code if promotion has discount
        let voucherCode: string | undefined;
        if (event.promo.discount_percent && event.promo.discount_percent > 0 && !event.promo.informational_only) {
          voucherCode = generateVoucherCode(event.promo.code_template, uid);
          
          // Create voucher document
          const voucherCreated = await createObservanceVoucher(uid, voucherCode, event);
          if (!voucherCreated) {
            errors++;
            continue;
          }
        }
        
        // Send inbox message
        const messageSent = await sendObservanceMessage(uid, event, userLocale as 'he' | 'en', voucherCode);
        
        if (messageSent) {
          await markAsSent(uid, idempotencyKey);
          sent++;
        } else {
          errors++;
        }
      }
    }
    
    logger.info(`Observances processed for ${locale}: ${sent} sent, ${errors} errors, ${skipped} skipped`);
    
  } catch (error) {
    logger.error(`Error processing observances for locale ${locale}`, error);
  }
  
  return { sent, errors, skipped };
}

/**
 * Process all observances (daily job)
 */
export async function processAllObservances(): Promise<{
  totalSent: number;
  totalErrors: number;
  totalSkipped: number;
}> {
  logger.info('Starting observance processing for all locales...');
  
  const locales = ['en-AU', 'he-IL']; // Can be expanded
  let totalSent = 0;
  let totalErrors = 0;
  let totalSkipped = 0;
  
  for (const locale of locales) {
    const result = await processObservancesForLocale(locale);
    totalSent += result.sent;
    totalErrors += result.errors;
    totalSkipped += result.skipped;
  }
  
  logger.info(`Observance processing complete: ${totalSent} sent, ${totalErrors} errors, ${totalSkipped} skipped`);
  
  return { totalSent, totalErrors, totalSkipped };
}
