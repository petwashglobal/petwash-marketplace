/**
 * Purpose-aware copy for the one Pet Wash verification screen.
 *
 * The old surfaces all said "Verification code" and nothing else, which asks
 * the customer to work out for themselves why they were interrupted. The
 * server already knows the purpose — so the screen can simply say it.
 *
 * Every purpose answers the same five questions the CEO set as the bar:
 *   title    — why am I verifying?
 *   lede     — what is this code FOR? (one sentence, plain)
 *   cta      — what happens when I press the button?
 *   next     — what happens after success?
 * Where the code went, and what to do if it didn't arrive, are rendered by
 * VerificationFlow from the server's maskedDestination + resend state.
 *
 * Hebrew is a real translation, not a transliteration, and the flow renders
 * dir="rtl" around it — see VerificationFlow.
 */

export type VerificationPurpose =
  | 'diagnostic_noop'
  | 'login'
  | 'signup'
  | 'egift_redeem'
  | 'change_email'
  | 'enable_2fa'
  | 'disable_2fa'
  | 'close_account'
  | 'payout';

export type VerificationChannel = 'sms' | 'email' | 'whatsapp' | 'push';
export type CopyLanguage = 'en' | 'he';

export interface PurposeCopy {
  title: string;
  lede: string;
  cta: string;
  next: string;
}

type CopyTable = Record<VerificationPurpose, Record<CopyLanguage, PurposeCopy>>;

/** Channel word used inside the "we sent a code to…" line. */
export const CHANNEL_NOUN: Record<VerificationChannel, Record<CopyLanguage, string>> = {
  email: { en: 'email', he: 'אימייל' },
  sms: { en: 'phone', he: 'טלפון' },
  whatsapp: { en: 'WhatsApp', he: 'וואטסאפ' },
  push: { en: 'device', he: 'מכשיר' },
};

const COPY: CopyTable = {
  diagnostic_noop: {
    en: {
      title: 'Verification check',
      lede: 'This is a diagnostic check. No account changes will be made.',
      cta: 'Continue',
      next: 'Nothing changes — this only confirms the verification system is working.',
    },
    he: {
      title: 'בדיקת אימות',
      lede: 'זוהי בדיקת תקינות בלבד. לא יבוצע שום שינוי בחשבון.',
      cta: 'המשך',
      next: 'שום דבר לא משתנה — הבדיקה רק מוודאת שמערכת האימות פועלת.',
    },
  },
  login: {
    en: {
      title: 'Sign in to Pet Wash',
      lede: 'Use this code to sign in to Pet Wash.',
      cta: 'Sign in',
      next: "We'll take you straight to where you were heading.",
    },
    he: {
      title: 'כניסה ל-Pet Wash',
      lede: 'השתמשו בקוד הזה כדי להיכנס ל-Pet Wash.',
      cta: 'כניסה',
      next: 'נחזיר אתכם בדיוק לאן שרציתם להגיע.',
    },
  },
  signup: {
    en: {
      title: 'Verify your email',
      lede: 'Verify your email to finish creating your Pet Wash account.',
      cta: 'Continue',
      next: "Next you'll add your name and mobile number.",
    },
    he: {
      title: 'אימות כתובת האימייל',
      lede: 'אמתו את כתובת האימייל כדי לסיים את יצירת חשבון Pet Wash.',
      cta: 'המשך',
      next: 'בשלב הבא נבקש את השם ומספר הנייד.',
    },
  },
  egift_redeem: {
    en: {
      title: 'Confirm it’s you',
      lede: "Confirm that it's you before adding this eGift to your wallet.",
      cta: 'Add the eGift',
      next: 'The eGift balance lands in your Pet Wash wallet straight away.',
    },
    he: {
      title: 'אישור זהות',
      lede: 'נאשר שזה אתם לפני הוספת ה-eGift לארנק.',
      cta: 'הוספת ה-eGift',
      next: 'יתרת ה-eGift תיכנס לארנק Pet Wash מיד.',
    },
  },
  change_email: {
    en: {
      title: 'Verify your new email address',
      lede: 'We sent a code to the NEW address so we know it reaches you before it becomes your sign-in email.',
      cta: 'Confirm the new address',
      next: "Your sign-in email changes, and we'll let the old address know.",
    },
    he: {
      title: 'אימות כתובת האימייל החדשה',
      lede: 'שלחנו קוד לכתובת החדשה כדי לוודא שהיא מגיעה אליכם, לפני שהיא תהפוך לכתובת הכניסה.',
      cta: 'אישור הכתובת החדשה',
      next: 'כתובת הכניסה תתעדכן, ונעדכן על כך גם את הכתובת הקודמת.',
    },
  },
  enable_2fa: {
    en: {
      title: 'Turn on extra security',
      lede: 'Confirm your identity to enable extra security on your account.',
      cta: 'Turn it on',
      next: "From now on we'll ask for a code when something sensitive happens.",
    },
    he: {
      title: 'הפעלת אבטחה נוספת',
      lede: 'אישור זהות כדי להפעיל שכבת אבטחה נוספת בחשבון.',
      cta: 'הפעלה',
      next: 'מעכשיו נבקש קוד בכל פעולה רגישה.',
    },
  },
  disable_2fa: {
    en: {
      title: 'Turn off extra security',
      lede: 'Confirm your identity before we remove the extra security step.',
      cta: 'Turn it off',
      next: "Your account will no longer ask for a second step. You can turn it back on any time.",
    },
    he: {
      title: 'כיבוי אבטחה נוספת',
      lede: 'אישור זהות לפני הסרת שלב האבטחה הנוסף.',
      cta: 'כיבוי',
      next: 'החשבון לא יבקש עוד שלב שני. אפשר להפעיל מחדש בכל רגע.',
    },
  },
  close_account: {
    en: {
      title: 'Confirm account closure',
      lede: 'Confirm account closure. This is the last step before we begin closing your Pet Wash account.',
      cta: 'Confirm closure',
      next: "We'll start the closure and email you a confirmation.",
    },
    he: {
      title: 'אישור סגירת חשבון',
      lede: 'אישור סגירת החשבון. זהו השלב האחרון לפני שנתחיל בסגירת חשבון Pet Wash.',
      cta: 'אישור סגירה',
      next: 'נתחיל בתהליך הסגירה ונשלח אישור באימייל.',
    },
  },
  payout: {
    en: {
      title: 'Confirm this payout',
      lede: 'Confirm this payout action before we release the funds.',
      cta: 'Confirm the payout',
      next: 'The payout is released once this is confirmed.',
    },
    he: {
      title: 'אישור התשלום',
      lede: 'אישור פעולת התשלום לפני שחרור הכספים.',
      cta: 'אישור התשלום',
      next: 'התשלום ישוחרר מיד לאחר האישור.',
    },
  },
};

