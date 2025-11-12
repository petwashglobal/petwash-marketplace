import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { type Language } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import {
  trackPageView as firebaseTrackPageView,
  trackPackageSelection as firebaseTrackPackageSelection,
  trackEVoucherPurchase as firebaseTrackEVoucherPurchase,
  trackLoyaltyTierChange,
  trackLanguageChange as firebaseTrackLanguageChange,
  trackAccessibilityFeature as firebaseTrackAccessibilityFeature,
  trackWhatsAppClick as firebaseTrackWhatsAppClick,
  trackQRRedemption as firebaseTrackQRRedemption,
  trackLogin as firebaseTrackLogin,
  trackHeaderAuthClick as firebaseTrackHeaderAuthClick,
} from '@/lib/analytics';

interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
  language?: Language;
  userId?: string;
}

export function useAnalytics() {
  const [location] = useLocation();

  // Track page views on location change
  useEffect(() => {
    const pageName = location === '/' ? 'home' : location.slice(1);
    firebaseTrackPageView(pageName);
  }, [location]);

  // Generic event tracker (kept for backward compatibility, but delegates to Firebase)
  const trackEvent = (event: AnalyticsEvent) => {
    // This is now a deprecated wrapper - components should use specific tracking functions
    logger.warn('Deprecated: Use specific tracking functions from @/lib/analytics instead');
  };

  // Track package selections
  const trackPackageSelection = (packageName: string, price: number, language: Language, userId?: string) => {
    firebaseTrackPackageSelection(packageName, price, userId);
  };

  // Track e-voucher purchases
  const trackEVoucherPurchase = (packageName: string, amount: number, language: Language, userId?: string) => {
    const transactionId = `evoucher_${Date.now()}`;
    firebaseTrackEVoucherPurchase(packageName, amount, transactionId, userId);
  };

  // Track loyalty program interactions
  const trackLoyaltyInteraction = (action: string, tier?: string, language?: Language, userId?: string) => {
    if (action === 'tier_change' && tier) {
      // For tier changes, we need old and new tier - this is a simplified version
      trackLoyaltyTierChange(userId || 'unknown', 'previous', tier);
    }
    // Other loyalty interactions can be logged as custom events if needed
  };

  // Track language changes
  const trackLanguageChange = (fromLanguage: Language, toLanguage: Language, userId?: string) => {
    firebaseTrackLanguageChange(fromLanguage, toLanguage, userId);
  };

  // Track accessibility feature usage
  const trackAccessibilityFeature = (feature: string, enabled: boolean, language: Language, userId?: string) => {
    firebaseTrackAccessibilityFeature(feature, enabled, userId);
  };

  // Track WhatsApp chat clicks
  const trackWhatsAppClick = (language: Language, userId?: string) => {
    firebaseTrackWhatsAppClick(userId);
  };

  // Track QR code scans/redemptions
  const trackQRRedemption = (voucherId: string, washCount: number, language: Language, userId?: string) => {
    firebaseTrackQRRedemption(voucherId, washCount, userId);
  };

  // Track user authentication
  const trackUserAuth = (action: 'login' | 'logout', language: Language, userId?: string) => {
    if (action === 'login' && userId) {
      firebaseTrackLogin('email', userId);
    }
    // Logout doesn't have a specific Firebase event, but could be added if needed
  };

  // Track header auth link clicks
  const trackHeaderAuthClick = (action: 'login' | 'signup' | 'account' | 'logout', language: Language, userId?: string) => {
    firebaseTrackHeaderAuthClick(action, userId);
  };

  return {
    trackEvent,
    trackPackageSelection,
    trackEVoucherPurchase,
    trackLoyaltyInteraction,
    trackLanguageChange,
    trackAccessibilityFeature,
    trackWhatsAppClick,
    trackQRRedemption,
    trackUserAuth,
    trackHeaderAuthClick,
  };
}

// Hook for tracking page-specific analytics
export function usePageAnalytics(pageName: string, language: Language, userId?: string) {
  useEffect(() => {
    firebaseTrackPageView(pageName, userId);
  }, [pageName, userId]);
}
