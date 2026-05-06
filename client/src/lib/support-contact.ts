/**
 * Canonical PetWash support contact details.
 * Import from here — do NOT hardcode these values in individual components.
 */
export const SUPPORT_EMAIL = 'support@petwash.co.il';
export const SUPPORT_PHONE = '+972549833355';
/** Display-formatted phone, safe to render as visible text. Always wrap
 *  in <Ltr> (or apply `dir="ltr"` + `unicode-bidi: isolate`) to prevent
 *  Hebrew RTL containers from reordering it (PR-W52). */
export const SUPPORT_PHONE_DISPLAY = '+972 54-983-3355';
export const SUPPORT_WHATSAPP_URL = `https://wa.me/972549833355`;
export const SUPPORT_MAILTO_URL = `mailto:${SUPPORT_EMAIL}`;
export const SUPPORT_TEL_URL = `tel:${SUPPORT_PHONE}`;

/** Pre-built WhatsApp URL with an optional pre-filled message */
export function whatsappUrl(message?: string): string {
  if (message) {
    return `https://wa.me/972549833355?text=${encodeURIComponent(message)}`;
  }
  return SUPPORT_WHATSAPP_URL;
}

/**
 * Format an Israeli phone (E.164 or national) for display.
 *   '+972549833355' → '+972 54-983-3355'
 *   '0549833355'    → '+972 54-983-3355'
 * Output MUST be rendered inside an LTR-isolated container (use <Ltr>).
 */
export function formatIsraeliPhoneForDisplay(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');
  let national = digits.startsWith('972')
    ? digits.slice(3)
    : digits.startsWith('0') ? digits.slice(1) : digits;
  if (!national) return raw;
  if (national.length === 9 && national.startsWith('5')) {
    return `+972 ${national.slice(0, 2)}-${national.slice(2, 5)}-${national.slice(5)}`;
  }
  if (national.length === 8) {
    return `+972 ${national.slice(0, 1)}-${national.slice(1, 4)}-${national.slice(4)}`;
  }
  return `+972 ${national}`;
}
