import { db } from '../db';
import { emailAudit } from '@shared/schema';
import { EmailService } from '../emailService';
import { logger } from '../lib/logger';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

type WelcomeAudience = 'public_customer' | 'provider_applicant' | 'staff_request';

let logoBase64: string | null = null;
try {
  const logoPath = path.resolve('brand/petwash-logo-official.png');
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = logoBuffer.toString('base64');
  }
} catch {}

function getLogo(): string {
  if (logoBase64) {
    return `<img src="data:image/png;base64,${logoBase64}" alt="Pet Wash™" style="max-width:180px;height:auto;" />`;
  }
  return `<span style="font-size:28px;font-weight:700;color:#c9a96e;letter-spacing:1px;">⁦Pet Wash™⁩</span>`;
}

function getWelcomeHtml(audience: WelcomeAudience, membershipNumber: string, language: string): string {
  const isHe = language === 'he';
  const dir = isHe ? 'rtl' : 'ltr';
  const logo = getLogo();
  const year = new Date().getFullYear();

  const content: Record<WelcomeAudience, { title: string; subtitle: string; body: string; cta: string; ctaUrl: string }> = {
    public_customer: {
      title: isHe ? 'ברוכים הבאים ל-Pet Wash™' : 'Welcome to Pet Wash™',
      subtitle: isHe ? 'חשבונך נוצר בהצלחה' : 'Your account has been created',
      body: isHe
        ? `<p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6;">מספר החברות שלך:</p>
           <div style="background:#f0ead6;border:2px solid #c9a96e;border-radius:2px;padding:16px;text-align:center;margin:0 0 20px;">
             <span style="font-size:22px;font-weight:700;letter-spacing:2px;color:#1a1a1a;font-family:'Courier New',monospace;">${membershipNumber}</span>
           </div>
           <p style="margin:0 0 12px;color:#444;font-size:14px;line-height:1.6;">עם Pet Wash™ תוכלו ליהנות מ:</p>
           <ul style="margin:0 0 20px;padding-right:20px;color:#555;font-size:14px;line-height:1.8;">
             <li>שטיפה עצמית 24/7 בתחנות K9000™</li>
             <li>שמפו אורגני 100% עם שמן עץ התה</li>
             <li>מערכת נאמנות 7 רמות</li>
             <li>כרטיסי מתנה ומנויים</li>
           </ul>`
        : `<p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6;">Your membership number:</p>
           <div style="background:#f0ead6;border:2px solid #c9a96e;border-radius:2px;padding:16px;text-align:center;margin:0 0 20px;">
             <span style="font-size:22px;font-weight:700;letter-spacing:2px;color:#1a1a1a;font-family:'Courier New',monospace;">${membershipNumber}</span>
           </div>
           <p style="margin:0 0 12px;color:#444;font-size:14px;line-height:1.6;">With Pet Wash™ you can enjoy:</p>
           <ul style="margin:0 0 20px;padding-left:20px;color:#555;font-size:14px;line-height:1.8;">
             <li>24/7 self-wash at K9000™ stations</li>
             <li>100% organic tea tree oil shampoo</li>
             <li>7-tier loyalty program</li>
             <li>Gift cards & wash packages</li>
           </ul>`,
      cta: isHe ? 'השלימו את הפרופיל שלכם' : 'Complete Your Profile',
      ctaUrl: 'https://petwash.co.il/complete-profile',
    },
    provider_applicant: {
      title: isHe ? 'ברוכים הבאים לצוות Pet Wash™' : 'Welcome to the Pet Wash™ Team',
      subtitle: isHe ? 'הרשמתך כנותן שירות התקבלה' : 'Your provider application received',
      body: isHe
        ? `<p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6;">מספר הזיהוי שלך כנותן שירות:</p>
           <div style="background:#f0ead6;border:2px solid #c9a96e;border-radius:2px;padding:16px;text-align:center;margin:0 0 20px;">
             <span style="font-size:22px;font-weight:700;letter-spacing:2px;color:#1a1a1a;font-family:'Courier New',monospace;">${membershipNumber}</span>
           </div>
           <p style="margin:0 0 12px;color:#444;font-size:14px;line-height:1.6;">השלבים הבאים:</p>
           <ol style="margin:0 0 20px;padding-right:20px;color:#555;font-size:14px;line-height:1.8;">
             <li>השלמת פרופיל מקצועי</li>
             <li>העלאת תמונות ומסמכים</li>
             <li>אימות זהות (KYC)</li>
             <li>אישור על ידי הצוות שלנו</li>
           </ol>
           <p style="margin:0 0 20px;color:#888;font-size:13px;">זמן טיפול ממוצע: 24-48 שעות עסקיות.</p>`
        : `<p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6;">Your provider ID:</p>
           <div style="background:#f0ead6;border:2px solid #c9a96e;border-radius:2px;padding:16px;text-align:center;margin:0 0 20px;">
             <span style="font-size:22px;font-weight:700;letter-spacing:2px;color:#1a1a1a;font-family:'Courier New',monospace;">${membershipNumber}</span>
           </div>
           <p style="margin:0 0 12px;color:#444;font-size:14px;line-height:1.6;">Next steps:</p>
           <ol style="margin:0 0 20px;padding-left:20px;color:#555;font-size:14px;line-height:1.8;">
             <li>Complete your professional profile</li>
             <li>Upload photos & documents</li>
             <li>Identity verification (KYC)</li>
             <li>Approval by our team</li>
           </ol>
           <p style="margin:0 0 20px;color:#888;font-size:13px;">Average processing time: 24-48 business hours.</p>`,
      cta: isHe ? 'התחילו את תהליך ההצטרפות' : 'Start Onboarding',
      ctaUrl: 'https://petwash.co.il/provider/onboarding',
    },
    staff_request: {
      title: isHe ? 'בקשתך להצטרפות לצוות התקבלה' : 'Staff Access Request Received',
      subtitle: isHe ? 'Pet Wash™ - צוות ההנהלה' : 'Pet Wash™ - Management Team',
      body: isHe
        ? `<p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6;">מספר הזיהוי שלך:</p>
           <div style="background:#f0ead6;border:2px solid #c9a96e;border-radius:2px;padding:16px;text-align:center;margin:0 0 20px;">
             <span style="font-size:22px;font-weight:700;letter-spacing:2px;color:#1a1a1a;font-family:'Courier New',monospace;">${membershipNumber}</span>
           </div>
           <p style="margin:0 0 12px;color:#444;font-size:14px;line-height:1.6;">הבקשה שלך מחכה לאישור מנהל. תקבלו הודעה ברגע שהבקשה תאושר.</p>
           <div style="background:#fef9c3;border:1px solid #fbbf24;border-radius:2px;padding:12px;margin:0 0 20px;">
             <p style="margin:0;color:#92400e;font-size:13px;">⚠️ גישה לממשק הצוות תינתן רק לאחר אישור מנהל מורשה.</p>
           </div>`
        : `<p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6;">Your staff ID:</p>
           <div style="background:#f0ead6;border:2px solid #c9a96e;border-radius:2px;padding:16px;text-align:center;margin:0 0 20px;">
             <span style="font-size:22px;font-weight:700;letter-spacing:2px;color:#1a1a1a;font-family:'Courier New',monospace;">${membershipNumber}</span>
           </div>
           <p style="margin:0 0 12px;color:#444;font-size:14px;line-height:1.6;">Your request is pending admin approval. You will be notified once approved.</p>
           <div style="background:#fef9c3;border:1px solid #fbbf24;border-radius:2px;padding:12px;margin:0 0 20px;">
             <p style="margin:0;color:#92400e;font-size:13px;">⚠️ Staff dashboard access requires authorization from a manager.</p>
           </div>`,
      cta: isHe ? 'בדקו סטטוס הבקשה' : 'Check Request Status',
      ctaUrl: 'https://petwash.co.il/staff/request-access',
    },
  };

  const c = content[audience];

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:2px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 50%,#1a1a1a 100%);padding:36px 32px;text-align:center;">
          ${logo}
        </td></tr>
        <tr><td style="padding:40px 32px 8px;text-align:center;">
          <h1 style="margin:0 0 8px;color:#1a1a1a;font-size:24px;font-weight:700;">${c.title}</h1>
          <p style="margin:0;color:#888;font-size:14px;font-weight:400;">${c.subtitle}</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          ${c.body}
          <div style="text-align:center;margin:28px 0 0;">
            <a href="${c.ctaUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#c9a96e,#b08d57);color:#ffffff;text-decoration:none;padding:14px 44px;border-radius:2px;font-size:16px;font-weight:600;letter-spacing:0.3px;">${c.cta}</a>
          </div>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #eee;text-align:center;">
          <p style="margin:0 0 8px;color:#bbb;font-size:11px;">© ${year} Pet Wash™. ${isHe ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
          <p style="margin:0;color:#ccc;font-size:10px;">${isHe ? 'אימייל זה נשלח אוטומטית. אין להשיב.' : 'This is an automated email. Do not reply.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export class WelcomeEmailService {
  static async sendWelcomeEmail(params: {
    audience: WelcomeAudience;
    toEmail: string;
    membershipNumber: string;
    userId?: string;
    language?: string;
    traceId?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const traceId = params.traceId || crypto.randomUUID().slice(0, 8);
    const language = params.language || 'he';
    const isHe = language === 'he';

    const subjectMap: Record<WelcomeAudience, string> = {
      public_customer: isHe ? `⁦Pet Wash™⁩ - ברוכים הבאים! ${params.membershipNumber}` : `⁦Pet Wash™⁩ - Welcome! ${params.membershipNumber}`,
      provider_applicant: isHe ? `⁦Pet Wash™⁩ - הרשמתך כנותן שירות התקבלה` : `⁦Pet Wash™⁩ - Provider Application Received`,
      staff_request: isHe ? `⁦Pet Wash™⁩ - בקשת גישה לצוות` : `⁦Pet Wash™⁩ - Staff Access Request`,
    };

    const html = getWelcomeHtml(params.audience, params.membershipNumber, language);

    try {
      const sent = await EmailService.send({
        to: params.toEmail,
        subject: subjectMap[params.audience],
        html,
      });

      await db.insert(emailAudit).values({
        emailType: `welcome_${params.audience}`,
        userId: params.userId || null,
        toEmail: params.toEmail,
        membershipNumber: params.membershipNumber,
        provider: 'sendgrid',
        status: sent ? 'sent' : 'failed',
        failureReason: sent ? null : 'SendGrid send returned false',
        traceId,
      });

      if (sent) {
        logger.info('[WelcomeEmail] Sent', {
          audience: params.audience,
          email: params.toEmail.slice(0, 3) + '***',
          membershipNumber: params.membershipNumber,
          traceId,
        });
      } else {
        logger.warn('[WelcomeEmail] Failed to send', {
          audience: params.audience,
          email: params.toEmail.slice(0, 3) + '***',
          traceId,
        });
      }

      return { success: sent };
    } catch (error: any) {
      logger.error('[WelcomeEmail] Error sending', { error: error.message, traceId });

      try {
        await db.insert(emailAudit).values({
          emailType: `welcome_${params.audience}`,
          userId: params.userId || null,
          toEmail: params.toEmail,
          membershipNumber: params.membershipNumber,
          provider: 'sendgrid',
          status: 'error',
          failureReason: error.message,
          traceId,
        });
      } catch {}

      return { success: false };
    }
  }
}
