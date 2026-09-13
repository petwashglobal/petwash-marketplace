/**
 * Passkey creation consent — one version, one text, shared by client and server.
 *
 * Follows the FIDO Alliance / Passkey Central design guidelines, Google's passkey
 * UX guidance and Apple's "passkey" wording (checked 2026-09-14):
 *   - explain what a passkey is BEFORE the OS sheet ("handshake"),
 *   - disclose that anyone who can unlock this device can use it,
 *   - an explicit button press to create, and an equal "Not now",
 *   - a success confirmation afterwards,
 *   - offered in account moments (signup, settings), not forced at sign-in.
 *
 * The server refuses /api/webauthn/register/options without this version and
 * records the acceptance in the security audit trail. Bump the version whenever
 * the text below changes.
 */
export const PASSKEY_CONSENT_VERSION = 'passkey-consent-2026-09-14';

export type PasskeyConsentLang = 'he' | 'en';

export const PASSKEY_CONSENT_TEXT: Record<PasskeyConsentLang, {
  title: string;
  lead: string;
  points: string[];
  disclosure: string;
  confirm: string;
  cancel: string;
  successTitle: string;
  successBody: string;
  done: string;
  removeTitle: string;
  removeBody: string;
  removeConfirm: string;
}> = {
  he: {
    title: 'יצירת Passkey',
    lead: 'התחברו ל-PetWash עם Face ID, טביעת אצבע או קוד הנעילה של המכשיר — בלי סיסמאות ובלי קודים.',
    points: [
      'ה-Passkey נשמר במכשיר שלכם (iCloud Keychain או מנהל הסיסמאות של Google) ומסונכרן רק לחשבון שלכם.',
      'הפנים או טביעת האצבע לא יוצאים מהמכשיר — PetWash לא מקבלת אותם לעולם.',
      'עמיד בפני פישינג: הוא עובד רק באתר ובאפליקציה של PetWash.',
    ],
    disclosure: 'חשוב: כל מי שיכול לפתוח את נעילת המכשיר הזה יוכל להתחבר לחשבון PetWash שלכם. אפשר להסיר את ה-Passkey בכל עת בחשבון ← אבטחה.',
    confirm: 'אני מאשר/ת — צור Passkey',
    cancel: 'לא עכשיו',
    successTitle: 'ה-Passkey נוצר',
    successBody: 'בפעם הבאה, התחברו בלחיצה אחת עם Face ID או טביעת אצבע.',
    done: 'סיום',
    removeTitle: 'להסיר את ה-Passkey?',
    removeBody: 'לא תוכלו להתחבר עם Passkey מהמכשיר הזה. תמיד אפשר להתחבר עם קוד חד-פעמי או Google.',
    removeConfirm: 'הסר Passkey',
  },
  en: {
    title: 'Create a passkey',
    lead: 'Sign in to PetWash with Face ID, your fingerprint or your device passcode — no passwords, no codes.',
    points: [
      'The passkey is saved on your device (iCloud Keychain or Google Password Manager) and syncs only to your own account.',
      'Your face or fingerprint never leaves your device — PetWash never receives it.',
      'Phishing-resistant: it only works on the real PetWash site and app.',
    ],
    disclosure: 'Important: anyone who can unlock this device will be able to sign in to your PetWash account. You can remove the passkey any time in Account → Security.',
    confirm: 'I agree — create passkey',
    cancel: 'Not now',
    successTitle: 'Passkey created',
    successBody: 'Next time, sign in with one tap using Face ID or your fingerprint.',
    done: 'Done',
    removeTitle: 'Remove this passkey?',
    removeBody: "You won't be able to sign in with a passkey from this device. You can always sign in with a one-time code or Google.",
    removeConfirm: 'Remove passkey',
  },
};

export function isValidPasskeyConsent(value: unknown): boolean {
  return value === PASSKEY_CONSENT_VERSION;
}
