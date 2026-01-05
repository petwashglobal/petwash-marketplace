/**
 * Pet Wash™ Brand Constants & Utilities
 * 
 * CRITICAL BRAND RULE:
 * The trademark symbol (™) must ALWAYS appear to the RIGHT of "Wash"
 * regardless of text direction (LTR or RTL languages).
 * 
 * CORRECT: Pet Wash™
 * WRONG: ™Pet Wash (can happen in RTL due to bidirectional text)
 * 
 * The brand name "Pet Wash™" must NEVER be transliterated.
 * Keep it in English in ALL languages (Hebrew, Arabic, Russian, etc.)
 */

// Unicode Bidirectional Control Characters
const LRM = '\u200E'; // Left-to-Right Mark - prevents RTL reordering
const RLM = '\u200F'; // Right-to-Left Mark

/**
 * Official brand name with proper bidirectional handling
 * Use this in all RTL contexts to ensure trademark stays on the right
 */
export const BRAND_NAME = 'Pet Wash™';
export const BRAND_NAME_RTL_SAFE = `Pet Wash™${LRM}`; // LRM after ™ anchors it in RTL

/**
 * Sub-brands with proper trademark handling
 */
export const SUB_BRANDS = {
  K9000: 'K9000™',
  K9000_RTL_SAFE: `K9000™${LRM}`,
  
  SITTER_SUITE: 'Sitter Suite™',
  SITTER_SUITE_RTL_SAFE: `Sitter Suite™${LRM}`,
  
  WALK_MY_PET: 'Walk My Pet™',
  WALK_MY_PET_RTL_SAFE: `Walk My Pet™${LRM}`,
  
  PET_TREK: 'PetTrek™',
  PET_TREK_RTL_SAFE: `PetTrek™${LRM}`,
  
  PAW_FINDER: 'Paw Finder™',
  PAW_FINDER_RTL_SAFE: `Paw Finder™${LRM}`,
  
  ACADEMY: 'Pet Wash Academy™',
  ACADEMY_RTL_SAFE: `Pet Wash Academy™${LRM}`,
  
  ENRIQUE: 'Enrique™',
  ENRIQUE_RTL_SAFE: `Enrique™${LRM}`,
  
  PLUSH_LAB: 'The Plush Lab™',
  PLUSH_LAB_RTL_SAFE: `The Plush Lab™${LRM}`,
} as const;

/**
 * Get brand name with proper bidirectional handling for the current language
 * @param language - Current language code (en, he, ar, ru, fr, es)
 * @returns Brand name with proper RTL handling if needed
 */
export function getBrandName(language: string): string {
  const isRTL = language === 'he' || language === 'ar';
  return isRTL ? BRAND_NAME_RTL_SAFE : BRAND_NAME;
}

/**
 * Get sub-brand name with proper bidirectional handling
 * @param brand - Sub-brand key
 * @param language - Current language code
 */
export function getSubBrand(
  brand: keyof typeof SUB_BRANDS, 
  language: string
): string {
  const isRTL = language === 'he' || language === 'ar';
  if (isRTL && brand.endsWith('_RTL_SAFE')) {
    return SUB_BRANDS[brand];
  }
  if (isRTL) {
    const rtlKey = `${brand}_RTL_SAFE` as keyof typeof SUB_BRANDS;
    if (rtlKey in SUB_BRANDS) {
      return SUB_BRANDS[rtlKey];
    }
  }
  return SUB_BRANDS[brand];
}

/**
 * Wrap a trademarked brand name to ensure proper RTL display
 * @param brandName - Brand name with trademark (e.g., "Pet Wash™")
 * @param isRTL - Whether the current language is RTL
 */
export function wrapBrandForRTL(brandName: string, isRTL: boolean): string {
  if (!isRTL) return brandName;
  // Add LRM after trademark to anchor its position
  return brandName.replace(/™/g, `™${LRM}`);
}

/**
 * Company legal name
 */
export const COMPANY_LEGAL_NAME = 'Pet Wash™ Ltd';
export const COMPANY_LEGAL_NAME_RTL_SAFE = `Pet Wash™${LRM} Ltd`;

export function getCompanyLegalName(language: string): string {
  const isRTL = language === 'he' || language === 'ar';
  return isRTL ? COMPANY_LEGAL_NAME_RTL_SAFE : COMPANY_LEGAL_NAME;
}
