/**
 * Send Thank You Email to Ido Shakarzi
 * One-time route for sending appreciation email
 */

import { Router } from 'express';
import sgMail from '@sendgrid/mail';
import { logger } from '../lib/logger';

const router = Router();

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * POST /api/send-signature-invite - Send e-signature invitation to Ido Shakarzi
 */
router.post('/send-signature-invite', async (req, res) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'SendGrid not configured' 
      });
    }

    const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PetWash™ E-Signature System</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background: rgba(255,255,255,0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
    <tr>
      <td style="background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); padding: 40px 32px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
        <h1 style="margin: 0; font-size: 32px; font-weight: 200; letter-spacing: 2px; color: #ffffff;">
          PetWash™ E-Signature
        </h1>
        <p style="margin: 12px 0 0; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #888;">
          Enterprise Digital Signature System
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 48px 40px;">
        <p style="margin: 0 0 24px; font-size: 18px; color: #ffffff; font-weight: 300;">
          שלום עידו,
        </p>
        <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.8; color: #cccccc;">
          בנינו מערכת חתימה דיגיטלית ארגונית מתקדמת עבור PetWash™ עם <strong style="color: #ffffff;">ביקורת קריפטוגרפית מלאה</strong> ושרשור בלתי ניתן לשינוי (blockchain-style audit trail).
        </p>
        <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.8; color: #cccccc;">
          כמנהל תפעול ארצי ושותף, <strong style="color: #ffffff;">הינך מוזמן להוסיף את חתימתך הדיגיטלית למערכת</strong> על מנת לחתום על מסמכים משפטיים, הסכמים עם ספקים, אישורים פיננסיים ודוחות ארגוניים.
        </p>
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; margin: 32px 0;">
          <h3 style="margin: 0 0 16px; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; color: #888;">
            התכונות העיקריות
          </h3>
          <ul style="margin: 0; padding: 0 0 0 24px; color: #cccccc; line-height: 2;">
            <li>חתימה מאובטחת עם SHA-256 cryptographic verification</li>
            <li>שרשור ביקורת בלתי ניתן לשינוי לכל חתימה</li>
            <li>גיבוי אוטומטי ל-Google Cloud Storage</li>
            <li>שליחה אוטומטית למקבלים באימייל</li>
            <li>ממשק 7-כוכבים במקום של נייר וסריקות</li>
          </ul>
        </div>
        <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.8; color: #cccccc;">
          כדי להתחיל, פשוט העלה את קובץ החתימה שלך (PNG/JPG) ונקבע אותך במערכת.
        </p>
        <p style="margin: 0 0 32px; font-size: 16px; line-height: 1.8; color: #cccccc;">
          מחכה לשמוע ממך! 🚀
        </p>
      </td>
    </tr>
    <tr>
      <td style="background: rgba(0,0,0,0.3); padding: 32px 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.08);">
        <p style="margin: 0 0 8px; font-size: 14px; color: #ffffff; font-weight: 300;">
          <strong>Nir Hadad</strong>
        </p>
        <p style="margin: 0 0 16px; font-size: 12px; color: #888;">
          Founder & CEO | PetWash Ltd (חברת פטוואש בע"מ)
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const msg = {
      to: 'ido.s@petwash.co.il',
      from: 'Support@PetWash.co.il',
      cc: 'Support@PetWash.co.il', // CC Nir Hadad
      subject: '🔐 PetWash™ E-Signature System - הזמנה אישית לחתימה דיגיטלית',
      html: emailHtml,
    };

    await sgMail.send(msg);

    logger.info('E-signature invitation sent to Ido Shakarzi');

    return res.json({ 
      success: true, 
      message: 'E-signature invitation sent successfully to ido.s@petwash.co.il'
    });

  } catch (error: any) {
    logger.error('Failed to send e-signature invitation:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send email'
    });
  }
});

/**
 * POST /api/send-thank-you - Send thank you email to Ido Shakarzi
 * One-time endpoint for management appreciation
 */
