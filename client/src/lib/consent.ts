/**
 * Shared Consent Management Utilities
 * Centralized consent preferences handling for GDPR compliance
 */

import { getApiUrl } from '@/lib/apiConfig';

export interface ConsentPreferences {
  necessary: boolean; // Always true
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  location: boolean;
  camera: boolean;
  washReminders: boolean;
  vaccinationReminders: boolean;
  promotionalNotifications: boolean;
  timestamp: string;
}

/**
 * Get current consent preferences from localStorage
 */
export function getConsentPreferences(): ConsentPreferences | null {
  const saved = localStorage.getItem('petwash_consent_preferences');
  if (!saved) return null;
  
  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error('Failed to parse consent preferences:', error);
    return null;
  }
}

/**
 * Check if user has already given consent
 */
export function hasConsentPreferences(): boolean {
  return !!localStorage.getItem('petwash_consent_preferences');
}

/**
 * Apply consent preferences to Google Tag Manager
 * CRITICAL: Must be called on app load for returning users
 */
export function applyConsentPreferences(consent: ConsentPreferences): void {
  if (typeof window === 'undefined' || !(window as any).gtag) return;

  const gtag = (window as any).gtag;

  // Analytics consent
  gtag('consent', 'update', {
    analytics_storage: consent.analytics ? 'granted' : 'denied'
  });

  // Marketing consent (ads, personalization, user data)
  gtag('consent', 'update', {
    ad_storage: consent.marketing ? 'granted' : 'denied',
    ad_user_data: consent.marketing ? 'granted' : 'denied',
    ad_personalization: consent.marketing ? 'granted' : 'denied'
  });
}

/**
 * Save consent to backend for audit trail and cross-device sync
 */
async function saveConsentToBackend(consent: ConsentPreferences): Promise<void> {
  try {
    await fetch(getApiUrl('/api/consent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consent),
    });
  } catch (error) {
    console.error('Failed to save consent to backend:', error);
    // Continue anyway - localStorage is saved
  }
}

/**
 * Save consent preferences (localStorage + Google Tag Manager + backend)
 * This is the single source of truth for saving consent
 */
export async function saveConsentPreferences(consent: ConsentPreferences): Promise<void> {
  // Update timestamp
  consent.timestamp = new Date().toISOString();
  
  // Save to localStorage
  localStorage.setItem('petwash_consent_preferences', JSON.stringify(consent));
  localStorage.setItem('petwash_cookie_consent', consent.analytics || consent.marketing ? 'accepted' : 'rejected');
  
  // Apply to Google Tag Manager
  applyConsentPreferences(consent);
  
  // Save to backend for audit trail
  await saveConsentToBackend(consent);
}

/**
 * Preset: Accept all consents
 */
export function createAcceptAllConsent(): ConsentPreferences {
  return {
    necessary: true,
    functional: true,
    analytics: true,
    marketing: true,
    location: true,
    camera: true,
    washReminders: true,
    vaccinationReminders: true,
    promotionalNotifications: true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Preset: Reject all non-essential consents (GDPR default)
 */
export function createRejectAllConsent(): ConsentPreferences {
  return {
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
    location: false,
    camera: false,
    washReminders: false,
    vaccinationReminders: false,
    promotionalNotifications: false,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Load consent from backend (for cross-device sync)
 */
export async function loadConsentFromBackend(): Promise<ConsentPreferences | null> {
  try {
    const response = await fetch(getApiUrl('/api/consent'));
    if (response.ok) {
      const data = await response.json();
      return data.consent || null;
    }
  } catch (error) {
    console.error('Failed to fetch backend consent:', error);
  }
  return null;
}
