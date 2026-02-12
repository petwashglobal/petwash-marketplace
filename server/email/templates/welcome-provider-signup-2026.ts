import { PETWASH_LOGO_BASE64 } from './logo-base64';

interface ProviderWelcomeEmailData {
  firstName: string;
  lastName: string;
  email: string;
  language: 'he' | 'en';
  providerType: string;
  applicationId: string | number;
  serviceTypes?: string[];
  autoApproved?: boolean;
}

const PROVIDER_TYPE_LABELS: Record<string, { en: string; he: string; icon: string }> = {
  pet_sitting: { en: 'Pet Sitter', he: 'שמרטף/ית', icon: '🏠' },
  dog_walking: { en: 'Dog Walker', he: 'מטייל/ת כלבים', icon: '🐕' },
  pet_transport: { en: 'Pet Transport Driver', he: 'נהג/ת הסעות', icon: '🚗' },
  grooming: { en: 'Groomer', he: 'מטפח/ת', icon: '✨' },
  training: { en: 'Pet Trainer', he: 'מאלף/ת', icon: '🎓' },
  wash_hub_operator: { en: 'K9000™ Station Operator', he: 'מפעיל/ת תחנת K9000™', icon: '🚿' },
  veterinary_house_calls: { en: 'Home Vet', he: 'וטרינר/ית בבית', icon: '🩺' },
};

