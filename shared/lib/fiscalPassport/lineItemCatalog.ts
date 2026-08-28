/**
 * Transaction line-item catalog — CEO 2026-08-27 fiscal directive §4-8, §76.
 *
 * The normalized product/service catalog for fiscal descriptions.
 *
 * §76 discipline: do not hard-code descriptions in 20 routes. ONE
 * catalog keyed by a stable code (SHOP_TOWEL_XL / WALK_60_MIN /
 * SITTER_DAY / …); the composer looks up the row and never lets a
 * frontend author fiscal text. §46 rule (HE/EN parity) applied here
 * so machine-translation never touches a document description.
 *
 * The catalog is DATA today, not a table. It ships as a frozen const
 * so a mutation is a source-pin failure. A future migration to a
 * merchandising CMS is a Phase-2 task.
 *
 * Nothing in this file makes tax decisions. VAT / document type still
 * come from `getSumitDocumentMapping()` on the sale event class.
 */

/** Stable code the composer uses to look up the fiscal description. */
export type LineItemCode =
  // ── K9000
  | 'K9000_SELF_SERVICE_WASH'
  | 'K9000_PUBLIC_CARD_WASH'
  // ── Shop (bootstrap set — real catalog comes from shop_products)
  | 'SHOP_ITEM_GENERIC'
  // ── Wallet / eGift (stored-value events)
  | 'WALLET_TOPUP'
  | 'EGIFT_PURCHASE'
  | 'EGIFT_REDEMPTION_SERVICE'
  // ── Walk (durations reflect current commercial model)
  | 'WALK_30_MIN'
  | 'WALK_60_MIN'
  | 'WALK_90_MIN'
  // ── Sitter (units per current commercial model)
  | 'SITTER_HOUR'
  | 'SITTER_DAY'
  | 'SITTER_NIGHT'
  // ── Academy
  | 'ACADEMY_SESSION'
  // ── PetTrek
  | 'PETTREK_TRIP'
  // ── Provider commission line (disclosed-agent)
  | 'PROVIDER_BOOKING_COMMISSION_15PCT';

/**
 * How each line item is quantified. Physical products use QUANTITY;
 * time-based services use DURATION_MINUTES; day/night stays use
 * COUNT_DAY / COUNT_NIGHT so a route can't fake quantity=1 for a
 * 3-night sitter stay (§77).
 */
export type LineItemUnit =
  | 'QUANTITY'
  | 'DURATION_MINUTES'
  | 'COUNT_DAY'
  | 'COUNT_NIGHT'
  | 'SESSION'
  | 'TRIP'
  | 'STORED_VALUE';

export interface LineItemDefinition {
  code: LineItemCode;
  /** SUMIT line description — Hebrew (fiscal-primary for Israel). */
  descriptionHe: string;
  /** SUMIT line description — English parity for reporting / OCR. */
  descriptionEn: string;
  unit: LineItemUnit;
  /**
   * Which system owns pricing for THIS line. The composer names this
   * so a future integration test can prove the price on the SUMIT
   * document came from the correct authority (§47).
   */
  pricingAuthority:
    | 'SHOP_ORDER_ROW'
    | 'K9000_TERMINAL'
    | 'WALLET_TOPUP_ROW'
    | 'EGIFT_ORDER_ROW'
    | 'QUOTE_ENGINE'
    | 'STORED_VALUE_LEDGER';
}

