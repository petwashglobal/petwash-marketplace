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
    // Ordered by reliability and speed
    const geolocationServices = [
      'https://ipinfo.io/json',
      'https://ipapi.co/json/',
      'https://ip-api.com/json/'
    ];

    for (const service of geolocationServices) {
      try {
        // Use 800ms timeout - balance between speed and reliability
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 800);
        
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
        
        // Country → Language mapping
        // Priority: saved user preference overrides IP detection for all non-IL countries
        const COUNTRY_LANGUAGE_MAP: Record<string, Language> = {
          // Israel: always Hebrew regardless of user preference
          'IL': 'he',
          'Israel': 'he',
          // France and French overseas territories
          'FR': 'fr',
          'BE': 'fr',
          'CH': 'fr',
          'LU': 'fr',
          // Spanish-speaking countries
          'ES': 'es',
          'MX': 'es',
          'AR': 'es',
          'CO': 'es',
          'CL': 'es',
          'PE': 'es',
          // Russia and CIS
          'RU': 'ru',
          'BY': 'ru',
          'KZ': 'ru',
          'UA': 'ru',
          // Arabic-speaking countries
          'AE': 'ar',
          'SA': 'ar',
          'EG': 'ar',
          'JO': 'ar',
          'LB': 'ar',
          'IQ': 'ar',
          'KW': 'ar',
          'QA': 'ar',
          'BH': 'ar',
          'OM': 'ar',
        };

        const mappedLanguage = COUNTRY_LANGUAGE_MAP[countryCode];

        // Israeli IP: always override to Hebrew, save preference
        if (countryCode === 'IL' || countryCode === 'Israel') {
          logger.info('🇮🇱 Israeli IP detected - defaulting to Hebrew');
          localStorage.setItem('language', 'he');
          return 'he';
        }

        // For non-Israeli IPs: user saved preference takes priority over IP mapping
        const savedLanguage = localStorage.getItem('language') as Language;
        if (savedLanguage && validLanguages.includes(savedLanguage)) {
          logger.debug('🌍 International IP - using saved preference', { countryCode, savedLanguage });
          return savedLanguage;
        }

        // Apply country→language mapping if available
        if (mappedLanguage) {
          logger.info(`🌍 IP detected country ${countryCode} → language ${mappedLanguage}`);
          localStorage.setItem('language', mappedLanguage);
          return mappedLanguage;
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