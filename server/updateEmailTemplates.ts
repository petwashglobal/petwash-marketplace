import { db } from './lib/firebase-admin';
import { logger } from './lib/logger';

/**
 * Enhanced Welcome Email Templates with Hero Image
 */
async function updateWelcomeTemplate() {
  const hebrewTemplate = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ברוכים הבאים ל-Pet Wash™</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; overflow: hidden; }
        .hero { width: 100%; height: 250px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; }
        .hero-logo { font-size: 48px; font-weight: 700; margin-bottom: 10px; }
        .hero-subtitle { font-size: 18px; opacity: 0.95; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 28px; color: #667eea; margin-bottom: 20px; font-weight: 600; text-align: center; }
        .message { color: #4a5568; font-size: 18px; line-height: 1.8; margin-bottom: 30px; text-align: center; }
        .cta-container { margin: 40px 0; text-align: center; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 36px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 8px; transition: transform 0.3s, box-shadow 0.3s; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4); }
        .features { background: #f7fafc; padding: 30px; border-radius: 15px; margin: 30px 0; }
        .feature-item { margin: 20px 0; padding: 15px; border-right: 4px solid #667eea; background: white; border-radius: 8px; }
        .feature-title { font-size: 20px; font-weight: 600; color: #2d3748; margin-bottom: 8px; }
        .feature-desc { color: #718096; font-size: 15px; }
        .paw-prints { text-align: center; font-size: 32px; margin: 30px 0; opacity: 0.3; }
        .footer { background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); color: white; padding: 40px 30px; text-align: center; }
        .footer-brand { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
        .footer-info { font-size: 14px; opacity: 0.9; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <div class="hero-logo">🐾 Pet Wash™</div>
            <div class="hero-subtitle">שירותי רחיצה פרימיום אורגניים</div>
        </div>
        
        <div class="content">
            <div class="greeting">
                \${firstName ? \`ברוכים הבאים \${firstName}!\` : 'ברוכים הבאים!'}
            </div>
            
            <div class="message">
                <strong>תודה רבה שהצטרפת למשפחת Pet Wash™!</strong><br><br>
                אנחנו נרגשים שבחרת בנו לטפל בחיית המחמד האהובה עליך. 
                Pet Wash™ מציעה את השירות המתקדם והאיכותי ביותר עם מוצרים אורגניים פרימיום.
            </div>

            <div class="features">
                <div class="feature-item">
                    <div class="feature-title">✨ מוצרים אורגניים פרימיום</div>
                    <div class="feature-desc">מוצרי טיפוח איכותיים וידידותיים לעור רגיש</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">🎁 תוכנית נאמנות 5 דרגות</div>
                    <div class="feature-desc">NEW → SILVER → GOLD → PLATINUM → DIAMOND עם הנחות עד 25%</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">📱 ניהול דיגיטלי מלא</div>
                    <div class="feature-desc">נהל הכל מהנייד - פרופיל, היסטוריה, קופונים ועוד</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">🤖 עוזר AI חכם</div>
                    <div class="feature-desc">תמיכה 24/7 בעברית ואנגלית</div>
                </div>
            </div>

            <div class="cta-container">
                <a href="https://petwash.co.il/dashboard" class="cta-button">
                    📝 השלם את הפרופיל
                </a>
                <a href="https://petwash.co.il/packages" class="cta-button">
                    🐕 הזמן רחיצה עכשיו
                </a>
                <a href="https://wa.me/972549833355" class="cta-button">
                    💬 הצטרף לוואטסאפ
                </a>
            </div>

            <div class="message" style="margin-top: 50px;">
                <div class="paw-prints">🐾 🐾 🐾</div>
                <p><strong>יש לך שאלות?</strong></p>
                <p>אנחנו כאן בשבילך 24/7!</p>
            </div>
        </div>

        <div class="footer">
            <div class="footer-brand">🐾 Pet Wash™</div>
            <div class="footer-info">שירותי רחיצה פרימיום אורגניים לחיות מחמד</div>
            <div class="footer-info">Support@PetWash.co.il | www.petwash.co.il</div>
            <div class="footer-info">📞 054-983-3355 | WhatsApp זמין 24/7</div>
        </div>
    </div>
</body>
</html>`;

  const englishTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Pet Wash™</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; overflow: hidden; }
        .hero { width: 100%; height: 250px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; }
        .hero-logo { font-size: 48px; font-weight: 700; margin-bottom: 10px; }
        .hero-subtitle { font-size: 18px; opacity: 0.95; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 28px; color: #667eea; margin-bottom: 20px; font-weight: 600; text-align: center; }
        .message { color: #4a5568; font-size: 18px; line-height: 1.8; margin-bottom: 30px; text-align: center; }
        .cta-container { margin: 40px 0; text-align: center; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 36px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 8px; transition: transform 0.3s, box-shadow 0.3s; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4); }
        .features { background: #f7fafc; padding: 30px; border-radius: 15px; margin: 30px 0; }
        .feature-item { margin: 20px 0; padding: 15px; border-left: 4px solid #667eea; background: white; border-radius: 8px; }
        .feature-title { font-size: 20px; font-weight: 600; color: #2d3748; margin-bottom: 8px; }
        .feature-desc { color: #718096; font-size: 15px; }
        .paw-prints { text-align: center; font-size: 32px; margin: 30px 0; opacity: 0.3; }
        .footer { background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); color: white; padding: 40px 30px; text-align: center; }
        .footer-brand { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
        .footer-info { font-size: 14px; opacity: 0.9; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <div class="hero-logo">🐾 Pet Wash™</div>
            <div class="hero-subtitle">Premium Organic Pet Wash Services</div>
        </div>
        
        <div class="content">
            <div class="greeting">
                \${firstName ? \`Welcome \${firstName}!\` : 'Welcome!'}
            </div>
            
            <div class="message">
                <strong>Thank you for joining the Pet Wash™ family!</strong><br><br>
                We're thrilled you chose us to care for your beloved pet. 
                Pet Wash™ offers the most advanced and quality service with premium organic products.
            </div>

            <div class="features">
                <div class="feature-item">
                    <div class="feature-title">✨ Premium Organic Products</div>
                    <div class="feature-desc">Quality grooming products gentle on sensitive skin</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">🎁 7-Tier Luxury Loyalty Program</div>
                    <div class="feature-desc">Bronze → Silver → Gold → Platinum → Diamond → Emerald → Royal with up to 50% discounts</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">📱 Full Digital Management</div>
                    <div class="feature-desc">Manage everything from your phone - profile, history, coupons & more</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">🤖 Smart AI Assistant</div>
                    <div class="feature-desc">24/7 support in Hebrew and English</div>
                </div>
            </div>

            <div class="cta-container">
                <a href="https://petwash.co.il/dashboard" class="cta-button">
                    📝 Complete Profile
                </a>
                <a href="https://petwash.co.il/packages" class="cta-button">
                    🐕 Book a Wash Now
                </a>
                <a href="https://wa.me/972549833355" class="cta-button">
                    💬 Join WhatsApp
                </a>
            </div>

            <div class="message" style="margin-top: 50px;">
                <div class="paw-prints">🐾 🐾 🐾</div>
                <p><strong>Have questions?</strong></p>
                <p>We're here for you 24/7!</p>
            </div>
        </div>

        <div class="footer">
            <div class="footer-brand">🐾 Pet Wash™</div>
            <div class="footer-info">Premium Organic Pet Wash Services</div>
            <div class="footer-info">Support@PetWash.co.il | www.petwash.co.il</div>
            <div class="footer-info">📞 +972-54-983-3355 | WhatsApp Available 24/7</div>
        </div>
    </div>
</body>
</html>`;

  await db
    .collection('crm_email_templates')
    .doc('welcome_v1')
    .set({
      name: 'Welcome Email v2 - Enhanced with Hero',
      type: 'welcome',
      version: 2,
      hebrewTemplate,
      englishTemplate,
      subject: {
        he: '🐾 ברוכים הבאים ל-Pet Wash™ - המסע שלך מתחיל כאן!',
        en: '🐾 Welcome to Pet Wash™ - Your Journey Starts Here!'
      },
      description: 'Enhanced welcome email with hero section, 7-tier luxury loyalty program info, AI assistant mention, and branded footer',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

  logger.info('Welcome template updated in Firestore');
}

/**
 * Enhanced Birthday Email Templates with Hero Image
 */
async function updateBirthdayTemplate() {
  const hebrewTemplate = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>יום הולדת שמח - Pet Wash™</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 600px; margin: 0 auto; background: white; overflow: hidden; }
        .hero { width: 100%; height: 280px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; position: relative; }
        .hero-emoji { font-size: 80px; margin-bottom: 15px; animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        .hero-title { font-size: 36px; font-weight: 700; margin-bottom: 10px; }
        .hero-subtitle { font-size: 20px; opacity: 0.95; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 32px; color: #667eea; margin-bottom: 25px; text-align: center; font-weight: 700; }
        .message { font-size: 20px; color: #4a5568; line-height: 1.8; text-align: center; margin-bottom: 35px; }
        .voucher-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; padding: 40px 30px; margin: 35px 0; text-align: center; box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4); }
        .discount-amount { color: white; font-size: 56px; font-weight: 700; margin: 25px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }
        .voucher-label { color: rgba(255,255,255,0.95); font-size: 16px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 2px; }
        .voucher-code { background: white; color: #667eea; font-size: 32px; font-weight: 700; padding: 20px 30px; border-radius: 15px; display: inline-block; letter-spacing: 3px; margin: 15px 0; box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
        .cta-button { display: inline-block; background: #0B57D0; color: white; text-decoration: none; padding: 20px 45px; border-radius: 50px; font-size: 20px; font-weight: 600; margin: 25px 0; transition: all 0.3s ease; box-shadow: 0 8px 20px rgba(11, 87, 208, 0.3); }
        .cta-button:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(11, 87, 208, 0.4); }
        .expiry { background: #FFF3CD; border: 3px solid #FFC107; border-radius: 15px; padding: 20px; margin: 25px 0; text-align: center; color: #856404; font-size: 16px; font-weight: 600; }
        .paw-prints { font-size: 32px; opacity: 0.3; text-align: center; margin: 30px 0; }
        .footer { background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); color: white; padding: 40px 30px; text-align: center; }
        .footer-brand { font-size: 28px; font-weight: 700; margin-bottom: 15px; }
        .footer-info { font-size: 15px; opacity: 0.9; margin: 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <div class="hero-emoji">🎂🐕🎉</div>
            <div class="hero-title">יום הולדת שמח!</div>
            <div class="hero-subtitle">Pet Wash™</div>
        </div>
        
        <div class="content">
            <div class="greeting">
                \${firstName ? \`שלום \${firstName}!\` : 'שלום!'}
            </div>
            
            <div class="message">
                <strong>🎊 יום הולדת שמח ל\${dogName || 'חבר הכלב שלך'}!</strong><br><br>
                אנחנו נרגשים לחגוג את היום המיוחד הזה איתך!<br>
                כמתנת יום הולדת, הנה הנחה מיוחדת עבורך:
            </div>

            <div class="voucher-box">
                <div class="discount-amount">🎁 10% הנחה 🎁</div>
                <div class="voucher-label">קוד ההנחה המיוחד שלך</div>
                <div class="voucher-code">\${voucherCode}</div>
            </div>

            <div style="text-align: center;">
                <a href="https://petwash.co.il/packages" class="cta-button">
                    🎁 השתמש במתנה עכשיו
                </a>
            </div>

            <div class="expiry">
                ⏰ <strong>תוקף הקופון:</strong> עד \${expiryDate}<br>
                (30 יום מהיום - אל תפספס!)
            </div>

            <div class="message" style="margin-top: 40px;">
                <div class="paw-prints">🐾 🐾 🐾</div>
                <p><strong>תודה שאתה חלק ממשפחת Pet Wash™!</strong></p>
                <p>אנחנו שמחים לחגוג את הרגעים המיוחדים שלך</p>
            </div>
        </div>

        <div class="footer">
            <div class="footer-brand">🐾 Pet Wash™</div>
            <div class="footer-info">שירותי רחיצה פרימיום אורגניים לחיות מחמד</div>
            <div class="footer-info">Support@PetWash.co.il | www.petwash.co.il</div>
            <div class="footer-info">📞 054-983-3355 | WhatsApp זמין 24/7</div>
        </div>
    </div>
</body>
</html>`;

  const englishTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Happy Birthday - Pet Wash™</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 600px; margin: 0 auto; background: white; overflow: hidden; }
        .hero { width: 100%; height: 280px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; position: relative; }
        .hero-emoji { font-size: 80px; margin-bottom: 15px; animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        .hero-title { font-size: 36px; font-weight: 700; margin-bottom: 10px; }
        .hero-subtitle { font-size: 20px; opacity: 0.95; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 32px; color: #667eea; margin-bottom: 25px; text-align: center; font-weight: 700; }
        .message { font-size: 20px; color: #4a5568; line-height: 1.8; text-align: center; margin-bottom: 35px; }
        .voucher-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; padding: 40px 30px; margin: 35px 0; text-align: center; box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4); }
        .discount-amount { color: white; font-size: 56px; font-weight: 700; margin: 25px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }
        .voucher-label { color: rgba(255,255,255,0.95); font-size: 16px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 2px; }
        .voucher-code { background: white; color: #667eea; font-size: 32px; font-weight: 700; padding: 20px 30px; border-radius: 15px; display: inline-block; letter-spacing: 3px; margin: 15px 0; box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
        .cta-button { display: inline-block; background: #0B57D0; color: white; text-decoration: none; padding: 20px 45px; border-radius: 50px; font-size: 20px; font-weight: 600; margin: 25px 0; transition: all 0.3s ease; box-shadow: 0 8px 20px rgba(11, 87, 208, 0.3); }
        .cta-button:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(11, 87, 208, 0.4); }
        .expiry { background: #FFF3CD; border: 3px solid #FFC107; border-radius: 15px; padding: 20px; margin: 25px 0; text-align: center; color: #856404; font-size: 16px; font-weight: 600; }
        .paw-prints { font-size: 32px; opacity: 0.3; text-align: center; margin: 30px 0; }
        .footer { background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); color: white; padding: 40px 30px; text-align: center; }
        .footer-brand { font-size: 28px; font-weight: 700; margin-bottom: 15px; }
        .footer-info { font-size: 15px; opacity: 0.9; margin: 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <div class="hero-emoji">🎂🐕🎉</div>
            <div class="hero-title">Happy Birthday!</div>
            <div class="hero-subtitle">Pet Wash™</div>
        </div>
        
        <div class="content">
            <div class="greeting">
                \${firstName ? \`Hello \${firstName}!\` : 'Hello!'}
            </div>
            
            <div class="message">
                <strong>🎊 Happy Birthday to \${dogName || 'Your Furry Friend'}!</strong><br><br>
                We're excited to celebrate this special day with you!<br>
                As a birthday gift, here's a special discount just for you:
            </div>

            <div class="voucher-box">
                <div class="discount-amount">🎁 10% OFF 🎁</div>
                <div class="voucher-label">Your Special Discount Code</div>
                <div class="voucher-code">\${voucherCode}</div>
            </div>

            <div style="text-align: center;">
                <a href="https://petwash.co.il/packages" class="cta-button">
                    🎁 Use Your Gift Now
                </a>
            </div>

            <div class="expiry">
                ⏰ <strong>Valid Until:</strong> \${expiryDate}<br>
                (30 days from today - Don't miss out!)
            </div>

            <div class="message" style="margin-top: 40px;">
                <div class="paw-prints">🐾 🐾 🐾</div>
                <p><strong>Thank you for being part of the Pet Wash™ family!</strong></p>
                <p>We're happy to celebrate your special moments with you</p>
            </div>
        </div>

        <div class="footer">
            <div class="footer-brand">🐾 Pet Wash™</div>
            <div class="footer-info">Premium Organic Pet Wash Services</div>
            <div class="footer-info">Support@PetWash.co.il | www.petwash.co.il</div>
            <div class="footer-info">📞 +972-54-983-3355 | WhatsApp Available 24/7</div>
        </div>
    </div>
</body>
</html>`;

  await db
    .collection('crm_email_templates')
    .doc('birthday_v1')
    .set({
      name: 'Birthday Email v2 - Enhanced with Hero & Animation',
      type: 'birthday',
      version: 2,
      hebrewTemplate,
      englishTemplate,
      subject: {
        he: '🎉 יום הולדת שמח ${dogName || ""}! 10% הנחה מיוחדת - Pet Wash™',
        en: '🎉 Happy Birthday ${dogName || ""}! Special 10% Discount - Pet Wash™'
      },
      description: 'Enhanced birthday email with animated hero section, larger voucher display, stronger CTAs, and branded footer',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

  logger.info('Birthday template updated in Firestore');
}

// Run the update
async function main() {
  logger.info('Starting email template update...');
  
  try {
    await updateWelcomeTemplate();
    await updateBirthdayTemplate();
    logger.info('All email templates updated successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error updating templates', error);
    process.exit(1);
  }
}

main();
