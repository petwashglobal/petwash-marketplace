/**
 * PETWASH™ BOOKING CONFIRMATION EMAIL SERVICE
 * Fires immediately at booking creation + payment capture.
 * Sends rich HTML emails to both customer and provider.
 * Complies with Israeli consumer law (right-to-information on transaction).
 */

import { db } from '../db';
import { bookings, users, pets, bookingPets, providers } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { createMailService, isSendGridConfigured } from '../lib/sendgrid';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from '@shared/support-contact';
import type { UnifiedBooking } from './unified-booking/types';
import type { CreditBreakdown } from './unified-booking/types';
import { FinancialDocumentService } from './FinancialDocumentService';
import {
  dispatchNotifications,
  buildBookingConfirmedSms,
} from './PetWashNotificationEngine';
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

const FROM_EMAIL = 'noreply@petwash.co.il';
const FROM_NAME = 'Pet Wash™';
const SITE_URL = 'https://petwash.co.il';
const COMPANY_NAME_HE = 'פט וואש בע"מ';
const COMPANY_TAX_ID = '517145033';

const SERVICE_NAMES: Record<string, { en: string; he: string }> = {
  K9000_WASH: { en: 'Self-Service Dog Wash', he: 'רחצת כלב עצמאית – K9000' },
  PET_ACADEMY: { en: 'Pet Academy Session', he: 'אקדמיה לחיות מחמד' },
  PET_SITTER: { en: 'Pet Sitting', he: 'ישיבת בית לחיות מחמד' },
  PET_WALK: { en: 'Dog Walking', he: 'הליכת כלב' },
  PET_TREK: { en: 'Pet Transport', he: 'הסעת חיית מחמד' },
};

const SOCIAL_BUTTONS = `
  <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td style="padding:0 5px;">
        <a href="https://www.instagram.com/petwashltd" target="_blank" style="display:inline-block;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;text-decoration:none;border-radius:8px;padding:9px 15px;font-size:12px;font-weight:bold;font-family:Arial,sans-serif;">📷 Instagram</a>
      </td>
      <td style="padding:0 5px;">
        <a href="https://www.facebook.com/petwashltd" target="_blank" style="display:inline-block;background:#1877F2;color:#fff;text-decoration:none;border-radius:8px;padding:9px 15px;font-size:12px;font-weight:bold;font-family:Arial,sans-serif;">f Facebook</a>
      </td>
      <td style="padding:0 5px;">
        <a href="https://www.tiktok.com/@petwashltd" target="_blank" style="display:inline-block;background:#010101;color:#fff;text-decoration:none;border-radius:8px;padding:9px 15px;font-size:12px;font-weight:bold;font-family:Arial,sans-serif;border:1px solid #333;">♪ TikTok</a>
      </td>
      <td style="padding:0 5px;">
        <a href="${SUPPORT_WHATSAPP_URL}" target="_blank" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;border-radius:8px;padding:9px 15px;font-size:12px;font-weight:bold;font-family:Arial,sans-serif;">💬 WhatsApp</a>
      </td>
    </tr>
  </table>`;

const PRIVACY_BAR = `
  <p style="margin:10px 0 0;font-size:11px;font-family:Arial,sans-serif;">
    <a href="${SITE_URL}/privacy" style="color:#888;text-decoration:none;margin:0 6px;">Privacy / פרטיות</a>
    <span style="color:#555;">·</span>
    <a href="${SITE_URL}/terms" style="color:#888;text-decoration:none;margin:0 6px;">Terms / תנאי שימוש</a>
    <span style="color:#555;">·</span>
    <a href="mailto:${SUPPORT_EMAIL}" style="color:#888;text-decoration:none;margin:0 6px;">Contact / צור קשר</a>
  </p>`;

function formatDate(d: Date): string {
  return d.toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Jerusalem',
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
  });
}

function fmt(n: number): string {
  return `₪${n.toFixed(2)}`;
}

function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    nayax: 'Nayax (כרטיס אשראי)',
    wallet_credits: 'ארנק PetWash™',
    apple_pay: 'Apple Pay',
    google_pay: 'Google Pay',
    credit_card: 'כרטיס אשראי',
    card: 'כרטיס אשראי',
  };
  if (method.includes('wallet')) return 'ארנק PetWash™ + תשלום';
  return map[method.toLowerCase()] || method;
}

