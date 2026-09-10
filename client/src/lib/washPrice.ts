/**
 * The ONE public price line for a standard self-service K9000 wash.
 *
 * Approved by the CEO on 2026-07-09 (₪55 incl. VAT) and already published on
 * /locations (FAQ + FAQPage JSON-LD). Every other surface that mentions the
 * wash price must import it from here so the site never states two numbers.
 * Bay tariffs are configured in Nayax; if the CEO changes the public price,
 * change it HERE and nowhere else.
 */
export const STANDARD_WASH_PRICE_ILS = 55;

export const STANDARD_WASH_PRICE_LINE = {
  he: `שטיפה עצמית סטנדרטית עולה ₪${STANDARD_WASH_PRICE_ILS} (כולל מע״מ).`,
  en: `A standard self-service wash is ₪${STANDARD_WASH_PRICE_ILS} (VAT included).`,
} as const;
