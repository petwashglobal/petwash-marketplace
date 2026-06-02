/**
 * Maya WhatsApp responder — rule-based (no LLM, so it cannot hallucinate
 * prices/hours; matches the CEO no-false-facts standard).
 *
 * Flow: classify the inbound message → compose an honest reply that answers
 * the question, states "opening soon in Kfar Saba", and asks to capture the
 * lead. Bilingual (Hebrew default, English when the text is Latin script).
 */
import {
  PETWASH_KNOWLEDGE,
  hoursAnswer,
  priceAnswer,
  locationAnswer,
} from './petwashKnowledge';

export type MayaIntent =
  | 'greeting'
  | 'hours'
  | 'price'
  | 'location'
  | 'services'
  | 'large_dog'
  | 'booking'
  | 'thanks'
  | 'fallback';

/** Hebrew presence → 'he', else 'en'. */
export function detectLocale(text: string): 'he' | 'en' {
  return /[֐-׿]/.test(text) ? 'he' : 'en';
}

const PATTERNS: Array<{ intent: MayaIntent; re: RegExp }> = [
  { intent: 'thanks', re: /\b(thank|thanks|thx)\b|תודה|תודה רבה/i },
  { intent: 'hours', re: /\b(hours?|open|opening|when.*open|time)\b|שעות|מתי.*פתוח|שעות פתיחה|פתוחים/i },
  { intent: 'price', re: /\b(price|prices|cost|how much|fee|rate)\b|מחיר|מחירים|כמה עולה|עלות|טווח מחירים/i },
  { intent: 'location', re: /\b(where|located|location|address|map)\b|איפה|כתובת|מיקום|ממוקמים|היכן/i },
  { intent: 'large_dog', re: /\b(big|large) dog\b|כלב גדול|כלבים גדולים/i },
  { intent: 'booking', re: /\b(book|booking|reserve|appointment)\b|להזמין|הזמנה|לקבוע|תור/i },
  { intent: 'services', re: /\b(service|services|wash|grooming|what.*offer|do you)\b|שירות|שירותים|שטיפה|רחצה|מה אתם/i },
  { intent: 'greeting', re: /\b(hi|hello|hey|good (morning|evening))\b|היי|שלום|הי|בוקר טוב|ערב טוב/i },
];

export function classifyIntent(text: string): MayaIntent {
  const t = (text || '').trim();
  if (!t) return 'greeting';
  for (const { intent, re } of PATTERNS) {
    if (re.test(t)) return intent;
  }
  return 'fallback';
}

const K = PETWASH_KNOWLEDGE;

/** Compose Maya's full WhatsApp reply. Always honest; always invites the lead. */
export function composeReply(text: string, profileName?: string): { reply: string; intent: MayaIntent; locale: 'he' | 'en' } {
  const locale = detectLocale(text);
  const intent = classifyIntent(text);
  const he = locale === 'he';
  const name = (profileName || '').trim().split(/\s+/)[0] || '';
  const hi = he ? (name ? `היי ${name},` : 'היי,') : (name ? `Hi ${name},` : 'Hi,');
  const opening = K.openingLine[locale];
  const capture = K.captureAsk[locale];
  const thanksWord = he ? `תודה שפנית ל-${K.brand} 🐾` : `thanks for reaching out to ${K.brand} 🐾`;

  // Body per intent (honest — price/hours/location fall back to "at launch").
  let body: string;
  switch (intent) {
    case 'hours':
      body = hoursAnswer(locale);
      break;
    case 'price':
      body = priceAnswer(locale);
      break;
    case 'location':
      body = locationAnswer(locale);
      break;
    case 'large_dog':
      body = he
        ? 'בהחלט — העמדה מתאימה מצוין גם לכלב גדול. ' + K.blurb.he
        : 'Absolutely — the station is great for large dogs. ' + K.blurb.en;
      break;
    case 'services':
    case 'greeting':
    case 'fallback':
      body = K.blurb[locale];
      break;
    case 'booking':
      body = he
        ? 'נשמח! ההזמנות נפתחות עם הפתיחה בכפר סבא — אוסיף אותך לרשימה ואעדכן ראשונה.'
        : "Love it! Booking opens with our Kfar Saba launch — I'll add you to the list and update you first.";
      break;
    case 'thanks':
      body = he ? 'בשמחה! 🙏' : "My pleasure! 🙏";
      break;
    default:
      body = K.blurb[locale];
  }

  // Assemble: greeting + thanks (first contact), body, opening-soon, capture ask.
  const lines = intent === 'thanks'
    ? [`${hi} ${body}`, opening, capture]
    : [`${hi} ${thanksWord}`, body, opening, capture];

  return { reply: lines.join('\n\n'), intent, locale };
}
