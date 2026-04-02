/**
 * PetWash™ Consent Version Registry
 *
 * All biometric consent version checks MUST reference this constant.
 * When terms change, update CURRENT_BIOMETRIC_CONSENT_VERSION here —
 * all enforcement points update automatically, and any user with an older
 * consent version is forced through the new consent flow before registration.
 *
 * Increment format: YYYY.N  (e.g. 2025.2 for the second change in 2025)
 */

export const CURRENT_BIOMETRIC_CONSENT_VERSION = '2026.1';
// 2026.1 — April 2026: Added Paw Finder data processing disclosure,
// corrected pre-checked marketing/reminders/push checkboxes to default OFF,
// removed "consent by continued use" language, expanded third-party processor list