router.post('/send-thank-you', async (req, res) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'SendGrid not configured' 
      });
    }

    const { recipientEmail, recipientName } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Recipient email is required' 
      });
    }

    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.8;
            color: #333;
            max-width: 700px;
            margin: 0 auto;
            padding: 40px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            border-radius: 20px;
            padding: 50px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 3px solid #667eea;
          }
          .header h1 {
            color: #667eea;
            font-size: 36px;
            margin: 0 0 10px 0;
          }
          .header .emoji {
            font-size: 48px;
            margin-bottom: 20px;
          }
          .section {
            margin: 30px 0;
          }
          .section h2 {
            color: #667eea;
            font-size: 24px;
            margin-top: 40px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .section h3 {
            color: #764ba2;
            font-size: 18px;
            margin-top: 25px;
            margin-bottom: 15px;
          }
          .checkmark {
            color: #10b981;
            font-weight: bold;
          }
          .achievements {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            padding: 25px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #667eea;
          }
          .achievements ul {
            margin: 0;
            padding-left: 20px;
          }
          .achievements li {
            margin: 10px 0;
            color: #1e40af;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin: 25px 0;
          }
          .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
          }
          .stat-card .number {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .stat-card .label {
            font-size: 14px;
            opacity: 0.9;
          }
          .quote {
            text-align: center;
            font-style: italic;
            color: #6b7280;
            margin: 40px 0;
            padding: 30px;
            background: #f9fafb;
            border-radius: 10px;
            font-size: 18px;
          }
          .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 30px;
            border-top: 2px solid #e5e7eb;
            color: #6b7280;
          }
          .footer .logo {
            font-size: 24px;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 30px;
            margin: 30px 0;
            font-weight: bold;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
          }
          .highlight {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="emoji">🎉 🐾 🎉</div>
            <h1>Heartfelt Thanks & Exciting Future Ahead!</h1>
            <p style="color: #6b7280; font-size: 16px; margin-top: 15px;">
              From the Pet Wash™ Management Team
            </p>
          </div>

          <div class="section">
            <p style="font-size: 18px; line-height: 1.8;">
              Dear ${recipientName || 'Ido'},
            </p>
            <p>
              As we stand on the threshold of our official launch, the entire Pet Wash™ management team wanted to take a moment to express our deepest gratitude for your exceptional dedication and hard work over the past few months.
            </p>
          </div>

          <div class="section">
            <h2>🌟 Your Impact</h2>
            <p>
              Your contributions have been nothing short of <span class="highlight">remarkable</span>. From the early conceptual stages to the sophisticated, production-ready platform we have today, your expertise, commitment, and innovative thinking have been instrumental in bringing our vision to life.
            </p>

            <div class="achievements">
              <h3>What You've Helped Us Build:</h3>
              <ul>
                <li><strong>Enterprise-Grade Authentication System</strong> - 11 authentication methods including cutting-edge mobile biometric (Face ID/Touch ID) with NIST AAL2 compliance</li>
                <li><strong>World-Class Security & Compliance</strong> - GDPR, HIPAA, and Israeli Privacy Law 2025 compliance with 7-year audit retention</li>
                <li><strong>Premium User Experience</strong> - 6-language support, AI chat assistant, Apple/Google Wallet integration</li>
                <li><strong>Smart Monitoring & Automation</strong> - K9000 station monitoring, automated backups, 30+ background jobs</li>
                <li><strong>Production-Ready Infrastructure</strong> - Automated deployments, comprehensive testing, performance optimization</li>
              </ul>
            </div>
          </div>

          <div class="section">
            <h2>🚀 The Future Looks Bright</h2>
            <p>
              We couldn't be more excited about what lies ahead. The platform you've helped us build is not just a product—it's a testament to what's possible when passion meets expertise. Pet Wash™ is poised to revolutionize the pet care industry, and you've been a cornerstone of this journey.
            </p>

            <div class="stats">
              <div class="stat-card">
                <div class="number">98/100</div>
                <div class="label">Deployment Readiness</div>
              </div>
              <div class="stat-card">
                <div class="number">11/11</div>
                <div class="label">Auth Methods Active</div>
              </div>
              <div class="stat-card">
                <div class="number">6</div>
                <div class="label">Languages Supported</div>
              </div>
              <div class="stat-card">
                <div class="number">30+</div>
                <div class="label">Automated Jobs</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>💙 Our Gratitude</h2>
            <p>
              Your technical brilliance, problem-solving skills, and unwavering dedication have made all the difference. The countless hours you've invested, the challenges you've overcome, and the innovations you've introduced have created something truly special.
            </p>
            <p>
              The Pet Wash™ management team <strong>cannot wait</strong> to see our platform live and serving customers. This is just the beginning, and we're honored to have you as part of our journey.
            </p>
          </div>

          <div class="section">
            <h2>🤝 Looking Forward</h2>
            <p>
              As we move toward launch and beyond, we're excited about the possibilities that lie ahead. Your work has laid a rock-solid foundation for success, and we're confident that the best is yet to come.
            </p>
            <p style="font-size: 18px; margin-top: 30px;">
              Thank you, ${recipientName || 'Ido'}. Thank you for believing in our vision, for your tireless efforts, and for helping us create something that will make a real difference in the lives of pets and their owners.
            </p>
            <p style="font-size: 18px; font-weight: 600; color: #667eea; margin-top: 20px;">
              With immense gratitude and excitement for the future,
            </p>
            <p style="font-size: 18px; font-weight: bold; color: #764ba2;">
              The Pet Wash™ Management Team
            </p>
          </div>

          <div class="quote">
            "Excellence is not a destination; it is a continuous journey that never ends."
          </div>

          <div style="text-align: center;">
            <a href="https://petwash.co.il" class="cta-button">
              Visit Pet Wash™ Platform
            </a>
          </div>

          <div class="footer">
            <div class="logo">🐾 Pet Wash™</div>
            <p>Premium Pet Care Platform</p>
            <p style="font-size: 14px; margin-top: 10px;">
              Launching Soon at: <a href="https://petwash.co.il" style="color: #667eea;">petwash.co.il</a>
            </p>
            <p style="font-size: 12px; margin-top: 20px; color: #9ca3af;">
              This email was sent with appreciation from Pet Wash™ Management<br>
              For inquiries: Support@PetWash.co.il
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData = {
      to: recipientEmail,
      cc: 'nir.h@petwash.co.il',
      from: {
        email: 'Support@PetWash.co.il',
        name: 'Pet Wash™ Management Team'
      },
      subject: '🎉 Heartfelt Thanks & Exciting Future Ahead! - Pet Wash™',
      html: emailContent,
      text: `
Dear ${recipientName || 'Ido'},

As we stand on the threshold of our official launch, the entire Pet Wash™ management team wanted to take a moment to express our deepest gratitude for your exceptional dedication and hard work over the past few months.

YOUR IMPACT

Your contributions have been nothing short of remarkable. From the early conceptual stages to the sophisticated, production-ready platform we have today, your expertise, commitment, and innovative thinking have been instrumental in bringing our vision to life.

What You've Helped Us Build:
- Enterprise-Grade Authentication System (11 methods, NIST AAL2 compliant)
- World-Class Security & Compliance (GDPR, HIPAA, Israeli Law 2025)
- Premium User Experience (6 languages, AI assistant, Wallet integration)
- Smart Monitoring & Automation (K9000 monitoring, 30+ background jobs)
- Production-Ready Infrastructure (Automated deployments, testing, optimization)

THE FUTURE LOOKS BRIGHT

Platform Achievement Highlights:
- Deployment Readiness: 98/100
- Authentication Methods: 11/11 Operational
- Languages Supported: 6
- Automated Systems: 30+ Background Jobs

We couldn't be more excited about what lies ahead. Pet Wash™ is poised to revolutionize the pet care industry, and you've been a cornerstone of this journey.

OUR GRATITUDE

Your technical brilliance, problem-solving skills, and unwavering dedication have made all the difference. The Pet Wash™ management team cannot wait to see our platform live and serving customers.

Thank you for believing in our vision, for your tireless efforts, and for helping us create something that will make a real difference in the lives of pets and their owners.

With immense gratitude and excitement for the future,

The Pet Wash™ Management Team

---
Pet Wash™ - Premium Pet Care Platform
Launching Soon at: https://petwash.co.il
      `.trim()
    };

    await sgMail.send(emailData);

    logger.info('[Thank You Email] Sent successfully', {
      to: recipientEmail,
      cc: 'nir.h@petwash.co.il',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Thank you email sent successfully',
      recipient: recipientEmail,
      cc: 'nir.h@petwash.co.il'
    });

  } catch (error) {
    logger.error('[Thank You Email] Failed to send', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    });
  }
});

export default router;
