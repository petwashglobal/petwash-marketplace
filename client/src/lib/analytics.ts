// Google Analytics 4 Event Tracking
// Comprehensive analytics for Pet Wash™

import { getAnalytics, isSupported, logEvent as firebaseLogEvent, setUserProperties, type Analytics } from "firebase/analytics";
import { app } from "./firebase";
import { logger } from "./logger";

// Initialize Google Analytics (browser-only, with support check)
let analytics: Analytics | null = null;

if (typeof window !== 'undefined' && !import.meta.env.DEV) {
  // Skip Analytics in development mode to prevent Firebase Installations API permission errors
  // Wrap entire analytics init in try-catch to prevent any initialization errors from blocking the app
  try {
    isSupported().then(yes => {
      if (yes) {
        try {
          analytics = getAnalytics(app);
          logger.info("✅ Google Analytics 4 initialized");
        } catch (error) {
          logger.warn("⚠️ Google Analytics initialization failed (fail-safe mode)", error);
          analytics = null;
        }
      } else {
        logger.debug("Google Analytics not supported in this environment");
      }
    }).catch(error => {
      logger.warn("⚠️ Failed to check Analytics support (fail-safe mode)", error);
      analytics = null;
    });
  } catch (error) {
    logger.warn("⚠️ Analytics module failed to load (fail-safe mode)", error);
    analytics = null;
  }
} else if (import.meta.env.DEV) {
  logger.debug("⏭️ Google Analytics skipped in development mode");
}

