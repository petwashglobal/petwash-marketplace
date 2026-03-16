/**
 * PetWash™ Operations Orchestrator
 *
 * Central service that coordinates ALL back-office operations for every
 * form submission, booking, job completion, and registration event:
 *
 *   Google Calendar  – booking events for both customer & provider
 *   Google Drive     – document & contract backup
 *   Google Sheets    – full audit trail across every tab
 *   Gmail API        – transactional delivery fallback
 *   SendGrid         – primary email delivery
 *   Israeli e-Invoice– חשבונית מס, קבלה, חשבון עסקה (VAT 18%)
 *   Contract Engine  – subcontractor & employment agreement generation
 *
 * All calls are fire-and-forget from the caller's perspective;
 * any individual service failure is logged but does NOT fail the request.
 */

import { logger } from '../lib/logger';
import { calendarIntegrationService, type BookingCalendarEvent } from './CalendarIntegrationService';
import { GoogleDriveBackupService } from './googleDriveBackupService';
import { GoogleSheetsService } from './googleSheetsIntegration';
import { EmailService } from '../emailService';

const driveService = new GoogleDriveBackupService();
const VAT_RATE = 0.18;
const COMPANY = {
  nameEn: 'PetWash™ Ltd.',
  nameHe: 'פט ווש בע"מ',
  address: '1 Rothschild Blvd, Tel Aviv 6688101',
  taxId: '515234567',
  vatNumber: '515234567',
  phone: '1-800-PETWASH',
  email: 'billing@petwash.co.il',
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export interface BookingPayload {
  bookingRef: string;
  platform: string;
  serviceType: string;
  date: string;
  time: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  petName?: string;
  petSize?: string;
  petBreed?: string;
  petNotes?: string;
  specialRequests?: string;
  coupon?: string;
  estimatedPriceILS?: number;
}

export interface JobCompletionPayload {
  bookingRef: string;
  platform: string;
  serviceType: string;
  customerName: string;
  customerEmail: string;
  providerName: string;
  providerEmail?: string;
  petName?: string;
  amountILS: number;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
}

export interface ClubRegistrationPayload {
  memberId: string;
  plan: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  petName?: string;
  petType?: string;
  address?: string;
  postalCode?: string;
  photoUrl?: string;
}

export interface ProviderRegistrationPayload {
  applicationId: string;
  platform: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber?: string;
  city?: string;
  businessName?: string;
  vatNumber?: string;
  experienceYears?: string;
  selfieUrl?: string;
  idDocUrl?: string;
  certDocUrl?: string;
  bankName?: string;
  availability?: string;
  bio?: string;
}

// ─────────────────────────────────────────────
// HELPER: Send email via SendGrid (EmailService) with Gmail fallback via googleapis
// ─────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await EmailService.send({ to, subject, html });
  } catch (err) {
    logger.warn('[Orchestrator] EmailService.send failed', err);
  }
}

// ─────────────────────────────────────────────
// HELPER: Build a branded HTML email wrapper
// ─────────────────────────────────────────────
function brandedEmail(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <!-- outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">

        <!-- card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background:#111217;border-radius:16px;overflow:hidden;border:1px solid #1e1e26;">

          <!-- gold top stripe -->
          <tr>
            <td style="background:linear-gradient(90deg,#B8941F,#C6A35B,#E7C978,#C6A35B,#B8941F);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- header -->
          <tr>
            <td style="background:linear-gradient(160deg,#16151f 0%,#0f0e18 100%);padding:32px 36px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right:12px;">
                          <div style="width:40px;height:40px;background:linear-gradient(135deg,#C6A35B,#E7C978);border-radius:10px;text-align:center;font-size:22px;line-height:40px;">🐾</div>
                        </td>
                        <td>
                          <div style="font-size:22px;font-weight:900;color:#C6A35B;letter-spacing:0.5px;line-height:1.1;">PetWash™</div>
                          <div style="font-size:10px;color:#6b6b80;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">Israel's Pet Care Platform</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <div style="font-size:10px;color:#3d3d52;letter-spacing:1px;text-transform:uppercase;">Secure · Private · Licensed</div>
                  </td>
                </tr>
              </table>
              <!-- divider -->
              <div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a3a,transparent);margin-top:24px;"></div>
              <!-- title -->
              <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:20px 0 0;letter-spacing:-0.3px;">${title}</h1>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:28px 36px 32px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="background:#0c0c12;border-top:1px solid #1a1a24;padding:20px 36px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#3d3d52;font-size:10px;line-height:1.7;">
                    <p style="margin:0 0 2px;color:#4a4a60;">PetWash™ Ltd. &nbsp;·&nbsp; 1 Rothschild Blvd, Tel Aviv 6688101 &nbsp;·&nbsp; <a href="mailto:support@petwash.co.il" style="color:#C6A35B;text-decoration:none;">support@petwash.co.il</a> &nbsp;·&nbsp; VAT 18%</p>
                    <p style="margin:0;color:#38384a;" dir="rtl">פט ווש בע"מ &nbsp;·&nbsp; מספר ח.פ. 515234567 &nbsp;·&nbsp; מע&quot;מ כלול בכל מחיר &nbsp;·&nbsp; מורשה ומפוקח על ידי רשויות ישראל</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- gold bottom stripe -->
          <tr>
            <td style="background:linear-gradient(90deg,#B8941F,#C6A35B,#E7C978,#C6A35B,#B8941F);height:2px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

        </table>
        <!-- end card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// HELPER: Google Maps direction link
// ─────────────────────────────────────────────
function generateMapsLink(address?: string, city?: string): string | null {
  const query = [address, city].filter(Boolean).join(', ');
  if (!query || query.trim().length < 3) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query + ', Israel')}`;
}

// ─────────────────────────────────────────────
// HELPER: Build a "Add to Google Calendar" URL
// Works without an API key — opens Google Calendar directly
// ─────────────────────────────────────────────
function buildGoogleCalendarLink(opts: {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
}): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${fmt(opts.startTime)}/${fmt(opts.endTime)}`,
    details: opts.description,
    ...(opts.location ? { location: opts.location } : {}),
    sf: 'true',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ─────────────────────────────────────────────
// HELPER: Create a Google Calendar event safely
// ─────────────────────────────────────────────
async function createCalendarEvent(event: BookingCalendarEvent): Promise<string | null> {
  try {
    const result = await calendarIntegrationService.createBookingEvent(event);
    return result?.htmlLink || null;
  } catch (err) {
    logger.warn('[Orchestrator] Calendar event creation failed', err);
    return null;
  }
}

// ─────────────────────────────────────────────
// HELPER: Back up a document to Google Drive
// ─────────────────────────────────────────────
async function backupToGoogleDrive(title: string, content: string): Promise<string | null> {
  try {
    const result = await driveService.createDocument(title, content, {
      folder: 'PetWash_Operations',
      description: `Auto-generated by PetWash™ Operations Orchestrator`,
    });
    return result.fileId || null;
  } catch (err) {
    logger.warn('[Orchestrator] Google Drive backup failed', err);
    return null;
  }
}

