/**
 * Registration Confirmation Email Templates - 2025
 * Different templates for different registration types:
 * - New User Sign Up
 * - Loyalty Program Enrollment
 * - Provider/Subcontractor Enrollment
 *
 * IMPORTANT: All styles are inlined. Email clients (Gmail, Outlook, Apple Mail) strip
 * <style> blocks, so class-based CSS never reaches the rendered email. Every element
 * that needs styling must carry a style="" attribute directly.
 */

import { PETWASH_LOGO_BASE64 } from './logo-base64';
import { SUPPORT_WHATSAPP_URL } from '../../../shared/support-contact';

interface NewUserEmailParams {
  firstName: string;
  email: string;
  language: 'he' | 'en';
}

interface LoyaltyEnrollmentEmailParams {
  firstName: string;
  email: string;
  tier: string;
  points: number;
  language: 'he' | 'en';
}

interface ProviderEnrollmentEmailParams {
  firstName: string;
  lastName: string;
  email: string;
  serviceTypes: string[];
  applicationId: number;
  language: 'he' | 'en';
}

const SERVICE_TYPE_LABELS: Record<string, { en: string; he: string; icon: string }> = {
  pet_sitting: { en: 'Pet Sitting', he: 'שמירה על חיות מחמד', icon: '🏠' },
  dog_walking: { en: 'Dog Walking', he: 'טיולי כלבים', icon: '🐕' },
  pet_transport: { en: 'Pet Transport', he: 'הסעות חיות מחמד', icon: '🚗' },
  grooming: { en: 'Grooming Services', he: 'שירותי טיפוח', icon: '✨' },
  training: { en: 'Pet Training', he: 'אילוף חיות מחמד', icon: '🎓' },
  wash_hub_operator: { en: '⁦K9000™⁩ Station Operator', he: 'מפעיל תחנת ⁦K9000™⁩', icon: '🚿' },
  veterinary_house_calls: { en: 'Home Vet Visits', he: 'ביקורי וטרינר בבית', icon: '🩺' },
};

/**
 * Generate New User Sign Up Confirmation Email
 */
