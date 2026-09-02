/**
 * SMS template registry — the single source of truth for every PetWash SMS.
 *
 * Before this, SMS bodies were scattered across ~13 inline build*Sms() builders
 * and ~20 raw twilioSMSService.sendSMS() call sites with no registry, so most of
 * the CEO's ~100 specified messages were simply missing. This registry keys every
 * message by event with the CEO's APPROVED Hebrew copy (Hebrew-first per the SMS
 * rules), so a new message becomes "add a row", and `sendSmsTemplate()` renders +
 * sends it.
 *
 * SMS rules (CEO 2026): short · Hebrew first · NO private/medical data · link only
 * when needed · MARKETING must carry an opt-out (transactional must NOT be blocked
 * by a marketing opt-out). Variables are {{name}} placeholders.
 */
import { twilioSMSService } from './TwilioSMSService';
import { logger } from '../lib/logger';

export type SmsCategory = 'transactional' | 'marketing';

export interface SmsTemplate {
  category: SmsCategory;
  /** Hebrew body (required — Hebrew-first). */
  he: string;
  /** Optional English body; falls back to Hebrew if absent. */
  en?: string;
}

/** Keyed by event. Values are the CEO's approved copy. */
export const SMS_TEMPLATES: Record<string, SmsTemplate> = {
  // ── User ──────────────────────────────────────────────────────────────────
  // NOTE: 5 min matches the live OTP TTL (OTP_TTL_SEC=300 in every OTP service).
  // Do NOT change to 10 min without also raising the server TTL, or the SMS lies.
  otp_login: { category: 'transactional', he: 'קוד האימות שלך ל-PetWash הוא: {{code}}. הקוד תקף ל-5 דקות.' },
  account_created: { category: 'transactional', he: 'ברוכים הבאים ל-PetWash. החשבון שלך נוצר בהצלחה. להשלמת הפרופיל: {{link}}' },
  email_verify_reminder: { category: 'transactional', he: 'כמעט סיימנו. נא לאמת את כתובת האימייל שלך כדי להפעיל את החשבון: {{link}}' },
  add_pet_reminder: { category: 'transactional', he: 'החשבון שלך פעיל. הוסף/י את פרטי חיית המחמד כדי להשתמש בכל שירותי PetWash: {{link}}' },
  pet_profile_completed: { category: 'transactional', he: 'פרופיל חיית המחמד נשמר בהצלחה. אפשר להתחיל להשתמש בשירותי PetWash.' },
  wallet_created: { category: 'transactional', he: 'ארנק PetWash שלך מוכן. ניתן לצפות בקרדיטים, נקודות והטבות כאן: {{link}}' },
  qr_card_ready: { category: 'transactional', he: 'כרטיס החבר הדיגיטלי שלך מוכן. להצגה וסריקה: {{link}}' },
  wash_credit_added: { category: 'transactional', he: 'נוספו {{credits}} קרדיטים לחשבון PetWash שלך. יתרה נוכחית: {{balance}}.' },
  reward_earned: { category: 'transactional', he: 'כל הכבוד! צברת {{points}} נקודות PetWash. לצפייה בהטבות: {{link}}' },
  reward_available: { category: 'transactional', he: 'יש לך הטבה חדשה ב-PetWash. למימוש: {{link}}' },
  reward_expiring: { category: 'transactional', he: 'תזכורת: ההטבה שלך ב-PetWash תפוג בתאריך {{date}}. למימוש: {{link}}' },
  booking_confirmed: { category: 'transactional', he: 'ההזמנה שלך אושרה. שירות: {{service}}, תאריך: {{date}}, שעה: {{time}}.' },
  booking_reminder: { category: 'transactional', he: 'תזכורת להזמנת PetWash שלך מחר בשעה {{time}}. לפרטים: {{link}}' },
  // Same reminder, day-of wording (T-2h tier of cron-booking-reminders.ts) —
  // the 'booking_reminder' row says "מחר" which would lie 2 hours before start.
  booking_reminder_today: { category: 'transactional', he: 'ההזמנה שלך ב-PetWash מתחילה היום בשעה {{time}}. לפרטים: {{link}}' },
  care_notes_reminder_24h: {
    category: 'transactional',
    he: 'PetWash: ההזמנה שלך ל{{pet_name}} מתחילה בפחות מ-24 שעות. נא להשלים פרטי טיפול: {{link}}',
    en: 'PetWash: your booking for {{pet_name}} starts in under 24 hours. Please complete care details: {{link}}',
  },
  booking_cancelled: { category: 'transactional', he: 'ההזמנה שלך בוטלה. פרטי הביטול וההחזר, ככל שקיים, זמינים כאן: {{link}}' },
  refund_request_received: { category: 'transactional', he: 'בקשת ההחזר שלך התקבלה ונמצאת בבדיקה. מספר פנייה: {{ticket_id}}.' },
  refund_approved: { category: 'transactional', he: 'בקשת ההחזר אושרה. ההחזר יבוצע לאמצעי התשלום המקורי בהתאם למדיניות.' },
  refund_rejected: { category: 'transactional', he: 'בקשת ההחזר נבדקה ולא אושרה. לפרטים נוספים ניתן לפנות לתמיכה: {{link}}' },
  payment_success: { category: 'transactional', he: 'התשלום ל-PetWash התקבל בהצלחה. חשבונית/קבלה זמינה כאן: {{link}}' },
  payment_failed: { category: 'transactional', he: 'התשלום לא הושלם. ניתן לנסות שוב או לבחור אמצעי תשלום אחר: {{link}}' },
  membership_renewed: { category: 'transactional', he: 'המנוי שלך ל-PetWash חודש בהצלחה. תודה שבחרת בנו.' },
  membership_expiring: { category: 'transactional', he: 'המנוי שלך ל-PetWash יפוג בתאריך {{date}}. לחידוש: {{link}}' },
  membership_expired: { category: 'transactional', he: 'המנוי שלך פג. ניתן לחדש ולהמשיך ליהנות מהטבות PetWash: {{link}}' },
  card_frozen: { category: 'transactional', he: 'כרטיס PetWash שלך הוקפא לפי בקשתך. אם לא ביקשת זאת, פנה/י מיד לתמיכה.' },
  card_replaced: { category: 'transactional', he: 'כרטיס PetWash חדש הופק עבורך. להצגת הכרטיס: {{link}}' },
  suspicious_scan: { category: 'transactional', he: 'זוהתה סריקה חריגה בכרטיס PetWash שלך. אם זו לא הייתה פעולה שלך, פנה/י לתמיכה.' },
  station_issue_received: { category: 'transactional', he: 'הדיווח שלך על תחנת PetWash התקבל. מספר פנייה: {{ticket_id}}.' },
  station_back_online: { category: 'transactional', he: 'התחנה שדיווחת עליה חזרה לפעילות. תודה שעזרת לנו להשתפר.' },
  feedback_request: { category: 'transactional', he: 'איך הייתה החוויה שלך ב-PetWash? נשמח לדירוג קצר: {{link}}' },
  marketing_offer: { category: 'marketing', he: 'הטבה מיוחדת לחברי PetWash: {{offer}}. למימוש: {{link}} להסרה: {{unsubscribe}}' },
  birthday_pet: { category: 'transactional', he: 'מזל טוב ל-{{pet_name}}! קיבלת הטבת יום הולדת מ-PetWash: {{link}}' },

  // ── Provider ──────────────────────────────────────────────────────────────
  provider_application_started: { category: 'transactional', he: 'התחלת בקשת הצטרפות כספק PetWash. להמשך התהליך: {{link}}' },
  provider_otp: { category: 'transactional', he: 'קוד האימות שלך ל-PetWash Provider הוא: {{code}}.' },
  provider_application_submitted: {
    category: 'transactional',
    he: 'PetWash™ - ברוכים הבאים! 🐾\nשלום {{name}}, הבקשה שלך כספק התקבלה. מספר חברות: {{membership}}. הצוות יבדוק ויחזור אליך תוך 48 שעות.',
    en: 'PetWash™ - Welcome! 🐾\nHi {{name}}, your provider application was received. Membership #: {{membership}}. Our team will review and reply within 48 hours.',
  },
  provider_pending: { category: 'transactional', he: 'בקשת הספק שלך ממתינה לאימות. חסר עוד שלב אחד להשלמת התהליך: {{link}}' },
  provider_missing_documents: { category: 'transactional', he: 'חסרים מסמכים בבקשת הספק שלך. להשלמה: {{link}}' },
  provider_document_rejected: { category: 'transactional', he: 'מסמך שהעלית לא אושר. נא להעלות מסמך ברור ועדכני כאן: {{link}}' },
  provider_id_approved: { category: 'transactional', he: 'אימות הזהות שלך אושר.' },
  provider_insurance_missing: { category: 'transactional', he: 'חסר אישור ביטוח בתיק הספק שלך. נא להעלות מסמך ביטוח תקף: {{link}}' },
  provider_insurance_expiring: { category: 'transactional', he: 'תזכורת: ביטוח הספק שלך יפוג בתאריך {{date}}. נא להעלות חידוש: {{link}}' },
  provider_tax_declaration_due: { category: 'transactional', he: 'נדרשת הצהרת מס/סטטוס עסק מעודכנת עבור PetWash. להשלמה: {{link}}' },
  provider_approved: { category: 'transactional', he: 'ברכות! חשבון הספק שלך אושר. ניתן להתחיל לקבל הזמנות: {{link}}' },
  provider_rejected: { category: 'transactional', he: 'בקשת ההצטרפות שלך כספק לא אושרה בשלב זה. לפרטים או ערעור: {{link}}' },
  provider_suspended: { category: 'transactional', he: 'חשבון הספק שלך הושעה זמנית עקב נושא שדורש טיפול. לפרטים: {{link}}' },
  provider_reactivated: { category: 'transactional', he: 'חשבון הספק שלך הופעל מחדש. ניתן לחזור לקבל הזמנות.' },
  provider_new_booking: { category: 'transactional', he: 'בקשת הזמנה חדשה התקבלה. שירות: {{service}}, תאריך: {{date}}. לצפייה: {{link}}' },
  provider_booking_accepted: { category: 'transactional', he: 'אישרת את ההזמנה. נא לוודא שהפרטים והזמנים ברורים: {{link}}' },
  provider_booking_cancelled: { category: 'transactional', he: 'הזמנה בוטלה על ידי הלקוח/מערכת. לפרטים: {{link}}' },
  provider_service_reminder: { category: 'transactional', he: 'תזכורת: יש לך שירות PetWash היום בשעה {{time}}. פרטים: {{link}}' },
  provider_start_service: { category: 'transactional', he: 'הגיע הזמן להתחיל את השירות. לחץ/י להתחלה: {{link}}' },
  provider_complete_service: { category: 'transactional', he: 'נא לסמן את השירות כהושלם ולהעלות הערות/תמונות אם נדרש: {{link}}' },
  provider_incident_received: { category: 'transactional', he: 'דיווח האירוע התקבל. צוות PetWash יבדוק ויצור קשר במידת הצורך.' },
  provider_payout_scheduled: { category: 'transactional', he: 'תשלום ספק מתוכנן עבורך בתאריך {{date}} בסך {{amount}} ₪.' },
  provider_payout_sent: { category: 'transactional', he: 'התשלום לספק נשלח. סכום: {{amount}} ₪. פירוט באזור הספק: {{link}}' },
  provider_invoice_missing: { category: 'transactional', he: 'חסרה חשבונית/קבלה עבור שירות שבוצע. נא להעלות כאן: {{link}}' },
  provider_review_received: { category: 'transactional', he: 'קיבלת ביקורת חדשה מלקוח. לצפייה: {{link}}' },
  provider_training_required: { category: 'transactional', he: 'נדרש להשלים הדרכת PetWash כדי להמשיך לקבל הזמנות. להתחלה: {{link}}' },
  provider_training_completed: { category: 'transactional', he: 'השלמת בהצלחה את הדרכת PetWash. כל הכבוד.' },
  provider_six_month_confirmation: { category: 'transactional', he: 'עברו 6 חודשים. נא לאשר מחדש סטטוס עסק/מס וביטוח: {{link}}' },
  provider_availability_reminder: { category: 'transactional', he: 'עדכן/י זמינות כדי לקבל יותר הזמנות ב-PetWash: {{link}}' },
  provider_support_reply: { category: 'transactional', he: 'צוות התמיכה של PetWash השיב לפנייתך. לצפייה: {{link}}' },

  // ── Admin / ops (internal staff alerts — never sent to customers) ──────────
  admin_new_provider_application: { category: 'transactional', he: 'PetWash: בקשת ספק חדשה ממתינה לאישור. {{provider_name}}. לבדיקה: {{link}}' },
  admin_refund_request: { category: 'transactional', he: 'PetWash: בקשת החזר חדשה ({{amount}} ₪) ממתינה לטיפול. {{link}}' },
  admin_dispute_opened: { category: 'transactional', he: 'PetWash: נפתחה מחלוקת בהזמנה {{booking_id}}. דורש בדיקה: {{link}}' },
  admin_station_fault: { category: 'transactional', he: 'PetWash: תקלה בתחנה {{station}} ({{fault}}). לטיפול: {{link}}' },
  admin_payment_failure_spike: { category: 'transactional', he: 'PetWash: עלייה חריגה בכשלי תשלום ({{count}} ב-{{window}}). לבדיקה: {{link}}' },
  admin_payout_pending_approval: { category: 'transactional', he: 'PetWash: תשלום ספק ({{amount}} ₪) ממתין לאישורך. {{link}}' },
  admin_kyc_review_needed: { category: 'transactional', he: 'PetWash: אימות זהות/מסמכים דורש בדיקה ידנית. {{link}}' },
  admin_insurance_expiring_provider: { category: 'transactional', he: 'PetWash: ביטוח ספק {{provider_name}} יפוג בתאריך {{date}}. {{link}}' },
  admin_daily_summary: { category: 'transactional', he: 'PetWash סיכום יומי: {{bookings}} הזמנות, {{revenue}} ₪, {{alerts}} התראות פתוחות. {{link}}' },
  admin_security_alert: { category: 'transactional', he: 'PetWash התראת אבטחה: {{event}}. דורש בדיקה מיידית: {{link}}' },
};

