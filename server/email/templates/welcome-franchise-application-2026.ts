import { PETWASH_LOGO_BASE64 } from './logo-base64';

interface FranchiseApplicationEmailData {
  firstName: string;
  lastName: string;
  email: string;
  language: 'he' | 'en';
  companyName?: string;
  country?: string;
  investmentRange?: string;
  applicationId?: string | number;
}

export function generateFranchiseApplicationEmail(data: FranchiseApplicationEmailData): { subject: string; html: string } {
  const isHebrew = data.language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  const submitDate = new Date().toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = isHebrew
    ? `בקשת הזכיינות שלך התקבלה, ${data.firstName} — ⁦Pet Wash™⁩ Global Franchise`
    : `Franchise Application Received, ${data.firstName} — ⁦Pet Wash™⁩ Global Franchise`;

  const html = `<!DOCTYPE html>
<html lang="${data.language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Georgia', 'Times New Roman', 'Palatino', serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
    <div style="background: #ffffff; border-radius: 2px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
      
      <div style="background: linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #7c3aed 100%); padding: 56px 40px; text-align: center; position: relative;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #c084fc, #c9a96e);"></div>
        <img src="${PETWASH_LOGO_BASE64}" alt="⁦Pet Wash™⁩" style="max-width: 150px; height: auto; margin-bottom: 24px;" />
        <h1 style="color: #ffffff; font-size: 28px; font-weight: 400; letter-spacing: 1.5px; margin: 0; font-family: 'Georgia', serif; text-shadow: 0 2px 8px rgba(0,0,0,0.15);">
          ${isHebrew ? 'בקשת זכיינות התקבלה' : 'Franchise Application Received'}
        </h1>
        <div style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 10px; letter-spacing: 3px; text-transform: uppercase;">
          Global Franchise Program
        </div>
        <div style="display: inline-block; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); color: #e9d5ff; padding: 8px 24px; border-radius: 2px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-top: 20px;">
          ${isHebrew ? 'שותף עסקי' : 'Business Partner'}
        </div>
      </div>
      
      <div style="height: 2px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #c084fc, #e8d5a3, #c9a96e);"></div>
      
      <div style="padding: 52px 44px;">
        <h2 style="font-size: 22px; color: #0f172a; margin: 0 0 28px; font-weight: 400; text-align: ${isHebrew ? 'right' : 'left'}; font-family: 'Georgia', serif;">
          ${isHebrew ? `שלום ${data.firstName},` : `Dear ${data.firstName},`}
        </h2>
        
        <div style="text-align: center; padding: 24px; margin: 28px 0; border-radius: 2px; background: linear-gradient(135deg, #faf5ff, #f3e8ff); border: 1px solid #e9d5ff;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #a855f7); margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
            <span style="color: #ffffff; font-size: 20px; font-weight: bold; line-height: 40px;">✓</span>
          </div>
          <h3 style="margin: 0 0 6px; font-size: 18px; color: #7c3aed; font-family: 'Georgia', serif; font-weight: 400;">
            ${isHebrew ? 'הבקשה התקבלה בהצלחה' : 'Application Successfully Received'}
          </h3>
          <p style="margin: 0; font-size: 13px; color: #6b21a8;">
            ${isHebrew ? 'הצוות שלנו יבדוק את הבקשה וייצור איתך קשר בהקדם.' : 'Our team will review your application and contact you shortly.'}
          </p>
        </div>
        
        <p style="font-size: 15px; line-height: 1.9; color: #475569; margin: 0 0 24px; text-align: ${isHebrew ? 'right' : 'left'};">
          ${isHebrew
            ? 'תודה על העניין שלך בתוכנית הזכיינות הבינלאומית של ⁦Pet Wash™⁩. אנו מעריכים את ההזדמנות לשתף פעולה איתך ולהרחיב את הרשת הגלובלית שלנו.'
            : 'Thank you for your interest in the ⁦Pet Wash™⁩ Global Franchise Program. We value the opportunity to partner with you and expand our global network.'}
        </p>
        
        <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 2px; padding: 28px; margin: 32px 0;">
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #7c3aed; margin: 0 0 20px; font-weight: 600; text-align: ${isHebrew ? 'right' : 'left'};">
            ${isHebrew ? 'פרטי הבקשה' : 'Application Details'}
          </h3>
          ${data.applicationId ? `
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? 'מספר בקשה:' : 'Application ID:'}</span>
            <span style="color: #0f172a; font-weight: 500; font-family: 'Courier New', monospace;">#${data.applicationId}</span>
          </div>
          ` : ''}
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? 'שם:' : 'Name:'}</span>
            <span style="color: #0f172a; font-weight: 500;">${data.firstName} ${data.lastName}</span>
          </div>
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? 'אימייל:' : 'Email:'}</span>
            <span style="color: #0f172a; font-weight: 500;">${data.email}</span>
          </div>
          ${data.companyName ? `
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? 'שם החברה:' : 'Company:'}</span>
            <span style="color: #0f172a; font-weight: 500;">${data.companyName}</span>
          </div>
          ` : ''}
          ${data.country ? `
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? 'מדינה:' : 'Country:'}</span>
            <span style="color: #0f172a; font-weight: 500;">${data.country}</span>
          </div>
          ` : ''}
          ${data.investmentRange ? `
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? 'טווח השקעה:' : 'Investment Range:'}</span>
            <span style="color: #7c3aed; font-weight: 500;">${data.investmentRange}</span>
          </div>
          ` : ''}
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? 'תאריך הגשה:' : 'Submit Date:'}</span>
            <span style="color: #0f172a; font-weight: 500;">${submitDate}</span>
          </div>
          <div style="padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? 'סטטוס:' : 'Status:'}</span>
            <span style="color: #b45309; font-weight: 600;">… ${isHebrew ? 'בבדיקה' : 'Under Review'}</span>
          </div>
        </div>
        
        <div style="background: linear-gradient(135deg, #faf5ff, #f3e8ff); border: 1px solid #e9d5ff; border-radius: 2px; padding: 32px; margin: 36px 0;">
          <h3 style="font-size: 16px; color: #0f172a; margin: 0 0 20px; text-align: ${isHebrew ? 'right' : 'left'}; font-family: 'Georgia', serif; font-weight: 400;">
            ${isHebrew ? 'מה כולל תוכנית הזכיינות' : 'What the Franchise Program Includes'}
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #581c87; border-bottom: 1px solid #e9d5ff; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #a855f7; font-size: 8px; top: 14px;">◆</span>
              ${isHebrew ? 'זכות שימוש בלעדית במותג ⁦Pet Wash™⁩ באזור שלך' : 'Exclusive ⁦Pet Wash™⁩ brand rights in your territory'}
            </td></tr>
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #581c87; border-bottom: 1px solid #e9d5ff; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #a855f7; font-size: 8px; top: 14px;">◆</span>
              ${isHebrew ? 'תחנות ⁦K9000™⁩ מתקדמות עם ניטור מרחוק' : 'Advanced ⁦K9000™⁩ stations with remote monitoring'}
            </td></tr>
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #581c87; border-bottom: 1px solid #e9d5ff; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #a855f7; font-size: 8px; top: 14px;">◆</span>
              ${isHebrew ? 'הדרכה מלאה והכשרה מקצועית' : 'Comprehensive training and professional certification'}
            </td></tr>
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #581c87; border-bottom: 1px solid #e9d5ff; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #a855f7; font-size: 8px; top: 14px;">◆</span>
              ${isHebrew ? 'תמיכה שיווקית ופרסום ארצי' : 'Marketing support and national advertising'}
            </td></tr>
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #581c87; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #a855f7; font-size: 8px; top: 14px;">◆</span>
              ${isHebrew ? 'גישה ללוח בקרה עסקי ודוחות בזמן אמת' : 'Access to business dashboard and real-time reporting'}
            </td></tr>
          </table>
        </div>
        
        <div style="margin: 36px 0;">
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #7c3aed; margin: 0 0 24px; font-weight: 600; text-align: ${isHebrew ? 'right' : 'left'};">
            ${isHebrew ? 'השלבים הבאים' : 'Next Steps'}
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 36px; vertical-align: top; padding: 8px 0;">
                <div style="width: 32px; height: 32px; border-radius: 2px; background: linear-gradient(135deg, #7c3aed, #a855f7); color: #ffffff; display: inline-block; text-align: center; line-height: 32px; font-size: 14px; font-weight: 600;">1</div>
              </td>
              <td style="padding: 8px 0 8px ${isHebrew ? '0' : '12px'}; padding-${isHebrew ? 'right' : 'left'}: 12px; vertical-align: top;">
                <h4 style="font-size: 14px; color: #0f172a; margin: 4px 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? 'סקירת הבקשה' : 'Application Review'}</h4>
                <p style="font-size: 13px; color: #64748b; margin: 4px 0 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? 'צוות הפיתוח העסקי שלנו יבדוק את הבקשה שלך תוך 5–7 ימי עסקים.' : 'Our business development team will review your application within 5–7 business days.'}</p>
              </td>
            </tr>
            <tr>
              <td style="width: 36px; vertical-align: top; padding: 8px 0;">
                <div style="width: 32px; height: 32px; border-radius: 2px; background: linear-gradient(135deg, #7c3aed, #a855f7); color: #ffffff; display: inline-block; text-align: center; line-height: 32px; font-size: 14px; font-weight: 600;">2</div>
              </td>
              <td style="padding: 8px 0 8px ${isHebrew ? '0' : '12px'}; padding-${isHebrew ? 'right' : 'left'}: 12px; vertical-align: top;">
                <h4 style="font-size: 14px; color: #0f172a; margin: 4px 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? 'שיחת היכרות' : 'Discovery Call'}</h4>
                <p style="font-size: 13px; color: #64748b; margin: 4px 0 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? 'נתאם שיחת וידאו כדי להכיר זה את זה ולענות על כל שאלותיך.' : 'We\'ll schedule a video call to get to know each other and answer your questions.'}</p>
              </td>
            </tr>
            <tr>
              <td style="width: 36px; vertical-align: top; padding: 8px 0;">
                <div style="width: 32px; height: 32px; border-radius: 2px; background: linear-gradient(135deg, #7c3aed, #a855f7); color: #ffffff; display: inline-block; text-align: center; line-height: 32px; font-size: 14px; font-weight: 600;">3</div>
              </td>
              <td style="padding: 8px 0 8px ${isHebrew ? '0' : '12px'}; padding-${isHebrew ? 'right' : 'left'}: 12px; vertical-align: top;">
                <h4 style="font-size: 14px; color: #0f172a; margin: 4px 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? 'הסכם זכיינות' : 'Franchise Agreement'}</h4>
                <p style="font-size: 13px; color: #64748b; margin: 4px 0 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? 'חתימה על הסכם זכיינות ותחילת תהליך ההקמה.' : 'Sign franchise agreement and begin the setup process.'}</p>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-${isHebrew ? 'right' : 'left'}: 3px solid #7c3aed; border-radius: 2px; padding: 20px 24px; margin: 28px 0;">
          <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 6px;">
            ${isHebrew ? 'שאלות?' : 'Questions?'}
          </strong>
          <span style="font-size: 13px; color: #475569; line-height: 1.7;">
            ${isHebrew
              ? 'אנא צור קשר עם צוות הפיתוח העסקי שלנו בכתובת franchise@petwash.co.il או התקשר ל-03-XXX-XXXX.'
              : 'Please contact our business development team at franchise@petwash.co.il or call +972-3-XXX-XXXX.'}
          </span>
        </div>
        
        <p style="font-size: 14px; text-align: center; font-style: italic; color: #94a3b8; line-height: 1.8; margin: 32px 0 0; font-family: 'Georgia', serif;">
          ${isHebrew
            ? 'אנחנו אוהבים את חיות המחמד שלנו, אבל הם אוהבים אותנו יותר.'
            : 'We love our pets, but they actually love us more.'}
        </p>
      </div>
      
      <div style="background: linear-gradient(160deg, #0f172a, #1e293b); padding: 36px 44px; text-align: center;">
        <p style="margin: 0;">
          <a href="https://petwash.co.il" style="color: #c4b5fd; text-decoration: none; font-size: 13px; letter-spacing: 0.5px;">petwash.co.il</a>
          <span style="color: rgba(255,255,255,0.2); margin: 0 8px;">│</span>
          <a href="mailto:franchise@petwash.co.il" style="color: #c4b5fd; text-decoration: none; font-size: 13px;">franchise@petwash.co.il</a>
        </p>
        <p style="color: rgba(255,255,255,0.3); font-size: 11px; line-height: 1.8; margin: 16px 0 0; letter-spacing: 0.5px;">
          © ${new Date().getFullYear()} ⁦Pet Wash™⁩. ${isHebrew ? 'כל הזכויות שמורות' : 'All rights reserved'}.<br>
          ${isHebrew ? 'מספר חברה' : 'Company No.'} 517145033 │ ${isHebrew ? 'רשומה בישראל' : 'Registered in Israel'}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
