import type { Language } from './i18n';
import { logger } from './logger';

export interface GeolocationData {
  country: string;
  countryCode: string;
  ip: string;
}

/**
 * Detects user's location and returns the appropriate language.
 *
 * Priority (same order used everywhere in the app):
 *   1. pw_lang          — canonical saved preference
 *   2. petwash_lang     — legacy key, migration read-only
 *   3. language         — legacy key, migration read-only
 *   4. geo-based first-visit default
 *   5. 'en'             — global fallback
 *
 * Rule: geo ONLY decides the default on a first visit (no saved preference).
 * After the user manually changes language, the saved preference always wins.
 * This function NEVER writes to localStorage.
 */
export async function getDefaultLanguageByLocation(): Promise<Language> {
  try {
    const validLanguages: Language[] = ['en', 'he', 'ar', 'ru', 'fr', 'es'];

    // Read saved preference using canonical key + legacy migration fallback.
    // If any saved preference exists, return it immediately — geo never overrides.
    const canonicalSaved = localStorage.getItem('pw_lang') as Language;
    if (canonicalSaved && validLanguages.includes(canonicalSaved)) {
      logger.debug('🌐 Saved language preference (pw_lang) found, skipping geo detection', { saved: canonicalSaved });
      return canonicalSaved;
    }
    const legacySaved = (localStorage.getItem('petwash_lang') || localStorage.getItem('language')) as Language;
    if (legacySaved && validLanguages.includes(legacySaved)) {
      logger.debug('🌐 Saved language preference (legacy key) found, skipping geo detection', { saved: legacySaved });
      return legacySaved;
    }

    // No saved preference — detect by IP for first-visit default only.
    // Try multiple services for reliability, ordered by speed.
    const geolocationServices = [
      'https://ipinfo.io/json',
      'https://ipapi.co/json/',
      'https://ip-api.com/json/'
    ];

    for (const service of geolocationServices) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 800);

        const response = await fetch(service, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!response.ok) continue;

        const data = await response.json();
        const countryCode = data.country_code || data.countryCode || data.country;

        // Country → first-visit language mapping
        const COUNTRY_LANGUAGE_MAP: Record<string, Language> = {
          // Israel: Hebrew as first-visit default (geo only, not a permanent override)
          'IL': 'he',
          'Israel': 'he',
          // France and French overseas territories
          'FR': 'fr', 'BE': 'fr', 'CH': 'fr', 'LU': 'fr',
          // Spanish-speaking countries
          'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es', 'PE': 'es',
          // Russia and CIS
          'RU': 'ru', 'BY': 'ru', 'KZ': 'ru', 'UA': 'ru',
          // Arabic-speaking countries
          'AE': 'ar', 'SA': 'ar', 'EG': 'ar', 'JO': 'ar', 'LB': 'ar',
          'IQ': 'ar', 'KW': 'ar', 'QA': 'ar', 'BH': 'ar', 'OM': 'ar',
        };

        const mappedLanguage = COUNTRY_LANGUAGE_MAP[countryCode];

        if (countryCode === 'IL' || countryCode === 'Israel') {
          logger.info('🇮🇱 Israeli IP, first visit — defaulting to Hebrew');
          return 'he';
        }

        if (mappedLanguage) {
          logger.info(`🌍 IP detected country ${countryCode} → language ${mappedLanguage}`);
          return mappedLanguage;
        }

        logger.info('🌍 International IP — defaulting to English (global default)', { countryCode });
        return 'en';

      } catch (error) {
        logger.warn('Geolocation service failed', { service, error });
        continue;
      }
    }

    // All geo services failed
    logger.warn('Geolocation detection failed — defaulting to English (global default)');
    return 'en';

  } catch (error) {
    logger.error('Geolocation error', error);
    return 'en';
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