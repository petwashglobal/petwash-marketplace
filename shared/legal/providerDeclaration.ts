/**
 * Israel-safe provider self-declaration (2026 spec).
 *
 * Policy:
 *   • Government ID upload is REQUIRED for every provider (handled by the
 *     existing /apply route which uploads `governmentId` to KYC storage).
 *   • Police clearance is OPTIONAL by default.
 *   • Provider MUST tick a self-declaration that they have no relevant
 *     criminal convictions or active legal matters that may create risk
 *     to pets, customers, homes, property, or the platform.
 *   • Police clearance becomes REQUIRED when the provider chooses any
 *     high-risk service (home access, overnight sitting, key holding,
 *     pet transport).
 *
 * This module is the single source of truth for the bilingual text and
 * the high-risk service mapping, used by both client and server.
 */

export const ENHANCED_VERIFICATION_REASONS = [
  'home_access',
  'overnight_sitting',
  'key_holding',
  'pet_transport',
] as const;

export type EnhancedVerificationReason =
  (typeof ENHANCED_VERIFICATION_REASONS)[number];

export const ENHANCED_REASON_LABELS: Record<
  EnhancedVerificationReason,
  { he: string; en: string }
> = {
  home_access: {
    he: 'גישה לבית הלקוח',
    en: 'Access to customer home',
  },
  overnight_sitting: {
    he: 'שמרטפות לילה',
    en: 'Overnight sitting',
  },
  key_holding: {
    he: 'החזקת מפתחות',
    en: 'Key holding',
  },
  pet_transport: {
    he: 'הסעת חיות מחמד',
    en: 'Pet transport',
  },
};

/**
 * Provider-type → enhanced-verification reasons mapping.
 *
 * Policy (PetWash 2026 spec):
 *   No provider type triggers enhanced verification automatically.
 *   The signed self-declaration is sufficient by default.
 *   Police clearance is only required when the provider EXPLICITLY
 *   opts into one of the four high-risk service categories
 *   (home_access, overnight_sitting, key_holding, pet_transport)
 *   via the dedicated checkboxes in the onboarding form.
 *
 * This function exists for forward compatibility (and to keep the
 * server's defense-in-depth union-with-defaults logic in one place)
 * but currently returns an empty array for every provider type.
 */
export function defaultReasonsForProviderTypes(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _types: ReadonlyArray<string>,
): EnhancedVerificationReason[] {
  return [];
}

export function requiresEnhancedVerification(
  reasons: ReadonlyArray<string>,
): boolean {
  if (!reasons || reasons.length === 0) return false;
  const allowed = new Set<string>(ENHANCED_VERIFICATION_REASONS);
  return reasons.some(r => allowed.has(r));
}

export const PROVIDER_DECLARATION_TEXT = {
  he: {
    title: 'הצהרת ספק',
    body:
      'אני מצהיר/ה כי אין לי הרשעות פליליות רלוונטיות או הליכים משפטיים פעילים ' +
      'העלולים להוות סיכון לחיות מחמד, ללקוחות, לבתיהם, לרכושם או לפלטפורמה. ' +
      'הצהרה זו ניתנת בתום לב וביודעי כי הצהרה כוזבת עלולה להוביל להשעיה מיידית, ' +
      'הסרה מהפלטפורמה ופנייה לרשויות.',
    enhancedNotice:
      'עבור שירותים בסיכון גבוה (כניסה לבית הלקוח, שמרטפות לילה, החזקת מפתחות, ' +
      'או הסעת חיות מחמד) תידרש בדיקת רקע משטרתית בנוסף להצהרה.',
    checkboxLabel:
      'אני מצהיר/ה שאין לי הרשעות פליליות רלוונטיות או הליכים משפטיים פעילים שעלולים ליצור סיכון',
    idRequiredNotice: 'תעודת זהות בתוקף נדרשת מכל הספקים.',
  },
  en: {
    title: 'Provider declaration',
    body:
      'I declare that I have no relevant criminal convictions or active ' +
      'legal matters that may create risk to pets, customers, their homes, ' +
      'property, or the platform. This declaration is given in good faith ' +
      'and I understand that a false declaration may lead to immediate ' +
      'suspension, removal from the platform, and referral to authorities.',
    enhancedNotice:
      'For higher-risk services (home access, overnight sitting, key ' +
      'holding, or pet transport) a police background check will be ' +
      'required in addition to this declaration.',
    checkboxLabel:
      'I declare that I have no relevant criminal convictions or active legal matters that may create risk',
    idRequiredNotice: 'A valid government-issued ID is required for every provider.',
  },
} as const;
