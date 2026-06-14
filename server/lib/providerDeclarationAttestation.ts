/**
 * providerDeclarationAttestation.ts — tamper-evident e-signature for provider declarations.
 *
 * WHY THIS EXISTS (2026-06-14): provider onboarding stored declarations as bare
 * booleans (accurate=true) buried in internalNotes. If a provider later disputes
 * what they agreed to — or a regulator/court asks us to PROVE it — a `true` in a
 * column is weak evidence. Israeli/EU electronic-signature law recognises an
 * electronic record as a signature when it shows (a) INTENT to sign, (b)
 * ATTRIBUTION to a person, and (c) INTEGRITY (it hasn't been altered since).
 *
 * This builds a SEALED attestation that captures, at submit time:
 *   - the EXACT declaration text the provider accepted, in the language shown
 *   - a pinned DECLARATION_VERSION (bumped whenever wording changes, so we can
 *     always reproduce exactly what they saw)
 *   - their identity (uid), provider types, timestamp, IP, and device (UA)
 *   - a SHA-256 over the canonical payload — change one byte later and the hash
 *     no longer matches, which is provable in a dispute.
 *
 * The stored object + its hash ARE the digital signature. verify…() recomputes
 * the hash to detect any tampering. The canonical texts live in version control,
 * so "version X said this" is anchored to a specific commit.
 */
import { createHash } from 'crypto';

/**
 * BUMP THIS whenever ANY declaration wording below changes. Old attestations keep
 * their own version string, so we can always prove what a given provider saw.
 */
export const DECLARATION_VERSION = '2026-06-14.v1';

/** Canonical declaration wording, per key, EN + HE. Source of legal truth. */
export const DECLARATION_TEXTS: Record<string, { en: string; he: string }> = {
  selfDeclarationNoRelevantConvictions: {
    en: 'I declare that I have no relevant criminal convictions that would prevent me from safely providing pet-care services.',
    he: 'אני מצהיר/ה כי אין לי הרשעות פליליות רלוונטיות המונעות ממני לספק שירותי טיפול בחיות מחמד באופן בטוח.',
  },
  declarationAccurateInfo: {
    en: 'I declare that all information and documents I have provided are accurate, current, and true.',
    he: 'אני מצהיר/ה כי כל המידע והמסמכים שמסרתי מדויקים, עדכניים ונכונים.',
  },
  declarationAcceptTerms: {
    en: 'I have read and accept the PetWash Terms of Service and Privacy Policy.',
    he: 'קראתי ואני מאשר/ת את תנאי השימוש ומדיניות הפרטיות של PetWash.',
  },
  declarationPhysicallyFit: {
    en: 'I declare that I am physically fit to care for and handle animals.',
    he: 'אני מצהיר/ה כי אני כשיר/ה פיזית לטפל ולהחזיק בעלי חיים.',
  },
  declarationAnimalExperience: {
    en: 'I declare that I have genuine experience caring for animals.',
    he: 'אני מצהיר/ה כי יש לי ניסיון אמיתי בטיפול בבעלי חיים.',
  },
  declarationFirstAidTraining: {
    en: 'I declare that I have pet first-aid training.',
    he: 'אני מצהיר/ה כי עברתי הכשרה בעזרה ראשונה לבעלי חיים.',
  },
  declarationValidLicense: {
    en: 'I declare that I hold a valid driving licence.',
    he: 'אני מצהיר/ה כי ברשותי רישיון נהיגה בתוקף.',
  },
  declarationNoSuspension: {
    en: 'I declare that my driving licence is not suspended and carries no disqualifying points.',
    he: 'אני מצהיר/ה כי רישיון הנהיגה שלי אינו מושעה ואין בו נקודות פוסלות.',
  },
  declarationUnderPointsLimit: {
    en: 'I declare that I am under the driving penalty-points limit.',
    he: 'אני מצהיר/ה כי אני מתחת למגבלת נקודות החובה בנהיגה.',
  },
  declarationNoDrugsAlcohol: {
    en: 'I declare that I have no drug or alcohol driving violations.',
    he: 'אני מצהיר/ה כי אין לי עבירות נהיגה תחת השפעת סמים או אלכוהול.',
  },
  declarationValidVehicleInsurance: {
    en: 'I declare that I hold valid vehicle insurance.',
    he: 'אני מצהיר/ה כי ברשותי ביטוח רכב בתוקף.',
  },
  declarationVehicleInspection: {
    en: 'I declare that my vehicle has passed its required inspection.',
    he: 'אני מצהיר/ה כי רכבי עבר את מבחן הרישוי הנדרש.',
  },
  declarationTrainingCertification: {
    en: 'I declare that I hold a valid animal-training certification.',
    he: 'אני מצהיר/ה כי ברשותי תעודת הסמכה תקפה לאילוף בעלי חיים.',
  },
  declarationAccreditedCourses: {
    en: 'I declare that my training certifications are from accredited courses.',
    he: 'אני מצהיר/ה כי תעודות ההכשרה שלי הן מקורסים מוכרים.',
  },
  declarationLiabilityInsurance: {
    en: 'I declare that I hold valid professional liability insurance.',
    he: 'אני מצהיר/ה כי ברשותי ביטוח אחריות מקצועית בתוקף.',
  },
};

