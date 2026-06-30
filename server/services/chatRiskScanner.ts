/**
 * chatRiskScanner — rules-based safety monitor for chat messages (he + en).
 *
 * Pure & deterministic. Scans a message for the risk patterns the CEO Trust &
 * Safety / Communication Hub spec calls out — off-platform payment, sharing a
 * private number too early, abuse/threats, pet-safety danger, lost-pet/medical
 * urgency, off-platform booking. Returns ADVISORY flags + a 0-100 score.
 *
 * Hard rule (spec): this NEVER acts — it does not block, pay, refund, ban, or
 * decide. It raises flags for a human (support/admin) to review. The caller logs
 * the result; staff decide.
 */

export type ChatRiskCode =
  | 'OFF_PLATFORM_PAYMENT'
  | 'OFF_PLATFORM_CONTACT'
  | 'PRIVATE_NUMBER_SHARED'
  | 'ABUSE_THREAT'
  | 'PET_DANGER'
  | 'MEDICAL_URGENT'
  | 'LOST_PET'
  | 'OFF_PLATFORM_BOOKING';

export type ChatRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ChatRiskFlag {
  code: ChatRiskCode;
  label: { en: string; he: string };
  weight: number; // contribution to the score
}

export interface ChatRiskResult {
  level: ChatRiskLevel;
  score: number; // 0-100
  flags: ChatRiskFlag[];
}

interface Rule {
  code: ChatRiskCode;
  weight: number;
  label: { en: string; he: string };
  patterns: RegExp[];
}

// Bilingual patterns. \b is unreliable for Hebrew, so Hebrew terms match as
// substrings; English terms use word-ish boundaries where helpful.
const RULES: Rule[] = [
  {
    code: 'OFF_PLATFORM_PAYMENT',
    weight: 55,
    label: { en: 'Off-platform payment', he: 'תשלום מחוץ לפלטפורמה' },
    patterns: [
      /\b(cash|bank\s*transfer|wire\s*transfer|paypal|venmo|revolut|zelle|western\s*union)\b/i,
      /\b(bit|paybox|pay\s*box)\b/i,
      /pay\s*(me|you)?\s*(directly|outside|in\s*cash)/i,
      /מזומן|העברה\s*בנקאית|העברה\s*לחשבון|ביט|פייבוקס|פאי?פאל|לשלם\s*ישיר|מחוץ\s*לאפליקציה|מחוץ\s*לפלטפורמה/,
    ],
  },
  {
    code: 'OFF_PLATFORM_CONTACT',
    weight: 30,
    label: { en: 'Move chat off-platform', he: 'העברת שיחה מחוץ לפלטפורמה' },
    patterns: [
      /\b(whats\s*app|whatsapp|telegram|signal|instagram\s*dm|messenger)\b/i,
      /(text|message|call)\s*me\s*(on|at)\b/i,
      /וואטסאפ|ווצאפ|וואצאפ|טלגרם|תכתוב\s*לי\s*ב|תתקשר\s*אלי|נדבר\s*בפרטי/,
    ],
  },
  {
    code: 'PRIVATE_NUMBER_SHARED',
    weight: 25,
    label: { en: 'Private phone number shared', he: 'שיתוף מספר טלפון פרטי' },
    patterns: [
      // Israeli mobile (05x-xxxxxxx / +9725x...) and generic 9-11 digit runs.
      /(\+?972|0)5\d[\s-]?\d{3}[\s-]?\d{4}/,
      /\b\d[\d\s-]{7,12}\d\b/,
    ],
  },
  {
    code: 'ABUSE_THREAT',
    weight: 45,
    label: { en: 'Abuse or threat', he: 'התעללות או איום' },
    patterns: [
      /\b(kill\s*you|i'?ll\s*hurt|threat|fuck\s*you|i\s*know\s*where\s*you\s*live)\b/i,
      /אהרוג\s*אותך|אפגע\s*בך|איום|אני\s*יודע\s*איפה\s*אתה\s*גר/,
    ],
  },
  {
    code: 'PET_DANGER',
    weight: 50,
    label: { en: 'Pet safety danger', he: 'סכנה לבטיחות החיה' },
    patterns: [
      /\b(bite|bitten|attack|aggressive|escaped|got\s*out|injur|bleeding|blood)\b/i,
      /נשך|נשיכה|תקף|תוקפ|אגרסי|ברח|נפצע|מדמם|דם/,
    ],
  },
  {
    code: 'MEDICAL_URGENT',
    weight: 60,
    label: { en: 'Urgent medical', he: 'מצב רפואי דחוף' },
    patterns: [
      /\b(emergency|can'?t\s*breathe|collapse|seizure|unconscious|vet\s*now|poison)\b/i,
      /חירום|לא\s*נושם|התמוטט|פרכוס|מחוסר\s*הכרה|וטרינר\s*דחוף|הרעלה/,
    ],
  },
  {
    code: 'LOST_PET',
    weight: 50,
    label: { en: 'Lost pet', he: 'חיה אבודה' },
    patterns: [
      /\b(lost|missing|can'?t\s*find|ran\s*away|disappeared)\b.*\b(dog|cat|pet|him|her)\b/i,
      /אבד|נעלם|לא\s*מוצא|ברח\s*הכלב|נעלמה\s*החתול/,
    ],
  },
  {
    code: 'OFF_PLATFORM_BOOKING',
    weight: 40,
    label: { en: 'Off-platform booking attempt', he: 'ניסיון הזמנה מחוץ לפלטפורמה' },
    patterns: [
      /\b(cancel\s*(the|this)?\s*booking\s*and|book\s*directly|skip\s*the\s*app|book\s*outside)\b/i,
      /נבטל\s*את\s*ההזמנה\s*ו|נסגור\s*ישיר|בלי\s*האפליקציה|הזמנה\s*מחוץ/,
    ],
  },
];

function levelFor(score: number): ChatRiskLevel {
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

/**
 * Scan one message. Returns the matched advisory flags and a capped 0-100 score.
 * Empty/whitespace input → LOW, no flags. Never throws.
 */
export function scanChatRisk(text: string | null | undefined): ChatRiskResult {
  const t = String(text ?? '').trim();
  if (!t) return { level: 'LOW', score: 0, flags: [] };

  const flags: ChatRiskFlag[] = [];
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(t))) {
      flags.push({ code: rule.code, label: rule.label, weight: rule.weight });
    }
  }
  const score = Math.min(100, flags.reduce((s, f) => s + f.weight, 0));
  return { level: levelFor(score), score, flags };
}
