import type { Language } from './i18n';
import { logger } from './logger';

export interface GeolocationData {
  country: string;
  countryCode: string;
  ip: string;
}

/**
 * Detects user's location and returns appropriate default language
 * GLOBAL DEFAULT: English (en)
 * ISRAEL ONLY: Hebrew (he)
 * Users can manually select: Arabic, Russian, French, Spanish
 */
export async function getDefaultLanguageByLocation(): Promise<Language> {
  try {
    const validLanguages: Language[] = ['en', 'he', 'ar', 'ru', 'fr', 'es'];
    
    // ALWAYS check IP location first for Israeli users
    // Try multiple IP geolocation services for reliability
    const geolocationServices = [
      'https://ipapi.co/json/',
      'https://ip-api.com/json/',
      'https://ipinfo.io/json'
    ];

    for (const service of geolocationServices) {
      try {
        // Add 400ms timeout for instant performance (as per requirements)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 400);
        
        const response = await fetch(service, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const data = await response.json();
        
        // Check different response formats from different services
        const countryCode = data.country_code || data.countryCode || data.country;
        
        // Israeli IP addresses ALWAYS get Hebrew (Israel-specific default)
        if (countryCode === 'IL' || countryCode === 'Israel') {
          logger.info('🇮🇱 Israeli IP detected - defaulting to Hebrew');
          logger.debug('Country code detected', { countryCode });
          logger.debug('IP address', { ip: data.ip });
          localStorage.setItem('language', 'he');
          return 'he';
        }
        
        // For non-Israeli IPs, check if user has a saved preference
        const savedLanguage = localStorage.getItem('language') as Language;
        if (savedLanguage && validLanguages.includes(savedLanguage)) {
          logger.debug('🌍 International IP - using saved preference', { countryCode, savedLanguage });
          return savedLanguage;
        }
        
        // All other countries default to English (GLOBAL DEFAULT)
        logger.info('🌍 International IP detected - defaulting to English (global default)', { countryCode });
        return 'en';
        
      } catch (error) {
        logger.warn('Geolocation service failed', { service, error });
        continue;
      }
    }

    // Fallback: check saved preference if geolocation fails
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && validLanguages.includes(savedLanguage)) {
      logger.warn('Geolocation detection failed - using saved preference', { savedLanguage });
      return savedLanguage;
    }

    // Final fallback to English (GLOBAL DEFAULT) if all services fail
    logger.warn('Geolocation detection failed - defaulting to English (global default)');
    return 'en';

  } catch (error) {
    logger.error('Geolocation error', error);
    return 'en'; // GLOBAL DEFAULT
  }
}

/**
 * Get detailed location information for analytics
 */
export async function getLocationInfo(): Promise<GeolocationData | null> {
  try {
    const response = await fetch('https://ipapi.co/json/');
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    return {
      country: data.country_name || data.country || 'Unknown',
      countryCode: data.country_code || data.countryCode || 'XX',
      ip: data.ip || 'Unknown'
    };

  } catch (error) {
    logger.error('Failed to get location info', error);
    return null;
  }
}