export function generateProviderWelcomeEmail(data: ProviderWelcomeEmailData): { subject: string; html: string } {
  const isHebrew = data.language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  const joinDate = new Date().toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const providerLabel = PROVIDER_TYPE_LABELS[data.providerType] || { en: data.providerType, he: data.providerType, icon: '📋' };

  const subject = isHebrew
    ? `ברוכים הבאים לצוות Pet Wash™, ${data.firstName}! הבקשה שלך ${data.autoApproved ? 'אושרה' : 'התקבלה'} 🎉`
    : `Welcome to Pet Wash™ Team, ${data.firstName}! Application ${data.autoApproved ? 'Approved' : 'Received'} 🎉`;

  const servicesHtml = (data.serviceTypes || [data.providerType]).map(type => {
    const label = PROVIDER_TYPE_LABELS[type] || { en: type, he: type, icon: '📋' };
    return `<div style="display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 2px; padding: 8px 16px; margin: 4px; font-size: 13px; color: #166534;">${label.icon} ${isHebrew ? label.he : label.en}</div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="${data.language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8f9fa; font-family: 'Georgia', 'Times New Roman', serif; }
    .wrapper { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 2px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%); padding: 48px 40px; text-align: center; }
    .header img { max-width: 160px; height: auto; margin-bottom: 20px; }
    .header h1 { color: #ffffff; font-size: 26px; font-weight: 400; letter-spacing: 1px; margin: 0; font-family: 'Georgia', serif; }
    .header .subtitle { color: rgba(255,255,255,0.7); font-size: 14px; margin-top: 8px; letter-spacing: 2px; text-transform: uppercase; }
    .header .badge { display: inline-block; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: #ffffff; padding: 6px 20px; border-radius: 2px; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 16px; }
    .emerald-bar { height: 3px; background: linear-gradient(90deg, #10b981, #6ee7b7, #10b981); }
    .body { padding: 48px 40px; }
    .greeting { font-size: 22px; color: #064e3b; margin: 0 0 24px; font-weight: 400; text-align: ${isHebrew ? 'right' : 'left'}; }
    .message { font-size: 15px; line-height: 1.8; color: #4a5568; margin: 0 0 20px; text-align: ${isHebrew ? 'right' : 'left'}; }
    .status-banner { text-align: center; padding: 20px; margin: 24px 0; border-radius: 2px; }
    .status-approved { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1px solid #a7f3d0; }
    .status-pending { background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 1px solid #fde68a; }
    .status-banner h3 { margin: 0 0 4px; font-size: 18px; }
    .status-banner p { margin: 0; font-size: 13px; }
    .detail-box { background: #fafbfc; border: 1px solid #e8ecf1; border-radius: 2px; padding: 24px; margin: 28px 0; }
    .detail-box h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #064e3b; margin: 0 0 16px; font-weight: 600; text-align: ${isHebrew ? 'right' : 'left'}; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f2f5; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''} }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #718096; }
    .detail-value { color: #064e3b; font-weight: 500; }
    .dashboard-section { background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid #bbf7d0; border-radius: 2px; padding: 28px; margin: 32px 0; }
    .dashboard-section h3 { font-size: 16px; color: #064e3b; margin: 0 0 16px; text-align: ${isHebrew ? 'right' : 'left'}; }
    .feature-list { list-style: none; padding: 0; margin: 0; }
    .feature-list li { font-size: 14px; color: #166534; padding: 8px 0; padding-${isHebrew ? 'right' : 'left'}: 28px; position: relative; border-bottom: 1px solid #d1fae5; }
    .feature-list li:last-child { border-bottom: none; }
    .feature-list li::before { content: '◆'; position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #10b981; font-size: 10px; top: 12px; }
    .commission-note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 2px; padding: 16px 20px; margin: 24px 0; font-size: 13px; color: #92400e; text-align: ${isHebrew ? 'right' : 'left'}; }
    .cta-section { text-align: center; margin: 36px 0; }
    .cta-button { display: inline-block; background: #064e3b; color: #a7f3d0; text-decoration: none; padding: 14px 40px; border-radius: 2px; font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    .cta-button.secondary { background: transparent; border: 1px solid #064e3b; color: #064e3b; margin-${isHebrew ? 'right' : 'left'}: 12px; }
    .steps-section { margin: 32px 0; }
    .steps-section h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #064e3b; margin: 0 0 20px; font-weight: 600; text-align: ${isHebrew ? 'right' : 'left'}; }
    .step { display: flex; align-items: flex-start; margin-bottom: 16px; ${isHebrew ? 'flex-direction: row-reverse;' : ''} }
    .step-number { width: 32px; height: 32px; border-radius: 50%; background: #064e3b; color: #a7f3d0; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0; }
    .step-content { margin-${isHebrew ? 'right' : 'left'}: 16px; flex: 1; }
    .step-content h4 { font-size: 14px; color: #064e3b; margin: 4px 0; text-align: ${isHebrew ? 'right' : 'left'}; }
    .step-content p { font-size: 13px; color: #718096; margin: 4px 0 0; text-align: ${isHebrew ? 'right' : 'left'}; }
    .footer { background: #064e3b; padding: 32px 40px; text-align: center; }
    .footer p { color: rgba(255,255,255,0.5); font-size: 12px; line-height: 1.8; margin: 0; }
    .footer a { color: #6ee7b7; text-decoration: none; }
    .social-row { margin: 16px 0; }
    .social-row a { display: inline-block; margin: 0 8px; font-size: 20px; text-decoration: none; }
    @media (max-width: 600px) {
      .body { padding: 32px 24px; }
      .cta-button { display: block; margin: 8px 0; }
      .cta-button.secondary { margin: 8px 0 0; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <img src="${PETWASH_LOGO_BASE64}" alt="Pet Wash™" />
        <h1>${isHebrew ? 'ברוכים הבאים לצוות' : 'Welcome to the Team'}</h1>
        <div class="subtitle">${isHebrew ? 'נותני שירות מקצועיים' : 'Professional Service Providers'}</div>
        <div class="badge">${providerLabel.icon} ${isHebrew ? providerLabel.he : providerLabel.en}</div>
      </div>
      
      <div class="emerald-bar"></div>
      
      <div class="body">
        <h2 class="greeting">${isHebrew ? `שלום ${data.firstName},` : `Dear ${data.firstName},`}</h2>
        
        ${data.autoApproved ? `
        <div class="status-banner status-approved">
          <h3 style="color: #065f46;">✅ ${isHebrew ? 'הבקשה אושרה!' : 'Application Approved!'}</h3>
          <p style="color: #047857;">${isHebrew ? 'ברכות! החשבון שלך פעיל ומוכן לקבלת הזמנות.' : 'Congratulations! Your account is active and ready to receive bookings.'}</p>
        </div>
        ` : `
        <div class="status-banner status-pending">
          <h3 style="color: #92400e;">⏳ ${isHebrew ? 'הבקשה בבדיקה' : 'Application Under Review'}</h3>
          <p style="color: #a16207;">${isHebrew ? 'המסמכים שלך נבדקים. נחזור אליך תוך 2-3 ימי עסקים.' : 'Your documents are being reviewed. We\'ll get back to you within 2-3 business days.'}</p>
        </div>
        `}
        
        <p class="message">
          ${isHebrew
            ? `תודה שהצטרפת לצוות נותני השירות של Pet Wash™. כנותן שירות מקצועי, תקבל גישה ללוח בקרה ייעודי עם כל הכלים שאתה צריך לנהל את העסק שלך.`
            : `Thank you for joining the Pet Wash™ provider team. As a professional service provider, you'll get access to a dedicated dashboard with all the tools you need to manage your business.`}
        </p>
        
        <div class="detail-box">
          <h3>${isHebrew ? 'פרטי הבקשה' : 'Application Details'}</h3>
          <div class="detail-row">
            <span class="detail-label">${isHebrew ? 'מספר בקשה:' : 'Application ID:'}</span>
            <span class="detail-value">#${data.applicationId}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${isHebrew ? 'שם:' : 'Name:'}</span>
            <span class="detail-value">${data.firstName} ${data.lastName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${isHebrew ? 'אימייל:' : 'Email:'}</span>
            <span class="detail-value">${data.email}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${isHebrew ? 'תפקיד:' : 'Role:'}</span>
            <span class="detail-value">${isHebrew ? providerLabel.he : providerLabel.en}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${isHebrew ? 'תאריך הגשה:' : 'Submit Date:'}</span>
            <span class="detail-value">${joinDate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${isHebrew ? 'סטטוס:' : 'Status:'}</span>
            <span class="detail-value" style="color: ${data.autoApproved ? '#059669' : '#d97706'}; font-weight: 600;">
              ${data.autoApproved
                ? (isHebrew ? '✅ מאושר' : '✅ Approved')
                : (isHebrew ? '⏳ בבדיקה' : '⏳ Under Review')}
            </span>
          </div>
        </div>
        
        ${servicesHtml ? `
        <div style="margin: 24px 0; text-align: ${isHebrew ? 'right' : 'left'};">
          <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #064e3b; margin: 0 0 12px;">${isHebrew ? 'שירותים שנבחרו' : 'Selected Services'}</h3>
          ${servicesHtml}
        </div>
        ` : ''}
        
        <div class="dashboard-section">
          <h3>${isHebrew ? '🖥️ לוח הבקרה המקצועי שלך' : '🖥️ Your Professional Dashboard'}</h3>
          <p style="font-size: 14px; color: #047857; margin: 0 0 16px; text-align: ${isHebrew ? 'right' : 'left'};">
            ${isHebrew
              ? 'כנותן שירות ב-Pet Wash™ תקבל גישה ללוח בקרה מקצועי הכולל:'
              : 'As a Pet Wash™ provider you get access to a professional dashboard including:'}
          </p>
          <ul class="feature-list">
            <li>${isHebrew ? 'קבלת הזמנות חדשות בזמן אמת עם אישור כפול' : 'Receive new bookings in real-time with dual confirmation'}</li>
            <li>${isHebrew ? 'ניהול לוח זמנים ותאריכים' : 'Schedule and calendar management'}</li>
            <li>${isHebrew ? 'צפייה בהיסטוריית עבודות עם תאריכים ומזהי לקוחות' : 'View job history with dates and client IDs'}</li>
            <li>${isHebrew ? 'מעקב אחר הכנסות ותשלומים' : 'Track earnings and payments'}</li>
            <li>${isHebrew ? 'דירוגים וביקורות מלקוחות' : 'Ratings and reviews from clients'}</li>
            <li>${isHebrew ? 'ניהול מצב נוכחות (מקוון/לא מקוון)' : 'Manage online/offline availability status'}</li>
            <li>${isHebrew ? 'סטטיסטיקות ביצועים ודוחות' : 'Performance statistics and reports'}</li>
          </ul>
        </div>
        
        <div class="commission-note">
          <strong>${isHebrew ? '💰 מבנה עמלות:' : '💰 Commission Structure:'}</strong><br>
          ${isHebrew
            ? 'Pet Wash™ גובה עמלה קבועה של 15% על כל הזמנה. 85% מהתשלום מועבר ישירות אליך.'
            : 'Pet Wash™ charges a flat 15% commission on every booking. 85% of the payment goes directly to you.'}
        </div>
        
        ${!data.autoApproved ? `
        <div class="steps-section">
          <h3>${isHebrew ? 'השלבים הבאים' : 'Next Steps'}</h3>
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>${isHebrew ? 'אימות מסמכים' : 'Document Verification'}</h4>
              <p>${isHebrew ? 'הצוות שלנו בודק את המסמכים שהגשת' : 'Our team is reviewing your submitted documents'}</p>
            </div>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>${isHebrew ? 'אישור חשבון' : 'Account Approval'}</h4>
              <p>${isHebrew ? 'נעדכן אותך במייל ו-SMS ברגע שהחשבון יאושר' : 'We\'ll notify you via email and SMS once approved'}</p>
            </div>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>${isHebrew ? 'התחל לעבוד' : 'Start Working'}</h4>
              <p>${isHebrew ? 'התחבר ללוח הבקרה, הפעל מצב מקוון והתחל לקבל הזמנות' : 'Log into your dashboard, go online, and start receiving bookings'}</p>
            </div>
          </div>
        </div>
        ` : ''}
        
        <div class="cta-section">
          <a href="https://petwash.co.il/provider/dashboard" class="cta-button">
            ${isHebrew ? 'לוח הבקרה שלי' : 'My Dashboard'}
          </a>
          <a href="https://petwash.co.il/my-account" class="cta-button secondary">
            ${isHebrew ? 'החשבון שלי' : 'My Account'}
          </a>
        </div>
        
        <p class="message" style="text-align: center; font-style: italic; color: #718096;">
          ${isHebrew
            ? 'צוות Pet Wash™ כאן לתמוך בך בכל צעד. בהצלחה!'
            : 'The Pet Wash™ team is here to support you every step of the way. Good luck!'}
        </p>
      </div>
      
      <div class="footer">
        <div class="social-row">
          <a href="https://www.facebook.com/petwash" title="Facebook">📘</a>
          <a href="https://www.instagram.com/petwash" title="Instagram">📸</a>
          <a href="https://www.tiktok.com/@petwash" title="TikTok">🎵</a>
        </div>
        <p>
          <a href="https://petwash.co.il">petwash.co.il</a> &nbsp;|&nbsp; <a href="mailto:Support@PetWash.co.il">Support@PetWash.co.il</a>
        </p>
        <p style="margin-top: 12px;">
          © ${new Date().getFullYear()} Pet Wash™. ${isHebrew ? 'כל הזכויות שמורות' : 'All rights reserved'}.<br>
          ${isHebrew ? 'מספר חברה' : 'Company No.'} 517145033 | ${isHebrew ? 'רשומה בישראל' : 'Registered in Israel'}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}