// User Events
export const trackSignUp = (method: 'email' | 'google' | 'google_one_tap' | 'facebook' | 'apple' | 'microsoft' | 'instagram' | 'tiktok' | 'phone' | 'biometric', userId: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'sign_up', {
    method,
    user_id: userId,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Sign up tracked', { method, userId });
};

export const trackLogin = (method: 'email' | 'google' | 'google_one_tap' | 'facebook' | 'apple' | 'microsoft' | 'instagram' | 'tiktok' | 'password' | 'magic_link' | 'phone' | 'biometric', userId: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'login', {
    method,
    user_id: userId,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Login tracked', { method, userId });
};

export const trackLogout = (userId: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'logout', {
    user_id: userId,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Logout tracked', { userId });
};

export const trackSwitchAccount = (previousUserId: string | null) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'switch_account', {
    previous_user_id: previousUserId,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Switch account tracked', { previousUserId });
};

// KYC Events
export const trackKYCSubmitted = (userId: string, documentType: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'kyc_submitted', {
    user_id: userId,
    document_type: documentType,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: KYC submitted', { userId, documentType });
};

export const trackKYCApproved = (userId: string, discountApplied: boolean) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'kyc_approved', {
    user_id: userId,
    discount_applied: discountApplied,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: KYC approved', { userId, discountApplied });
};

export const trackKYCRejected = (userId: string, reason: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'kyc_rejected', {
    user_id: userId,
    rejection_reason: reason,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: KYC rejected', { userId, reason });
};

// Payment Events
export const trackPaymentInitiated = (userId: string, amount: number, packageName: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'begin_checkout', {
    user_id: userId,
    value: amount,
    currency: 'ILS',
    items: [{ item_name: packageName, price: amount }],
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Payment initiated', { userId, amount, packageName });
};

export const trackPaymentSuccess = (userId: string, amount: number, packageName: string, transactionId: string) => {
  if (!analytics) return;
  
  // Use 'payment_succeeded' as the event name per requirements
  firebaseLogEvent(analytics, 'payment_succeeded', {
    user_id: userId,
    transaction_id: transactionId,
    value: amount,
    currency: 'ILS',
    items: [{ item_name: packageName, price: amount }],
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Payment succeeded', { userId, amount, packageName, transactionId });
};

export const trackPaymentFailed = (userId: string, amount: number, errorReason: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'payment_failed', {
    user_id: userId,
    value: amount,
    currency: 'ILS',
    error_reason: errorReason,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Payment failed', { userId, amount, errorReason });
};

// Coupon Events
export const trackCouponApplied = (userId: string, couponCode: string, discountAmount: number, couponType: 'birthday' | 'kyc' | 'loyalty' | 'promo') => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'coupon_applied', {
    user_id: userId,
    coupon_code: couponCode,
    discount_amount: discountAmount,
    coupon_type: couponType,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Coupon applied', { userId, couponCode, discountAmount, couponType });
};

export const trackCouponRedeemed = (userId: string, couponCode: string, packageName: string, finalAmount: number) => {
  if (!analytics) return;
  
  // Use 'voucher_redeemed' as the primary event name per requirements
  firebaseLogEvent(analytics, 'voucher_redeemed', {
    user_id: userId,
    coupon_code: couponCode,
    package_name: packageName,
    final_amount: finalAmount,
    currency: 'ILS',
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Voucher redeemed', { userId, couponCode, packageName, finalAmount });
};

// Alias for clarity
export const trackVoucherRedeemed = trackCouponRedeemed;

// Modern E-Voucher Events (2025-2026)
export const trackVoucherIssued = (
  voucherId: string, 
  amount: number, 
  currency: string = 'ILS',
  purchaserUid?: string,
  recipientEmail?: string
) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'voucher_issued', {
    voucher_id: voucherId,
    value: amount,
    currency,
    purchaser_uid: purchaserUid || null,
    recipient_email: recipientEmail || null,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Voucher issued', { voucherId, amount, currency, purchaserUid, recipientEmail });
};

export const trackVoucherClaimed = (
  userId: string,
  voucherId: string,
  amount: number,
  currency: string = 'ILS'
) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'voucher_claimed', {
    user_id: userId,
    voucher_id: voucherId,
    value: amount,
    currency,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Voucher claimed', { userId, voucherId, amount, currency });
};

// Loyalty Program Events
export const trackLoyaltyTierChange = (userId: string, oldTier: string, newTier: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'loyalty_tier_change', {
    user_id: userId,
    old_tier: oldTier,
    new_tier: newTier,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Loyalty tier changed', { userId, oldTier, newTier });
};

// Engagement Events
export const trackPageView = (pageName: string, userId?: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'page_view', {
    page_title: pageName,
    page_location: window.location.href,
    user_id: userId,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Page view', { pageName, userId });
};

export const trackAIChatInteraction = (userId: string, messageCount: number, language: 'he' | 'en') => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'ai_chat_interaction', {
    user_id: userId,
    message_count: messageCount,
    language,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: AI chat interaction', { userId, messageCount, language });
};

// User Properties
export const setUserAnalyticsProperties = (userId: string, properties: {
  loyaltyTier?: string;
  isKYCVerified?: boolean;
  totalWashes?: number;
  language?: 'he' | 'en';
}) => {
  if (!analytics) return;
  
  setUserProperties(analytics, {
    user_id: userId,
    loyalty_tier: properties.loyaltyTier,
    kyc_verified: properties.isKYCVerified,
    total_washes: properties.totalWashes,
    preferred_language: properties.language
  });
  
  logger.debug('GA4: User properties set', { userId, properties });
};

// Error Tracking
export const trackError = (errorType: string, errorMessage: string, userId?: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'exception', {
    description: `${errorType}: ${errorMessage}`,
    fatal: false,
    user_id: userId,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Error tracked', { errorType, errorMessage, userId });
};

// Package Selection Events
export const trackPackageSelection = (packageName: string, price: number, userId?: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'select_item', {
    user_id: userId,
    items: [{ item_name: packageName, price, currency: 'ILS' }] as any,
    value: price,
    currency: 'ILS',
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Package selected', { packageName, price, userId });
};

// E-Voucher Purchase (Gift Card)
export const trackEVoucherPurchase = (packageName: string, amount: number, transactionId: string, userId?: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'purchase', {
    user_id: userId,
    transaction_id: transactionId,
    value: amount,
    currency: 'ILS',
    items: [{ 
      item_name: packageName, 
      item_category: 'gift_card',
      price: amount 
    }],
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: E-Voucher purchased', { packageName, amount, transactionId, userId });
};

// Language Change
export const trackLanguageChange = (fromLanguage: string, toLanguage: string, userId?: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'language_change', {
    user_id: userId,
    from_language: fromLanguage,
    to_language: toLanguage,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Language changed', { fromLanguage, toLanguage, userId });
};

// WhatsApp Chat Click
export const trackWhatsAppClick = (userId?: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'contact_support', {
    user_id: userId,
    method: 'whatsapp',
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: WhatsApp clicked', { userId });
};

// QR Code Redemption
export const trackQRRedemption = (voucherId: string, washCount: number, userId?: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'qr_voucher_redeemed', {
    user_id: userId,
    voucher_id: voucherId,
    wash_count: washCount,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: QR voucher redeemed', { voucherId, washCount, userId });
};

// Header Navigation Clicks
export const trackHeaderAuthClick = (action: 'login' | 'signup' | 'account' | 'logout', userId?: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'header_navigation', {
    user_id: userId,
    action,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Header navigation', { action, userId });
};

// Accessibility Feature Toggle
export const trackAccessibilityFeature = (feature: string, enabled: boolean, userId?: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'accessibility_toggle', {
    user_id: userId,
    feature,
    enabled,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Accessibility feature', { feature, enabled, userId });
};

// Pet Management Events
export const trackPetAdded = (userId: string, petId: string, species: string, petName: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'pet_added', {
    user_id: userId,
    pet_id: petId,
    species,
    pet_name: petName,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Pet added', { userId, petId, species, petName });
};

export const trackPetUpdated = (userId: string, petId: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'pet_updated', {
    user_id: userId,
    pet_id: petId,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Pet updated', { userId, petId });
};

export const trackPetDeleted = (userId: string, petId: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'pet_deleted', {
    user_id: userId,
    pet_id: petId,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Pet deleted', { userId, petId });
};

// Inbox Events
export const trackInboxOpened = (userId: string, unreadCount: number) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'inbox_opened', {
    user_id: userId,
    unread_count: unreadCount,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Inbox opened', { userId, unreadCount });
};

export const trackMessageRead = (userId: string, messageId: string, messageType: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'message_read', {
    user_id: userId,
    message_id: messageId,
    message_type: messageType,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Message read', { userId, messageId, messageType });
};

// Franchise Events
export const trackFranchiseDashboardOpened = (franchiseId: string, userId: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'dashboard_opened', {
    franchise_id: franchiseId,
    user_id: userId,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Franchise dashboard opened', { franchiseId, userId });
};

export const trackFranchiseMessageAcknowledged = (franchiseId: string, messageId: string, category: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'message_acknowledged', {
    franchise_id: franchiseId,
    message_id: messageId,
    message_category: category,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Franchise message acknowledged', { franchiseId, messageId, category });
};

export const trackFranchiseReportDownloaded = (franchiseId: string, reportType: 'excel' | 'pdf', period: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'report_downloaded', {
    franchise_id: franchiseId,
    report_type: reportType,
    report_period: period,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Franchise report downloaded', { franchiseId, reportType, period });
};

export const trackFranchiseSupportTicketCreated = (franchiseId: string, ticketId: string, category: string, priority: string) => {
  if (!analytics) return;
  
  firebaseLogEvent(analytics, 'support_ticket_created', {
    franchise_id: franchiseId,
    ticket_id: ticketId,
    ticket_category: category,
    ticket_priority: priority,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('GA4: Franchise support ticket created', { franchiseId, ticketId, category, priority });
};

export default analytics;
