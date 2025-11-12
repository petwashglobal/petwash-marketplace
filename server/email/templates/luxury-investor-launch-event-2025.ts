/**
 * Luxury Investor Launch Event Email - Pet Wash™ 2025
 * Special event invitation with pure white background and premium design
 */

interface InvestorLaunchEventData {
  recipientName: string;
  recipientEmail: string;
  language?: 'he' | 'en';
}

export function generateInvestorLaunchEventEmail(data: InvestorLaunchEventData): { subject: string; html: string } {
  const lang = data.language || 'he';
  
  const content = {
    he: {
      subject: '🚀 Pet Wash™ - הזמנה מיוחדת לאירוע השקה | 7 בנובמבר 2025',
      greeting: `${data.recipientName} שלום,`,
      headline: 'אירוע השקה מיוחד',
      subheadline: 'Pet Wash™ Ltd - הפלטפורמה הפרמיום הראשונה לטיפול אורגני בחיות מחמד בישראל',
      intro: 'אנו מתכבדים להזמין אותך לאירוע ההשקה המיוחד של Pet Wash™ - רגע היסטורי בתעשיית הטיפול בחיות המחמד בישראל.',
      eventDate: '7 בנובמבר 2025',
      eventTime: '18:00',
      eventLocation: 'פארק וולד, כפר סבא',
      features: [
        { icon: '✨', title: '11 שיטות אימות מתקדמות', desc: 'אבטחה ברמה בנקאית' },
        { icon: '🌍', title: 'פלטפורמה רב-לשונית', desc: '6 שפות לשוק גלובלי' },
        { icon: '🤖', title: 'שירות לקוחות AI', desc: 'Google Gemini 2.5 Flash' },
        { icon: '🏢', title: 'רשת תחנות K9000', desc: 'IOT חכם עם ניטור בזמן אמת' },
        { icon: '🌿', title: 'מוצרים אורגניים 100%', desc: 'איכות פרמיום בלבד' },
        { icon: '💳', title: 'ארנקים דיגיטליים', desc: 'Apple Wallet & Google Wallet' },
        { icon: '🔒', title: 'אבטחה ארגונית', desc: 'NIST SP 800-63B AAL2' }
      ],
      mapTitle: 'מפה למיקום האירוע',
      mapDesc: 'פארק וולד ממוקם בלב כפר סבא',
      cta: 'אשר הגעה',
      footer: 'Pet Wash™ Ltd | טיפול אורגני פרמיום בחיות מחמד | תוצרת ישראל 🇮🇱'
    },
    en: {
      subject: '🚀 Pet Wash™ - Special Launch Event Invitation | November 7, 2025',
      greeting: `Dear ${data.recipientName},`,
      headline: 'Exclusive Launch Event',
      subheadline: 'Pet Wash™ Ltd - Israel\'s First Premium Organic Pet Care Platform',
      intro: 'We are honored to invite you to the special launch event of Pet Wash™ - a historic moment in Israel\'s pet care industry.',
      eventDate: 'November 7, 2025',
      eventTime: '18:00',
      eventLocation: 'World Park, Kfar Saba',
      features: [
        { icon: '✨', title: '11 Advanced Auth Methods', desc: 'Banking-level security' },
        { icon: '🌍', title: 'Multi-language Platform', desc: '6 languages for global market' },
        { icon: '🤖', title: 'AI Customer Service', desc: 'Google Gemini 2.5 Flash powered' },
        { icon: '🏢', title: 'K9000 Station Network', desc: 'Smart IOT with real-time monitoring' },
        { icon: '🌿', title: '100% Organic Products', desc: 'Premium quality only' },
        { icon: '💳', title: 'Digital Wallets', desc: 'Apple Wallet & Google Wallet' },
        { icon: '🔒', title: 'Enterprise Security', desc: 'NIST SP 800-63B AAL2 compliant' }
      ],
      mapTitle: 'Event Location Map',
      mapDesc: 'World Park is located in the heart of Kfar Saba',
      cta: 'Confirm Attendance',
      footer: 'Pet Wash™ Ltd | Premium Organic Pet Care | Made in Israel 🇮🇱'
    }
  };

  const c = content[lang];
  
  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${lang === 'he' ? 'rtl' : 'ltr'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${c.subject}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;900&family=Playfair+Display:wght@400;700;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: ${lang === 'he' ? "'Heebo'" : "'Inter'"}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #FFFFFF;
            padding: 0;
            margin: 0;
        }
        
        .container {
            max-width: 700px;
            margin: 0 auto;
            background: #FFFFFF;
        }
        
        .header {
            background: linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #F59E0B 100%);
            background-size: 200% 200%;
            animation: gradientFlow 8s ease infinite;
            padding: 80px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        @keyframes gradientFlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        .logo {
            font-size: 100px;
            margin-bottom: 20px;
            animation: float 3s ease-in-out infinite;
            filter: drop-shadow(0 15px 40px rgba(0,0,0,0.3));
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }
        
        .brand {
            font-family: 'Playfair Display', serif;
            font-size: 54px;
            font-weight: 900;
            color: #FFFFFF;
            text-shadow: 0 5px 30px rgba(0, 0, 0, 0.3);
            margin-bottom: 10px;
        }
        
        .content {
            padding: 60px 50px;
            background: #FFFFFF;
        }
        
        .greeting {
            font-size: 22px;
            color: #1E293B;
            margin-bottom: 40px;
            font-weight: 500;
        }
        
        .headline {
            font-family: 'Playfair Display', serif;
            font-size: 52px;
            font-weight: 700;
            background: linear-gradient(135deg, #7C3AED, #EC4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
            line-height: 1.2;
        }
        
        .subheadline {
            font-size: 20px;
            color: #64748B;
            margin-bottom: 40px;
            line-height: 1.6;
        }
        
        .intro {
            font-size: 18px;
            line-height: 1.9;
            color: #475569;
            margin-bottom: 50px;
        }
        
        .event-card {
            background: linear-gradient(135deg, #F8F9FA 0%, #FFFFFF 100%);
            padding: 40px;
            border-radius: 20px;
            border: 2px solid #E2E8F0;
            margin: 50px 0;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        }
        
        .event-detail {
            display: flex;
            align-items: center;
            margin-bottom: 25px;
            font-size: 20px;
        }
        
        .event-icon {
            font-size: 32px;
            margin-${lang === 'he' ? 'left' : 'right'}: 20px;
        }
        
        .event-label {
            color: #64748B;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 5px;
        }
        
        .event-value {
            color: #1E293B;
            font-size: 22px;
            font-weight: 700;
        }
        
        .features-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
            margin: 50px 0;
        }
        
        .feature {
            background: linear-gradient(135deg, #FAFAFA 0%, #FFFFFF 100%);
            padding: 25px;
            border-radius: 15px;
            border-${lang === 'he' ? 'right' : 'left'}: 4px solid #7C3AED;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.05);
            transition: transform 0.3s ease;
        }
        
        .feature-header {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .feature-icon {
            font-size: 32px;
            margin-${lang === 'he' ? 'left' : 'right'}: 15px;
        }
        
        .feature-title {
            font-size: 18px;
            font-weight: 700;
            color: #1E293B;
        }
        
        .feature-desc {
            font-size: 15px;
            color: #64748B;
            margin-${lang === 'he' ? 'right' : 'left'}: 47px;
        }
        
        .map-section {
            margin: 50px 0;
            text-align: center;
        }
        
        .map-title {
            font-size: 24px;
            font-weight: 700;
            color: #1E293B;
            margin-bottom: 10px;
        }
        
        .map-desc {
            font-size: 16px;
            color: #64748B;
            margin-bottom: 20px;
        }
        
        .cta-section {
            text-align: center;
            margin: 60px 0;
        }
        
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #7C3AED 0%, #EC4899 100%);
            color: #FFFFFF;
            text-decoration: none;
            padding: 22px 60px;
            font-size: 20px;
            font-weight: 700;
            border-radius: 50px;
            box-shadow: 0 20px 50px rgba(124, 58, 237, 0.4);
            transition: all 0.3s ease;
            animation: pulse 2.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { box-shadow: 0 20px 50px rgba(124, 58, 237, 0.4); }
            50% { box-shadow: 0 25px 60px rgba(124, 58, 237, 0.6); }
        }
        
        .footer {
            background: #F8F9FA;
            padding: 40px;
            text-align: center;
            border-top: 1px solid #E2E8F0;
        }
        
        .footer-text {
            color: #64748B;
            font-size: 14px;
            line-height: 1.8;
        }
        
        @media screen and (max-width: 600px) {
            .header { padding: 50px 30px; }
            .brand { font-size: 38px; }
            .content { padding: 40px 30px; }
            .headline { font-size: 36px; }
            .event-card { padding: 30px 20px; }
            .cta-button { padding: 18px 40px; font-size: 18px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🐾</div>
            <div class="brand">Pet Wash™</div>
        </div>
        
        <div class="content">
            <p class="greeting">${c.greeting}</p>
            
            <h1 class="headline">${c.headline}</h1>
            <h2 class="subheadline">${c.subheadline}</h2>
            
            <p class="intro">${c.intro}</p>
            
            <div class="event-card">
                <div class="event-detail">
                    <div class="event-icon">📅</div>
                    <div>
                        <div class="event-label">${lang === 'he' ? 'תאריך' : 'Date'}</div>
                        <div class="event-value">${c.eventDate}</div>
                    </div>
                </div>
                <div class="event-detail">
                    <div class="event-icon">⏰</div>
                    <div>
                        <div class="event-label">${lang === 'he' ? 'שעה' : 'Time'}</div>
                        <div class="event-value">${c.eventTime}</div>
                    </div>
                </div>
                <div class="event-detail">
                    <div class="event-icon">📍</div>
                    <div>
                        <div class="event-label">${lang === 'he' ? 'מיקום' : 'Location'}</div>
                        <div class="event-value">${c.eventLocation}</div>
                    </div>
                </div>
            </div>
            
            <div class="features-grid">
                ${c.features.map(feature => `
                    <div class="feature">
                        <div class="feature-header">
                            <span class="feature-icon">${feature.icon}</span>
                            <span class="feature-title">${feature.title}</span>
                        </div>
                        <div class="feature-desc">${feature.desc}</div>
                    </div>
                `).join('')}
            </div>
            
            <div class="map-section">
                <h3 class="map-title">${c.mapTitle}</h3>
                <p class="map-desc">${c.mapDesc}</p>
                <div style="font-size: 80px; margin: 30px 0;">🗺️</div>
            </div>
            
            <div class="cta-section">
                <a href="https://petwash.co.il" class="cta-button" style="color: #FFFFFF;">
                    ${c.cta} →
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p class="footer-text">${c.footer}</p>
            <p class="footer-text" style="margin-top: 15px; font-size: 12px;">
                © 2025 Pet Wash™ Ltd. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`;

  return { subject: c.subject, html };
}
