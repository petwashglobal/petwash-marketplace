/**
 * Pet Wash™ Platform Copy Email Service
 * Sends luxury formatted platform copy with all 8 platforms
 * November 2025
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { sendLuxuryEmail } from '../email/luxury-email-service';

const router = Router();

const generatePlatformCopyEmail = () => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pet Wash™ Platform Copy 2025 - All 7 Platforms</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa; }
    .container { max-width: 800px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #00C569 0%, #008F46 100%); padding: 50px 40px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.9); margin: 15px 0 0; font-size: 18px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 8px 20px; border-radius: 30px; font-size: 14px; font-weight: 600; margin-top: 20px; }
    .content { padding: 50px 40px; }
    .section-title { color: #1a1a1a; font-size: 24px; margin: 40px 0 25px; border-bottom: 3px solid #00C569; padding-bottom: 12px; font-weight: 700; }
    .platform-card { margin-bottom: 30px; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }
    .platform-header { padding: 25px 30px; display: flex; align-items: center; gap: 20px; }
    .platform-icon { width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: white; }
    .platform-title { flex: 1; }
    .platform-title h3 { margin: 0 0 5px; font-size: 20px; color: #1a1a1a; }
    .platform-title .path { color: #6b7280; font-size: 13px; font-family: monospace; background: #f3f4f6; padding: 3px 10px; border-radius: 4px; display: inline-block; }
    .platform-body { padding: 0 30px 25px; }
    .copy-block { margin-bottom: 20px; }
    .copy-label { font-size: 12px; font-weight: 600; color: #00C569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .copy-en { font-size: 16px; color: #1a1a1a; margin-bottom: 5px; }
    .copy-he { font-size: 16px; color: #374151; direction: rtl; text-align: right; }
    .features { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; }
    .feature-tag { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); color: #065f46; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; }
    .k9000-special { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; }
    .k9000-badge { background: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-block; margin-bottom: 15px; }
    .tech-specs { background: #f8fafc; padding: 20px; border-radius: 12px; margin-top: 15px; }
    .tech-specs p { margin: 8px 0; font-size: 14px; color: #374151; }
    .trust-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .trust-card { background: #f8fafc; padding: 20px; border-radius: 12px; }
    .trust-card strong { display: block; margin-bottom: 8px; font-size: 15px; color: #1a1a1a; }
    .trust-card .en { color: #6b7280; font-size: 14px; margin-bottom: 5px; }
    .trust-card .he { color: #6b7280; font-size: 14px; direction: rtl; text-align: right; }
    .steps { display: flex; gap: 20px; margin: 25px 0; }
    .step { flex: 1; text-align: center; padding: 25px 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 16px; }
    .step-number { width: 50px; height: 50px; background: linear-gradient(135deg, #00C569 0%, #008F46 100%); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; color: white; font-size: 22px; font-weight: bold; }
    .step h4 { margin: 0 0 10px; color: #166534; font-size: 16px; }
    .step p { margin: 0; font-size: 13px; color: #6b7280; }
    .cities { color: #6b7280; line-height: 2; font-size: 15px; }
    .city-badge { display: inline-block; background: #f3f4f6; padding: 6px 14px; border-radius: 20px; margin: 4px; font-size: 13px; }
    .design-box { background: #1a1a1a; padding: 30px; border-radius: 16px; color: white; margin-top: 40px; }
    .design-box h3 { margin: 0 0 20px; color: #00C569; font-size: 18px; }
    .design-box p { margin: 8px 0; font-size: 14px; }
    .design-box .label { color: #9ca3af; }
    .footer { padding: 40px; background: #f8fafc; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { margin: 8px 0; color: #6b7280; font-size: 14px; }
    .hero-preview { background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 50%, #ffffff 100%); padding: 40px; border-radius: 20px; margin-bottom: 40px; border: 1px solid #e5e7eb; }
    .hero-badge { background: linear-gradient(135deg, #00C569 0%, #008F46 100%); color: white; padding: 10px 20px; border-radius: 30px; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; }
    .hero-headline { font-size: 36px; font-weight: 700; color: #1a1a1a; margin: 25px 0 15px; line-height: 1.2; }
    .hero-sub { font-size: 18px; color: #6b7280; margin: 0; }
    .stats-row { display: flex; gap: 20px; margin-top: 25px; }
    .stat-box { flex: 1; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: center; }
    .stat-number { font-size: 28px; font-weight: 700; color: #00C569; }
    .stat-label { font-size: 13px; color: #6b7280; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    
    <!-- Header -->
    <div class="header">
      <h1>Pet Wash™ Platform Copy 2025</h1>
      <p>Luxury Pet Care Ecosystem - 7 Platforms Complete Marketing Content</p>
      <div class="badge">🏆 MadPaws + Rover + TrustedHousesitters Inspired</div>
    </div>

    <div class="content">

      <!-- Hero Section Preview -->
      <h2 class="section-title">🏠 HERO SECTION - Service Discovery Page</h2>
      <div class="hero-preview">
        <div class="hero-badge">✨ 🏆 2025 Award Winner</div>
        <h1 class="hero-headline">Trusted pet care, anytime, anywhere</h1>
        <p class="hero-sub">Find trusted pet sitters & dog walkers near you</p>
        <div class="stats-row">
          <div class="stat-box">
            <div class="stat-number">10,000+</div>
            <div class="stat-label">Verified Providers</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">50,000+</div>
            <div class="stat-label">Happy Pets Served</div>
          </div>
        </div>
        <div style="margin-top: 25px; padding-top: 25px; border-top: 1px dashed #d1d5db;">
          <p style="margin: 0 0 10px; font-weight: 600; color: #1a1a1a;">Hebrew Version:</p>
          <h2 style="font-size: 28px; color: #1a1a1a; margin: 10px 0; direction: rtl; text-align: right;">טיפול אמין בחיות מחמד, בכל זמן, בכל מקום</h2>
          <p style="font-size: 16px; color: #6b7280; direction: rtl; text-align: right;">מצא שמרטפים ומטיילי כלבים מאומתים בסביבתך</p>
        </div>
      </div>

      <!-- All 7 Platforms -->
      <h2 class="section-title">📱 THE 7 SERVICE PLATFORMS</h2>

      <!-- Platform 1: Pet Boarding -->
      <div class="platform-card">
        <div class="platform-header" style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);">
          <div class="platform-icon" style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);">🏠</div>
          <div class="platform-title">
            <h3>1. THE SITTER SUITE™ - Pet Boarding</h3>
            <span class="path">/sitter-suite</span>
          </div>
        </div>
        <div class="platform-body">
          <div class="copy-block">
            <div class="copy-label">English Copy</div>
            <div class="copy-en"><strong>Name:</strong> Pet Boarding</div>
            <div class="copy-en"><strong>Description:</strong> Overnight care in a loving sitter's home</div>
          </div>
          <div class="copy-block">
            <div class="copy-label">Hebrew Copy</div>
            <div class="copy-he"><strong>שם:</strong> פנסיון לחיות מחמד</div>
            <div class="copy-he"><strong>תיאור:</strong> טיפול לילי בבית מארח אוהב</div>
          </div>
        </div>
      </div>

      <!-- Platform 2: House Sitting -->
      <div class="platform-card">
        <div class="platform-header" style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);">
          <div class="platform-icon" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">💜</div>
          <div class="platform-title">
            <h3>2. THE SITTER SUITE™ - House Sitting</h3>
            <span class="path">/sitter-suite</span>
          </div>
        </div>
        <div class="platform-body">
          <div class="copy-block">
            <div class="copy-label">English Copy</div>
            <div class="copy-en"><strong>Name:</strong> House Sitting</div>
            <div class="copy-en"><strong>Description:</strong> Your sitter stays in your home with your pet</div>
          </div>
          <div class="copy-block">
            <div class="copy-label">Hebrew Copy</div>
            <div class="copy-he"><strong>שם:</strong> שמרטפות בבית</div>
            <div class="copy-he"><strong>תיאור:</strong> המטפל נשאר בביתך עם חיית המחמד</div>
          </div>
        </div>
      </div>

      <!-- Platform 3: Doggy Daycare -->
      <div class="platform-card">
        <div class="platform-header" style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);">
          <div class="platform-icon" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);">🧡</div>
          <div class="platform-title">
            <h3>3. THE SITTER SUITE™ - Doggy Daycare</h3>
            <span class="path">/sitter-suite</span>
          </div>
        </div>
        <div class="platform-body">
          <div class="copy-block">
            <div class="copy-label">English Copy</div>
            <div class="copy-en"><strong>Name:</strong> Doggy Daycare</div>
            <div class="copy-en"><strong>Description:</strong> Daytime care while you work</div>
          </div>
          <div class="copy-block">
            <div class="copy-label">Hebrew Copy</div>
            <div class="copy-he"><strong>שם:</strong> מעון יום לכלבים</div>
            <div class="copy-he"><strong>תיאור:</strong> טיפול יומי בזמן שאתה בעבודה</div>
          </div>
        </div>
      </div>

      <!-- Platform 4: Walk My Pet -->
      <div class="platform-card">
        <div class="platform-header" style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);">
          <div class="platform-icon" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">🐕</div>
          <div class="platform-title">
            <h3>4. WALK MY PET™ - Dog Walking</h3>
            <span class="path">/walk-my-pet</span>
          </div>
        </div>
        <div class="platform-body">
          <div class="copy-block">
            <div class="copy-label">English Copy</div>
            <div class="copy-en"><strong>Name:</strong> Dog Walking</div>
            <div class="copy-en"><strong>Description:</strong> 30 or 60 minute walks with GPS tracking</div>
          </div>
          <div class="copy-block">
            <div class="copy-label">Hebrew Copy</div>
            <div class="copy-he"><strong>שם:</strong> טיולי כלבים</div>
            <div class="copy-he"><strong>תיאור:</strong> טיולים של 30 או 60 דקות עם מעקב GPS</div>
          </div>
          <div class="features">
            <span class="feature-tag">✓ Real-time GPS tracking</span>
            <span class="feature-tag">✓ Photo updates</span>
            <span class="feature-tag">✓ Potty break reports</span>
          </div>
        </div>
      </div>

      <!-- Platform 5: PetTrek Transport -->
      <div class="platform-card">
        <div class="platform-header" style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);">
          <div class="platform-icon" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);">🚗</div>
          <div class="platform-title">
            <h3>5. PETTREK™ - Pet Transport</h3>
            <span class="path">/pettrek</span>
          </div>
        </div>
        <div class="platform-body">
          <div class="copy-block">
            <div class="copy-label">English Copy</div>
            <div class="copy-en"><strong>Name:</strong> Pet Transport</div>
            <div class="copy-en"><strong>Description:</strong> Safe transportation to vet, groomer & more</div>
          </div>
          <div class="copy-block">
            <div class="copy-label">Hebrew Copy</div>
            <div class="copy-he"><strong>שם:</strong> הסעות חיות מחמד</div>
            <div class="copy-he"><strong>תיאור:</strong> הסעה בטוחה לווטרינר, מטפח ועוד</div>
          </div>
          <div class="features">
            <span class="feature-tag">✓ GPS tracking</span>
            <span class="feature-tag">✓ Climate-controlled vehicles</span>
            <span class="feature-tag">✓ Professional drivers</span>
          </div>
        </div>
      </div>

      <!-- Platform 6: Academy -->
      <div class="platform-card">
        <div class="platform-header" style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);">
          <div class="platform-icon" style="background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);">🎓</div>
          <div class="platform-title">
            <h3>6. PET WASH ACADEMY™ - Dog Training</h3>
            <span class="path">/academy</span>
          </div>
        </div>
        <div class="platform-body">
          <div class="copy-block">
            <div class="copy-label">English Copy</div>
            <div class="copy-en"><strong>Name:</strong> Dog Training</div>
            <div class="copy-en"><strong>Description:</strong> Private training with certified trainers</div>
          </div>
          <div class="copy-block">
            <div class="copy-label">Hebrew Copy</div>
            <div class="copy-he"><strong>שם:</strong> אילוף כלבים</div>
            <div class="copy-he"><strong>תיאור:</strong> אימון פרטי עם מאלפים מוסמכים</div>
          </div>
          <div class="features">
            <span class="feature-tag">✓ Puppy training</span>
            <span class="feature-tag">✓ Obedience</span>
            <span class="feature-tag">✓ Behavioral modification</span>
          </div>
        </div>
      </div>

      <!-- Platform 7: K9000 Station (SPECIAL) -->
      <div class="platform-card k9000-special">
        <div class="platform-header" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);">
          <div class="platform-icon" style="background: linear-gradient(135deg, #00C569 0%, #008F46 100%);">🚿</div>
          <div class="platform-title">
            <h3>7. K9000™ SMART HUB - Outdoor DIY Pet Wash</h3>
            <span class="path">/k9000</span>
          </div>
        </div>
        <div class="platform-body">
          <div class="k9000-badge">⚠️ PHYSICAL OUTDOOR STATION (Not a marketplace)</div>
          <div class="copy-block">
            <div class="copy-label">English Copy</div>
            <div class="copy-en"><strong>Name:</strong> K9000™ Wash</div>
            <div class="copy-en"><strong>Description:</strong> Self-service wash stations 24/7</div>
          </div>
          <div class="copy-block">
            <div class="copy-label">Hebrew Copy</div>
            <div class="copy-he"><strong>שם:</strong> K9000™ שטיפה</div>
            <div class="copy-he"><strong>תיאור:</strong> עמדות שטיפה בשירות עצמי 24/7</div>
          </div>
          <div class="tech-specs">
            <p><strong>📱 QR Code</strong> - Activation via mobile phone</p>
            <p><strong>💳 Nayax Israel</strong> - Payment terminal (credit card) - API keys pending</p>
            <p><strong>🧴 100% Organic</strong> - Shampoo with Australian Tea Tree Oil</p>
            <p><strong>💡 7-Star LED</strong> - Premium visual experience</p>
            <p><strong>🕐 24/7</strong> - Available around the clock</p>
          </div>
        </div>
      </div>

      <!-- Trust & Safety -->
      <h2 class="section-title">🛡️ TRUST & SAFETY (Pet Wash Protect™)</h2>
      <div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 16px;">
        <p style="margin: 0; font-size: 16px;"><strong>EN:</strong> Book with peace of mind - Every booking is protected by Pet Wash Protect</p>
        <p style="margin: 10px 0 0; font-size: 16px; direction: rtl; text-align: right;"><strong>HE:</strong> הזמן בשקט נפשי - כל הזמנה מוגנת על ידי Pet Wash Protect</p>
      </div>
      <div class="trust-grid">
        <div class="trust-card">
          <strong>🛡️ Background Verified</strong>
          <div class="en">Every provider passes enhanced background checks</div>
          <div class="he">כל נותן שירות עובר בדיקות רקע מורחבות</div>
        </div>
        <div class="trust-card">
          <strong>🏆 ₪25,000 Guarantee</strong>
          <div class="en">Pet Wash Protect covers eligible vet care</div>
          <div class="he">הגנת Pet Wash מכסה טיפול וטרינרי מזכה</div>
        </div>
        <div class="trust-card">
          <strong>📞 24/7 Support</strong>
          <div class="en">Our team is always here when you need us</div>
          <div class="he">הצוות שלנו תמיד כאן כשאתה צריך אותנו</div>
        </div>
        <div class="trust-card">
          <strong>📸 Photo Updates</strong>
          <div class="en">Receive cute photos during every service</div>
          <div class="he">קבל תמונות חמודות במהלך כל שירות</div>
        </div>
        <div class="trust-card">
          <strong>🗺️ GPS Tracking</strong>
          <div class="en">Track walks and transport in real-time</div>
          <div class="he">עקוב אחר טיולים והסעות בזמן אמת</div>
        </div>
        <div class="trust-card">
          <strong>💳 72-Hour Escrow</strong>
          <div class="en">Secure payments via Nayax Israel</div>
          <div class="he">תשלומים מאובטחים דרך Nayax ישראל</div>
        </div>
      </div>

      <!-- How It Works -->
      <h2 class="section-title">📋 HOW IT WORKS - 3 STEPS</h2>
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <h4>Search & Compare</h4>
          <p>EN: Browse verified providers</p>
          <p style="direction: rtl;">HE: חפש והשווה</p>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <h4>Meet & Greet</h4>
          <p>EN: Free meet & greet</p>
          <p style="direction: rtl;">HE: פגישת היכרות</p>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <h4>Book & Relax</h4>
          <p>EN: Book securely</p>
          <p style="direction: rtl;">HE: הזמן ותירגע</p>
        </div>
      </div>

      <!-- Cities -->
      <h2 class="section-title">📍 CITIES WE SERVE (Israel)</h2>
      <div class="cities">
        <span class="city-badge">Tel Aviv</span>
        <span class="city-badge">Jerusalem</span>
        <span class="city-badge">Haifa</span>
        <span class="city-badge">Herzliya</span>
        <span class="city-badge">Ramat Gan</span>
        <span class="city-badge">Netanya</span>
        <span class="city-badge">Beer Sheva</span>
        <span class="city-badge">Ashdod</span>
        <span class="city-badge">Rishon LeZion</span>
        <span class="city-badge">Petah Tikva</span>
        <span class="city-badge">Eilat</span>
        <span class="city-badge">Kfar Saba</span>
        <span class="city-badge">Ra'anana</span>
        <span class="city-badge">Modiin</span>
        <span class="city-badge">Rehovot</span>
        <span class="city-badge">Holon</span>
      </div>

      <!-- Design Specs -->
      <div class="design-box">
        <h3>🎨 2025 LUXURY DESIGN SPECIFICATIONS</h3>
        <p><span class="label">Primary Color:</span> Metallic Emerald Gradient (#00C569 → #008F46)</p>
        <p><span class="label">Background:</span> Pure White</p>
        <p><span class="label">Style:</span> Fashion-brand layouts, glassmorphism, Apple-style animations</p>
        <p><span class="label">Feel:</span> 7-Star Premium, Luxury White</p>
        <p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;"><span class="label">Inspiration Sources:</span> MadPaws (AU), Rover (USA), Wag (USA), TrustedHousesitters (Global)</p>
      </div>

    </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong>Pet Wash™ - Premium Organic Pet Care Ecosystem</strong></p>
      <p>Document generated: November 2025</p>
      <p style="font-size: 12px; color: #9ca3af;">Full Markdown document available at: docs/PETWASH_PLATFORM_COPY_2025.md</p>
      <p style="font-size: 12px; color: #9ca3af;">Live preview at: /services</p>
    </div>

  </div>
</body>
</html>
`;

  return {
    subject: '🐾 Pet Wash™ Platform Copy 2025 - All 7 Platforms (Visual Preview + Copy)',
    html
  };
};

/**
 * POST /api/admin/send-platform-copy
 * Sends the platform copy email to specified address
 */
router.post('/send-platform-copy', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    const { subject, html } = generatePlatformCopyEmail();

    const sent = await sendLuxuryEmail({
      to: email,
      subject,
      html,
      from: {
        email: 'Support@PetWash.co.il',
        name: 'Pet Wash™ Platform Team'
      }
    });

    if (sent) {
      logger.info('[Platform Copy] Email sent successfully', { to: email });
      return res.json({
        success: true,
        message: `Platform copy email sent to ${email}`
      });
    } else {
      logger.warn('[Platform Copy] Email not sent - SendGrid may not be configured');
      return res.json({
        success: false,
        message: 'Email service not configured. Content saved to docs/PETWASH_PLATFORM_COPY_2025.md',
        previewHtml: html
      });
    }
  } catch (error) {
    logger.error('[Platform Copy] Error sending email', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send email'
    });
  }
});

/**
 * GET /api/admin/platform-copy-preview
 * Returns the HTML preview without sending email
 */
router.get('/platform-copy-preview', async (_req: Request, res: Response) => {
  const { html } = generatePlatformCopyEmail();
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
