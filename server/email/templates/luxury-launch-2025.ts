/**
 * Luxury Brand Launch Email - ⁦Pet Wash™⁩ 2025
 * Ultra-premium design with animations, pure white background, and luxury imagery
 */

interface LuxuryLaunchData {
  recipientName: string;
  recipientEmail: string;
  language?: 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es';
}

export function generateLuxuryLaunchEmail(data: LuxuryLaunchData): { subject: string; html: string } {
  const lang = data.language || 'en';
  
  const content = {
    en: {
      subject: '🚀 ⁦Pet Wash™⁩ Premium - Official Launch November 7, 2025',
      greeting: `Dear ${data.recipientName},`,
      headline: 'The Future of Pet Care',
      subheadline: 'Officially Launching November 7, 2025',
      intro: 'We are thrilled to invite you to witness the official launch of ⁦Pet Wash™⁩ - Israel\'s first premium organic pet care platform.',
      features: [
        '11 Advanced Authentication Methods',
        '6-Language Global Platform',
        'AI-Powered Customer Service',
        'K9000 Smart Station Network',
        '100% Organic Premium Products',
        'Apple & Google Wallet Integration',
        'Enterprise-Grade Security'
      ],
      quote: '"Excellence is not a destination; it is a continuous journey that never ends."',
      cta: 'Experience ⁦Pet Wash™⁩',
      footer: 'Premium Organic Pet Care | Made in Israel 🇮🇱'
    },
    he: {
      subject: '🚀 ⁦Pet Wash™⁩ פרמיום - השקה רשמית 7 בנובמבר 2025',
      greeting: `${data.recipientName} שלום,`,
      headline: 'עתיד הטיפול בחיות מחמד',
      subheadline: 'השקה רשמית ב-7 בנובמבר 2025',
      intro: 'אנו שמחים להזמין אותך לחזות בהשקה הרשמית של ⁦Pet Wash™⁩ - פלטפורמת הטיפול האורגני הפרמיום הראשונה בישראל.',
      features: [
        '11 שיטות אימות מתקדמות',
        'פלטפורמה רב-לשונית (6 שפות)',
        'שירות לקוחות מבוסס AI',
        'רשת תחנות חכמות K9000',
        'מוצרים אורגניים 100%',
        'אינטגרציה עם ארנקים דיגיטליים',
        'אבטחה ברמה ארגונית'
      ],
      quote: '"מצוינות אינה יעד; היא מסע מתמשך שאינו נגמר."',
      cta: 'חוו את ⁦Pet Wash™⁩',
      footer: 'טיפול אורגני פרמיום בחיות מחמד | תוצרת ישראל 🇮🇱'
    }
  };

  const c = content[lang] || content.en;
  
  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${['he', 'ar'].includes(lang) ? 'rtl' : 'ltr'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${c.subject}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #FFFFFF;
            padding: 0;
            margin: 0;
        }
        
        .container {
            max-width: 700px;
            margin: 0 auto;
            background: #FFFFFF;
        }
        
        /* Animated Gradient Header */
        .header {
            background: linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #F59E0B 100%);
            background-size: 200% 200%;
            padding: 80px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }        
        /* Floating particles animation */
        .header::before {
            content: '🐾';
            position: absolute;
            font-size: 60px;
            opacity: 0.15;
            top: 20%;
            left: 10%;
        }
        
        .header::after {
            content: '✨';
            position: absolute;
            font-size: 50px;
            opacity: 0.15;
            top: 60%;
            right: 15%;
        }        
        .logo {
            font-size: 80px;
            margin-bottom: 20px;
            filter: drop-shadow(0 10px 40px rgba(0,0,0,0.2));
        }        
        .brand-name {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 52px;
            font-weight: 900;
            color: #FFFFFF;
            text-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
            margin-bottom: 15px;
            letter-spacing: 2px;
        }
        
        .tagline {
            color: rgba(255, 255, 255, 0.95);
            font-size: 18px;
            font-weight: 300;
            letter-spacing: 4px;
            text-transform: uppercase;
        }
        
        /* Content Section */
        .content {
            padding: 60px 50px;
            background: #FFFFFF;
        }
        
        .greeting {
            font-size: 20px;
            color: #1E293B;
            margin-bottom: 30px;
            font-weight: 500;
        }
        
        .headline {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 48px;
            font-weight: 700;
            background: linear-gradient(135deg, #7C3AED, #EC4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 15px;
            line-height: 1.2;
        }
        
        .subheadline {
            font-size: 24px;
            color: #64748B;
            margin-bottom: 40px;
            font-weight: 300;
        }
        
        .intro {
            font-size: 18px;
            line-height: 1.8;
            color: #475569;
            margin-bottom: 50px;
        }
        
        /* Luxury Image Section */
        .luxury-image {
            width: 100%;
            margin: 40px 0;
            text-align: center;
        }
        
        .luxury-image img {
            max-width: 100%;
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
        }        
        /* Features Grid */
        .features {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
            margin: 50px 0;
        }
        
        .feature-item {
            background: linear-gradient(135deg, #F8F9FA 0%, #FFFFFF 100%);
            padding: 25px;
            border-radius: 15px;
            border-left: 4px solid #7C3AED;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .feature-item:nth-child(1) { animation-delay: 0.1s; }
        .feature-item:nth-child(2) { animation-delay: 0.2s; }
        .feature-item:nth-child(3) { animation-delay: 0.3s; }
        .feature-item:nth-child(4) { animation-delay: 0.4s; }
        .feature-item:nth-child(5) { animation-delay: 0.5s; }
        .feature-item:nth-child(6) { animation-delay: 0.6s; }
        .feature-item:nth-child(7) { animation-delay: 0.7s; }        
        .feature-icon {
            font-size: 28px;
            margin-${['he', 'ar'].includes(lang) ? 'left' : 'right'}: 15px;
            display: inline-block;
        }
        
        .feature-text {
            font-size: 16px;
            color: #1E293B;
            font-weight: 500;
        }
        
        /* Quote Section */
        .quote-section {
            background: linear-gradient(135deg, #7C3AED 0%, #EC4899 100%);
            padding: 50px 40px;
            border-radius: 20px;
            margin: 50px 0;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .quote-section::before {
            content: '"';
            position: absolute;
            font-size: 200px;
            font-family: Georgia, 'Times New Roman', serif;
            color: rgba(255, 255, 255, 0.1);
            top: -40px;
            left: 20px;
        }
        
        .quote {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 24px;
            line-height: 1.6;
            color: #FFFFFF;
            font-style: italic;
            position: relative;
            z-index: 1;
        }
        
        /* CTA Button */
        .cta-section {
            text-align: center;
            margin: 60px 0;
        }
        
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #7C3AED 0%, #EC4899 100%);
            color: #FFFFFF;
            text-decoration: none;
            padding: 20px 50px;
            font-size: 18px;
            font-weight: 700;
            border-radius: 50px;
            box-shadow: 0 20px 40px rgba(124, 58, 237, 0.3);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }        
        /* Launch Date */
        .launch-date {
            text-align: center;
            margin: 40px 0;
        }
        
        .date-card {
            display: inline-block;
            background: linear-gradient(135deg, #1E293B 0%, #334155 100%);
            color: #FFFFFF;
            padding: 30px 60px;
            border-radius: 20px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.2);
        }
        
        .date-label {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 3px;
            opacity: 0.8;
            margin-bottom: 10px;
        }
        
        .date-value {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 36px;
            font-weight: 700;
        }
        
        /* Footer */
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
        
        .social-icons {
            margin: 20px 0;
        }
        
        .social-icon {
            display: inline-block;
            margin: 0 10px;
            font-size: 24px;
            text-decoration: none;
            transition: transform 0.3s ease;
        }
        
        /* Mobile Responsive */
        @media screen and (max-width: 600px) {
            .header { padding: 50px 30px; }
            .brand-name { font-size: 36px; }
            .content { padding: 40px 30px; }
            .headline { font-size: 32px; }
            .subheadline { font-size: 18px; }
            .cta-button { padding: 18px 40px; font-size: 16px; }
            .date-value { font-size: 28px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Animated Header -->
        <div class="header">
            <div class="logo">🐾</div>
            <div class="brand-name">⁦Pet Wash™⁩</div>
            <div class="tagline">Premium Organic Pet Care</div>
        </div>
        
        <!-- Main Content -->
        <div class="content">
            <p class="greeting">${c.greeting}</p>
            
            <h1 class="headline">${c.headline}</h1>
            <h2 class="subheadline">${c.subheadline}</h2>
            
            <p class="intro">${c.intro}</p>
            
            <!-- Launch Date Card -->
            <div class="launch-date">
                <div class="date-card">
                    <div class="date-label">Official Launch</div>
                    <div class="date-value">November 7, 2025</div>
                </div>
            </div>
            
            <!-- Luxury Image -->
            <div class="luxury-image">
                <div style="font-size: 120px; margin: 40px 0; filter: drop-shadow(0 20px 40px rgba(124, 58, 237, 0.2));">
                    🚀
                </div>
            </div>
            
            <!-- Features Grid -->
            <div class="features">
                ${c.features.map((feature, index) => `
                    <div class="feature-item">
                        <span class="feature-icon">${['✨', '🌍', '🤖', '🏢', '🌿', '💳', '🔒'][index]}</span>
                        <span class="feature-text">${feature}</span>
                    </div>
                `).join('')}
            </div>
            
            <!-- Quote -->
            <div class="quote-section">
                <p class="quote">${c.quote}</p>
            </div>
            
            <!-- CTA Button -->
            <div class="cta-section">
                <a href="https://petwash.co.il" class="cta-button" style="color: #FFFFFF;">
                    ${c.cta} →
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="social-icons">
                <span class="social-icon">📱</span>
                <span class="social-icon">🌐</span>
                <span class="social-icon">💼</span>
            </div>
            <p class="footer-text">${c.footer}</p>
            <p class="footer-text" style="margin-top: 15px; font-size: 12px;">
                © 2025 ⁦Pet Wash™⁩ Ltd. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`;

  return { subject: c.subject, html };
}
