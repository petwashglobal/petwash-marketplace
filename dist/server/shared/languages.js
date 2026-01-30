/**
 * Pet Wash Stay™ - Global Multi-Language Support
 *
 * Supported Languages (Leading Countries):
 * - Hebrew (עברית) - PRIMARY for Israeli market
 * - English - Global/USA/UK/AUS/CAN
 * - Arabic (العربية) - Middle East
 * - Russian (Русский) - Russia/Eastern Europe
 * - French (Français) - France/Canada
 * - Spanish (Español) - Spain/Latin America
 * - German (Deutsch) - Germany/Austria/Switzerland
 * - Italian (Italiano) - Italy
 * - Portuguese (Português) - Portugal/Brazil
 * - Chinese (中文) - China/Taiwan/Singapore
 * - Japanese (日本語) - Japan
 */
export const SUPPORTED_LANGUAGES = {
    he: {
        code: 'he',
        name: 'עברית',
        nativeName: 'עברית',
        direction: 'rtl',
        flag: '🇮🇱',
        country: 'Israel',
        currency: 'ILS',
        currencySymbol: '₪',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        timezone: 'Asia/Jerusalem',
    },
    en: {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
        flag: '🇺🇸',
        country: 'United States',
        currency: 'USD',
        currencySymbol: '$',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        timezone: 'America/New_York',
    },
    ar: {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        direction: 'rtl',
        flag: '🇸🇦',
        country: 'Saudi Arabia',
        currency: 'SAR',
        currencySymbol: 'ر.س',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h',
        timezone: 'Asia/Riyadh',
    },
    ru: {
        code: 'ru',
        name: 'Russian',
        nativeName: 'Русский',
        direction: 'ltr',
        flag: '🇷🇺',
        country: 'Russia',
        currency: 'RUB',
        currencySymbol: '₽',
        dateFormat: 'DD.MM.YYYY',
        timeFormat: '24h',
        timezone: 'Europe/Moscow',
    },
    fr: {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        direction: 'ltr',
        flag: '🇫🇷',
        country: 'France',
        currency: 'EUR',
        currencySymbol: '€',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        timezone: 'Europe/Paris',
    },
    es: {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        direction: 'ltr',
        flag: '🇪🇸',
        country: 'Spain',
        currency: 'EUR',
        currencySymbol: '€',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        timezone: 'Europe/Madrid',
    },
    de: {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        direction: 'ltr',
        flag: '🇩🇪',
        country: 'Germany',
        currency: 'EUR',
        currencySymbol: '€',
        dateFormat: 'DD.MM.YYYY',
        timeFormat: '24h',
        timezone: 'Europe/Berlin',
    },
    it: {
        code: 'it',
        name: 'Italian',
        nativeName: 'Italiano',
        direction: 'ltr',
        flag: '🇮🇹',
        country: 'Italy',
        currency: 'EUR',
        currencySymbol: '€',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        timezone: 'Europe/Rome',
    },
    pt: {
        code: 'pt',
        name: 'Portuguese',
        nativeName: 'Português',
        direction: 'ltr',
        flag: '🇵🇹',
        country: 'Portugal',
        currency: 'EUR',
        currencySymbol: '€',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        timezone: 'Europe/Lisbon',
    },
    zh: {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文',
        direction: 'ltr',
        flag: '🇨🇳',
        country: 'China',
        currency: 'CNY',
        currencySymbol: '¥',
        dateFormat: 'YYYY/MM/DD',
        timeFormat: '24h',
        timezone: 'Asia/Shanghai',
    },
    ja: {
        code: 'ja',
        name: 'Japanese',
        nativeName: '日本語',
        direction: 'ltr',
        flag: '🇯🇵',
        country: 'Japan',
        currency: 'JPY',
        currencySymbol: '¥',
        dateFormat: 'YYYY/MM/DD',
        timeFormat: '24h',
        timezone: 'Asia/Tokyo',
    },
};
export const DEFAULT_LANGUAGE = 'he'; // Hebrew primary
export const FALLBACK_LANGUAGE = 'en'; // English fallback
/**
 * Get language configuration
 */
export function getLanguageConfig(code) {
    return SUPPORTED_LANGUAGES[code] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
}
/**
 * Get all supported language codes
 */
export function getSupportedLanguageCodes() {
    return Object.keys(SUPPORTED_LANGUAGES);
}
/**
 * Check if language is RTL (Right-to-Left)
 */
export function isRTL(code) {
    return SUPPORTED_LANGUAGES[code]?.direction === 'rtl';
}
/**
 * Get currency for language/country
 */
export function getCurrency(code) {
    const config = getLanguageConfig(code);
    return {
        code: config.currency,
        symbol: config.currencySymbol,
    };
}
/**
 * Get timezone for language/country
 */
export function getTimezone(code) {
    return getLanguageConfig(code).timezone;
}
/**
 * Format date according to language locale
 */
export function formatDate(date, code) {
    const config = getLanguageConfig(code);
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    };
    return new Intl.DateTimeFormat(code, options).format(date);
}
/**
 * Format time according to language locale
 */
export function formatTime(date, code) {
    const config = getLanguageConfig(code);
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: config.timeFormat === '12h',
    };
    return new Intl.DateTimeFormat(code, options).format(date);
}
/**
 * Format currency amount according to language locale
 */
export function formatCurrency(amountCents, code) {
    const config = getLanguageConfig(code);
    const amount = amountCents / 100;
    return new Intl.NumberFormat(code, {
        style: 'currency',
        currency: config.currency,
    }).format(amount);
}
/**
 * Country-to-language mapping for auto-detection
 */
export const COUNTRY_TO_LANGUAGE = {
    // Israel
    IL: 'he',
    ISR: 'he',
    // USA & English-speaking
    US: 'en',
    USA: 'en',
    GB: 'en',
    GBR: 'en',
    AU: 'en',
    AUS: 'en',
    CA: 'en',
    CAN: 'en',
    NZ: 'en',
    IE: 'en',
    // Arabic countries
    SA: 'ar',
    AE: 'ar',
    EG: 'ar',
    JO: 'ar',
    LB: 'ar',
    KW: 'ar',
    QA: 'ar',
    BH: 'ar',
    OM: 'ar',
    // Russia & Eastern Europe
    RU: 'ru',
    UA: 'ru',
    BY: 'ru',
    KZ: 'ru',
    // France & French-speaking
    FR: 'fr',
    BE: 'fr',
    CH: 'fr',
    // Spain & Spanish-speaking
    ES: 'es',
    MX: 'es',
    AR: 'es',
    CO: 'es',
    CL: 'es',
    // Germany & German-speaking
    DE: 'de',
    AT: 'de',
    // Italy
    IT: 'it',
    // Portugal & Brazil
    PT: 'pt',
    BR: 'pt',
    // China
    CN: 'zh',
    TW: 'zh',
    HK: 'zh',
    SG: 'zh',
    // Japan
    JP: 'ja',
};
/**
 * Get language code from country code
 */
export function getLanguageFromCountry(countryCode) {
    return COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()] || DEFAULT_LANGUAGE;
}