interface ConfirmationParams {
  booking: UnifiedBooking;
  transactionId: string;
  paymentProvider: string;
  paymentReference?: string;
  creditBreakdown?: CreditBreakdown;
}

interface ConfirmationResult {
  customerSent: boolean;
  providerSent: boolean;
}

export class BookingConfirmationEmailService {
  static async send(params: ConfirmationParams): Promise<ConfirmationResult> {
    if (!isSendGridConfigured()) {
      logger.info('[BookingConfirmation] SendGrid not configured – emails skipped', {
        bookingId: params.booking.id,
      });
      return { customerSent: false, providerSent: false };
    }

    let customerSent = false;
    let providerSent = false;

    try {
      // ── Lookup customer ──────────────────────────────────────────────────
      const [customer] = await db
        .select({
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.id, params.booking.userId))
        .limit(1);

      // ── Lookup pets on this booking ──────────────────────────────────────
      const petRows = await db
        .select({ name: pets.name, species: pets.species, breed: pets.breed })
        .from(bookingPets)
        .innerJoin(pets, eq(bookingPets.petId, pets.id))
        .where(eq(bookingPets.bookingId, params.booking.id));

      const petNames = petRows.length > 0
        ? petRows.map(p => `${p.name}${p.breed ? ` (${p.breed})` : ''}`).join(', ')
        : (params.booking.metadata?.petName as string | undefined) || '—';

      // ── Lookup provider name/email ───────────────────────────────────────
      let providerName: string = params.booking.metadata?.providerName as string || 'ממתין לשיבוץ / Pending assignment';
      let providerEmail: string | null = null;
      let providerPhone: string | null = null;
      let providerUserId: string | null = null;

      if (params.booking.resourceType === 'HUMAN' && params.booking.resourceId) {
        const [provRow] = await db
          .select({
            email: users.email,
            phone: users.phone,
            userId: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            businessName: providers.businessName,
          })
          .from(providers)
          .innerJoin(users, eq(providers.userId, users.id))
          .where(eq(providers.userId, params.booking.resourceId))
          .limit(1);

        if (provRow) {
          providerName = provRow.businessName
            || `${provRow.firstName || ''} ${provRow.lastName || ''}`.trim()
            || providerName;
          providerEmail = provRow.email || null;
          providerPhone = provRow.phone || null;
          providerUserId = provRow.userId || null;
        }
      }

      // ── Address / location ───────────────────────────────────────────────
      const address: string = (params.booking.metadata?.address as string | undefined)
        || (params.booking.metadata?.location as string | undefined)
        || (params.booking.metadata?.stationName as string | undefined)
        || 'לפי פרטי ההזמנה';

      // ── Price maths ──────────────────────────────────────────────────────
      const gross = params.booking.priceSnapshot.gross;
      const vatAmount = params.booking.priceSnapshot.vat;
      const netAmount = params.booking.priceSnapshot.net;
      const loyaltyDiscount = params.booking.priceSnapshot.loyaltyDiscount || 0;
      const promoDiscount = params.booking.priceSnapshot.promoDiscount || 0;
      const platformFee = params.booking.priceSnapshot.platformFee || 0;
      const providerPayout = params.booking.priceSnapshot.providerPayout || (gross - platformFee);

      const creditsApplied = params.creditBreakdown
        ? params.creditBreakdown.totalCreditsAppliedCents / 100
        : 0;
      const cashPaid = params.creditBreakdown
        ? params.creditBreakdown.cashPaidCents / 100
        : gross;

      const paymentMethodStr = paymentMethodLabel(
        (creditsApplied > 0 && cashPaid === 0)
          ? 'wallet_credits'
          : (creditsApplied > 0 ? 'wallet+cash' : params.paymentProvider)
      );

      // ── Service label ───────────────────────────────────────────────────
      const serviceKey = params.booking.serviceId?.split('_').slice(0, 2).join('_') || '';
      const serviceInfo = SERVICE_NAMES[serviceKey] || {
        en: params.booking.metadata?.serviceDescription as string || params.booking.serviceId,
        he: params.booking.metadata?.serviceDescriptionHe as string || params.booking.serviceId,
      };

      // ── Customer name ────────────────────────────────────────────────────
      const customerName = customer
        ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || 'לקוח יקר'
        : 'לקוח יקר';
      const customerFirstName = customer?.firstName || 'לקוח יקר';

      const now = new Date();
      const year = now.getFullYear();

      // ════════════════════════════════════════════════════════════════════
      // CUSTOMER EMAIL
      // ════════════════════════════════════════════════════════════════════
      if (customer?.email) {
        const customerHtml = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>הזמנה אושרה – Pet Wash™ #${params.booking.bookingNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f5">
  <tr><td align="center" style="padding:32px 12px;">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">

    <!-- ── HEADER ── -->
    <tr>
      <td style="background:#000;padding:28px 36px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:26px;letter-spacing:3px;font-family:Arial,sans-serif;">⁦Pet Wash™⁩</h1>
        <p style="margin:6px 0 0;color:#aaa;font-size:11px;letter-spacing:1px;">${COMPANY_NAME_HE} | ח.פ ${COMPANY_TAX_ID}</p>
      </td>
    </tr>

    <!-- ── CONFIRMATION BADGE ── -->
    <tr>
      <td style="padding:32px 36px 16px;text-align:center;">
        <div style="display:inline-block;background:#f0fdf4;border:2px solid #22c55e;border-radius:50px;padding:10px 28px;margin-bottom:18px;">
          <span style="color:#16a34a;font-size:15px;font-weight:bold;font-family:Arial,sans-serif;">✓ ההזמנה אושרה / Booking Confirmed</span>
        </div>
        <h2 style="margin:0;font-size:20px;color:#111;font-family:Arial,sans-serif;">שלום ${customerFirstName},</h2>
        <p style="margin:8px 0 0;color:#555;font-size:14px;line-height:1.6;">תודה שבחרת ב-⁦Pet Wash™⁩. הזמנתך התקבלה ואושרה בהצלחה.</p>
      </td>
    </tr>

    <!-- ── BOOKING REFERENCE BOX ── -->
    <tr>
      <td style="padding:8px 36px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:10px;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:16px 20px;text-align:center;border-left:1px solid #e5e7eb;" width="50%">
              <p style="margin:0;font-size:10px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">מספר הזמנה / Booking Ref</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#111;font-family:'Courier New',monospace;">#${params.booking.bookingNumber}</p>
            </td>
            <td style="padding:16px 20px;text-align:center;" width="50%">
              <p style="margin:0;font-size:10px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">תאריך הזמנה / Placed</p>
              <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111;">${formatDate(params.booking.createdAt)}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#666;">${formatTime(params.booking.createdAt)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ── BOOKING SUMMARY ── -->
    <tr>
      <td style="padding:8px 36px 8px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#9ca3af;letter-spacing:1.5px;text-transform:uppercase;">פרטי ההזמנה / Booking Summary</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tr style="background:#f9fafb;">
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;width:40%;border-bottom:1px solid #e5e7eb;">🐾 חיית מחמד / Pet</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb;">${petNames}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">🛁 שירות / Service</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb;">${serviceInfo.he}<br><span style="font-size:11px;color:#999;font-weight:400;">${serviceInfo.en}</span></td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">📅 תאריך שירות / Date</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb;">${formatDate(params.booking.startTime)}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">⏰ שעה / Time</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb;">${formatTime(params.booking.startTime)} – ${formatTime(params.booking.endTime)}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">📍 מיקום / Location</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb;">${address}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;">👤 נותן שירות / Provider</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;">${providerName}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ── PAYMENT SUMMARY ── -->
    <tr>
      <td style="padding:16px 36px 8px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#9ca3af;letter-spacing:1.5px;text-transform:uppercase;">סיכום תשלום / Payment Summary</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#555;border-bottom:1px dashed #e5e7eb;">סכום לפני מע"מ / Subtotal</td>
            <td style="padding:8px 0;font-size:13px;color:#555;text-align:left;border-bottom:1px dashed #e5e7eb;">${fmt(netAmount)}</td>
          </tr>
          ${loyaltyDiscount > 0 ? `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#16a34a;border-bottom:1px dashed #e5e7eb;">🏆 הנחת נאמנות / Loyalty Discount</td>
            <td style="padding:8px 0;font-size:13px;color:#16a34a;text-align:left;border-bottom:1px dashed #e5e7eb;">−${fmt(loyaltyDiscount)}</td>
          </tr>` : ''}
          ${promoDiscount > 0 ? `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#16a34a;border-bottom:1px dashed #e5e7eb;">🎁 קוד פרומו / Promo</td>
            <td style="padding:8px 0;font-size:13px;color:#16a34a;text-align:left;border-bottom:1px dashed #e5e7eb;">−${fmt(promoDiscount)}</td>
          </tr>` : ''}
          ${creditsApplied > 0 ? `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#7c3aed;border-bottom:1px dashed #e5e7eb;">💳 ארנק PetWash™ / Wallet Credits</td>
            <td style="padding:8px 0;font-size:13px;color:#7c3aed;text-align:left;border-bottom:1px dashed #e5e7eb;">−${fmt(creditsApplied)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#555;border-bottom:1px dashed #e5e7eb;">מע"מ 18% / VAT</td>
            <td style="padding:8px 0;font-size:13px;color:#555;text-align:left;border-bottom:1px dashed #e5e7eb;">${fmt(vatAmount)}</td>
          </tr>
          <tr style="border-top:2px solid #111;">
            <td style="padding:12px 0 8px;font-size:16px;font-weight:bold;color:#111;">סה"כ שולם / Total Paid</td>
            <td style="padding:12px 0 8px;font-size:16px;font-weight:bold;color:#111;text-align:left;">${fmt(gross)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#9ca3af;">אמצעי תשלום / Method</td>
            <td style="padding:4px 0;font-size:12px;color:#9ca3af;text-align:left;">${paymentMethodStr}</td>
          </tr>
          ${params.paymentReference ? `
          <tr>
            <td style="padding:4px 0;font-size:11px;color:#c4c4c4;">מזהה עסקה / Transaction</td>
            <td style="padding:4px 0;font-size:11px;color:#c4c4c4;text-align:left;font-family:'Courier New',monospace;">${params.paymentReference}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:4px 0;font-size:11px;color:#c4c4c4;">חותמת עסקה / Stamped at</td>
            <td style="padding:4px 0;font-size:11px;color:#c4c4c4;text-align:left;">${formatDate(new Date())} ${formatTime(new Date())}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ── NEXT STEPS ── -->
    <tr>
      <td style="padding:16px 36px 8px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#9ca3af;letter-spacing:1.5px;text-transform:uppercase;">מה קורה עכשיו? / What's Next?</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border-radius:10px;border:1px solid #fde68a;">
          <tr>
            <td style="padding:16px 20px;font-size:13px;color:#92400e;line-height:1.7;">
              <p style="margin:0;">📬 אישור נוסף ישלח כשנותן השירות יאשר את ההזמנה.</p>
              <p style="margin:6px 0 0;">📱 תוכל/י לנהל את ההזמנה <a href="${SITE_URL}/bookings/${params.booking.id}" style="color:#b45309;font-weight:bold;">בלחיצה כאן</a>.</p>
              <p style="margin:6px 0 0;">❓ שאלות? פנה/י אל <a href="mailto:${SUPPORT_EMAIL}" style="color:#b45309;font-weight:bold;">${SUPPORT_EMAIL}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ── CTA BUTTON ── -->
    <tr>
      <td style="padding:16px 36px 24px;text-align:center;">
        <a href="${SITE_URL}/bookings/${params.booking.id}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;border-radius:50px;padding:14px 36px;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;letter-spacing:0.5px;">נהל הזמנה / Manage Booking</a>
      </td>
    </tr>

    <!-- ── SOCIAL ── -->
    <tr>
      <td style="padding:24px 36px 16px;text-align:center;background:#fafafa;border-top:1px solid #f0f0f0;">
        <p style="margin:0 0 14px;font-size:11px;color:#aaa;letter-spacing:0.5px;">עקבו אחרינו / Follow us</p>
        ${SOCIAL_BUTTONS}
        ${PRIVACY_BAR}
      </td>
    </tr>

    <!-- ── FOOTER ── -->
    <tr>
      <td style="background:#000;padding:20px 36px;text-align:center;">
        <p style="margin:0;color:#fff;font-size:12px;font-family:Arial,sans-serif;">⁦Pet Wash™⁩ | ${COMPANY_NAME_HE}</p>
        <p style="margin:5px 0 0;color:#666;font-size:11px;font-family:Arial,sans-serif;">
          <a href="${SITE_URL}" style="color:#888;text-decoration:none;">${SITE_URL.replace('https://', '')}</a>
          &nbsp;·&nbsp;
          <a href="mailto:${SUPPORT_EMAIL}" style="color:#888;text-decoration:none;">${SUPPORT_EMAIL}</a>
        </p>
        <p style="margin:5px 0 0;color:#444;font-size:10px;">© ${year} ${COMPANY_NAME_HE}. All rights reserved.</p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;

        const mailService = createMailService();
        await mailService.send({
          to: customer.email,
          from: { email: FROM_EMAIL, name: FROM_NAME },
          subject: `הזמנה אושרה ✓ – ⁦Pet Wash™⁩ #${params.booking.bookingNumber}`,
          html: customerHtml,
        });

        customerSent = true;
        logger.info('[BookingConfirmation] Customer email sent', {
          bookingId: params.booking.id,
          bookingNumber: params.booking.bookingNumber,
          to: customer.email,
        });

        // ── Financial document (booking_receipt) ─────────────────────────────
        const customerDocRef = await FinancialDocumentService.create({
          userId: params.booking.userId,
          bookingId: params.booking.id,
          transactionId: params.transactionId,
          documentType: 'booking_receipt',
          issuedByEntity: 'PetWash',
          documentPayloadJson: {
            bookingNumber: params.booking.bookingNumber,
            serviceId: params.booking.serviceId,
            gross,
            vatAmount,
            netAmount,
            loyaltyDiscount,
            promoDiscount,
            creditsApplied,
            cashPaid,
            paymentMethod: paymentMethodStr,
            transactionId: params.transactionId,
          },
          renderedHtml: customerHtml,
        });

        // ── SMS + push for customer (fire-and-forget) ─────────────────────────
        const smsDateStr = params.booking.startTime
          ? `${formatDate(params.booking.startTime)} ${formatTime(params.booking.startTime)}`
          : '—';
        dispatchNotifications({
          userId: params.booking.userId,
          eventType: 'booking_confirmed',
          templateKey: 'customer_booking_confirmed',
          bookingId: params.booking.id,
          transactionId: params.transactionId,
          channels: ['sms', 'push'],
          sms: customer.phone ? {
            to: customer.phone,
            text: buildBookingConfirmedSms({
              bookingRef: params.booking.bookingNumber || params.booking.id,
              serviceName: serviceInfo.he,
              dateStr: smsDateStr,
              totalAmount: gross.toFixed(2),
            }),
          } : undefined,
          push: {
            userId: params.booking.userId,
            title: `הזמנה אושרה – Pet Wash™ 🐾`,
            body: `הזמנה #${params.booking.bookingNumber} אושרה. ${serviceInfo.he} – ${smsDateStr}`,
            data: {
              bookingId: params.booking.id,
              bookingNumber: params.booking.bookingNumber || '',
              documentRef: customerDocRef,
              type: 'booking_confirmed',
            },
          },
          debugPayload: {
            bookingId: params.booking.id,
            documentRef: customerDocRef,
          },
        }).catch((e) => logger.error('[BookingConfirmation] Customer notifications failed silently', { error: e?.message }));
      }

      // ════════════════════════════════════════════════════════════════════
      // PROVIDER EMAIL
      // ════════════════════════════════════════════════════════════════════
      if (providerEmail && params.booking.resourceType === 'HUMAN') {
        const providerFirstName = providerName.split(' ')[0] || 'ספק';

        const settlementNote = gross > 0
          ? `${fmt(platformFee)} (${((platformFee / gross) * 100).toFixed(0)}%)`
          : '—';

        const providerHtml = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>הזמנה חדשה – Pet Wash™ #${params.booking.bookingNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f5">
  <tr><td align="center" style="padding:32px 12px;">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">

    <!-- ── HEADER ── -->
    <tr>
      <td style="background:#000;padding:28px 36px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:26px;letter-spacing:3px;font-family:Arial,sans-serif;">⁦Pet Wash™⁩</h1>
        <p style="margin:6px 0 0;color:#aaa;font-size:11px;letter-spacing:1px;">Provider Notification / הודעה לספק</p>
      </td>
    </tr>

    <!-- ── BADGE ── -->
    <tr>
      <td style="padding:32px 36px 16px;text-align:center;">
        <div style="display:inline-block;background:#eff6ff;border:2px solid #3b82f6;border-radius:50px;padding:10px 28px;margin-bottom:18px;">
          <span style="color:#1d4ed8;font-size:15px;font-weight:bold;font-family:Arial,sans-serif;">📋 הזמנה חדשה / New Booking Assigned</span>
        </div>
        <h2 style="margin:0;font-size:20px;color:#111;font-family:Arial,sans-serif;">שלום ${providerFirstName},</h2>
        <p style="margin:8px 0 0;color:#555;font-size:14px;line-height:1.6;">הזמנה חדשה שובצה אליך. אנא אשר/י בהקדם.</p>
      </td>
    </tr>

    <!-- ── BOOKING REF ── -->
    <tr>
      <td style="padding:8px 36px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:10px;border:1px solid #e5e7eb;text-align:center;">
          <tr>
            <td style="padding:16px 20px;border-left:1px solid #e5e7eb;" width="50%">
              <p style="margin:0;font-size:10px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">מספר הזמנה</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#111;font-family:'Courier New',monospace;">#${params.booking.bookingNumber}</p>
            </td>
            <td style="padding:16px 20px;" width="50%">
              <p style="margin:0;font-size:10px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">נוצר</p>
              <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#111;">${formatDate(params.booking.createdAt)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ── JOB DETAILS ── -->
    <tr>
      <td style="padding:8px 36px 8px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#9ca3af;letter-spacing:1.5px;text-transform:uppercase;">פרטי העבודה / Job Details</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tr style="background:#f9fafb;">
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;width:40%;border-bottom:1px solid #e5e7eb;">👤 שם לקוח / Customer</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb;">${customerName}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">🐾 חיית מחמד / Pet</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb;">${petNames}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">🛁 שירות / Service</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb;">${serviceInfo.he}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">📅 תאריך / Date</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb;">${formatDate(params.booking.startTime)}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">⏰ שעה / Time</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb;">${formatTime(params.booking.startTime)} – ${formatTime(params.booking.endTime)}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:12px;color:#6b7280;">📍 מיקום / Location</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111;">${address}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ── PAYOUT SUMMARY ── -->
    <tr>
      <td style="padding:16px 36px 8px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#9ca3af;letter-spacing:1.5px;text-transform:uppercase;">סיכום תשלום / Payout Summary</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#555;border-bottom:1px dashed #e5e7eb;">ברוטו הזמנה / Gross Booking Amount</td>
            <td style="padding:8px 0;font-size:13px;color:#555;text-align:left;border-bottom:1px dashed #e5e7eb;">${fmt(gross)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#ef4444;border-bottom:1px dashed #e5e7eb;">עמלת פלטפורמה / Platform Fee</td>
            <td style="padding:8px 0;font-size:13px;color:#ef4444;text-align:left;border-bottom:1px dashed #e5e7eb;">−${settlementNote}</td>
          </tr>
          <tr style="border-top:2px solid #111;">
            <td style="padding:12px 0 8px;font-size:16px;font-weight:bold;color:#16a34a;">הכנסה נטו / Net Earnings</td>
            <td style="padding:12px 0 8px;font-size:16px;font-weight:bold;color:#16a34a;text-align:left;">${fmt(providerPayout)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#9ca3af;">מועד סילוק / Settlement</td>
            <td style="padding:4px 0;font-size:12px;color:#9ca3af;text-align:left;">לאחר השלמת השירות / After service completion</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ── CTA ── -->
    <tr>
      <td style="padding:16px 36px 24px;text-align:center;">
        <a href="${SITE_URL}/provider/bookings/${params.booking.id}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;border-radius:50px;padding:14px 36px;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;margin-bottom:10px;">אשר הזמנה / Confirm Booking</a>
        <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">שאלות? <a href="mailto:${SUPPORT_EMAIL}" style="color:#555;">${SUPPORT_EMAIL}</a></p>
      </td>
    </tr>

    <!-- ── SOCIAL ── -->
    <tr>
      <td style="padding:24px 36px 16px;text-align:center;background:#fafafa;border-top:1px solid #f0f0f0;">
        <p style="margin:0 0 14px;font-size:11px;color:#aaa;letter-spacing:0.5px;">עקבו אחרינו / Follow us</p>
        ${SOCIAL_BUTTONS}
        ${PRIVACY_BAR}
      </td>
    </tr>

    <!-- ── FOOTER ── -->
    <tr>
      <td style="background:#000;padding:20px 36px;text-align:center;">
        <p style="margin:0;color:#fff;font-size:12px;font-family:Arial,sans-serif;">⁦Pet Wash™⁩ | ${COMPANY_NAME_HE}</p>
        <p style="margin:5px 0 0;color:#666;font-size:11px;font-family:Arial,sans-serif;">
          <a href="${SITE_URL}" style="color:#888;text-decoration:none;">${SITE_URL.replace('https://', '')}</a>
          &nbsp;·&nbsp;
          <a href="mailto:${SUPPORT_EMAIL}" style="color:#888;text-decoration:none;">${SUPPORT_EMAIL}</a>
        </p>
        <p style="margin:5px 0 0;color:#444;font-size:10px;">© ${year} ${COMPANY_NAME_HE}. All rights reserved.</p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;

        const mailService = createMailService();
        await mailService.send({
          to: providerEmail,
          from: { email: FROM_EMAIL, name: FROM_NAME },
          subject: `הזמנה חדשה שובצה 📋 – ⁦Pet Wash™⁩ #${params.booking.bookingNumber}`,
          html: providerHtml,
        });

        providerSent = true;
        logger.info('[BookingConfirmation] Provider email sent', {
          bookingId: params.booking.id,
          bookingNumber: params.booking.bookingNumber,
          to: providerEmail,
        });

        // ── Financial document (booking_earnings_notice) ──────────────────────
        if (providerUserId) {
          const providerDocRef = await FinancialDocumentService.create({
            userId: providerUserId,
            bookingId: params.booking.id,
            transactionId: params.transactionId,
            documentType: 'booking_earnings_notice',
            issuedByEntity: 'PetWash',
            documentPayloadJson: {
              bookingNumber: params.booking.bookingNumber,
              serviceId: params.booking.serviceId,
              gross,
              platformFee,
              providerPayout,
              vatAmount,
              transactionId: params.transactionId,
            },
            renderedHtml: providerHtml,
          });

          // ── SMS + push for provider (fire-and-forget) ─────────────────────
          const provSmsDateStr = params.booking.startTime
            ? `${formatDate(params.booking.startTime)} ${formatTime(params.booking.startTime)}`
            : '—';
          dispatchNotifications({
            userId: providerUserId,
            eventType: 'booking_confirmed',
            templateKey: 'provider_booking_assigned',
            bookingId: params.booking.id,
            transactionId: params.transactionId,
            channels: ['sms', 'push'],
            sms: providerPhone ? {
              to: providerPhone,
              text: (
                `PetWash™ - הזמנה חדשה 📋\n` +
                `מס' הזמנה: ${params.booking.bookingNumber}\n` +
                `שירות: ${serviceInfo.he}\n` +
                `תאריך: ${provSmsDateStr}\n` +
                `תשלום נטו: ₪${providerPayout.toFixed(2)}\n` +
                `https://petwash.co.il/provider/bookings`
              ),
            } : undefined,
            push: {
              userId: providerUserId,
              title: `הזמנה חדשה – Pet Wash™ 📋`,
              body: `הזמנה #${params.booking.bookingNumber} שובצה אליך. ${serviceInfo.he} – ${provSmsDateStr}`,
              data: {
                bookingId: params.booking.id,
                bookingNumber: params.booking.bookingNumber || '',
                documentRef: providerDocRef,
                type: 'provider_booking_assigned',
              },
            },
            debugPayload: {
              bookingId: params.booking.id,
              documentRef: providerDocRef,
            },
          }).catch((e) => logger.error('[BookingConfirmation] Provider notifications failed silently', { error: e?.message }));
        }
      }

    } catch (err: any) {
      logger.error('[BookingConfirmation] Email dispatch failed', {
        bookingId: params.booking.id,
        error: err.message,
      });
    }

    return { customerSent, providerSent };
  }
}
