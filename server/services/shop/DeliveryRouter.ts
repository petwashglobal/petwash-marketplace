/**
 * DeliveryRouter — chooses shipping options for a shop order.
 *
 * CEO direction 2026-06-10:
 *   • Israel Post = the DEFAULT — nationwide, cheaper, good for remote addresses.
 *   • Wolt = OPT-IN only, for customers who want it FAST (same-day), and it costs more.
 *     Wolt is offered only when the order is physically eligible (weight/size/city).
 *
 * This module is PURE decision + rate logic — it makes NO live carrier API calls and
 * touches NO money rail. It returns quotes that feed the cart total; the actual charge
 * stays gated by SHOP_ENABLED + the payment provider (UPay/SUMIT), elsewhere.
 *
 * Rates below are STUB tiers (clearly marked) until the real carrier accounts are
 * signed (Israel Post business-subscriber; Wolt Packages merchant). When those land,
 * the live-quote calls plug in behind the flags WITHOUT changing this decision shape.
 * Design source: docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md §10,
 * docs/design/2026-05-26-shop-module-physical-goods.md §5.5 (ShippingProvider).
 */

import { addDeliveryDays, nextDispatchDate, DELIVERY_LEGAL_NOTE } from './israeliDeliveryCalendar';

export type CarrierId = 'israel_post' | 'wolt' | 'pickup';

export interface DeliveryInput {
  /** Free-text city as captured (HE or EN). Matched against the Wolt service area. */
  city: string;
  /** Israeli postcode (5 or 7 digits) if known. Captured but not yet zone-mapped. */
  postcode?: string | null;
  /** Total cart weight in grams. */
  totalGrams: number;
  /** Cart merchandise subtotal in agorot (for the free-shipping threshold). */
  subtotalCents: number;
  /** Largest single dimension in cm, if known (Wolt cap is 35×35×30). */
  maxDimensionCm?: number | null;
  /** Customer explicitly wants the fastest option (surfaces/recommends Wolt). */
  wantsFast?: boolean;
}

export interface DeliveryOption {
  carrier: CarrierId;
  /** Stable code used by checkout. */
  serviceCode: 'standard' | 'express_same_day' | 'pickup';
  cents: number;
  vatCents: number;            // VAT portion (18/118 back-calc), invoice needs it
  etaMinDays: number;
  etaMaxDays: number;
  /** Next valid dispatch day (skips Israeli weekend + public holidays). YYYY-MM-DD. */
  estimatedDispatch: string;
  /** Estimated arrival, counted in delivery business days (holiday/weekend-aware). */
  estimatedArrival: string;
  label_he: string;
  label_en: string;
  /** Cheapest option for the order (UI can pre-select). */
  isCheapest?: boolean;
  /** Fastest option for the order. */
  isFastest?: boolean;
  /** True only for a genuinely live carrier quote; false = stub estimate. */
  liveQuote: boolean;
}

// ── Free-shipping threshold (Israel Post only; Wolt is premium, never free) ──
export const FREE_ISRAEL_POST_THRESHOLD_CENTS = 15000; // ₪150

// ── Israel VAT (18%) back-calc helper ──
const ISRAEL_VAT_RATE = 0.18;
const vatPortion = (gross: number) => Math.round((gross * ISRAEL_VAT_RATE) / (1 + ISRAEL_VAT_RATE));

// ── Israel Post domestic parcel — STUB weight tiers (VAT-incl agorot) ──
// Replace with live business-subscriber rates when the account is signed.
const ISRAEL_POST_TIERS: Array<{ maxGrams: number; cents: number }> = [
  { maxGrams: 500, cents: 1990 },    // ₪19.90
  { maxGrams: 2000, cents: 2990 },   // ₪29.90
  { maxGrams: 5000, cents: 3990 },   // ₪39.90
  { maxGrams: 10000, cents: 5490 },  // ₪54.90
  { maxGrams: Infinity, cents: 6990 }, // ₪69.90 (heavy / oversized)
];

function israelPostRate(totalGrams: number): number {
  const tier = ISRAEL_POST_TIERS.find((t) => totalGrams <= t.maxGrams)!;
  return tier.cents;
}

// ── Wolt Packages eligibility gates (Codex's rules, SDD §10.3) ──
const WOLT_MAX_GRAMS = 8000;
const WOLT_MAX_DIMENSION_CM = 35;
const WOLT_FLAT_CENTS = 3900; // ₪39 STUB premium same-day; live quote replaces this.

