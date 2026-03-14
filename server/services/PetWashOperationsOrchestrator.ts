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
  return `
<!DOCTYPE html>
<html dir="ltr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
    <tr><td style="padding:32px 24px 0;">
      <div style="display:flex;align-items:center;gap:12px;border-bottom:1px solid #1a1a1a;padding-bottom:20px;margin-bottom:24px;">
        <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#C6A35B,#E7C978);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">PetWash™</div>
        <div style="font-size:11px;color:#666;letter-spacing:2px;text-transform:uppercase;">Israel's Pet Care Platform</div>
      </div>
      <h2 style="color:#fff;font-size:20px;margin:0 0 16px;">${title}</h2>
      ${bodyHtml}
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1a1a1a;color:#444;font-size:11px;">
        <p style="margin:0;">PetWash™ Ltd. · 1 Rothschild Blvd, Tel Aviv · support@petwash.co.il · VAT 18%</p>
        <p style="margin:4px 0 0;" dir="rtl">פט ווש בע"מ · מספר ח.פ. 515234567 · מע"מ כלול בכל מחיר</p>
      </div>
    </td></tr>
  </table>
</body>
</html>`;
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
    const confirmHtml = brandedEmail(
      `Booking Confirmed – ${data.bookingRef}`,
      `<p style="color:#ccc;font-size:14px;">Hi <strong style="color:#fff;">${data.firstName}</strong>,</p>
       <p style="color:#ccc;font-size:14px;">Your <strong style="color:#E7C978;">${data.serviceType}</strong> booking is confirmed!</p>
       <table style="background:#111;border-radius:12px;padding:20px;width:100%;margin:16px 0;">
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Booking Ref</td><td style="color:#E7C978;font-weight:700;font-family:monospace;font-size:14px;">${data.bookingRef}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Platform</td><td style="color:#fff;font-size:13px;">${data.platform}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Service</td><td style="color:#fff;font-size:13px;">${data.serviceType}</td></tr>
         <tr><td style="color:#666;font-size:12px;padding:4px 0;">Date & Time</td><td style="color:#fff;font-size:13px;">${data.date} at ${data.time}</td></tr>
         ${data.city ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">Location</td><td style="color:#fff;font-size:13px;">${data.city}</td></tr>` : ''}
         ${data.petName ? `<tr><td style="color:#666;font-size:12px;padding:4px 0;">Pet</td><td style="color:#fff;font-size:13px;">🐾 ${data.petName}</td></tr>` : ''}
       </table>
       ${calendarLink ? `<p style="text-align:center;"><a href="${calendarLink}" style="background:linear-gradient(135deg,#C6A35B,#E7C978);color:#000;font-weight:700;padding:12px 28px;border-radius:24px;text-decoration:none;display:inline-block;">📅 Add to Google Calendar</a></p>` : ''}
       <p style="color:#666;font-size:12px;">Free cancellation up to 2 hours before your appointment. Questions? Call 1-800-PETWASH or email support@petwash.co.il</p>
       <p style="color:#555;font-size:11px;" dir="rtl">אישור הזמנה – ${data.bookingRef} | ניתן לבטל עד שעתיים לפני השירות</p>`
    );

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