export type SmsTemplateKey = keyof typeof SMS_TEMPLATES;

/** Render the body for an event in the chosen language with {{var}} substitution. */
export function renderSms(
  key: string,
  vars: Record<string, string | number> = {},
  lang: 'he' | 'en' = 'he',
): { body: string; category: SmsCategory } | null {
  const t = SMS_TEMPLATES[key];
  if (!t) return null;
  const raw = lang === 'en' && t.en ? t.en : t.he;
  const body = raw.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars[name] ?? '')).trim();
  return { body, category: t.category };
}

/**
 * Render + send an SMS by event key. Marketing messages MUST be gated by the
 * caller (consent) and carry an opt-out var; this helper warns if a marketing
 * template is sent without {{unsubscribe}} resolved. Returns the send result.
 */
export async function sendSmsTemplate(
  key: string,
  to: string,
  vars: Record<string, string | number> = {},
  opts: { lang?: 'he' | 'en'; userId?: string; purpose?: string } = {},
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const rendered = renderSms(key, vars, opts.lang ?? 'he');
  if (!rendered) {
    logger.warn('[SMS] unknown template key', { key });
    return { success: false, error: `unknown SMS template: ${key}` };
  }
  if (rendered.category === 'marketing' && !vars.unsubscribe) {
    logger.warn('[SMS] marketing template sent without an opt-out link', { key });
  }
  // AUDIT-SMS-5 (#221): marketing templates default to BOOKING_REMINDER
  // (which is where they sit in the per-UID budget catalogue), everything
  // else to BOOKING_CONFIRM. Callers CAN override with opts.purpose.
  const { SMS_PURPOSES } = await import('../lib/perUidSmsBudget');
  const purpose = opts.purpose
    ?? (rendered.category === 'marketing' ? SMS_PURPOSES.BOOKING_REMINDER : SMS_PURPOSES.BOOKING_CONFIRM);
  return twilioSMSService.sendSMS(to, rendered.body, { userId: opts.userId, purpose });
}