// Cities where Wolt Packages same-day is offered (major metros). HE + EN normalized.
const WOLT_SERVICE_AREA = new Set(
  [
    'תל אביב', 'tel aviv', 'רמת גן', 'ramat gan', 'גבעתיים', 'givatayim',
    'בני ברק', 'bnei brak', 'פתח תקווה', 'petah tikva', 'רחובות', 'rehovot',
    'ראשון לציון', 'rishon lezion', 'חולון', 'holon', 'בת ים', 'bat yam',
    'הרצליה', 'herzliya', 'רעננה', 'raanana', 'כפר סבא', 'kfar saba',
    'נתניה', 'netanya', 'ירושלים', 'jerusalem', 'חיפה', 'haifa',
    'באר שבע', 'beer sheva', 'אשדוד', 'ashdod', 'ראש העין', 'rosh haayin',
  ].map((s) => s.trim().toLowerCase()),
);

function woltEligible(input: DeliveryInput, woltFlagOn: boolean): boolean {
  if (!woltFlagOn) return false;
  const cityNorm = (input.city || '').trim().toLowerCase();
  if (!WOLT_SERVICE_AREA.has(cityNorm)) return false;
  if (input.totalGrams > WOLT_MAX_GRAMS) return false;
  if (input.maxDimensionCm != null && input.maxDimensionCm > WOLT_MAX_DIMENSION_CM) return false;
  return true;
}

/**
 * Returns the delivery options to show at checkout, cheapest-first.
 * Israel Post is always present (the default). Wolt appears only when eligible.
 */
export function getDeliveryOptions(
  input: DeliveryInput,
  opts: { woltEnabled?: boolean } = {},
): DeliveryOption[] {
  const woltFlagOn = opts.woltEnabled ?? (process.env.SHOP_SHIPPING_WOLT_ENABLED === 'true');
  const options: DeliveryOption[] = [];

  // ── Israel Post (default, nationwide, cheaper; free over threshold) ──
  const ipFree = input.subtotalCents >= FREE_ISRAEL_POST_THRESHOLD_CENTS;
  const ipCents = ipFree ? 0 : israelPostRate(input.totalGrams);
  options.push({
    carrier: 'israel_post',
    serviceCode: 'standard',
    cents: ipCents,
    vatCents: vatPortion(ipCents),
    etaMinDays: 3,
    etaMaxDays: 5,
    estimatedDispatch: nextDispatchDate(),
    estimatedArrival: addDeliveryDays(5),
    label_he: ipFree ? 'דואר ישראל — משלוח חינם (3–5 ימי עסקים)' : 'דואר ישראל — 3–5 ימי עסקים',
    label_en: ipFree ? 'Israel Post — free shipping (3–5 business days)' : 'Israel Post — 3–5 business days',
    liveQuote: false,
  });

  // ── Wolt (opt-in, same-day, premium) — only when eligible ──
  if (woltEligible(input, woltFlagOn)) {
    options.push({
      carrier: 'wolt',
      serviceCode: 'express_same_day',
      cents: WOLT_FLAT_CENTS,
      vatCents: vatPortion(WOLT_FLAT_CENTS),
      etaMinDays: 0,
      etaMaxDays: 0,
      estimatedDispatch: nextDispatchDate(),
      estimatedArrival: nextDispatchDate(), // same-day if today is a delivery day, else next
      label_he: 'Wolt — משלוח מהיר היום (תוספת תשלום)',
      label_en: 'Wolt — fast same-day delivery (premium)',
      liveQuote: false,
    });
  }

  // ── Flag cheapest / fastest ──
  const cheapest = options.reduce((a, b) => (b.cents < a.cents ? b : a));
  cheapest.isCheapest = true;
  const fastest = options.reduce((a, b) => (b.etaMaxDays < a.etaMaxDays ? b : a));
  fastest.isFastest = true;

  // If the customer asked for fast, sort fastest-first; else cheapest-first.
  options.sort((a, b) =>
    input.wantsFast ? a.etaMaxDays - b.etaMaxDays : a.cents - b.cents,
  );

  return options;
}

/** Consumer-facing legal delivery note (Israel Consumer Protection Law + weekend/holiday basis). */
export function getDeliveryLegalNote(): { he: string; en: string } {
  return { he: DELIVERY_LEGAL_NOTE.he, en: DELIVERY_LEGAL_NOTE.en };
}
