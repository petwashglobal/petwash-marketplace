/**
 * Welcome Email for New Pet Owner Customers - 2025 Design
 * Warm, loving, creates emotional bond with brand
 */

interface WelcomeEmailData {
  firstName: string;
  email: string;
  petName?: string;
  petType?: string;
  language?: 'he' | 'en';
}

export function generateWelcomeEmail(data: WelcomeEmailData): { subject: string; html: string } {
  const isHebrew = data.language === 'he';
  
  const subject = isHebrew 
    ? `🐾 ברוכים הבאים למשפחת ⁦Pet Wash™⁩ - ${data.firstName}!`
    : `🐾 Welcome to the ⁦Pet Wash™⁩ Family, ${data.firstName}!`;
  
  const html = `
<!DOCTYPE html>
<html lang="${isHebrew ? 'he' : 'en'}" dir="${isHebrew ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Pet Wash</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 50%, #FCD34D 100%);
      padding: 30px 20px;
    }
    
    .container {
      max-width: 650px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    }
    
    .header {
      background: linear-gradient(135deg, #7C3AED 0%, #EC4899 100%);
      padding: 50px 40px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '🐾';
      position: absolute;
      font-size: 200px;
      opacity: 0.1;
      top: -40px;
      ${isHebrew ? 'left: -40px;' : 'right: -40px;'}
    }
    
    .logo {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 38px;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 15px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }
    
    .hero-image {
      font-size: 100px;
      margin: 20px 0;
      filter: drop-shadow(0 5px 15px rgba(0, 0, 0, 0.2));
    }
    
    .tagline {
      color: rgba(255, 255, 255, 0.95);
      font-size: 16px;
      font-weight: 400;
      letter-spacing: 1px;
    }
    
    .content {
      padding: 50px 45px;
    }
    
    .greeting {
      font-size: 28px;
      font-weight: 700;
      color: #1E293B;
      margin-bottom: 25px;
      text-align: center;
    }
    
    .pet-name {
      color: #EC4899;
      font-weight: 800;
    }
    
    .message {
      font-size: 17px;
      line-height: 1.8;
      color: #475569;
      margin-bottom: 25px;
      text-align: ${isHebrew ? 'right' : 'left'};
    }
    
    .message strong {
      color: #7C3AED;
      font-weight: 600;
    }
    
    .heart-box {
      background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
      border: 2px solid #FBBF24;
      border-radius: 20px;
      padding: 30px;
      margin: 35px 0;
      text-align: center;
    }
    
    .heart-icon {
      font-size: 50px;
      margin-bottom: 15px;
    }
    
    .heart-title {
      font-size: 22px;
      font-weight: 700;
      color: #92400E;
      margin-bottom: 12px;
    }
    
    .heart-text {
      font-size: 16px;
      color: #78350F;
      line-height: 1.7;
    }
    
    .benefits {
      margin: 40px 0;
    }
    
    .benefit-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 25px;
      padding: 20px;
      background: #F8FAFC;
      border-radius: 16px;
      ${isHebrew ? 'flex-direction: row-reverse;' : ''}
      ${isHebrew ? 'text-align: right;' : ''}
    }
    
    .benefit-icon {
      font-size: 36px;
      margin-${isHebrew ? 'left' : 'right'}: 20px;
      flex-shrink: 0;
    }
    
    .benefit-content h3 {
      font-size: 18px;
      font-weight: 700;
      color: #1E293B;
      margin-bottom: 8px;
    }
    
    .benefit-content p {
      font-size: 15px;
      color: #64748B;
      line-height: 1.6;
      margin: 0;
    }
    
    .cta-section {
      background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      margin: 40px 0;
    }
    
    .cta-title {
      font-size: 24px;
      font-weight: 700;
      color: #065F46;
      margin-bottom: 20px;
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      color: #FFFFFF;
      padding: 18px 45px;
      text-decoration: none;
      border-radius: 12px;
      font-size: 17px;
      font-weight: 700;
      margin: 15px 10px;
      box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
      transition: all 0.3s ease;
    }
    
    .cta-button:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 30px rgba(16, 185, 129, 0.4);
    }
    
    .promise-box {
      background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%);
      border-left: 4px solid #7C3AED;
      padding: 30px;
      border-radius: 16px;
      margin: 35px 0;
    }
    
    .promise-title {
      font-size: 20px;
      font-weight: 700;
      color: #5B21B6;
      margin-bottom: 15px;
      ${isHebrew ? 'text-align: right;' : ''}
    }
    
    .promise-list {
      list-style: none;
      padding: 0;
    }
    
    .promise-list li {
      font-size: 15px;
      color: #4C1D95;
      line-height: 2;
      padding-${isHebrew ? 'right' : 'left'}: 30px;
      position: relative;
    }
    
    .promise-list li::before {
      content: '✓';
      position: absolute;
      ${isHebrew ? 'right: 0;' : 'left: 0;'}
      color: #10B981;
      font-weight: 700;
      font-size: 18px;
    }
    
    .footer {
      background: #F8FAFC;
      padding: 40px;
      text-align: center;
      border-top: 1px solid #E2E8F0;
    }
    
    .footer-text {
      color: #64748B;
      font-size: 14px;
      line-height: 1.7;
      margin-bottom: 20px;
    }
    
    .social-links {
      margin: 25px 0;
    }
    
    .social-links a {
      display: inline-block;
      margin: 0 12px;
      font-size: 28px;
      text-decoration: none;
      transition: transform 0.3s ease;
    }
    
    .social-links a:hover {
      transform: scale(1.2);
    }
    
    @media (max-width: 600px) {
      .content {
        padding: 35px 25px;
      }
      
      .greeting {
        font-size: 24px;
      }
      
      .benefit-item {
        flex-direction: column;
        text-align: center;
      }
      
      .benefit-icon {
        margin: 0 0 15px 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">⁦Pet Wash™⁩</div>
      <div class="hero-image">${data.petType === 'cat' ? '🐱' : data.petType === 'dog' ? '🐶' : '🐾'}</div>
      <div class="tagline">${isHebrew ? 'טיפול אורגני פרימיום לחיות מחמד' : 'Premium Organic Pet Care'}</div>
    </div>
    
    <!-- Content -->
    <div class="content">
      <h1 class="greeting">
        ${isHebrew ? `שלום ${data.firstName}!` : `Hello ${data.firstName}!`}
        ${data.petName ? `<br><span class="pet-name">${isHebrew ? 'ו' : '&'}${data.petName}! 💜</span>` : ''}
      </h1>
      
      <p class="message">
        ${isHebrew 
          ? `אנחנו כל כך שמחים שהצטרפת למשפחת <strong>⁦Pet Wash™⁩</strong>! זה לא רק חברה, זו <strong>קהילה</strong> של אנשים שאוהבים את חיות המחמד שלהם מעל הכל.`
          : `We're absolutely <strong>thrilled</strong> to welcome you to the <strong>⁦Pet Wash™⁩ family</strong>! This isn't just a company — it's a <strong>community</strong> of people who love their pets more than anything.`}
      </p>
      
      <p class="message">
        ${isHebrew
          ? `כי אנחנו יודעים שהחיית מחמד שלך היא <strong>יותר ממשפחה</strong>. היא מקור האושר, החיבוק החם, והאהבה הבלתי מותנית בחיים שלך.`
          : `Because we know that your beloved pet is <strong>more than family</strong>. They're your source of joy, your warm hug, your unconditional love.`}
      </p>
      
      <!-- Heart Message -->
      <div class="heart-box">
        <div class="heart-icon">💛</div>
        <div class="heart-title">
          ${isHebrew ? 'האושר שלהם מתחיל עם ניקיון מושלם' : 'Their Happiness Starts with Perfect Cleanliness'}
        </div>
        <p class="heart-text">
          ${isHebrew
            ? `חיית מחמד נקייה היא חיית מחמד <strong>שמחה, בריאה ומרוצה</strong>. איכות החיים שלהם תלויה בנו, וב⁦Pet Wash™⁩ אנחנו עושים הכל בשביל שהם ירגישו מושלמים.`
            : `A clean pet is a <strong>happy, healthy, and content pet</strong>. Their quality of life depends on us, and at ⁦Pet Wash™⁩, we do everything to make them feel perfect.`}
        </p>
      </div>
      
      <!-- Benefits -->
      <div class="benefits">
        <div class="benefit-item">
          <div class="benefit-icon">🌿</div>
          <div class="benefit-content">
            <h3>${isHebrew ? 'מוצרים אורגניים 100%' : '100% Organic Products'}</h3>
            <p>${isHebrew 
              ? 'רק החומרים הטובים ביותר, עדינים ובטוחים לעור ולפרווה של חיית המחמד שלך'
              : 'Only the finest ingredients, gentle and safe for your pet\'s skin and fur'}</p>
          </div>
        </div>
        
        <div class="benefit-item">
          <div class="benefit-icon">🏆</div>
          <div class="benefit-content">
            <h3>${isHebrew ? 'טכנולוגיה מתקדמת' : 'Advanced Technology'}</h3>
            <p>${isHebrew
              ? 'עמדות שטיפה חכמות עם בקרת טמפרטורה, לחץ מים אופטימלי וייבוש מושלם'
              : 'Smart washing stations with temperature control, optimal water pressure, and perfect drying'}</p>
          </div>
        </div>
        
        <div class="benefit-item">
          <div class="benefit-icon">💚</div>
          <div class="benefit-content">
            <h3>${isHebrew ? 'שירות עצמי נוח' : 'Convenient Self-Service'}</h3>
            <p>${isHebrew
              ? 'שטפו את חיית המחמד שלכם בקצב שלכם, עם כל הציוד המקצועי במקום אחד'
              : 'Wash your pet at your own pace, with all professional equipment in one place'}</p>
          </div>
        </div>
        
        <div class="benefit-item">
          <div class="benefit-icon">🎁</div>
          <div class="benefit-content">
            <h3>${isHebrew ? 'תוכנית נאמנות מדהימה' : 'Amazing Loyalty Program'}</h3>
            <p>${isHebrew
              ? 'צברו נקודות בכל שטיפה, קבלו הנחות, מתנות והטבות בלעדיות'
              : 'Earn points with every wash, get discounts, gifts, and exclusive benefits'}</p>
          </div>
        </div>
      </div>
      
      <!-- Promise -->
      <div class="promise-box">
        <h3 class="promise-title">${isHebrew ? '💜 ההבטחה שלנו אליך' : '💜 Our Promise to You'}</h3>
        <ul class="promise-list">
          <li>${isHebrew ? 'נטפל בחיית המחמד שלך כאילו הייתה שלנו' : 'We\'ll care for your pet like they\'re our own'}</li>
          <li>${isHebrew ? 'מוצרים מהאיכות הגבוהה ביותר בלבד' : 'Only the highest quality products'}</li>
          <li>${isHebrew ? 'שירות לקוחות תמיד זמין בשבילך' : 'Customer service always available for you'}</li>
          <li>${isHebrew ? 'חוויה מושלמת בכל ביקור' : 'Perfect experience on every visit'}</li>
          <li>${isHebrew ? 'קהילה חמה ותומכת של אוהבי חיות' : 'Warm and supportive community of pet lovers'}</li>
        </ul>
      </div>
      
      <!-- CTA -->
      <div class="cta-section">
        <h2 class="cta-title">${isHebrew ? '🎉 מוכנים להתחיל?' : '🎉 Ready to Get Started?'}</h2>
        <p style="color: #047857; font-size: 16px; margin-bottom: 20px;">
          ${isHebrew
            ? 'מצא את התחנה הקרובה אליך ותן לחיית המחמד שלך את חוויית הניקיון שהיא מגיעה לה!'
            : 'Find the station nearest to you and give your pet the cleaning experience they deserve!'}
        </p>
        <a href="https://petwash.co.il/locations" class="cta-button">
          ${isHebrew ? '📍 מצא תחנה קרובה' : '📍 Find Nearest Station'}
        </a>
        <a href="https://petwash.co.il/packages" class="cta-button" style="background: linear-gradient(135deg, #7C3AED 0%, #6366F1 100%);">
          ${isHebrew ? '🎁 ראה מבצעים' : '🎁 View Offers'}
        </a>
      </div>
      
      <p class="message" style="text-align: center; margin-top: 35px;">
        ${isHebrew
          ? `תודה שבחרת ב-<strong>⁦Pet Wash™⁩</strong>. אנחנו כאן בשבילך ${data.petName ? `ובשביל ${data.petName}` : ''}, תמיד. 💜`
          : `Thank you for choosing <strong>⁦Pet Wash™⁩</strong>. We're here for you ${data.petName ? `and ${data.petName}` : ''}, always. 💜`}
      </p>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">
        ${isHebrew
          ? '🐾 ⁦Pet Wash™⁩ — היכן שטכנולוגיה פוגשת אהבה ללא תנאים'
          : '🐾 ⁦Pet Wash™⁩ — Where Technology Meets Unconditional Love'}
      </p>
      
      <div class="social-links">
        <a href="https://www.facebook.com/petwash" style="color: #3B82F6;" title="Facebook">📘</a>
        <a href="https://www.instagram.com/petwash" style="color: #EC4899;" title="Instagram">📸</a>
        <a href="https://www.tiktok.com/@petwash" style="color: #000000;" title="TikTok">🎵</a>
      </div>
      
      <p class="footer-text" style="font-size: 13px; margin-top: 25px;">
        ${isHebrew 
          ? 'שאלות? צריכים עזרה? אנחנו כאן בשבילך!'
          : 'Questions? Need help? We\'re here for you!'}
        <br>
        <a href="mailto:Support@PetWash.co.il" style="color: #7C3AED; text-decoration: none; font-weight: 600;">Support@PetWash.co.il</a>
      </p>
      
      <p class="footer-text" style="margin-top: 25px; font-size: 11px; color: #94A3B8;">
        © 2025 Pet Wash Ltd. ${isHebrew ? 'כל הזכויות שמורות' : 'All rights reserved'}.<br>
        ${isHebrew ? 'מספר חברה' : 'Company No.'} 517145033 | ${isHebrew ? 'רשומה בישראל' : 'Registered in Israel'}
      </p>
    </div>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}