export interface DeclarationAttestationInput {
  uid: string;
  email?: string;
  acceptedKeys: string[];
  providerTypes: string[];
  language: string;
  signedAt: Date;
  ip: string;
  userAgent: string;
}

export interface SealedDeclarationAttestation {
  version: string;
  uid: string;
  email: string;
  providerTypes: string[];
  language: 'en' | 'he';
  signedAtIso: string;
  ip: string;
  userAgent: string;
  declarations: Array<{ key: string; text: string }>;
  signatureSha256: string;
}

/** Deterministic canonical JSON — identical key order in build + verify so the
 *  hash is reproducible. Do NOT reorder these fields without bumping the version. */
function canonicalJson(f: {
  version: string; uid: string; email: string; providerTypes: string[];
  language: 'en' | 'he'; signedAtIso: string; ip: string; userAgent: string;
  declarations: Array<{ key: string; text: string }>;
}): string {
  return JSON.stringify({
    version: f.version,
    uid: f.uid,
    email: f.email,
    providerTypes: [...f.providerTypes].sort(),
    language: f.language,
    signedAtIso: f.signedAtIso,
    ip: f.ip,
    userAgent: f.userAgent,
    declarations: f.declarations,
  });
}

export function buildSealedDeclarationAttestation(
  input: DeclarationAttestationInput,
): SealedDeclarationAttestation {
  const language: 'en' | 'he' = input.language === 'he' ? 'he' : 'en';
  // Only keys we have canonical wording for carry legal weight; sort for determinism.
  const declarations = Array.from(new Set(input.acceptedKeys))
    .filter((k) => DECLARATION_TEXTS[k])
    .sort()
    .map((k) => ({ key: k, text: DECLARATION_TEXTS[k][language] }));

  const fields = {
    version: DECLARATION_VERSION,
    uid: input.uid,
    email: input.email || '',
    providerTypes: [...input.providerTypes].sort(),
    language,
    signedAtIso: input.signedAt.toISOString(),
    ip: input.ip,
    userAgent: input.userAgent,
    declarations,
  };
  const signatureSha256 = createHash('sha256').update(canonicalJson(fields)).digest('hex');
  return { ...fields, signatureSha256 };
}

/** Recompute the hash and confirm the sealed attestation has not been altered. */
export function verifySealedDeclarationAttestation(
  att: SealedDeclarationAttestation | null | undefined,
): boolean {
  if (!att || typeof att.signatureSha256 !== 'string') return false;
  const recomputed = createHash('sha256')
    .update(
      canonicalJson({
        version: att.version,
        uid: att.uid,
        email: att.email,
        providerTypes: att.providerTypes,
        language: att.language,
        signedAtIso: att.signedAtIso,
        ip: att.ip,
        userAgent: att.userAgent,
        declarations: att.declarations,
      }),
    )
    .digest('hex');
  return recomputed === att.signatureSha256;
}