export function generateNewUserConfirmationEmail(params: NewUserEmailParams): { subject: string; html: string } {
  const { firstName, email, language } = params;
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  const subject = isHebrew 
    ? `ברוכים הבאים ל-⁦Pet Wash™⁩, ${firstName}! 🐾`
    : `Welcome to ⁦Pet Wash™⁩, ${firstName}! 🐾`;

  const html = `
<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:0;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7C3AED,#EC4899);padding:40px 30px;text-align:center;">
            <img src="${PETWASH_LOGO_BASE64}" alt="⁦Pet Wash™⁩" style="max-width:180px;height:auto;margin-bottom:20px;display:block;margin-left:auto;margin-right:auto;" />
            <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:600;">${isHebrew ? 'ברוכים הבאים!' : 'Welcome!'}</h1>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:40px 30px;">
            <h2 style="color:#1F2937;margin:0 0 20px;font-size:24px;">${isHebrew ? `שלום ${firstName}!` : `Hello ${firstName}!`}</h2>
            <p style="color:#4B5563;line-height:1.6;margin:0 0 16px;">${isHebrew
              ? 'אנחנו שמחים שהצטרפת למשפחת ⁦Pet Wash™⁩. החשבון שלך פעיל ומוכן לשימוש.'
              : 'We\'re thrilled to have you join the ⁦Pet Wash™⁩ family. Your account is now active and ready to use.'
            }</p>
            <!-- Account details box -->
            <div style="background:linear-gradient(135deg,#F3E8FF,#FCE7F3);border-radius:12px;padding:24px;margin:24px 0;">
              <h3 style="color:#7C3AED;margin:0 0 12px;font-size:18px;">${isHebrew ? '📋 פרטי החשבון שלך' : '📋 Your Account Details'}</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:14px;">${isHebrew ? 'סוג רישום:' : 'Registration Type:'}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${isHebrew ? 'חשבון לקוח חדש' : 'New Customer Account'}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:14px;">${isHebrew ? 'אימייל:' : 'Email:'}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${email}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6B7280;font-size:14px;">${isHebrew ? 'תאריך הצטרפות:' : 'Join Date:'}</td>
                  <td style="padding:8px 0;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${new Date().toLocaleDateString(isHebrew ? 'he-IL' : 'en-US')}</td>
                </tr>
              </table>
            </div>
            <p style="color:#4B5563;line-height:1.6;margin:0 0 16px;">${isHebrew
              ? 'עכשיו תוכל לגשת לכל השירותים שלנו: תחנות שטיפה ⁦K9000™⁩, שירותי Pet Sitting, הליכות כלבים, הסעות חיות מחמד ועוד!'
              : 'You now have access to all our services: ⁦K9000™⁩ wash stations, Pet Sitting, Dog Walking, Pet Transport, and more!'
            }</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="https://petwash.co.il/loyalty" style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#EC4899);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:30px;font-weight:600;font-size:14px;">${isHebrew ? '🌟 הצטרף למועדון הנאמנות' : '🌟 Join the Loyalty Club'}</a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#1F2937;color:#9CA3AF;padding:30px;text-align:center;font-size:14px;">
            <p style="margin:0 0 16px;">${isHebrew ? 'תודה שבחרת ב-⁦Pet Wash™⁩' : 'Thank you for choosing ⁦Pet Wash™⁩'}</p>
            <div style="margin:20px 0 14px;">
              <a href="https://www.instagram.com/petwashltd" target="_blank" style="display:inline-block;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;">📷 Instagram</a>
              <a href="https://www.facebook.com/petwashltd" target="_blank" style="display:inline-block;background:#1877F2;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;">f Facebook</a>
              <a href="https://www.tiktok.com/@petwashltd" target="_blank" style="display:inline-block;background:#010101;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;border:1px solid #444;">♪ TikTok</a>
              <a href="${SUPPORT_WHATSAPP_URL}" target="_blank" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;">💬 WhatsApp</a>
            </div>
            <p style="margin:8px 0;"><a href="https://petwash.co.il" style="color:#EC4899;text-decoration:none;">petwash.co.il</a> | <a href="mailto:Support@PetWash.co.il" style="color:#EC4899;text-decoration:none;">Support@PetWash.co.il</a></p>
            <p style="font-size:11px;margin-top:10px;">
              <a href="https://petwash.co.il/privacy" style="color:#6B7280;text-decoration:none;margin:0 6px;">Privacy / פרטיות</a> ·
              <a href="https://petwash.co.il/terms" style="color:#6B7280;text-decoration:none;margin:0 6px;">Terms / תנאי שימוש</a>
            </p>
            <p style="font-size:12px;margin-top:12px;">© ${new Date().getFullYear()} ⁦Pet Wash™⁩. ${isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

/**
 * Generate Loyalty Program Enrollment Confirmation Email
 */
export function generateLoyaltyEnrollmentEmail(params: LoyaltyEnrollmentEmailParams): { subject: string; html: string } {
  const { firstName, email, tier, points, language } = params;
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  const tierLabels: Record<string, { en: string; he: string }> = {
    bronze: { en: 'Bronze', he: 'ארד' },
    silver: { en: 'Silver', he: 'כסף' },
    gold: { en: 'Gold', he: 'זהב' },
    platinum: { en: 'Platinum', he: 'פלטינום' },
    diamond: { en: 'Diamond', he: 'יהלום' },
    emerald: { en: 'Emerald', he: 'אמרלד' },
    royal: { en: '7-Star Royal', he: 'רויאל 7 כוכבים' },
  };

  const tierLabel = tierLabels[tier] || tierLabels.bronze;

  const subject = isHebrew 
    ? `🌟 ברוכים הבאים למועדון הנאמנות של ⁦Pet Wash™⁩!`
    : `🌟 Welcome to ⁦Pet Wash™⁩ Loyalty Club!`;

  const html = `
<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:0;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#F59E0B,#EF4444);padding:40px 30px;text-align:center;">
            <img src="${PETWASH_LOGO_BASE64}" alt="⁦Pet Wash™⁩" style="max-width:180px;height:auto;margin-bottom:20px;display:block;margin-left:auto;margin-right:auto;" />
            <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:600;">${isHebrew ? 'מועדון הנאמנות' : 'Loyalty Club'}</h1>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:40px 30px;">
            <h2 style="color:#1F2937;margin:0 0 20px;font-size:24px;">${isHebrew ? `${firstName}, הצטרפת למועדון!` : `${firstName}, You're In!`}</h2>
            <p style="color:#4B5563;line-height:1.6;margin:0 0 16px;">${isHebrew
              ? 'ברוכים הבאים למועדון הנאמנות היוקרתי של ⁦Pet Wash™⁩ עם מערכת 7 הכוכבים שלנו.'
              : 'Welcome to ⁦Pet Wash™⁩\'s exclusive 7-Star Loyalty Club.'
            }</p>
            <!-- Tier badge box -->
            <div style="background:linear-gradient(135deg,#FEF3C7,#FDE68A);border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
              <h3 style="color:#92400E;margin:0 0 12px;font-size:18px;">${isHebrew ? '🏆 הדרגה שלך' : '🏆 Your Tier'}</h3>
              <span style="display:inline-block;background:linear-gradient(135deg,#92400E,#D97706);color:#ffffff;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;">${isHebrew ? tierLabel.he : tierLabel.en}</span>
              <p style="margin-top:16px;color:#92400E;">${isHebrew ? `${points} נקודות` : `${points} Points`}</p>
            </div>
            <!-- Enrollment details box -->
            <div style="background:linear-gradient(135deg,#F3E8FF,#FCE7F3);border-radius:12px;padding:24px;margin:24px 0;">
              <h3 style="color:#7C3AED;margin:0 0 12px;font-size:18px;">${isHebrew ? '📋 פרטי ההרשמה' : '📋 Enrollment Details'}</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:14px;">${isHebrew ? 'סוג רישום:' : 'Registration Type:'}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${isHebrew ? 'הצטרפות למועדון נאמנות' : 'Loyalty Club Enrollment'}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:14px;">${isHebrew ? 'אימייל:' : 'Email:'}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${email}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:14px;">${isHebrew ? 'דרגה התחלתית:' : 'Starting Tier:'}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${isHebrew ? tierLabel.he : tierLabel.en}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6B7280;font-size:14px;">${isHebrew ? 'נקודות:' : 'Points:'}</td>
                  <td style="padding:8px 0;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${points}</td>
                </tr>
              </table>
            </div>
            <p style="color:#4B5563;line-height:1.6;margin:0 0 16px;">${isHebrew
              ? 'צבור נקודות עם כל שימוש בשירותינו וטפס בסולם 7 הכוכבים לקבלת הטבות בלעדיות!'
              : 'Earn points with every service and climb our 7-Star ladder for exclusive benefits!'
            }</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="https://petwash.co.il/loyalty/dashboard" style="display:inline-block;background:linear-gradient(135deg,#F59E0B,#EF4444);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:30px;font-weight:600;font-size:14px;">${isHebrew ? '📊 צפה בלוח הבקרה שלך' : '📊 View Your Dashboard'}</a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#1F2937;color:#9CA3AF;padding:30px;text-align:center;font-size:14px;">
            <p style="margin:0 0 16px;">${isHebrew ? 'תודה שבחרת ב-⁦Pet Wash™⁩' : 'Thank you for choosing ⁦Pet Wash™⁩'}</p>
            <div style="margin:20px 0 14px;">
              <a href="https://www.instagram.com/petwashltd" target="_blank" style="display:inline-block;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;">📷 Instagram</a>
              <a href="https://www.facebook.com/petwashltd" target="_blank" style="display:inline-block;background:#1877F2;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;">f Facebook</a>
              <a href="https://www.tiktok.com/@petwashltd" target="_blank" style="display:inline-block;background:#010101;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;border:1px solid #444;">♪ TikTok</a>
              <a href="${SUPPORT_WHATSAPP_URL}" target="_blank" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;">💬 WhatsApp</a>
            </div>
            <p style="margin:8px 0;"><a href="https://petwash.co.il" style="color:#EC4899;text-decoration:none;">petwash.co.il</a> | <a href="mailto:Support@PetWash.co.il" style="color:#EC4899;text-decoration:none;">Support@PetWash.co.il</a></p>
            <p style="font-size:11px;margin-top:10px;">
              <a href="https://petwash.co.il/privacy" style="color:#6B7280;text-decoration:none;margin:0 6px;">Privacy / פרטיות</a> ·
              <a href="https://petwash.co.il/terms" style="color:#6B7280;text-decoration:none;margin:0 6px;">Terms / תנאי שימוש</a>
            </p>
            <p style="font-size:12px;margin-top:12px;">© ${new Date().getFullYear()} ⁦Pet Wash™⁩. ${isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

/**
 * Generate Provider/Subcontractor Enrollment Confirmation Email
 */
export function generateProviderEnrollmentEmail(params: ProviderEnrollmentEmailParams): { subject: string; html: string } {
  const { firstName, lastName, email, serviceTypes, applicationId, language } = params;
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  const subject = isHebrew 
    ? `✅ הבקשה שלך התקבלה - ⁦Pet Wash™⁩ Provider`
    : `✅ Application Received - ⁦Pet Wash™⁩ Provider`;

  const servicesHtml = serviceTypes.map(type => {
    const label = SERVICE_TYPE_LABELS[type] || { en: type, he: type, icon: '📋' };
    return `<div style="background:#F3F4F6;padding:12px 16px;border-radius:8px;margin-bottom:8px;font-size:14px;"><span style="font-size:20px;margin-${isHebrew ? 'left' : 'right'}:10px;">${label.icon}</span>${isHebrew ? label.he : label.en}</div>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:0;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#10B981,#059669);padding:40px 30px;text-align:center;">
            <img src="${PETWASH_LOGO_BASE64}" alt="⁦Pet Wash™⁩" style="max-width:180px;height:auto;margin-bottom:20px;display:block;margin-left:auto;margin-right:auto;" />
            <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:600;">${isHebrew ? 'הבקשה התקבלה!' : 'Application Received!'}</h1>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:40px 30px;">
            <h2 style="color:#1F2937;margin:0 0 20px;font-size:24px;">${isHebrew ? `שלום ${firstName}!` : `Hello ${firstName}!`}</h2>
            <p style="color:#4B5563;line-height:1.6;margin:0 0 16px;">${isHebrew
              ? 'תודה על הגשת הבקשה להצטרף לצוות נותני השירות של ⁦Pet Wash™⁩. קיבלנו את הבקשה שלך ונבדוק אותה בקרוב.'
              : 'Thank you for applying to join the ⁦Pet Wash™⁩ provider team. We\'ve received your application and will review it shortly.'
            }</p>
            <!-- Application details box -->
            <div style="background:linear-gradient(135deg,#D1FAE5,#A7F3D0);border-radius:12px;padding:24px;margin:24px 0;">
              <h3 style="color:#065F46;margin:0 0 12px;font-size:18px;">${isHebrew ? '📋 פרטי הבקשה' : '📋 Application Details'}</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #A7F3D0;color:#065F46;font-size:14px;">${isHebrew ? 'סוג רישום:' : 'Registration Type:'}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #A7F3D0;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${isHebrew ? 'בקשה להצטרפות כנותן שירות' : 'Provider/Subcontractor Application'}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #A7F3D0;color:#065F46;font-size:14px;">${isHebrew ? 'מספר בקשה:' : 'Application ID:'}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #A7F3D0;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">#${applicationId}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #A7F3D0;color:#065F46;font-size:14px;">${isHebrew ? 'שם:' : 'Name:'}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #A7F3D0;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${firstName} ${lastName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #A7F3D0;color:#065F46;font-size:14px;">${isHebrew ? 'אימייל:' : 'Email:'}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #A7F3D0;color:#1F2937;font-weight:500;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${email}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#065F46;font-size:14px;">${isHebrew ? 'סטטוס:' : 'Status:'}</td>
                  <td style="padding:8px 0;color:#F59E0B;font-weight:600;font-size:14px;text-align:${isHebrew ? 'left' : 'right'};">${isHebrew ? 'בבדיקה' : 'Under Review'}</td>
                </tr>
              </table>
            </div>
            <!-- Services box -->
            <div style="background:linear-gradient(135deg,#F3E8FF,#FCE7F3);border-radius:12px;padding:24px;margin:24px 0;">
              <h3 style="color:#7C3AED;margin:0 0 12px;font-size:18px;">${isHebrew ? '🛠️ שירותים שבחרת' : '🛠️ Services Selected'}</h3>
              ${servicesHtml}
            </div>
            <p style="color:#4B5563;line-height:1.6;margin:0 0 16px;">${isHebrew
              ? 'השלבים הבאים: נבדוק את הפרטים שלך, ייתכן שנבקש מסמכים נוספים, ונחזור אליך תוך 2-3 ימי עסקים.'
              : 'Next steps: We\'ll review your details, may request additional documents, and will get back to you within 2-3 business days.'
            }</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="https://petwash.co.il/my-applications" style="display:inline-block;background:linear-gradient(135deg,#10B981,#059669);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:30px;font-weight:600;font-size:14px;">${isHebrew ? '📊 עקוב אחר הבקשה' : '📊 Track Your Application'}</a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#1F2937;color:#9CA3AF;padding:30px;text-align:center;font-size:14px;">
            <p style="margin:0 0 16px;">${isHebrew ? 'תודה שבחרת להצטרף לצוות ⁦Pet Wash™⁩' : 'Thank you for joining the ⁦Pet Wash™⁩ team'}</p>
            <div style="margin:20px 0 14px;">
              <a href="https://www.instagram.com/petwashltd" target="_blank" style="display:inline-block;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;">📷 Instagram</a>
              <a href="https://www.facebook.com/petwashltd" target="_blank" style="display:inline-block;background:#1877F2;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;">f Facebook</a>
              <a href="https://www.tiktok.com/@petwashltd" target="_blank" style="display:inline-block;background:#010101;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;border:1px solid #444;">♪ TikTok</a>
              <a href="${SUPPORT_WHATSAPP_URL}" target="_blank" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:bold;margin:0 4px 6px;">💬 WhatsApp</a>
            </div>
            <p style="margin:8px 0;"><a href="https://petwash.co.il" style="color:#EC4899;text-decoration:none;">petwash.co.il</a> | <a href="mailto:Support@PetWash.co.il" style="color:#EC4899;text-decoration:none;">Support@PetWash.co.il</a></p>
            <p style="font-size:11px;margin-top:10px;">
              <a href="https://petwash.co.il/privacy" style="color:#6B7280;text-decoration:none;margin:0 6px;">Privacy / פרטיות</a> ·
              <a href="https://petwash.co.il/terms" style="color:#6B7280;text-decoration:none;margin:0 6px;">Terms / תנאי שימוש</a>
            </p>
            <p style="font-size:12px;margin-top:12px;">© ${new Date().getFullYear()} ⁦Pet Wash™⁩. ${isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