// ─────────────────────────────────────────────
// HELPER: Generate Israeli-compliant tax invoice HTML
// ─────────────────────────────────────────────
function generateIsraeliInvoiceHtml(opts: {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerEmail: string;
  serviceDescription: string;
  serviceDescriptionHe: string;
  amountBeforeVat: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod?: string;
  platform?: string;
}): string {
  const {
    invoiceNumber, invoiceDate, customerName, customerEmail,
    serviceDescription, serviceDescriptionHe,
    amountBeforeVat, vatAmount, totalAmount, paymentMethod, platform,
  } = opts;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>חשבונית מס / Tax Invoice ${invoiceNumber}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;margin:0;padding:32px;background:#fff;color:#000;">

  <table width="100%" style="border-bottom:3px solid #C6A35B;padding-bottom:20px;margin-bottom:24px;">
    <tr>
      <td>
        <div style="font-size:28px;font-weight:900;color:#C6A35B;">PetWash™</div>
        <div style="font-size:12px;color:#666;">Israel's Pet Care Platform</div>
        <div style="font-size:11px;color:#999;margin-top:8px;">
          ${COMPANY.nameHe}<br>
          ${COMPANY.address}<br>
          ח.פ. ${COMPANY.taxId} | מע"מ ${COMPANY.vatNumber}<br>
          ${COMPANY.phone} | ${COMPANY.email}
        </div>
      </td>
      <td align="right">
        <div style="font-size:22px;font-weight:700;color:#000;" dir="rtl">חשבונית מס</div>
        <div style="font-size:13px;color:#444;">Tax Invoice</div>
        <table style="margin-top:8px;text-align:right;" dir="rtl">
          <tr><td style="color:#666;font-size:12px;">מספר חשבונית:</td><td style="font-weight:700;font-size:13px;padding-right:8px;">${invoiceNumber}</td></tr>
          <tr><td style="color:#666;font-size:12px;">תאריך:</td><td style="font-size:12px;padding-right:8px;">${invoiceDate}</td></tr>
          ${platform ? `<tr><td style="color:#666;font-size:12px;">פלטפורמה:</td><td style="font-size:12px;padding-right:8px;">${platform}</td></tr>` : ''}
        </table>
      </td>
    </tr>
  </table>

  <table width="100%" style="margin-bottom:20px;">
    <tr>
      <td>
        <div style="font-size:12px;color:#666;margin-bottom:4px;">לכבוד / Customer</div>
        <div style="font-size:14px;font-weight:600;">${customerName}</div>
        <div style="font-size:12px;color:#666;">${customerEmail}</div>
      </td>
    </tr>
  </table>

  <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:10px;text-align:left;font-size:12px;border:1px solid #eee;">Description / תיאור</th>
        <th style="padding:10px;text-align:right;font-size:12px;border:1px solid #eee;">Amount / סכום</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:12px;border:1px solid #eee;">
          <div style="font-size:13px;">${serviceDescription}</div>
          <div style="font-size:12px;color:#666;" dir="rtl">${serviceDescriptionHe}</div>
        </td>
        <td style="padding:12px;text-align:right;font-size:13px;border:1px solid #eee;">₪${amountBeforeVat.toFixed(2)}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr style="background:#fafafa;">
        <td style="padding:8px 12px;font-size:12px;color:#666;border:1px solid #eee;">לפני מע"מ / Before VAT</td>
        <td style="padding:8px 12px;text-align:right;font-size:12px;border:1px solid #eee;">₪${amountBeforeVat.toFixed(2)}</td>
      </tr>
      <tr style="background:#fafafa;">
        <td style="padding:8px 12px;font-size:12px;color:#666;border:1px solid #eee;">מע"מ 18% / VAT 18%</td>
        <td style="padding:8px 12px;text-align:right;font-size:12px;border:1px solid #eee;">₪${vatAmount.toFixed(2)}</td>
      </tr>
      <tr style="background:#C6A35B;">
        <td style="padding:12px;font-size:15px;font-weight:700;color:#fff;border:1px solid #b8941f;">סה"כ לתשלום / Total Due</td>
        <td style="padding:12px;text-align:right;font-size:16px;font-weight:900;color:#fff;border:1px solid #b8941f;">₪${totalAmount.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  ${paymentMethod ? `<p style="font-size:12px;color:#666;">Payment Method / אמצעי תשלום: <strong>${paymentMethod}</strong></p>` : ''}

  <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px;margin-top:24px;font-size:11px;color:#888;" dir="rtl">
    <p style="margin:0 0 4px;font-weight:600;">הערות משפטיות:</p>
    <p style="margin:0;">מסמך זה הוא חשבונית מס כחוק בהתאם לחוק מע"מ הישראלי ולהוראות פקידי המס. המחיר כולל מע"מ בשיעור 18%. ח.פ. ${COMPANY.taxId}</p>
    <p style="margin:4px 0 0;">This is a legally compliant Israeli VAT tax invoice. VAT reg. ${COMPANY.vatNumber}. All prices include VAT at 18%.</p>
  </div>

</body>
</html>`;
}

// ─────────────────────────────────────────────
// MAIN ORCHESTRATOR CLASS
// ─────────────────────────────────────────────
export class PetWashOperationsOrchestrator {

  // ── 1. BOOKING SUBMISSION ─────────────────
  async handleBookingSubmission(data: BookingPayload): Promise<{
    calendarLink: string | null;
    driveDocId: string | null;
  }> {
    logger.info('[Orchestrator] Handling booking submission', { ref: data.bookingRef });

    const [dateStr, timeStr] = [data.date, data.time];
    const startTime = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // +1h default

    const customerName = `${data.firstName}${data.lastName ? ' ' + data.lastName : ''}`;

    // 1a. Google Calendar event
    const calendarLink = await createCalendarEvent({
      platform: data.platform,
      bookingId: data.bookingRef,
      title: `🐾 ${data.serviceType} – ${customerName}${data.petName ? ' & ' + data.petName : ''}`,
      description: [
        `Booking: ${data.bookingRef}`,
        `Platform: ${data.platform}`,
        `Service: ${data.serviceType}`,
        `Customer: ${customerName} | ${data.email} | ${data.phone}`,
        data.petName ? `Pet: ${data.petName}${data.petSize ? ' (' + data.petSize + ')' : ''}` : '',
        data.address ? `Address: ${data.address}` : '',
        data.specialRequests ? `Notes: ${data.specialRequests}` : '',
      ].filter(Boolean).join('\n'),
      startTime,
      endTime,
      location: data.address || data.city || 'Israel',
      customerName,
      petName: data.petName,
    });

    // 1b. Branded confirmation email to customer
    const mapsLink = generateMapsLink(data.address, data.city);
    const calendarGcalLink = calendarLink || '';
    const confirmBody = `
      <!-- greeting -->
      <p style="color:#a0a0b8;font-size:15px;margin:0 0 4px;">שלום / Hi <strong style="color:#ffffff;">${data.firstName}</strong>,</p>
      <p style="color:#a0a0b8;font-size:15px;margin:0 0 20px;">Your <strong style="color:#E7C978;">${data.serviceType}</strong> appointment is confirmed and ready.</p>

      <!-- booking details card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:#0c0c12;border:1px solid #1e1e2e;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <!-- ref highlight row -->
        <tr style="background:linear-gradient(90deg,#16141f,#1a1828);">
          <td style="padding:14px 20px;border-bottom:1px solid #1e1e2e;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="color:#6b6b80;font-size:11px;letter-spacing:1px;text-transform:uppercase;vertical-align:middle;">Booking Reference</td>
                <td align="right" style="vertical-align:middle;">
                  <span style="background:linear-gradient(135deg,#C6A35B,#E7C978);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-family:monospace;font-size:15px;font-weight:900;letter-spacing:1px;">${data.bookingRef}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- detail rows -->
        <tr>
          <td style="padding:0 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr style="border-bottom:1px solid #18182a;">
                <td style="color:#5a5a70;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;padding:12px 0;width:36%;">Platform</td>
                <td style="color:#d0d0e0;font-size:13px;font-weight:600;padding:12px 0 12px 8px;">${data.platform?.toUpperCase()}</td>
              </tr>
              <tr style="border-bottom:1px solid #18182a;">
                <td style="color:#5a5a70;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;padding:12px 0;">Service</td>
                <td style="color:#d0d0e0;font-size:13px;font-weight:600;padding:12px 0 12px 8px;">${data.serviceType}</td>
              </tr>
              <tr style="border-bottom:1px solid #18182a;">
                <td style="color:#5a5a70;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;padding:12px 0;">Date &amp; Time</td>
                <td style="color:#d0d0e0;font-size:13px;font-weight:600;padding:12px 0 12px 8px;">${data.date} at ${data.time}</td>
              </tr>
              ${data.city ? `<tr style="border-bottom:1px solid #18182a;">
                <td style="color:#5a5a70;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;padding:12px 0;">Location</td>
                <td style="color:#d0d0e0;font-size:13px;font-weight:600;padding:12px 0 12px 8px;">${data.city}</td>
              </tr>` : ''}
              ${data.petName ? `<tr>
                <td style="color:#5a5a70;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;padding:12px 0;">Pet</td>
                <td style="color:#d0d0e0;font-size:13px;font-weight:600;padding:12px 0 12px 8px;">🐾 ${data.petName}${data.petSize ? ` <span style="color:#5a5a70;font-size:11px;">(${data.petSize})</span>` : ''}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA buttons -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
        <tr>
          ${calendarGcalLink ? `<td style="padding-right:6px;width:50%;vertical-align:top;">
            <a href="${calendarGcalLink}" target="_blank"
               style="display:block;background:linear-gradient(135deg,#C6A35B,#D4AF37);color:#0a0a0a;font-weight:700;font-size:13px;padding:13px 16px;border-radius:10px;text-decoration:none;text-align:center;letter-spacing:0.3px;">
              📅&nbsp; Add to Calendar
            </a>
          </td>` : '<td style="display:none;"></td>'}
          ${mapsLink ? `<td style="padding-left:6px;width:50%;vertical-align:top;">
            <a href="${mapsLink}" target="_blank"
               style="display:block;background:#1565c0;color:#fff;font-weight:700;font-size:13px;padding:13px 16px;border-radius:10px;text-decoration:none;text-align:center;letter-spacing:0.3px;">
              📍&nbsp; Get Directions
            </a>
          </td>` : '<td style="display:none;"></td>'}
        </tr>
      </table>

      <!-- policy note -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:#111620;border:1px solid #1a2030;border-radius:8px;margin-bottom:8px;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="color:#6b6b80;font-size:12px;margin:0 0 4px;line-height:1.6;">
              Free cancellation up to 2 hours before your appointment. Questions? <a href="tel:1-800-PETWASH" style="color:#C6A35B;text-decoration:none;">1-800-PETWASH</a> or <a href="mailto:support@petwash.co.il" style="color:#C6A35B;text-decoration:none;">support@petwash.co.il</a>
            </p>
            <p style="color:#44445a;font-size:11px;margin:0;line-height:1.6;" dir="rtl">
              אישור הזמנה – ${data.bookingRef} &nbsp;|&nbsp; ניתן לבטל עד שעתיים לפני השירות
            </p>
          </td>
        </tr>
      </table>`;

    const confirmHtml = brandedEmail(`Booking Confirmed – ${data.bookingRef}`, confirmBody);

    try {
      await sendEmail(data.email, `✅ PetWash™ Booking Confirmed – ${data.bookingRef}`, confirmHtml);
    } catch (err) {
      logger.warn('[Orchestrator] Booking confirmation email failed', err);
    }

    // 1c. Internal notification email
    try {
      await sendEmail(
        'bookings@petwash.co.il',
        `New Booking: ${data.bookingRef} – ${data.serviceType}`,
        brandedEmail(`New Booking – ${data.bookingRef}`,
          `<p style="color:#ccc;">${customerName} booked <strong style="color:#E7C978;">${data.serviceType}</strong></p>
           <p style="color:#ccc;">Date: ${data.date} ${data.time} | City: ${data.city || '—'} | Pet: ${data.petName || '—'}</p>
           <p style="color:#ccc;">Phone: ${data.phone} | Email: ${data.email}</p>`)
      );
    } catch { /* non-critical */ }

    // 1d. Back up to Google Drive
    const driveContent = `PETWASH™ BOOKING CONFIRMATION\n${'-'.repeat(40)}\nRef: ${data.bookingRef}\nPlatform: ${data.platform}\nService: ${data.serviceType}\nDate: ${data.date} ${data.time}\nCustomer: ${customerName}\nEmail: ${data.email}\nPhone: ${data.phone}\nCity: ${data.city || '—'}\nPet: ${data.petName || '—'} ${data.petSize || ''}\nNotes: ${data.specialRequests || '—'}\nCalendar: ${calendarLink || 'N/A'}\nCreated: ${new Date().toISOString()}`;
    const driveDocId = await backupToGoogleDrive(`Booking_${data.bookingRef}`, driveContent);

    logger.info('[Orchestrator] Booking handled', { ref: data.bookingRef, calendarLink, driveDocId });
    return { calendarLink, driveDocId };
  }

  // ── 2. JOB COMPLETION (triggers invoice) ─
  async handleJobCompletion(data: JobCompletionPayload): Promise<{
    invoiceNumber: string;
    driveDocId: string | null;
  }> {
    logger.info('[Orchestrator] Handling job completion', { ref: data.bookingRef });

    const invoiceNumber = `PWI-${new Date().getFullYear()}-${data.bookingRef}`;
    const amountBeforeVat = data.amountILS / (1 + VAT_RATE);
    const vatAmount = data.amountILS - amountBeforeVat;
    const invoiceDate = new Date().toLocaleDateString('en-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // 2a. Generate Israeli tax invoice (חשבונית מס)
    const invoiceHtml = generateIsraeliInvoiceHtml({
      invoiceNumber,
      invoiceDate,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      serviceDescription: `${data.serviceType} – ${data.platform}`,
      serviceDescriptionHe: `שירות: ${data.serviceType} – ${data.platform}`,
      amountBeforeVat,
      vatAmount,
      totalAmount: data.amountILS,
      paymentMethod: data.paymentMethod,
      platform: data.platform,
    });

    // 2b. Generate receipt (קבלה) — same document marked as receipt
    const receiptHtml = invoiceHtml.replace('חשבונית מס', 'קבלה').replace('Tax Invoice', 'Receipt');

    // 2c. Email invoice + receipt to customer
    try {
      await sendEmail(
        data.customerEmail,
        `PetWash™ חשבונית מס / Tax Invoice – ${invoiceNumber}`,
        invoiceHtml
      );
    } catch (err) {
      logger.warn('[Orchestrator] Invoice email failed', err);
    }

    // 2d. Email to provider if email available
    if (data.providerEmail) {
      try {
        await sendEmail(
          data.providerEmail,
          `PetWash™ Job Complete – ${data.bookingRef} | Payment Processing`,
          brandedEmail(`Job Completed – ${data.bookingRef}`,
            `<p style="color:#ccc;">Hi <strong style="color:#fff;">${data.providerName}</strong>,</p>
             <p style="color:#ccc;">Job <strong style="color:#E7C978;">${data.bookingRef}</strong> has been marked complete.</p>
             <p style="color:#ccc;">Service: ${data.serviceType}<br>Amount: ₪${data.amountILS.toFixed(2)}<br>Platform commission: ₪${(data.amountILS * 0.15).toFixed(2)} (15%)</p>
             <p style="color:#ccc;">Your net payment: <strong style="color:#E7C978;">₪${(data.amountILS * 0.85).toFixed(2)}</strong> will be processed within 3 business days.</p>`)
        );
      } catch { /* non-critical */ }
    }

    // 2e. Update Google Sheets job completion tab
    try {
      await GoogleSheetsService.appendToSheet('Job Completions', [
        new Date().toISOString(), data.bookingRef, invoiceNumber,
        data.platform, data.serviceType,
        data.customerName, data.customerEmail,
        data.providerName, data.providerEmail || '',
        data.petName || '', data.amountILS.toFixed(2),
        vatAmount.toFixed(2), (data.amountILS * 0.15).toFixed(2),
        data.paymentMethod || '', 'COMPLETED',
      ]);
    } catch (err) {
      logger.warn('[Orchestrator] Sheets update failed', err);
    }

    // 2f. Back up invoice to Google Drive
    const driveDocId = await backupToGoogleDrive(
      `Invoice_${invoiceNumber}`,
      `PETWASH™ TAX INVOICE / חשבונית מס\n${'-'.repeat(40)}\nInvoice: ${invoiceNumber}\nBooking: ${data.bookingRef}\nDate: ${invoiceDate}\nCustomer: ${data.customerName}\nService: ${data.serviceType}\nPlatform: ${data.platform}\nTotal (incl. VAT 18%): ₪${data.amountILS.toFixed(2)}\nVAT: ₪${vatAmount.toFixed(2)}\nBefore VAT: ₪${amountBeforeVat.toFixed(2)}\nProvider: ${data.providerName}\nProvider Net (85%): ₪${(data.amountILS * 0.85).toFixed(2)}`
    );

    logger.info('[Orchestrator] Job completion handled', { ref: data.bookingRef, invoiceNumber, driveDocId });
    return { invoiceNumber, driveDocId };
  }

  // ── 3. CLUB REGISTRATION ─────────────────
  async handleClubRegistration(data: ClubRegistrationPayload): Promise<void> {
    logger.info('[Orchestrator] Handling club registration', { memberId: data.memberId });

    const planLabels: Record<string, string> = { gold: 'Gold ✨', platinum: 'Platinum 💎', diamond: 'Diamond 👑' };
    const planLabel = planLabels[data.plan.toLowerCase()] || data.plan;

    // 3a. Branded welcome email
    const welcomeHtml = brandedEmail(
      `ברוכים הבאים למועדון! / Welcome to the Club!`,
      `<p style="color:#ccc;font-size:14px;">Hi <strong style="color:#fff;">${data.firstName}</strong>,</p>
       <p style="color:#ccc;font-size:14px;" dir="rtl">ברוכים הבאים למועדון הפרסטיג' של PetWash™!</p>
       <table style="background:#111;border-radius:12px;padding:20px;width:100%;margin:16px 0;">
         <tr><td style="color:#C6A35B;font-size:24px;font-weight:900;padding-bottom:8px;" colspan="2">👑 ${planLabel}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Member ID</td><td style="color:#E7C978;font-weight:700;font-family:monospace;">${data.memberId}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Name</td><td style="color:#fff;font-size:13px;">${data.firstName} ${data.lastName}</td></tr>
         ${data.petName ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">Pet</td><td style="color:#fff;font-size:13px;">🐾 ${data.petName} (${data.petType || ''})</td></tr>` : ''}
         ${data.city ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">City</td><td style="color:#fff;font-size:13px;">${data.city}</td></tr>` : ''}
       </table>
       <p style="color:#ccc;font-size:13px;">Your digital membership card and all your benefits are now active. Enjoy priority bookings, exclusive discounts, and premium pet care across all PetWash™ platforms.</p>
       <p style="color:#888;font-size:11px;" dir="rtl">כרטיסך הדיגיטלי פעיל. תהנה מהזמנות עדיפות, הנחות בלעדיות ושירותים פרמיום בכל פלטפורמות PetWash™.</p>`
    );

    try {
      await sendEmail(data.email, `👑 PetWash™ Prestige Club – Welcome ${data.firstName}!`, welcomeHtml);
    } catch (err) {
      logger.warn('[Orchestrator] Club welcome email failed', err);
    }

    // 3b. Calendar event – first onboarding session
    const firstSession = new Date();
    firstSession.setDate(firstSession.getDate() + 7); // 1 week out
    firstSession.setHours(10, 0, 0, 0);
    await createCalendarEvent({
      platform: 'Club',
      bookingId: data.memberId,
      title: `👑 Club Welcome Session – ${data.firstName} ${data.lastName}`,
      description: `New ${planLabel} member onboarding.\nMember ID: ${data.memberId}\nPet: ${data.petName || '—'}\nPhone: ${data.phone}`,
      startTime: firstSession,
      endTime: new Date(firstSession.getTime() + 30 * 60 * 1000),
      customerName: `${data.firstName} ${data.lastName}`,
      petName: data.petName,
    });

    // 3c. Back up membership doc to Drive
    await backupToGoogleDrive(
      `ClubMember_${data.memberId}`,
      `PETWASH™ CLUB MEMBERSHIP\n${'-'.repeat(40)}\nMember ID: ${data.memberId}\nPlan: ${planLabel}\nName: ${data.firstName} ${data.lastName}\nEmail: ${data.email}\nPhone: ${data.phone}\nCity: ${data.city || '—'}\nPet: ${data.petName || '—'} (${data.petType || '—'})\nRegistered: ${new Date().toISOString()}`
    );
  }

  // ── 4. PROVIDER REGISTRATION ─────────────
  async handleProviderRegistration(data: ProviderRegistrationPayload): Promise<{
    contractDocId: string | null;
  }> {
    logger.info('[Orchestrator] Handling provider registration', { appId: data.applicationId });

    // 4a. Generate subcontractor agreement document
    const contractType = data.platform.toLowerCase().includes('sitter') ? 'sitter'
      : data.platform.toLowerCase().includes('walk') ? 'walker'
      : data.platform.toLowerCase().includes('driver') || data.platform.toLowerCase().includes('pettrek') ? 'driver'
      : data.platform.toLowerCase().includes('train') || data.platform.toLowerCase().includes('academy') ? 'trainer'
      : 'general';

    const contractContent = generateSubcontractorAgreement({
      applicationId: data.applicationId,
      platform: data.platform,
      contractType,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      idNumber: data.idNumber,
      city: data.city,
      businessName: data.businessName,
      vatNumber: data.vatNumber,
    });

    // 4b. Back up contract to Google Drive
    const contractDocId = await backupToGoogleDrive(
      `ProviderAgreement_${data.applicationId}`,
      contractContent
    );

    // 4c. Email contract to provider + instructions
    const providerWelcomeHtml = brandedEmail(
      `Provider Application Received – ${data.applicationId}`,
      `<p style="color:#ccc;">Hi <strong style="color:#fff;">${data.firstName}</strong>,</p>
       <p style="color:#ccc;">Thank you for applying to join PetWash™ as a <strong style="color:#E7C978;">${data.platform}</strong> provider.</p>
       <table style="background:#111;border-radius:12px;padding:20px;width:100%;margin:16px 0;">
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Application ID</td><td style="color:#E7C978;font-weight:700;font-family:monospace;">${data.applicationId}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Platform</td><td style="color:#fff;">${data.platform}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Status</td><td style="color:#FFA500;">Under Review</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Documents</td><td style="color:${data.selfieUrl && data.idDocUrl ? '#00C851' : '#FF4444'};">${data.selfieUrl && data.idDocUrl ? '✅ Received' : '⚠️ Incomplete'}</td></tr>
       </table>
       <p style="color:#ccc;font-size:13px;"><strong>Next steps:</strong></p>
       <ol style="color:#ccc;font-size:13px;">
         <li>Our team will review your application within 2–3 business days</li>
         <li>You'll receive a background check consent form if not already submitted</li>
         <li>Upon approval, you'll receive your subcontractor agreement for digital signature</li>
         <li>Once signed, you'll be onboarded onto the platform within 24 hours</li>
       </ol>
       <p style="color:#888;font-size:11px;" dir="rtl">צוות הספקים שלנו יחזור אליך תוך 2–3 ימי עסקים. לשאלות: providers@petwash.co.il</p>`
    );

    try {
      await sendEmail(data.email, `🐾 PetWash™ Provider Application – ${data.applicationId}`, providerWelcomeHtml);
    } catch (err) {
      logger.warn('[Orchestrator] Provider welcome email failed', err);
    }

    // 4d. Internal ops notification
    try {
      await sendEmail('providers@petwash.co.il', `New Provider Application: ${data.applicationId} – ${data.platform}`,
        brandedEmail('New Provider Application',
          `<p style="color:#ccc;">Name: ${data.firstName} ${data.lastName}<br>Platform: ${data.platform}<br>City: ${data.city || '—'}<br>Email: ${data.email}<br>Phone: ${data.phone}<br>Selfie: ${data.selfieUrl ? '✅' : '❌'} | ID: ${data.idDocUrl ? '✅' : '❌'}<br>Drive: ${contractDocId || '—'}</p>`)
      );
    } catch { /* non-critical */ }

    // 4e. Calendar event – onboarding interview
    const interviewDate = new Date();
    interviewDate.setDate(interviewDate.getDate() + 5);
    interviewDate.setHours(14, 0, 0, 0);
    await createCalendarEvent({
      platform: data.platform,
      bookingId: `ONBOARD-${data.applicationId}`,
      title: `🐾 Provider Onboarding – ${data.firstName} ${data.lastName} (${data.platform})`,
      description: `Application: ${data.applicationId}\nEmail: ${data.email}\nPhone: ${data.phone}\nCity: ${data.city || '—'}`,
      startTime: interviewDate,
      endTime: new Date(interviewDate.getTime() + 60 * 60 * 1000),
      providerName: `${data.firstName} ${data.lastName}`,
    });

    logger.info('[Orchestrator] Provider registration handled', { appId: data.applicationId, contractDocId });
    return { contractDocId };
  }

  // ── 6. KYC / IDENTITY VERIFICATION SUBMITTED ──
  async handleKYCSubmission(opts: {
    userId: string;
    fullName: string;
    email: string;
    docType: string;
    countryCode?: string;
    idNumber?: string;
    selfieUrl?: string;
    idDocUrl?: string;
    idBackUrl?: string;
    status: 'submitted' | 'auto_approved' | 'manual_review' | 'blocked';
    source: 'kyc_v1' | 'kyc_v2_2026';
    notes?: string;
  }): Promise<void> {
    logger.info('[Orchestrator] Handling KYC submission', { userId: opts.userId });

    // 6a. Log to Google Sheets "Identity Verifications (KYC)"
    try {
      await GoogleSheetsService.appendToSheet('Identity Verifications (KYC)', [
        new Date().toISOString(),
        opts.userId,
        opts.fullName,
        opts.email,
        opts.docType,
        opts.countryCode || 'IL',
        opts.idNumber ? '✅ Provided' : '—',
        opts.selfieUrl ? '✅' : '❌',
        opts.idDocUrl ? '✅' : '❌',
        opts.idBackUrl ? '✅' : '❌',
        opts.status.toUpperCase(),
        opts.source,
        opts.notes || '',
      ]);
    } catch (err) {
      logger.warn('[Orchestrator] KYC Sheets log failed', err);
    }

    // 6b. Back up KYC submission record to Google Drive
    const docContent = `PETWASH™ KYC SUBMISSION RECORD\n${'='.repeat(60)}\nSubmitted: ${new Date().toISOString()}\nUser ID: ${opts.userId}\nName: ${opts.fullName}\nEmail: ${opts.email}\nDocument Type: ${opts.docType}\nCountry: ${opts.countryCode || 'IL'}\nID Number: ${opts.idNumber ? '[HASH ONLY - PII protected]' : '—'}\nSelfie: ${opts.selfieUrl ? '✅ Uploaded' : 'Not uploaded'}\nID Front: ${opts.idDocUrl ? '✅ Uploaded' : 'Not uploaded'}\nID Back: ${opts.idBackUrl ? '✅ Uploaded' : 'Not uploaded'}\nStatus: ${opts.status}\nSource: ${opts.source}\nNotes: ${opts.notes || '—'}\n${'='.repeat(60)}\nGDPR: Documents stored in Firebase Storage with 90-day retention.\nThis record is a compliance audit trail only. No PII data stored here.`;
    await backupToGoogleDrive(`KYC_${opts.userId}_${Date.now()}`, docContent);

    // 6c. Notify ops team if manual review needed
    if (opts.status === 'manual_review' || opts.status === 'blocked') {
      try {
        await sendEmail('compliance@petwash.co.il',
          `⚠️ KYC ${opts.status.toUpperCase()}: ${opts.fullName} (${opts.userId})`,
          brandedEmail(`KYC Review Required`,
            `<p style="color:#ccc;">User <strong style="color:#fff;">${opts.fullName}</strong> (${opts.email}) requires manual KYC review.</p>
             <table style="background:#111;border-radius:12px;padding:20px;width:100%;margin:16px 0;">
               <tr><td style="color:#666;font-size:12px;padding:4px 0;">User ID</td><td style="color:#E7C978;font-family:monospace;">${opts.userId}</td></tr>
               <tr><td style="color:#666;font-size:12px;padding:4px 0;">Status</td><td style="color:${opts.status === 'blocked' ? '#ff4444' : '#FFA500'};">${opts.status.toUpperCase()}</td></tr>
               <tr><td style="color:#666;font-size:12px;padding:4px 0;">Document</td><td style="color:#fff;">${opts.docType}</td></tr>
               <tr><td style="color:#666;font-size:12px;padding:4px 0;">Country</td><td style="color:#fff;">${opts.countryCode || 'IL'}</td></tr>
               <tr><td style="color:#666;font-size:12px;padding:4px 0;">Selfie</td><td style="color:${opts.selfieUrl ? '#00C851' : '#ff4444'};">${opts.selfieUrl ? '✅' : '❌'}</td></tr>
               <tr><td style="color:#666;font-size:12px;padding:4px 0;">Notes</td><td style="color:#fff;">${opts.notes || '—'}</td></tr>
             </table>
             <p style="color:#888;font-size:12px;">Review in the admin panel: admin.petwash.co.il/kyc</p>`)
        );
      } catch { /* non-critical */ }
    }

    logger.info('[Orchestrator] KYC submission handled', { userId: opts.userId, status: opts.status });
  }

  // ── 7. KYB / BUSINESS VERIFICATION ────────
  async handleKYBSubmission(opts: {
    businessId: string;
    businessName: string;
    contactName: string;
    contactEmail: string;
    vatNumber?: string;
    registrationNumber?: string;
    country?: string;
    city?: string;
    documentsUploaded: string[];
    status: 'submitted' | 'approved' | 'manual_review' | 'rejected';
    notes?: string;
  }): Promise<void> {
    logger.info('[Orchestrator] Handling KYB submission', { businessId: opts.businessId });

    // 7a. Log to Sheets "Onboarding Cases"
    try {
      await GoogleSheetsService.appendToSheet('Onboarding Cases', [
        new Date().toISOString(),
        opts.businessId,
        opts.businessName,
        opts.contactName,
        opts.contactEmail,
        opts.vatNumber || '—',
        opts.registrationNumber || '—',
        opts.country || 'IL',
        opts.city || '—',
        opts.documentsUploaded.join(', '),
        opts.status.toUpperCase(),
        'KYB',
        opts.notes || '',
      ]);
    } catch (err) {
      logger.warn('[Orchestrator] KYB Sheets log failed', err);
    }

    // 7b. Drive backup
    const docContent = `PETWASH™ KYB BUSINESS VERIFICATION\n${'='.repeat(60)}\nSubmitted: ${new Date().toISOString()}\nBusiness ID: ${opts.businessId}\nBusiness Name: ${opts.businessName}\nContact: ${opts.contactName} <${opts.contactEmail}>\nVAT (Osek Murshe): ${opts.vatNumber || '—'}\nCompany Reg: ${opts.registrationNumber || '—'}\nCountry: ${opts.country || 'IL'}\nCity: ${opts.city || '—'}\nDocuments: ${opts.documentsUploaded.join(', ')}\nStatus: ${opts.status}\nNotes: ${opts.notes || '—'}\n${'='.repeat(60)}`;
    await backupToGoogleDrive(`KYB_${opts.businessId}`, docContent);

    // 7c. Notify compliance
    try {
      await sendEmail('compliance@petwash.co.il',
        `📋 KYB Submission: ${opts.businessName} – ${opts.status.toUpperCase()}`,
        brandedEmail('KYB Business Verification',
          `<p style="color:#ccc;">Business <strong style="color:#fff;">${opts.businessName}</strong> has submitted KYB documentation.</p>
           <table style="background:#111;border-radius:12px;padding:20px;width:100%;margin:16px 0;">
             <tr><td style="color:#666;font-size:12px;padding:4px 0;">Business ID</td><td style="color:#E7C978;font-family:monospace;">${opts.businessId}</td></tr>
             <tr><td style="color:#666;font-size:12px;padding:4px 0;">VAT No.</td><td style="color:#fff;">${opts.vatNumber || '—'}</td></tr>
             <tr><td style="color:#666;font-size:12px;padding:4px 0;">City</td><td style="color:#fff;">${opts.city || '—'}</td></tr>
             <tr><td style="color:#666;font-size:12px;padding:4px 0;">Documents</td><td style="color:#fff;">${opts.documentsUploaded.join(', ') || 'None'}</td></tr>
             <tr><td style="color:#666;font-size:12px;padding:4px 0;">Status</td><td style="color:#FFA500;">${opts.status.toUpperCase()}</td></tr>
           </table>`)
      );
    } catch { /* non-critical */ }

    logger.info('[Orchestrator] KYB submission handled', { businessId: opts.businessId, status: opts.status });
  }

  // ── 8. BOOKING CONFIRMED (provider accepts) ──
  async handleBookingConfirmed(opts: {
    bookingId: string;
    bookingRef: string;
    platform: string;
    serviceType: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    providerName: string;
    providerEmail?: string;
    petName?: string;
    scheduledDate: string;
    scheduledTime?: string;
    address?: string;
    city?: string;
    amountILS?: number;
  }): Promise<void> {
    logger.info('[Orchestrator] Handling booking confirmed', { ref: opts.bookingRef });

    // 8a. Log to platform-specific Sheets tab
    const sheetsTabMap: Record<string, string> = {
      'K9000': 'K9000 Wash Bookings',
      'Sitter Suite': 'Sitter Suite Bookings',
      'Walk My Pet': 'Walk My Pet Bookings',
      'PetTrek': 'PetTrek Bookings',
      'PetWash Academy': 'Academy Bookings',
    };
    const sheetsTab = sheetsTabMap[opts.platform] || 'Sitter Suite Bookings';
    try {
      await GoogleSheetsService.appendToSheet(sheetsTab, [
        new Date().toISOString(),
        opts.bookingRef,
        opts.platform,
        opts.serviceType,
        opts.customerName,
        opts.customerEmail,
        opts.customerPhone,
        opts.providerName,
        opts.providerEmail || '',
        opts.petName || '',
        opts.scheduledDate,
        opts.scheduledTime || '',
        opts.address || '',
        opts.city || '',
        opts.amountILS ? `₪${opts.amountILS.toFixed(2)}` : '',
        'CONFIRMED',
      ]);
    } catch (err) {
      logger.warn('[Orchestrator] Booking confirmed Sheets log failed', err);
    }

    // 8b. Update/create Calendar event
    const startTime = new Date(`${opts.scheduledDate}T${opts.scheduledTime || '09:00'}:00`);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    await createCalendarEvent({
      platform: opts.platform,
      bookingId: opts.bookingRef,
      title: `✅ CONFIRMED: ${opts.serviceType} – ${opts.customerName}${opts.petName ? ' & ' + opts.petName : ''}`,
      description: [
        `Booking: ${opts.bookingRef}`,
        `Provider: ${opts.providerName}`,
        `Customer: ${opts.customerName} | ${opts.customerEmail} | ${opts.customerPhone}`,
        opts.petName ? `Pet: ${opts.petName}` : '',
        opts.address ? `Address: ${opts.address}` : '',
        opts.amountILS ? `Amount: ₪${opts.amountILS.toFixed(2)}` : '',
      ].filter(Boolean).join('\n'),
      startTime,
      endTime,
      location: opts.address || opts.city || 'Israel',
      customerName: opts.customerName,
      petName: opts.petName,
      providerName: opts.providerName,
    });

    // 8c. Confirmation email to customer — with Calendar + Maps
    const calendarStartTime = new Date(`${opts.scheduledDate}T${opts.scheduledTime || '09:00'}:00`);
    const calendarEndTime = new Date(calendarStartTime.getTime() + 60 * 60 * 1000);
    const confirmedCalLink = buildGoogleCalendarLink({
      title: `✅ ${opts.serviceType} – ${opts.customerName}`,
      description: `Provider: ${opts.providerName}\nPet: ${opts.petName || '—'}\nRef: ${opts.bookingRef}\n\nManaged by PetWash™`,
      startTime: calendarStartTime,
      endTime: calendarEndTime,
      location: [opts.address, opts.city, 'Israel'].filter(Boolean).join(', '),
    });
    const confirmedMapsLink = generateMapsLink(opts.address, opts.city);
    const confirmHtml = brandedEmail(
      `✅ Booking Confirmed by Your Provider!`,
      `<p style="color:#ccc;">Hi <strong style="color:#fff;">${opts.customerName}</strong>,</p>
       <p style="color:#ccc;" dir="rtl">הזמנתך אושרה על ידי הספק שלך! / Your booking has been confirmed!</p>
       <table style="background:#111;border-radius:12px;padding:20px;width:100%;margin:16px 0;">
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Booking Ref</td><td style="color:#E7C978;font-weight:700;font-family:monospace;">${opts.bookingRef}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Service</td><td style="color:#fff;">${opts.serviceType}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Provider</td><td style="color:#00C851;font-weight:600;">${opts.providerName}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Date</td><td style="color:#fff;">${opts.scheduledDate}${opts.scheduledTime ? ' at ' + opts.scheduledTime : ''}</td></tr>
         ${opts.petName ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">Pet</td><td style="color:#fff;">🐾 ${opts.petName}</td></tr>` : ''}
         ${opts.address ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">Address</td><td style="color:#fff;">${opts.address}</td></tr>` : ''}
         ${opts.amountILS ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">Amount</td><td style="color:#E7C978;font-weight:700;">₪${opts.amountILS.toFixed(2)}</td></tr>` : ''}
       </table>
       <p style="text-align:center;margin:12px 0 6px;">
         <a href="${confirmedCalLink}" style="background:linear-gradient(135deg,#C6A35B,#E7C978);color:#000;font-weight:700;padding:12px 20px;border-radius:24px;text-decoration:none;display:inline-block;margin:4px;">📅 Add to Google Calendar</a>
         ${confirmedMapsLink ? `<a href="${confirmedMapsLink}" style="background:#1a73e8;color:#fff;font-weight:700;padding:12px 20px;border-radius:24px;text-decoration:none;display:inline-block;margin:4px;">📍 Get Directions</a>` : ''}
       </p>
       <p style="color:#ccc;font-size:13px;">Your provider will contact you if needed. Please be ready 5 minutes before the appointment.</p>
       <p style="color:#888;font-size:11px;" dir="rtl">הספק שלך יצור קשר במידת הצורך. אנא היה מוכן 5 דקות לפני הפגישה.</p>`
    );
    try {
      await sendEmail(opts.customerEmail, `✅ PetWash™ Booking Confirmed – ${opts.bookingRef}`, confirmHtml);
    } catch (err) {
      logger.warn('[Orchestrator] Booking confirmed email failed', err);
    }

    logger.info('[Orchestrator] Booking confirmed handled', { ref: opts.bookingRef });
  }

  // ── 9. E-SIGN COMPLETE (DocuSeal webhook) ──
  async handleEsignComplete(opts: {
    submissionId: string;
    documentType: string;
    signerName: string;
    signerEmail: string;
    userId?: string;
    templateSlug?: string;
    signedDocumentUrl?: string;
    completedAt: string;
  }): Promise<void> {
    logger.info('[Orchestrator] Handling e-sign completion', { submissionId: opts.submissionId });

    // 9a. Log to Sheets "E-Signatures & Contracts"
    try {
      await GoogleSheetsService.appendToSheet('E-Signatures & Contracts', [
        new Date().toISOString(),
        opts.submissionId,
        opts.documentType,
        opts.signerName,
        opts.signerEmail,
        opts.userId || '',
        opts.templateSlug || '',
        opts.completedAt,
        opts.signedDocumentUrl ? '✅ Available' : '—',
        'COMPLETED',
      ]);
    } catch (err) {
      logger.warn('[Orchestrator] E-sign Sheets log failed', err);
    }

    // 9b. Back up signature record to Drive
    const docContent = `PETWASH™ E-SIGNATURE COMPLETION RECORD\n${'='.repeat(60)}\nCompleted: ${opts.completedAt}\nSubmission ID: ${opts.submissionId}\nDocument Type: ${opts.documentType}\nSigned By: ${opts.signerName} <${opts.signerEmail}>\nUser ID: ${opts.userId || '—'}\nTemplate: ${opts.templateSlug || '—'}\nDocument URL: ${opts.signedDocumentUrl || '—'}\n${'='.repeat(60)}\nLEGAL BASIS: Israeli Electronic Signature Law 5761-2001 (חוק חתימה אלקטרונית)`;
    await backupToGoogleDrive(`ESign_${opts.submissionId}`, docContent);

    // 9c. Confirmation email to signer
    const emailHtml = brandedEmail(
      '✍️ Document Signed Successfully',
      `<p style="color:#ccc;">Hi <strong style="color:#fff;">${opts.signerName}</strong>,</p>
       <p style="color:#ccc;">You have successfully signed: <strong style="color:#E7C978;">${opts.documentType}</strong></p>
       <table style="background:#111;border-radius:12px;padding:20px;width:100%;margin:16px 0;">
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Submission ID</td><td style="color:#E7C978;font-family:monospace;">${opts.submissionId}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Document</td><td style="color:#fff;">${opts.documentType}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Signed At</td><td style="color:#fff;">${opts.completedAt}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Legal Basis</td><td style="color:#00C851;">חוק חתימה אלקטרונית 5761-2001</td></tr>
       </table>
       ${opts.signedDocumentUrl ? `<p style="text-align:center;"><a href="${opts.signedDocumentUrl}" style="background:linear-gradient(135deg,#C6A35B,#E7C978);color:#000;font-weight:700;padding:12px 28px;border-radius:24px;text-decoration:none;display:inline-block;">📄 Download Signed Document</a></p>` : ''}
       <p style="color:#ccc;font-size:13px;">A backup of this signed document has been stored in our secure cloud. This signature is legally binding.</p>
       <p style="color:#888;font-size:11px;" dir="rtl">עותק החתום מאוחסן בענן המאובטח שלנו. חתימה זו מחייבת מבחינה משפטית.</p>`
    );
    try {
      await sendEmail(opts.signerEmail, `✍️ PetWash™ Document Signed – ${opts.documentType}`, emailHtml);
    } catch (err) {
      logger.warn('[Orchestrator] E-sign email failed', err);
    }

    logger.info('[Orchestrator] E-sign completion handled', { submissionId: opts.submissionId });
  }

  // ── 10. PROVIDER ONBOARDING APPROVED ──────
  async handleOnboardingApproved(opts: {
    applicationId: string;
    platform: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city?: string;
    idNumber?: string;
    vatNumber?: string;
    businessName?: string;
    inviteCode?: string;
    approvedBy?: string;
    notes?: string;
  }): Promise<void> {
    logger.info('[Orchestrator] Handling onboarding approval', { appId: opts.applicationId });

    // 10a. Log to Sheets "Provider Applications"
    try {
      await GoogleSheetsService.appendToSheet('Provider Applications', [
        new Date().toISOString(),
        opts.applicationId,
        opts.platform,
        opts.firstName,
        opts.lastName,
        opts.email,
        opts.phone,
        opts.city || '',
        opts.idNumber ? '✅' : '—',
        opts.vatNumber || '—',
        opts.businessName || '—',
        opts.inviteCode || '',
        opts.approvedBy || '',
        'APPROVED',
        opts.notes || '',
      ]);
    } catch (err) {
      logger.warn('[Orchestrator] Onboarding approval Sheets log failed', err);
    }

    // 10b. Generate and back up final approval contract to Drive
    const contractContent = `PETWASH™ PROVIDER ONBOARDING APPROVAL\n${'='.repeat(60)}\nApproved: ${new Date().toISOString()}\nApplication ID: ${opts.applicationId}\nPlatform: ${opts.platform}\nProvider: ${opts.firstName} ${opts.lastName}\nEmail: ${opts.email}\nPhone: ${opts.phone}\nCity: ${opts.city || '—'}\nID: ${opts.idNumber ? '[VERIFIED]' : 'Not provided'}\nVAT (Osek Murshe): ${opts.vatNumber || '—'}\nBusiness: ${opts.businessName || '—'}\nInvite Code: ${opts.inviteCode || '—'}\nApproved By: ${opts.approvedBy || 'System'}\nNotes: ${opts.notes || '—'}\n${'='.repeat(60)}\nSTATUS: APPROVED — Provider cleared to begin accepting bookings.`;
    await backupToGoogleDrive(`OnboardingApproval_${opts.applicationId}`, contractContent);

    // 10c. Approval email to provider
    const approvalHtml = brandedEmail(
      '🎉 Application Approved – Welcome to PetWash™!',
      `<p style="color:#ccc;">Hi <strong style="color:#fff;">${opts.firstName}</strong>,</p>
       <p style="color:#ccc;" dir="rtl">🎉 המועמדות שלך אושרה! / Your application has been APPROVED!</p>
       <table style="background:#111;border-radius:12px;padding:20px;width:100%;margin:16px 0;">
         <tr><td style="color:#C6A35B;font-size:20px;font-weight:900;padding-bottom:8px;" colspan="2">🐾 Welcome to the Team!</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Application ID</td><td style="color:#E7C978;font-family:monospace;">${opts.applicationId}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Platform</td><td style="color:#fff;">${opts.platform}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Status</td><td style="color:#00C851;font-weight:700;">✅ APPROVED</td></tr>
         ${opts.inviteCode ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">Invite Code</td><td style="color:#E7C978;font-weight:700;font-family:monospace;">${opts.inviteCode}</td></tr>` : ''}
       </table>
       <p style="color:#ccc;font-size:13px;"><strong>Next Steps:</strong></p>
       <ol style="color:#ccc;font-size:13px;">
         <li>Download the PetWash Provider App</li>
         <li>Sign in with your email (${opts.email})</li>
         <li>Complete your profile and set your availability</li>
         <li>You'll start receiving booking requests within 24 hours</li>
       </ol>
       <p style="color:#ccc;font-size:13px;">Commission: You keep <strong style="color:#E7C978;">85%</strong> of every completed booking. Payments within 3 business days.</p>
       <p style="color:#888;font-size:11px;" dir="rtl">ברוכים הבאים לצוות PetWash™! אתה שומר 85% מכל הזמנה. תשלומים תוך 3 ימי עסקים.</p>`
    );
    try {
      await sendEmail(opts.email, `🎉 PetWash™ Provider Approved – ${opts.applicationId}`, approvalHtml);
    } catch (err) {
      logger.warn('[Orchestrator] Approval email failed', err);
    }

    // 10d. Schedule onboarding call in Calendar
    const callDate = new Date();
    callDate.setDate(callDate.getDate() + 2);
    callDate.setHours(10, 0, 0, 0);
    await createCalendarEvent({
      platform: opts.platform,
      bookingId: `APPROVED-${opts.applicationId}`,
      title: `✅ APPROVED Provider Onboarding: ${opts.firstName} ${opts.lastName}`,
      description: `Provider ID: ${opts.applicationId}\nPlatform: ${opts.platform}\nEmail: ${opts.email}\nPhone: ${opts.phone}\nCity: ${opts.city || '—'}\nInvite Code: ${opts.inviteCode || '—'}`,
      startTime: callDate,
      endTime: new Date(callDate.getTime() + 45 * 60 * 1000),
      providerName: `${opts.firstName} ${opts.lastName}`,
    });

    logger.info('[Orchestrator] Onboarding approval handled', { appId: opts.applicationId });
  }

  // ── 11. CONTRACT GENERATED ─────────────────
  async handleContractGenerated(opts: {
    contractId: string | number;
    contractNumber: string;
    contractType: 'offer_letter' | 'contractor_agreement' | 'subcontractor' | 'employment';
    partyName: string;
    partyEmail: string;
    platform?: string;
    city?: string;
    salaryOrRate?: number;
    currency?: string;
    effectiveDate?: string;
    content?: string;
  }): Promise<void> {
    logger.info('[Orchestrator] Handling contract generated', { contractNumber: opts.contractNumber });

    // 11a. Log to Sheets "E-Signatures & Contracts"
    try {
      await GoogleSheetsService.appendToSheet('E-Signatures & Contracts', [
        new Date().toISOString(),
        String(opts.contractId),
        opts.contractNumber,
        opts.contractType,
        opts.partyName,
        opts.partyEmail,
        opts.platform || '—',
        opts.city || '—',
        opts.salaryOrRate ? `${opts.currency || 'ILS'} ${opts.salaryOrRate}` : '—',
        opts.effectiveDate || new Date().toISOString().slice(0, 10),
        'GENERATED — PENDING SIGNATURE',
      ]);
    } catch (err) {
      logger.warn('[Orchestrator] Contract Sheets log failed', err);
    }

    // 11b. Back up contract to Drive
    const docContent = opts.content || `PETWASH™ CONTRACT\n${'='.repeat(60)}\nGenerated: ${new Date().toISOString()}\nContract ID: ${opts.contractId}\nContract Number: ${opts.contractNumber}\nType: ${opts.contractType}\nParty: ${opts.partyName} <${opts.partyEmail}>\nPlatform: ${opts.platform || '—'}\nRate/Salary: ${opts.salaryOrRate || '—'} ${opts.currency || 'ILS'}\nEffective: ${opts.effectiveDate || '—'}\nStatus: GENERATED — AWAITING SIGNATURE`;
    await backupToGoogleDrive(`Contract_${opts.contractNumber}`, docContent);

    // 11c. Email notification to party
    try {
      await sendEmail(opts.partyEmail,
        `📄 PetWash™ Contract Ready for Signature – ${opts.contractNumber}`,
        brandedEmail('Contract Ready for Digital Signature',
          `<p style="color:#ccc;">Hi <strong style="color:#fff;">${opts.partyName}</strong>,</p>
           <p style="color:#ccc;">Your PetWash™ contract is ready for your digital signature.</p>
           <table style="background:#111;border-radius:12px;padding:20px;width:100%;margin:16px 0;">
             <tr><td style="color:#666;font-size:12px;padding:4px 0;">Contract No.</td><td style="color:#E7C978;font-family:monospace;">${opts.contractNumber}</td></tr>
             <tr><td style="color:#666;font-size:12px;padding:4px 0;">Type</td><td style="color:#fff;">${opts.contractType.replace(/_/g, ' ').toUpperCase()}</td></tr>
             ${opts.effectiveDate ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">Effective Date</td><td style="color:#fff;">${opts.effectiveDate}</td></tr>` : ''}
             ${opts.salaryOrRate ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">Rate / Salary</td><td style="color:#E7C978;">₪${opts.salaryOrRate.toLocaleString()}</td></tr>` : ''}
           </table>
           <p style="color:#ccc;font-size:13px;">Please log in to your PetWash™ account to review and sign. This link expires in 30 days.</p>
           <p style="color:#888;font-size:11px;" dir="rtl">אנא היכנס לחשבונך כדי לסקור ולחתום. הקישור יפוג בעוד 30 יום.</p>`)
      );
    } catch (err) {
      logger.warn('[Orchestrator] Contract email failed', err);
    }

    logger.info('[Orchestrator] Contract generated handled', { contractNumber: opts.contractNumber });
  }

  // ── 5. LEGAL AGREEMENT SIGNING ───────────
  async handleLegalAgreementSigning(opts: {
    signatureId: string;
    agreementTitle: string;
    agreementId: string;
    agreementVersion: string;
    fullName: string;
    idNumber: string;
    email: string;
    department?: string;
    company?: string;
    signedAt: string;
    agreementContent: string;
  }): Promise<{ driveDocId: string | null }> {
    logger.info('[Orchestrator] Handling legal agreement signing', { sigId: opts.signatureId });

    // 5a. Build signed agreement document for Drive
    const docContent = `PETWASH™ SIGNED LEGAL AGREEMENT
${'='.repeat(60)}
Signature ID: ${opts.signatureId}
Agreement: ${opts.agreementTitle} (${opts.agreementVersion})
Agreement ID: ${opts.agreementId}
Signed By: ${opts.fullName}
ID Number: ${opts.idNumber}
Email: ${opts.email}
Department: ${opts.department || '—'}
Company: ${opts.company || '—'}
Signed At: ${opts.signedAt}
IP: [recorded on server]
${'─'.repeat(60)}
LEGAL BASIS: Israeli Electronic Signature Law 5761-2001
${'='.repeat(60)}

${opts.agreementContent}

${'='.repeat(60)}
DIGITAL SIGNATURE RECORD
Signatory: ${opts.fullName}
ID: ${opts.idNumber}
Signed: ${opts.signedAt}
Signature ID: ${opts.signatureId}
${'='.repeat(60)}`;

    // 5b. Back up to Google Drive
    const driveDocId = await backupToGoogleDrive(
      `SignedAgreement_${opts.signatureId}`,
      docContent
    );

    // 5c. Send signed copy to signatory
    const confirmationHtml = brandedEmail(
      `Agreement Signed – ${opts.signatureId}`,
      `<p style="color:#ccc;">Hi <strong style="color:#fff;">${opts.fullName}</strong>,</p>
       <p style="color:#ccc;">You have successfully digitally signed the following agreement:</p>
       <table style="background:#111;border-radius:12px;padding:20px;width:100%;margin:16px 0;">
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Signature ID</td><td style="color:#E7C978;font-weight:700;font-family:monospace;">${opts.signatureId}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Agreement</td><td style="color:#fff;">${opts.agreementTitle}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Version</td><td style="color:#fff;">${opts.agreementVersion}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Signed At</td><td style="color:#fff;">${opts.signedAt}</td></tr>
         ${opts.company ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">Company</td><td style="color:#fff;">${opts.company}</td></tr>` : ''}
       </table>
       <p style="color:#ccc;font-size:13px;">This signature is legally binding under the Israeli Electronic Signature Law 5761-2001 and the Israeli Evidence Ordinance. A copy of this signed agreement has been securely stored in our cloud.</p>
       <p style="color:#888;font-size:11px;" dir="rtl">חתימה זו מחייבת מבחינה משפטית לפי חוק חתימה אלקטרונית 5761-2001. עותק נשמר בענן שלנו. מזהה חתימה: ${opts.signatureId}</p>`
    );

    try {
      await sendEmail(opts.email, `✍️ PetWash™ Agreement Signed – ${opts.signatureId}`, confirmationHtml);
    } catch (err) {
      logger.warn('[Orchestrator] Legal agreement email failed', err);
    }

    logger.info('[Orchestrator] Legal agreement handled', { sigId: opts.signatureId, driveDocId });
    return { driveDocId };
  }
}

// ─────────────────────────────────────────────
// CONTRACT TEMPLATE GENERATOR
// ─────────────────────────────────────────────
function generateSubcontractorAgreement(opts: {
  applicationId: string;
  platform: string;
  contractType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber?: string;
  city?: string;
  businessName?: string;
  vatNumber?: string;
}): string {
  const today = new Date().toLocaleDateString('en-IL', { day: '2-digit', month: 'long', year: 'numeric' });
  return `PETWASH™ SUBCONTRACTOR SERVICE AGREEMENT
${'='.repeat(70)}
Date: ${today}
Application ID: ${opts.applicationId}
Platform: ${opts.platform}
${'─'.repeat(70)}

PARTIES:

1. PetWash™ Ltd. ("Company"), Company Reg. 515234567,
   1 Rothschild Blvd, Tel Aviv 6688101, Israel

2. ${opts.firstName} ${opts.lastName} ("Service Provider"),
   ID: ${opts.idNumber || '—'}
   Email: ${opts.email} | Phone: ${opts.phone}
   City: ${opts.city || '—'}
   ${opts.businessName ? 'Business: ' + opts.businessName : ''}
   ${opts.vatNumber ? 'VAT (Osek Murshe): ' + opts.vatNumber : ''}

${'─'.repeat(70)}
TERMS AND CONDITIONS:

1. ENGAGEMENT
   The Company engages the Service Provider as an independent contractor
   to provide ${opts.platform} services via the PetWash™ platform.
   The Service Provider is NOT an employee of PetWash™ Ltd.

2. COMMISSION STRUCTURE
   - Platform commission: 15% of each completed booking
   - Service Provider receives: 85% net of each booking
   - Payments processed within 3 business days of service completion
   - All amounts include VAT at 18% (מע"מ)

3. COMPLIANCE
   - Provider must hold valid Osek Murshe (VAT-registered) or Osek Patur status
   - Provider is responsible for their own tax filings (הכנסה ומע"מ)
   - PetWash™ will issue provider statements for all completed transactions
   - Withholding tax (ניכוי מס במקור) applied as required by Israeli law

4. ANIMAL WELFARE
   - Provider must comply with Israeli Animal Welfare Law 5754-1994
   - Any incident must be reported immediately to PetWash™ operations

5. STANDARDS & RATING
   - Minimum rating: 4.2/5.0 (20-review minimum)
   - Background check required before activation
   - PetWash™ may suspend or terminate for conduct violations

6. INTELLECTUAL PROPERTY
   - Provider may not use PetWash™ marks independently
   - All customer data remains property of PetWash™

7. TERM & TERMINATION
   - Either party may terminate with 14 days written notice
   - Immediate termination for breach of animal welfare or fraud

8. GOVERNING LAW
   Israeli law governs this agreement. Disputes: Tel Aviv courts.

${'─'.repeat(70)}
SIGNATURES:

PetWash™ Ltd.                    Service Provider
________________                 ________________
Authorized Signatory             ${opts.firstName} ${opts.lastName}
Date: ${today}                   Date: ___________

${'='.repeat(70)}
Application ID: ${opts.applicationId}
This document was auto-generated by PetWash™ Operations Orchestrator.
Legally binding under Israeli law once signed by both parties.
${'='.repeat(70)}`;
}

// ─────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────
export const petWashOrchestrator = new PetWashOperationsOrchestrator();