export const LINE_ITEMS: readonly LineItemDefinition[] = [
  {
    code: 'K9000_SELF_SERVICE_WASH',
    descriptionHe: 'שירות רחצה עצמית לכלב — Pet Wash',
    descriptionEn: 'Pet Wash Self-Service Dog Wash',
    unit: 'QUANTITY',
    pricingAuthority: 'K9000_TERMINAL',
  },
  {
    code: 'K9000_PUBLIC_CARD_WASH',
    descriptionHe: 'רחצה עצמית — כרטיס אשראי בעמדה',
    descriptionEn: 'Public Card Self-Service Wash',
    unit: 'QUANTITY',
    pricingAuthority: 'K9000_TERMINAL',
  },
  {
    code: 'SHOP_ITEM_GENERIC',
    descriptionHe: 'מוצר Pet Wash Shop',
    descriptionEn: 'Pet Wash Shop item',
    unit: 'QUANTITY',
    pricingAuthority: 'SHOP_ORDER_ROW',
  },
  {
    code: 'WALLET_TOPUP',
    descriptionHe: 'טעינת ארנק Pet Wash',
    descriptionEn: 'Pet Wash Wallet top-up',
    unit: 'STORED_VALUE',
    pricingAuthority: 'WALLET_TOPUP_ROW',
  },
  {
    code: 'EGIFT_PURCHASE',
    descriptionHe: 'רכישת שובר מתנה Pet Wash eGift',
    descriptionEn: 'Pet Wash eGift purchase',
    unit: 'STORED_VALUE',
    pricingAuthority: 'EGIFT_ORDER_ROW',
  },
  {
    code: 'EGIFT_REDEMPTION_SERVICE',
    descriptionHe: 'מימוש שובר Pet Wash eGift',
    descriptionEn: 'Pet Wash eGift redemption',
    unit: 'STORED_VALUE',
    pricingAuthority: 'STORED_VALUE_LEDGER',
  },
  {
    code: 'WALK_30_MIN',
    descriptionHe: 'Walk My Pet — הליכה 30 דקות',
    descriptionEn: 'Walk My Pet — 30 minute walk',
    unit: 'DURATION_MINUTES',
    pricingAuthority: 'QUOTE_ENGINE',
  },
  {
    code: 'WALK_60_MIN',
    descriptionHe: 'Walk My Pet — הליכה 60 דקות',
    descriptionEn: 'Walk My Pet — 60 minute walk',
    unit: 'DURATION_MINUTES',
    pricingAuthority: 'QUOTE_ENGINE',
  },
  {
    code: 'WALK_90_MIN',
    descriptionHe: 'Walk My Pet — הליכה 90 דקות',
    descriptionEn: 'Walk My Pet — 90 minute walk',
    unit: 'DURATION_MINUTES',
    pricingAuthority: 'QUOTE_ENGINE',
  },
  {
    code: 'SITTER_HOUR',
    descriptionHe: 'The Sitter Suite — שעה',
    descriptionEn: 'The Sitter Suite — hour',
    unit: 'DURATION_MINUTES',
    pricingAuthority: 'QUOTE_ENGINE',
  },
  {
    code: 'SITTER_DAY',
    descriptionHe: 'The Sitter Suite — יום',
    descriptionEn: 'The Sitter Suite — day',
    unit: 'COUNT_DAY',
    pricingAuthority: 'QUOTE_ENGINE',
  },
  {
    code: 'SITTER_NIGHT',
    descriptionHe: 'The Sitter Suite — לילה',
    descriptionEn: 'The Sitter Suite — night',
    unit: 'COUNT_NIGHT',
    pricingAuthority: 'QUOTE_ENGINE',
  },
  {
    code: 'ACADEMY_SESSION',
    descriptionHe: 'PetWash Academy — מפגש אימון',
    descriptionEn: 'PetWash Academy — training session',
    unit: 'SESSION',
    pricingAuthority: 'QUOTE_ENGINE',
  },
  {
    code: 'PETTREK_TRIP',
    descriptionHe: 'PetTrek — שירות הסעה',
    descriptionEn: 'PetTrek — transport trip',
    unit: 'TRIP',
    pricingAuthority: 'QUOTE_ENGINE',
  },
  {
    code: 'PROVIDER_BOOKING_COMMISSION_15PCT',
    descriptionHe: 'עמלת Pet Wash — 15%',
    descriptionEn: 'PetWash Commission — 15%',
    unit: 'QUANTITY',
    pricingAuthority: 'QUOTE_ENGINE',
  },
] as const;

export function getLineItem(code: LineItemCode): LineItemDefinition | null {
  return LINE_ITEMS.find((l) => l.code === code) ?? null;
}

/**
 * A concrete instance of a line item on a specific transaction — with
 * the resolved unit + amount. The composer builds this from the
 * booking / order / event row; the frontend never authors it.
 */
export interface TransactionLineItem {
  code: LineItemCode;
  /** Snapshot of description at transaction time; server-derived. */
  descriptionHe: string;
  descriptionEn: string;
  unit: LineItemUnit;
  quantity: number;         // integer for products; minutes / days for services
  unitAmountCents: number;  // integer cents
  lineAmountCents: number;  // integer cents
  vatTreatment: 'FULL_VAT' | 'NO_VAT_STORED_VALUE' | 'VAT_AT_REDEMPTION' | 'VAT_ON_COMMISSION_ONLY' | 'CREDIT';
  sourceType?: 'shop_orders' | 'sitter_bookings' | 'walk_bookings' | 'trainer_bookings' | 'k9000_wash_events' | 'egift_guest_orders' | 'booking_requests' | 'pettrek_trips';
  sourceId?: string;
}