export function purposeCopy(purpose: VerificationPurpose, language: CopyLanguage): PurposeCopy {
  const forPurpose = COPY[purpose] ?? COPY.diagnostic_noop;
  return forPurpose[language] ?? forPurpose.en;
}

/**
 * Human error copy, keyed by the server's reasonCode.
 *
 * The rule the CEO set: never make verification feel like a mysterious
 * interruption, and never reset the form because a code was wrong. Each entry
 * says what happened and what to do next — nothing else.
 */
export type VerificationReasonCode =
  // Every code UnifiedVerificationService can actually throw, taken from the
  // service source rather than guessed. The first draft of this map invented
  // CODE_MISMATCH and TOO_MANY_ATTEMPTS, which the server never emits — so a
  // customer with a wrong digit would have fallen through to "Something went
  // wrong." A test pins this list against the service so it cannot drift again.
  | 'INVALID_CODE'
  | 'CHALLENGE_LOCKED'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_NOT_FOUND'
  | 'CHALLENGE_NOT_PENDING'
  | 'CHALLENGE_ALREADY_CLAIMED'
  | 'CHALLENGE_COOLDOWN'
  | 'CHANNEL_NOT_ALLOWED'
  | 'CHANNEL_SWITCH_NOT_ALLOWED'
  | 'SESSION_REQUIRED'
  | 'ACTOR_MISMATCH'
  | 'PURPOSE_FLAG_DISABLED'
  | 'PURPOSE_NOT_MIGRATED'
  | 'UNKNOWN_PURPOSE'
  | 'DIAGNOSTIC_DISABLED'
  | 'SMS_PROVIDER_ERROR'
  | 'EMAIL_PROVIDER_ERROR'
  | 'SMS_VERIFICATION_SECRET_MISSING'
  // Client-side only.
  | 'NETWORK'
  | 'UNKNOWN';

