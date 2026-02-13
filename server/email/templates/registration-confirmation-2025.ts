/**
 * Registration Confirmation Email Templates - 2025
 * Different templates for different registration types:
 * - New User Sign Up
 * - Loyalty Program Enrollment
 * - Provider/Subcontractor Enrollment
 */

import { PETWASH_LOGO_BASE64 } from './logo-base64';

const BRAND_COLORS = {
  primary: '#7C3AED', // Purple
  secondary: '#EC4899', // Pink
  gold: '#F59E0B',
  emerald: '#10B981',
  dark: '#1F2937',
  light: '#F9FAFB',
};

const baseStyles = `
  body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary}); padding: 40px 30px; text-align: center; }
  .logo { max-width: 180px; height: auto; margin-bottom: 20px; }
  .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
  .content { padding: 40px 30px; }
  .content h2 { color: ${BRAND_COLORS.dark}; margin: 0 0 20px; font-size: 24px; }
  .content p { color: #4B5563; line-height: 1.6; margin: 0 0 16px; }
  .highlight-box { background: linear-gradient(135deg, #F3E8FF, #FCE7F3); border-radius: 12px; padding: 24px; margin: 24px 0; }
  .highlight-box h3 { color: ${BRAND_COLORS.primary}; margin: 0 0 12px; font-size: 18px; }
  .details-list { list-style: none; padding: 0; margin: 0; }
  .details-list li { padding: 8px 0; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; }
  .details-list li:last-child { border-bottom: none; }
  .details-list .label { color: #6B7280; }
  .details-list .value { color: ${BRAND_COLORS.dark}; font-weight: 500; }
  .cta-button { display: inline-block; background: linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary}); color: white; text-decoration: none; padding: 16px 32px; border-radius: 30px; font-weight: 600; margin: 24px 0; }
  .footer { background: ${BRAND_COLORS.dark}; color: #9CA3AF; padding: 30px; text-align: center; font-size: 14px; }
  .footer a { color: ${BRAND_COLORS.secondary}; text-decoration: none; }
  .tier-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; }
  .tier-bronze { background: linear-gradient(135deg, #92400E, #D97706); color: white; }
  .services-grid { display: grid; gap: 12px; margin: 16px 0; }
  .service-item { background: #F3F4F6; padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; gap: 10px; }
  .service-icon { font-size: 20px; }
`;

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
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${PETWASH_LOGO_BASE64}" alt="⁦Pet Wash™⁩" class="logo" />
      <h1>${isHebrew ? 'ברוכים הבאים!' : 'Welcome!'}</h1>
    </div>
    
    <div class="content">
      <h2>${isHebrew ? `שלום ${firstName}!` : `Hello ${firstName}!`}</h2>
      
      <p>${isHebrew 
        ? 'אנחנו שמחים שהצטרפת למשפחת ⁦Pet Wash™⁩. החשבון שלך פעיל ומוכן לשימוש.'
        : 'We\'re thrilled to have you join the ⁦Pet Wash™⁩ family. Your account is now active and ready to use.'
      }</p>
      
      <div class="highlight-box">
        <h3>${isHebrew ? '📋 פרטי החשבון שלך' : '📋 Your Account Details'}</h3>
        <ul class="details-list">
          <li>
            <span class="label">${isHebrew ? 'סוג רישום:' : 'Registration Type:'}</span>
            <span class="value">${isHebrew ? 'חשבון לקוח חדש' : 'New Customer Account'}</span>
          </li>
          <li>
            <span class="label">${isHebrew ? 'אימייל:' : 'Email:'}</span>
            <span class="value">${email}</span>
          </li>
          <li>
            <span class="label">${isHebrew ? 'תאריך הצטרפות:' : 'Join Date:'}</span>
            <span class="value">${new Date().toLocaleDateString(isHebrew ? 'he-IL' : 'en-US')}</span>
          </li>
        </ul>
      </div>
      
      <p>${isHebrew 
        ? 'עכשיו תוכל לגשת לכל השירותים שלנו: תחנות שטיפה ⁦K9000™⁩, שירותי Pet Sitting, הליכות כלבים, הסעות חיות מחמד ועוד!'
        : 'You now have access to all our services: ⁦K9000™⁩ wash stations, Pet Sitting, Dog Walking, Pet Transport, and more!'
      }</p>
      
      <center>
        <a href="https://petwash.co.il/loyalty" class="cta-button">
          ${isHebrew ? '🌟 הצטרף למועדון הנאמנות' : '🌟 Join the Loyalty Club'}
        </a>
      </center>
    </div>
    
    <div class="footer">
      <p>${isHebrew ? 'תודה שבחרת ב-⁦Pet Wash™⁩' : 'Thank you for choosing ⁦Pet Wash™⁩'}</p>
      <p><a href="https://petwash.co.il">petwash.co.il</a> | <a href="mailto:Support@PetWash.co.il">Support@PetWash.co.il</a></p>
      <p style="font-size: 12px; margin-top: 16px;">© ${new Date().getFullYear()} ⁦Pet Wash™⁩. ${isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
    </div>
  </div>
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
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #F59E0B, #EF4444);">
      <img src="${PETWASH_LOGO_BASE64}" alt="⁦Pet Wash™⁩" class="logo" />
      <h1>${isHebrew ? 'מועדון הנאמנות' : 'Loyalty Club'}</h1>
    </div>
    
    <div class="content">
      <h2>${isHebrew ? `${firstName}, הצטרפת למועדון!` : `${firstName}, You're In!`}</h2>
      
      <p>${isHebrew 
        ? 'ברוכים הבאים למועדון הנאמנות היוקרתי של ⁦Pet Wash™⁩ עם מערכת 7 הכוכבים שלנו.'
        : 'Welcome to ⁦Pet Wash™⁩\'s exclusive 7-Star Loyalty Club.'
      }</p>
      
      <div class="highlight-box" style="background: linear-gradient(135deg, #FEF3C7, #FDE68A); text-align: center;">
        <h3 style="color: #92400E;">${isHebrew ? '🏆 הדרגה שלך' : '🏆 Your Tier'}</h3>
        <span class="tier-badge tier-bronze">${isHebrew ? tierLabel.he : tierLabel.en}</span>
        <p style="margin-top: 16px; color: #92400E;">
          ${isHebrew ? `${points} נקודות` : `${points} Points`}
        </p>
      </div>
      
      <div class="highlight-box">
        <h3>${isHebrew ? '📋 פרטי ההרשמה' : '📋 Enrollment Details'}</h3>
        <ul class="details-list">
          <li>
            <span class="label">${isHebrew ? 'סוג רישום:' : 'Registration Type:'}</span>
            <span class="value">${isHebrew ? 'הצטרפות למועדון נאמנות' : 'Loyalty Club Enrollment'}</span>
          </li>
          <li>
            <span class="label">${isHebrew ? 'אימייל:' : 'Email:'}</span>
            <span class="value">${email}</span>
          </li>
          <li>
            <span class="label">${isHebrew ? 'דרגה התחלתית:' : 'Starting Tier:'}</span>
            <span class="value">${isHebrew ? tierLabel.he : tierLabel.en}</span>
          </li>
          <li>
            <span class="label">${isHebrew ? 'נקודות:' : 'Points:'}</span>
            <span class="value">${points}</span>
          </li>
        </ul>
      </div>
      
      <p>${isHebrew 
        ? 'צבור נקודות עם כל שימוש בשירותינו וטפס בסולם 7 הכוכבים לקבלת הטבות בלעדיות!'
        : 'Earn points with every service and climb our 7-Star ladder for exclusive benefits!'
      }</p>
      
      <center>
        <a href="https://petwash.co.il/loyalty/dashboard" class="cta-button" style="background: linear-gradient(135deg, #F59E0B, #EF4444);">
          ${isHebrew ? '📊 צפה בלוח הבקרה שלך' : '📊 View Your Dashboard'}
        </a>
      </center>
    </div>
    
    <div class="footer">
      <p>${isHebrew ? 'תודה שבחרת ב-⁦Pet Wash™⁩' : 'Thank you for choosing ⁦Pet Wash™⁩'}</p>
      <p><a href="https://petwash.co.il">petwash.co.il</a> | <a href="mailto:Support@PetWash.co.il">Support@PetWash.co.il</a></p>
      <p style="font-size: 12px; margin-top: 16px;">© ${new Date().getFullYear()} ⁦Pet Wash™⁩. ${isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
    </div>
  </div>
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
    return `
      <div class="service-item">
        <span class="service-icon">${label.icon}</span>
        <span>${isHebrew ? label.he : label.en}</span>
      </div>
    `;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #10B981, #059669);">
      <img src="${PETWASH_LOGO_BASE64}" alt="⁦Pet Wash™⁩" class="logo" />
      <h1>${isHebrew ? 'הבקשה התקבלה!' : 'Application Received!'}</h1>
    </div>
    
    <div class="content">
      <h2>${isHebrew ? `שלום ${firstName}!` : `Hello ${firstName}!`}</h2>
      
      <p>${isHebrew 
        ? 'תודה על הגשת הבקשה להצטרף לצוות נותני השירות של ⁦Pet Wash™⁩. קיבלנו את הבקשה שלך ונבדוק אותה בקרוב.'
        : 'Thank you for applying to join the ⁦Pet Wash™⁩ provider team. We\'ve received your application and will review it shortly.'
      }</p>
      
      <div class="highlight-box" style="background: linear-gradient(135deg, #D1FAE5, #A7F3D0);">
        <h3 style="color: #065F46;">${isHebrew ? '📋 פרטי הבקשה' : '📋 Application Details'}</h3>
        <ul class="details-list">
          <li>
            <span class="label">${isHebrew ? 'סוג רישום:' : 'Registration Type:'}</span>
            <span class="value">${isHebrew ? 'בקשה להצטרפות כנותן שירות' : 'Provider/Subcontractor Application'}</span>
          </li>
          <li>
            <span class="label">${isHebrew ? 'מספר בקשה:' : 'Application ID:'}</span>
            <span class="value">#${applicationId}</span>
          </li>
          <li>
            <span class="label">${isHebrew ? 'שם:' : 'Name:'}</span>
            <span class="value">${firstName} ${lastName}</span>
          </li>
          <li>
            <span class="label">${isHebrew ? 'אימייל:' : 'Email:'}</span>
            <span class="value">${email}</span>
          </li>
          <li>
            <span class="label">${isHebrew ? 'סטטוס:' : 'Status:'}</span>
            <span class="value" style="color: #F59E0B; font-weight: 600;">${isHebrew ? 'בבדיקה' : 'Under Review'}</span>
          </li>
        </ul>
      </div>
      
      <div class="highlight-box">
        <h3>${isHebrew ? '🛠️ שירותים שבחרת' : '🛠️ Services Selected'}</h3>
        <div class="services-grid">
          ${servicesHtml}
        </div>
      </div>
      
      <p>${isHebrew 
        ? 'השלבים הבאים:\n• נבדוק את הפרטים שלך\n• ייתכן שנבקש מסמכים נוספים\n• נחזור אליך תוך 2-3 ימי עסקים'
        : 'Next steps:\n• We\'ll review your details\n• We may request additional documents\n• We\'ll get back to you within 2-3 business days'
      }</p>
      
      <center>
        <a href="https://petwash.co.il/my-applications" class="cta-button" style="background: linear-gradient(135deg, #10B981, #059669);">
          ${isHebrew ? '📊 עקוב אחר הבקשה' : '📊 Track Your Application'}
        </a>
      </center>
    </div>
    
    <div class="footer">
      <p>${isHebrew ? 'תודה שבחרת להצטרף לצוות ⁦Pet Wash™⁩' : 'Thank you for joining the ⁦Pet Wash™⁩ team'}</p>
      <p><a href="https://petwash.co.il">petwash.co.il</a> | <a href="mailto:Support@PetWash.co.il">Support@PetWash.co.il</a></p>
      <p style="font-size: 12px; margin-top: 16px;">© ${new Date().getFullYear()} ⁦Pet Wash™⁩. ${isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
