/**
 * petwashIncomeItems.ts — canonical, stable income-item catalog (CEO accounting spec §8).
 *
 * ONE source of truth for the PW_* item codes used on every accounting document, so
 * SUMIT lines stop being ad-hoc free-text and the books are consistent. Maps each
 * code → module + HE/EN title. The accountant confirms the SUMIT income-item id +
 * VAT rule per code (income_item_mappings table links PW_* → SUMIT id at runtime).
 *
 * RULES: PetTrek items are NOT active (frozen). Operator/SaaS/Smart-Hub-licence items
 * are FORBIDDEN — listed here only to hard-block accidental creation. Public wash
 * wording is "self-service dog wash / שטיפת כלבים בשירות עצמי".
 */

export type IncomeModule =
  | 'self_service_wash' | 'wash_package' | 'gift' | 'shop' | 'academy'
  | 'pet_sitter' | 'walk_my_pet' | 'provider_marketplace' | 'platform_commission'
  | 'wallet';

export interface IncomeItem {
  code: string;          // stable PW_* code (never changes)
  module: IncomeModule;
  he: string;
  en: string;
}

export const PETWASH_INCOME_ITEMS: Record<string, IncomeItem> = {
  // DIY self-service dog wash
  PW_SELF_SERVICE_DOG_WASH_SINGLE:    { code: 'PW_SELF_SERVICE_DOG_WASH_SINGLE',    module: 'self_service_wash', he: 'שטיפת כלבים בשירות עצמי', en: 'Self-service dog wash' },
  PW_SELF_SERVICE_DOG_WASH_PREMIUM:   { code: 'PW_SELF_SERVICE_DOG_WASH_PREMIUM',   module: 'self_service_wash', he: 'שטיפת פרימיום בשירות עצמי', en: 'Premium self-service dog wash' },
  PW_SELF_SERVICE_DOG_WASH_EXTRA_TIME:{ code: 'PW_SELF_SERVICE_DOG_WASH_EXTRA_TIME',module: 'self_service_wash', he: 'תוספת זמן רחיצה', en: 'Extra wash time' },
  PW_SELF_SERVICE_DOG_WASH_UPGRADE:   { code: 'PW_SELF_SERVICE_DOG_WASH_UPGRADE',   module: 'self_service_wash', he: 'שדרוג רחיצה', en: 'Wash upgrade' },
  // Wash packages
  PW_WASH_PACKAGE_5:      { code: 'PW_WASH_PACKAGE_5',      module: 'wash_package', he: 'חבילת 5 רחיצות', en: '5 wash package' },
  PW_WASH_PACKAGE_10:     { code: 'PW_WASH_PACKAGE_10',     module: 'wash_package', he: 'חבילת 10 רחיצות', en: '10 wash package' },
  PW_WASH_PACKAGE_CUSTOM: { code: 'PW_WASH_PACKAGE_CUSTOM', module: 'wash_package', he: 'חבילת רחיצות מותאמת', en: 'Custom wash package' },
  // Gift
  PW_GIFT_CARD:         { code: 'PW_GIFT_CARD',         module: 'gift', he: 'שובר מתנה PetWash', en: 'PetWash gift card' },
  PW_GIFT_WASH_PACKAGE: { code: 'PW_GIFT_WASH_PACKAGE', module: 'gift', he: 'חבילת רחיצות במתנה', en: 'Gift wash package' },
  // Wallet / prepaid credit (money-value instrument — receipt at load, VAT at 18%)
  PW_WALLET_TOPUP:      { code: 'PW_WALLET_TOPUP',      module: 'wallet', he: 'טעינת ארנק PetWash', en: 'PetWash wallet top-up' },
  // Shop
  PW_SHOP_COLLAR:      { code: 'PW_SHOP_COLLAR',      module: 'shop', he: 'קולר', en: 'Pet collar' },
  PW_SHOP_ENGRAVED_TAG:{ code: 'PW_SHOP_ENGRAVED_TAG',module: 'shop', he: 'תג חריטה', en: 'Engraved pet tag' },
  PW_SHOP_TREATS:      { code: 'PW_SHOP_TREATS',      module: 'shop', he: 'חטיפים לחיות מחמד', en: 'Pet treats' },
  PW_SHOP_CLOTHING:    { code: 'PW_SHOP_CLOTHING',    module: 'shop', he: 'בגדי חיות מחמד', en: 'Pet clothing' },
  PW_SHOP_SHAMPOO:     { code: 'PW_SHOP_SHAMPOO',     module: 'shop', he: 'שמפו', en: 'Shampoo' },
  PW_SHOP_CONDITIONER: { code: 'PW_SHOP_CONDITIONER', module: 'shop', he: 'מרכך', en: 'Conditioner' },
  PW_SHOP_TOWEL:       { code: 'PW_SHOP_TOWEL',       module: 'shop', he: 'מגבת', en: 'Towel' },
  PW_SHOP_ACCESSORY:   { code: 'PW_SHOP_ACCESSORY',   module: 'shop', he: 'אביזר לחיית מחמד', en: 'Pet accessory' },
  PW_SHIPPING:         { code: 'PW_SHIPPING',         module: 'shop', he: 'משלוח', en: 'Shipping' },
  // Academy
  PW_ACADEMY_COURSE:      { code: 'PW_ACADEMY_COURSE',      module: 'academy', he: 'קורס PetWash Academy', en: 'PetWash Academy course' },
  PW_ACADEMY_CERTIFICATE: { code: 'PW_ACADEMY_CERTIFICATE', module: 'academy', he: 'תעודת הכשרה PetWash Academy', en: 'PetWash Academy certificate' },
  // Pet sitter
  PW_PET_SITTER_BOOKING:   { code: 'PW_PET_SITTER_BOOKING',   module: 'pet_sitter', he: 'שירות שמירה על חיית מחמד', en: 'Pet sitter booking' },
  PW_PET_SITTER_HOME_VISIT:{ code: 'PW_PET_SITTER_HOME_VISIT',module: 'pet_sitter', he: 'ביקור בית לחיית מחמד', en: 'Pet home visit' },
  PW_PET_SITTER_OVERNIGHT: { code: 'PW_PET_SITTER_OVERNIGHT', module: 'pet_sitter', he: 'שמירת לילה לחיית מחמד', en: 'Overnight pet sitting' },
  // Walk my pet
  PW_WALK_MY_PET:           { code: 'PW_WALK_MY_PET',           module: 'walk_my_pet', he: 'שירות הליכת כלב', en: 'Walk My Pet dog walking service' },
  PW_WALK_MY_PET_EXTRA_DOG: { code: 'PW_WALK_MY_PET_EXTRA_DOG', module: 'walk_my_pet', he: 'תוספת כלב נוסף', en: 'Extra dog walking fee' },
  // Provider marketplace
  PW_PROVIDER_GROOMING:  { code: 'PW_PROVIDER_GROOMING',  module: 'provider_marketplace', he: 'שירות טיפוח חיית מחמד', en: 'Pet grooming service' },
  PW_PROVIDER_TRANSPORT: { code: 'PW_PROVIDER_TRANSPORT', module: 'provider_marketplace', he: 'שירות הסעת חיית מחמד', en: 'Pet transport service' },
  PW_PLATFORM_COMMISSION:{ code: 'PW_PLATFORM_COMMISSION', module: 'platform_commission', he: 'עמלת פלטפורמה PetWash', en: 'PetWash platform commission' },
};

export type PetwashIncomeCode = keyof typeof PETWASH_INCOME_ITEMS;

/** FORBIDDEN codes — never create these (spec §8). Guard rails for the line builder. */
export const FORBIDDEN_INCOME_CODES: readonly string[] = [
  'PW_STATION_OPERATOR_FEE', 'PW_OPERATOR_INVOICE', 'PW_SMART_HUB_LICENSE',
  'PW_SAAS_MONTHLY_FEE', 'PW_MAINTENANCE_PLAN', 'PW_CONSUMABLES_SUPPLY_TO_OPERATOR',
];

/** PetTrek income items are NOT active (frozen). No active PW_PETTREK_* code exists by design. */
export function assertIncomeCodeAllowed(code: string): void {
  if (FORBIDDEN_INCOME_CODES.includes(code)) {
    throw new Error(`[income] Forbidden income item "${code}" — operator/SaaS items are not allowed (CEO accounting spec §8).`);
  }
  if (code.startsWith('PW_PETTREK')) {
    throw new Error('[income] PetTrek is frozen — no active PetTrek income items.');
  }
}

export function getIncomeItem(code: string): IncomeItem | undefined {
  return PETWASH_INCOME_ITEMS[code];
}