const ERRORS: Record<VerificationReasonCode, Record<CopyLanguage, string>> = {
  INVALID_CODE: {
    en: "That code isn't correct. Try again.",
    he: 'הקוד אינו נכון. נסו שוב.',
  },
  CHALLENGE_EXPIRED: {
    en: 'That code has expired. Send a new one.',
    he: 'תוקף הקוד פג. שלחו קוד חדש.',
  },
  CHALLENGE_NOT_FOUND: {
    en: "We couldn't find that verification. Start again.",
    he: 'לא מצאנו את בקשת האימות. התחילו מחדש.',
  },
  CHALLENGE_NOT_PENDING: {
    en: 'This code has already been used. Send a new one.',
    he: 'הקוד הזה כבר נוצל. שלחו קוד חדש.',
  },
  CHALLENGE_LOCKED: {
    en: 'Too many attempts. For your security this code is locked — send a new one in a moment.',
    he: 'יותר מדי ניסיונות. למען אבטחתכם הקוד ננעל — שלחו קוד חדש בעוד רגע.',
  },
  CHALLENGE_ALREADY_CLAIMED: {
    en: 'This code has already been used. Send a new one.',
    he: 'הקוד הזה כבר נוצל. שלחו קוד חדש.',
  },
  ACTOR_MISMATCH: {
    en: 'This verification belongs to a different account. Please sign in as that account.',
    he: 'האימות הזה שייך לחשבון אחר. יש להתחבר לאותו חשבון.',
  },
  UNKNOWN_PURPOSE: {
    en: "This isn't available right now. Please try again later.",
    he: 'האפשרות אינה זמינה כרגע. נסו שוב מאוחר יותר.',
  },
  DIAGNOSTIC_DISABLED: {
    en: "This isn't available right now. Please try again later.",
    he: 'האפשרות אינה זמינה כרגע. נסו שוב מאוחר יותר.',
  },
  CHALLENGE_COOLDOWN: {
    en: 'Give the last code a moment to arrive before asking for another.',
    he: 'תנו לקוד הקודם רגע להגיע לפני בקשת קוד נוסף.',
  },
  CHANNEL_NOT_ALLOWED: {
    en: "That method can't be used for this step.",
    he: 'לא ניתן להשתמש בשיטה הזו בשלב הזה.',
  },
  CHANNEL_SWITCH_NOT_ALLOWED: {
    en: 'To use a different method, start again with the new details.',
    he: 'כדי להשתמש בשיטה אחרת, התחילו מחדש עם הפרטים החדשים.',
  },
  SESSION_REQUIRED: {
    en: 'Please sign in first, then try again.',
    he: 'יש להתחבר תחילה ואז לנסות שוב.',
  },
  PURPOSE_FLAG_DISABLED: {
    en: "This isn't available right now. Please try again later.",
    he: 'האפשרות אינה זמינה כרגע. נסו שוב מאוחר יותר.',
  },
  PURPOSE_NOT_MIGRATED: {
    en: "This isn't available right now. Please try again later.",
    he: 'האפשרות אינה זמינה כרגע. נסו שוב מאוחר יותר.',
  },
  SMS_PROVIDER_ERROR: {
    en: "We couldn't send the code right now. Try again or use another method.",
    he: 'לא הצלחנו לשלוח את הקוד כרגע. נסו שוב או בחרו שיטה אחרת.',
  },
  EMAIL_PROVIDER_ERROR: {
    en: "We couldn't send the code right now. Try again or use another method.",
    he: 'לא הצלחנו לשלוח את הקוד כרגע. נסו שוב או בחרו שיטה אחרת.',
  },
  SMS_VERIFICATION_SECRET_MISSING: {
    en: "This isn't available right now. Please try again later.",
    he: 'האפשרות אינה זמינה כרגע. נסו שוב מאוחר יותר.',
  },
  NETWORK: {
    en: 'Connection problem. Your code is still valid — check your connection and try again.',
    he: 'בעיית תקשורת. הקוד עדיין בתוקף — בדקו את החיבור ונסו שוב.',
  },
  UNKNOWN: {
    en: 'Something went wrong. Try again.',
    he: 'משהו השתבש. נסו שוב.',
  },
};

export function verificationErrorMessage(
  reasonCode: string | undefined,
  language: CopyLanguage,
): string {
  const key = (reasonCode || 'UNKNOWN') as VerificationReasonCode;
  const entry = ERRORS[key] ?? ERRORS.UNKNOWN;
  return entry[language] ?? entry.en;
}

/** Shared chrome strings. */
export const UI_COPY = {
  sentTo: {
    en: (channel: string) => `We sent a 6-digit Pet Wash code to your ${channel}`,
    he: (channel: string) => `שלחנו קוד אימות בן 6 ספרות ל${channel} שלכם`,
  },
  codeLabel: { en: 'Verification code', he: 'קוד אימות' },
  didntGetIt: { en: "Didn't receive it?", he: 'הקוד לא הגיע?' },
  resend: { en: 'Send a new code', he: 'שליחת קוד חדש' },
  resendIn: {
    en: (mmss: string) => `Resend in ${mmss}`,
    he: (mmss: string) => `שליחה חוזרת בעוד ${mmss}`,
  },
  resent: { en: 'New code sent', he: 'נשלח קוד חדש' },
  useSms: { en: 'Use SMS instead', he: 'קבלת קוד ב-SMS' },
  useWhatsapp: { en: 'Use WhatsApp instead', he: 'קבלת קוד בוואטסאפ' },
  useEmail: { en: 'Use email instead', he: 'קבלת קוד באימייל' },
  changeEmail: { en: 'Change email', he: 'שינוי כתובת האימייל' },
  changePhone: { en: 'Change number', he: 'שינוי מספר הטלפון' },
  verifying: { en: 'Verifying…', he: 'מאמת…' },
  sending: { en: 'Sending…', he: 'שולח…' },
  back: { en: 'Back', he: 'חזרה' },
} as const;
