/**
 * "Keep on PetWash" system reply — CEO Integrity Doctrine §45.
 *
 * When one side (usually the customer) solicits an off-platform deal or
 * contact exchange, the OTHER side can send a friendly, system-generated
 * response. Provider taps `[Keep this on PetWash]` — a canned reply lands
 * in the thread; the provider does NOT get penalised for it.
 *
 * Rules:
 *   • Pure function — no I/O. Callers dispatch the resulting message.
 *   • Bilingual (Hebrew primary, English fallback), because 90 % of
 *     PetWash chat is in Hebrew.
 *   • Marked as SYSTEM_REPLY_SAFE so the policy engine + audit can skip it
 *     (never treat this as a violation attempt).
 */
import type { PolicyCategory } from './policyEngine';

export type ReplyLanguage = 'he' | 'en';

export interface KeepOnPlatformReply {
  text: string;
  language: ReplyLanguage;
  systemTag: 'KEEP_ON_PETWASH';
  reason: PolicyCategory | 'GENERIC';
  /**
   * True when this reply is emitted by the platform on behalf of a party.
   * The audit / integrity engines must skip these — they are not violations.
   */
  safeSystemReply: true;
}

const HE = {
  GENERIC:
    'תודה! בואו נשמור את התיאום כאן ב-PetWash — כך יש לשנינו תיעוד, תשלום מאובטח ותמיכה במקרה הצורך. 🐾',
  OFF_PLATFORM_BOOKING:
    'תודה! אני מעדיף להישאר עם ההזמנות דרך PetWash — יש לי שם יומן, תיעוד ותמיכה, ולשנינו כך יש הגנה. אשמח אם נמשיך כאן. 🐾',
  OFF_PLATFORM_PAYMENT:
    'תודה! התשלום צריך להתבצע דרך PetWash כך שיהיה לשנינו קבלה מסודרת והגנה במקרה של תקלה. אעדכן אם צריך התאמות דרך "עדכון הזמנה". 🐾',
  CONTACT_EXCHANGE:
    'ניצור קשר דרך הצ׳אט של PetWash בשלב הזה — זה שומר עליי ועליכם. ברגע שנאשר את ההזמנה נוכל להתקשר בכפתור המובנה. 🐾',
  EXTERNAL_MESSAGING_APP:
    'תודה, נשאיר את הצ׳אט כאן ב-PetWash כרגע — זה שומר עלינו וגם על ההזמנה בתיעוד רשמי. 🐾',
} as const;

const EN = {
  GENERIC:
    "Thanks! Let's keep this on PetWash — it gives us both a record, secure payment, and support if anything comes up. 🐾",
  OFF_PLATFORM_BOOKING:
    "Thanks! I prefer to book through PetWash — I have my calendar, records, and support there, and it protects both of us. Happy to continue here. 🐾",
  OFF_PLATFORM_PAYMENT:
    "Thanks! Payment should go through PetWash so we both have a proper receipt and coverage if anything goes wrong. I'll use 'Request Booking Change' if we need to adjust. 🐾",
  CONTACT_EXCHANGE:
    "Let's stay in PetWash chat for now — it protects both of us. Once the booking is confirmed we can use the built-in call button. 🐾",
  EXTERNAL_MESSAGING_APP:
    "Thanks, let's keep the chat on PetWash for now — it keeps us both safer and keeps a proper booking record. 🐾",
} as const;

type TemplateKey = keyof typeof HE;

/**
 * Build a canned reply for the given category. Unknown / null category
 * falls back to GENERIC. English is a secondary target used only when the
 * caller explicitly asked for it (some providers work with expats).
 */
export function buildKeepOnPlatformReply(
  category: PolicyCategory | undefined,
  language: ReplyLanguage = 'he',
): KeepOnPlatformReply {
  const key = pickKey(category);
  const text = language === 'en' ? EN[key] : HE[key];
  return {
    text,
    language,
    systemTag: 'KEEP_ON_PETWASH',
    reason: category ?? 'GENERIC',
    safeSystemReply: true,
  };
}

function pickKey(category: PolicyCategory | undefined): TemplateKey {
  switch (category) {
    case 'OFF_PLATFORM_BOOKING':
    case 'OFF_PLATFORM_PAYMENT':
    case 'CONTACT_EXCHANGE':
    case 'EXTERNAL_MESSAGING_APP':
      return category;
    default:
      return 'GENERIC';
  }
}
