/**
 * Canonical PetWash support contact details.
 * Import from here — do NOT hardcode these values in individual components.
 */
export const SUPPORT_EMAIL = 'support@petwash.co.il';
export const SUPPORT_PHONE = '+972549833355';
export const SUPPORT_WHATSAPP_URL = `https://wa.me/972549833355`;
export const SUPPORT_MAILTO_URL = `mailto:${SUPPORT_EMAIL}`;

/** Pre-built WhatsApp URL with an optional pre-filled message */
export function whatsappUrl(message?: string): string {
  if (message) {
    return `https://wa.me/972549833355?text=${encodeURIComponent(message)}`;
  }
  return SUPPORT_WHATSAPP_URL;
}
