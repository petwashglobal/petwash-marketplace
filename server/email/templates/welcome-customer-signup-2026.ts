import { PETWASH_LOGO_BASE64 } from './logo-base64';

interface CustomerWelcomeEmailData {
  firstName: string;
  lastName: string;
  email: string;
  language: 'he' | 'en';
  loyaltyTier?: string;
  petType?: string;
}

export function generateCustomerWelcomeEmail(data: CustomerWelcomeEmailData): { subject: string; html: string } {
  const isHebrew = data.language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  const joinDate = new Date().toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = isHebrew
    ? `ברוכים הבאים ל-Pet Wash™, ${data.firstName}! החשבון שלך פעיל 🐾`
    : `Welcome to Pet Wash™, ${data.firstName}! Your Account is Active 🐾`;

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
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 48px 40px; text-align: center; }
    .header img { max-width: 160px; height: auto; margin-bottom: 20px; }
    .header h1 { color: #ffffff; font-size: 26px; font-weight: 400; letter-spacing: 1px; margin: 0; font-family: 'Georgia', serif; }
    .header .subtitle { color: rgba(255,255,255,0.7); font-size: 14px; margin-top: 8px; letter-spacing: 2px; text-transform: uppercase; }
    .gold-bar { height: 3px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #c9a96e); }
    .body { padding: 48px 40px; }
    .greeting { font-size: 22px; color: #1a1a2e; margin: 0 0 24px; font-weight: 400; text-align: ${isHebrew ? 'right' : 'left'}; }
    .message { font-size: 15px; line-height: 1.8; color: #4a5568; margin: 0 0 20px; text-align: ${isHebrew ? 'right' : 'left'}; }
    .detail-box { background: #fafbfc; border: 1px solid #e8ecf1; border-radius: 2px; padding: 24px; margin: 28px 0; }
    .detail-box h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #1a1a2e; margin: 0 0 16px; font-weight: 600; text-align: ${isHebrew ? 'right' : 'left'}; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f2f5; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''} }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #718096; }
    .detail-value { color: #1a1a2e; font-weight: 500; }
    .services-section { margin: 32px 0; }
    .services-section h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #1a1a2e; margin: 0 0 20px; font-weight: 600; text-align: ${isHebrew ? 'right' : 'left'}; }
    .service-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .service-item { background: #fafbfc; border: 1px solid #e8ecf1; border-radius: 2px; padding: 16px; text-align: center; }
    .service-icon { font-size: 28px; margin-bottom: 8px; }
    .service-name { font-size: 13px; color: #1a1a2e; font-weight: 500; }
    .service-desc { font-size: 11px; color: #718096; margin-top: 4px; }
    .cta-section { text-align: center; margin: 36px 0; }
    .cta-button { display: inline-block; background: #1a1a2e; color: #e8d5a3; text-decoration: none; padding: 14px 40px; border-radius: 2px; font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    .cta-button.secondary { background: transparent; border: 1px solid #1a1a2e; color: #1a1a2e; margin-${isHebrew ? 'right' : 'left'}: 12px; }
    .access-note { background: linear-gradient(135deg, #fff9e6, #fff3cc); border-${isHebrew ? 'right' : 'left'}: 3px solid #c9a96e; padding: 20px 24px; margin: 28px 0; border-radius: 2px; }
    .access-note h4 { font-size: 14px; color: #8b6914; margin: 0 0 8px; text-align: ${isHebrew ? 'right' : 'left'}; }
    .access-note p { font-size: 13px; color: #92742e; line-height: 1.6; margin: 0; text-align: ${isHebrew ? 'right' : 'left'}; }
    .access-list { list-style: none; padding: 0; margin: 12px 0 0; }
    .access-list li { font-size: 13px; color: #92742e; padding: 4px 0; padding-${isHebrew ? 'right' : 'left'}: 20px; position: relative; }
    .access-list li::before { content: '✓'; position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #c9a96e; font-weight: bold; }
    .footer { background: #1a1a2e; padding: 32px 40px; text-align: center; }
    .footer p { color: rgba(255,255,255,0.5); font-size: 12px; line-height: 1.8; margin: 0; }
    .footer a { color: #e8d5a3; text-decoration: none; }
    .social-row { margin: 16px 0; }
    .social-row a { display: inline-block; margin: 0 8px; font-size: 20px; text-decoration: none; }
    @media (max-width: 600px) {
      .body { padding: 32px 24px; }
      .service-grid { grid-template-columns: 1fr; }
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
        <h1>${isHebrew ? 'ברוכים הבאים למשפחה' : 'Welcome to the Family'}</h1>
        <div class="subtitle">${isHebrew ? 'טיפוח יוקרתי לחיות מחמד' : 'Premium Organic Pet Care'}</div>
      </div>
      
      <div class="gold-bar"></div>
      
      <div class="body">
        <h2 class="greeting">${isHebrew ? `שלום ${data.firstName},` : `Dear ${data.firstName},`}</h2>
        
        <p class="message">
          ${isHebrew
            ? `תודה שהצטרפת ל-Pet Wash™. החשבון שלך נוצר בהצלחה ומוכן לשימוש. אנחנו שמחים לקבל אותך לקהילה שלנו של אוהבי חיות מחמד.`
            : `Thank you for joining Pet Wash™. Your account has been successfully created and is ready to use. We're delighted to welcome you to our community of pet lovers.`}
        </p>
        
        <div class="detail-box">
          <h3>${isHebrew ? 'פרטי החשבון' : 'Account Details'}</h3>
          <div class="detail-row">
            <span class="detail-label">${isHebrew ? 'סוג חשבון:' : 'Account Type:'}</span>
            <span class="detail-value">${isHebrew ? 'לקוח' : 'Customer'}</span>
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
            <span class="detail-label">${isHebrew ? 'תאריך הצטרפות:' : 'Join Date:'}</span>
            <span class="detail-value">${joinDate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${isHebrew ? 'דרגת נאמנות:' : 'Loyalty Tier:'}</span>
            <span class="detail-value" style="color: #c9a96e;">★ ${isHebrew ? 'חדש' : 'New Member'}</span>
          </div>
        </div>
        
        <div class="access-note">
          <h4>${isHebrew ? 'גישת הלקוח שלך כוללת:' : 'Your Customer Access Includes:'}</h4>
          <ul class="access-list">
            <li>${isHebrew ? 'הזמנת שירותי שטיפה בתחנות K9000™' : 'Book K9000™ wash station services'}</li>
            <li>${isHebrew ? 'רכישת חבילות שטיפה וכרטיסי מתנה' : 'Purchase wash packages and e-gift cards'}</li>
            <li>${isHebrew ? 'הזמנת שירותי שמרטפות, טיולים והסעות' : 'Book pet sitting, walking and transport services'}</li>
            <li>${isHebrew ? 'צבירת נקודות נאמנות בכל שימוש' : 'Earn loyalty points with every use'}</li>
            <li>${isHebrew ? 'ניהול החיות שלך וצפייה בהיסטוריית הזמנות' : 'Manage your pets and view booking history'}</li>
          </ul>
          <p style="margin-top: 12px; font-style: italic;">
            ${isHebrew
              ? 'מעוניין להציע שירותים? הגש בקשה להיות נותן שירות ותקבל גישה ללוח בקרה מקצועי.'
              : 'Interested in offering services? Apply to become a provider and unlock your professional dashboard.'}
          </p>
        </div>
        
        <div class="services-section">
          <h3>${isHebrew ? 'השירותים שלנו' : 'Our Services'}</h3>
          <div class="service-grid">
            <div class="service-item">
              <div class="service-icon">🚿</div>
              <div class="service-name">${isHebrew ? 'תחנות K9000™' : 'K9000™ Stations'}</div>
              <div class="service-desc">${isHebrew ? 'שטיפה עצמית אורגנית' : 'Organic self-wash'}</div>
            </div>
            <div class="service-item">
              <div class="service-icon">🏠</div>
              <div class="service-name">${isHebrew ? 'שמירה על חיות' : 'Pet Sitting'}</div>
              <div class="service-desc">${isHebrew ? 'שמרטפים מקצועיים' : 'Professional sitters'}</div>
            </div>
            <div class="service-item">
              <div class="service-icon">🐕</div>
              <div class="service-name">${isHebrew ? 'טיולי כלבים' : 'Dog Walking'}</div>
              <div class="service-desc">${isHebrew ? 'מטיילים מאומתים' : 'Verified walkers'}</div>
            </div>
            <div class="service-item">
              <div class="service-icon">🚗</div>
              <div class="service-name">${isHebrew ? 'הסעות' : 'Pet Transport'}</div>
              <div class="service-desc">${isHebrew ? 'הסעות בטוחות' : 'Safe transport'}</div>
            </div>
          </div>
        </div>
        
        <div class="cta-section">
          <a href="https://petwash.co.il/packages" class="cta-button">
            ${isHebrew ? 'חבילות שטיפה' : 'Wash Packages'}
          </a>
          <a href="https://petwash.co.il/loyalty" class="cta-button secondary">
            ${isHebrew ? 'מועדון נאמנות' : 'Loyalty Club'}
          </a>
        </div>
        
        <p class="message" style="text-align: center; font-style: italic; color: #718096;">
          ${isHebrew
            ? 'שאלות? צוות התמיכה שלנו כאן בשבילך תמיד.'
            : 'Questions? Our support team is always here for you.'}
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