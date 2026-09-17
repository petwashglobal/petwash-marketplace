/**
 * Send Pet Wash's own payment confirmation (payment-confirmation-2026) once a
 * card payment is verified with SUMIT.
 *
 * CEO 2026-09-17: SUMIT's stock "חיוב שבוצע בהצלחה" mail replaced by our
 * letter. The flows that send it open SUMIT's page with
 * UpdateCustomerOnSuccess:false so the customer gets one email, not two.
 *
 * Callers send it only on the FIRST verification of a payment (a fresh
 * payment claim / the winning status flip), so a refresh never re-sends.
 * Never throws — a mail problem must not break the payment return.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { logger } from '../lib/logger';
import { buildPaymentConfirmationEmail } from '../email/templates/payment-confirmation-2026';
import { sendLuxuryEmail } from '../email/luxury-email-service';

/** Where a signed-in customer sees their transactions and tax documents. */
export const MY_TRANSACTIONS_URL = `${process.env.APP_URL || 'https://petwash.co.il'}/account/transactions`;

/** Last four card digits from a SUMIT /billing/payments/get/ response, if present. */
export function readSumitCardLast4(raw: unknown): string | null {
  const pm = (raw as any)?.Data?.Payment?.PaymentMethod;
  const v = pm?.CreditCard_LastDigits ?? pm?.CreditCard_CardMask;
  const digits = String(v ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

const ITEM_LABELS: Record<string, { he: string; en: string }> = {
  SINGLE_WASH: { he: 'שטיפה בעמדת PetWash', en: 'PetWash station wash' },
  WASH_PACKAGE: { he: 'חבילת שטיפות', en: 'Wash package' },
  EGIFT_CARD: { he: 'כרטיס מתנה / טעינת ארנק', en: 'Gift card / wallet credit' },
  MEMBERSHIP: { he: 'מנוי מועדון', en: 'Club membership' },
  PET_SITTING_BOOKING: { he: 'Sitter Suite · שמירה על חיית מחמד', en: 'Sitter Suite · pet sitting' },
  DOG_WALKING_BOOKING: { he: 'Walk My Pet · טיול כלב', en: 'Walk My Pet · dog walk' },
  GROOMING_BOOKING: { he: 'טיפוח', en: 'Grooming' },
  SHOP_ORDER: { he: 'הזמנה מהחנות', en: 'Shop order' },
};

/** What the customer paid for, in their words. */
export function purchaseItemLabel(productType: string | null | undefined): { he: string; en: string } {
  return ITEM_LABELS[String(productType || '')] ?? { he: 'תשלום ב־PetWash', en: 'PetWash payment' };
}

const BOOKING_LABELS: Record<string, { he: string; en: string }> = {
  walking: ITEM_LABELS.DOG_WALKING_BOOKING,
  dog_walking: ITEM_LABELS.DOG_WALKING_BOOKING,
  sitting: ITEM_LABELS.PET_SITTING_BOOKING,
  pet_sitting: ITEM_LABELS.PET_SITTING_BOOKING,
  grooming: ITEM_LABELS.GROOMING_BOOKING,
  training: { he: 'PetWash Academy · אימון', en: 'PetWash Academy · training' },
};

/** Booking service type → letter line. */
export function bookingItemLabel(serviceType: string | null | undefined): { he: string; en: string } {
  const s = String(serviceType || '').toLowerCase();
  if (BOOKING_LABELS[s]) return BOOKING_LABELS[s];
  if (s.includes('walk')) return BOOKING_LABELS.walking;
  if (s.includes('sit')) return BOOKING_LABELS.sitting;
  if (s.includes('groom')) return BOOKING_LABELS.grooming;
  if (s.includes('train') || s.includes('academy')) return BOOKING_LABELS.training;
  return { he: 'הזמנת שירות', en: 'Service booking' };
}

export interface PaymentLetterInput {
  userId: string;
  amountIls: number;
  itemDescription: { he: string; en: string };
  reference: string;
  sumitRaw?: unknown;
  /** Defaults to the customer's transactions page. */
  documentUrl?: string | null;
}

export async function sendPaymentLetter(input: PaymentLetterInput): Promise<'sent' | 'skipped' | 'failed'> {
  try {
    if (!input.userId || !(input.amountIls > 0)) return 'skipped';
    const [u] = await db
      .select({ email: users.email, firstName: users.firstName, language: users.language })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!u?.email) {
      logger.warn('[PaymentLetter] no email on file — letter not sent', { userId: input.userId, reference: input.reference });
      return 'skipped';
    }
    const lang = String(u.language || 'he').slice(0, 2) === 'en' ? 'en' : 'he';
    const email = buildPaymentConfirmationEmail({
      language: lang,
      customerName: u.firstName,
      amountIls: input.amountIls,
      cardLast4: readSumitCardLast4(input.sumitRaw),
      itemDescription: lang === 'en' ? input.itemDescription.en : input.itemDescription.he,
      paidAt: new Date(),
      reference: input.reference,
      documentUrl: input.documentUrl === undefined ? MY_TRANSACTIONS_URL : input.documentUrl,
      buttonText: lang === 'en' ? 'Your payments & documents' : 'התשלומים והמסמכים שלי',
    });
    const ok = await sendLuxuryEmail({ to: u.email, subject: email.subject, html: email.html });
    if (!ok) logger.error('[PaymentLetter] send failed', { userId: input.userId, reference: input.reference });
    return ok ? 'sent' : 'failed';
  } catch (err: any) {
    logger.error('[PaymentLetter] error (payment unaffected)', { reference: input.reference, error: err?.message });
    return 'failed';
  }
}
